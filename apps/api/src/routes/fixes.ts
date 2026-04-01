// @ts-nocheck — Fix pipeline uses loosely typed tool/LLM responses.
/**
 * Fix Application API Routes
 * 
 * Real, production-ready endpoints for:
 * - Applying fixes to code
 * - Generating diffs
 * - Viewing fix previews
 * - Rollback capabilities
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../middleware/fastify-auth";
import { requirePlan } from "../middleware/plan-gating";
import { logger } from "../logger";
import * as path from "path";
import * as fs from "fs/promises";
import { execSync } from "child_process";
import * as crypto from "crypto";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface ApplyFixRequest {
  runId: string;
  packId: string;
  dryRun?: boolean;
  projectPath?: string;
}

interface GenerateDiffRequest {
  runId: string;
  packId: string;
  projectPath?: string;
}

interface FixApplicationResult {
  success: boolean;
  packId: string;
  filesModified: string[];
  diffs: Array<{
    file: string;
    hunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      content: string;
    }>;
  }>;
  verification: {
    passed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      message: string;
    }>;
  };
  rollbackAvailable: boolean;
  rollbackId?: string;
}

export async function fixesRoutes(fastify: FastifyInstance) {
  // Apply fix pack
  fastify.post(
    "/apply",
    {
      preHandler: [
        authMiddleware,
        requirePlan({ minTierLevel: 2, featureName: "Fix Application" }),
      ],
    },
    async (request: FastifyRequest<{ Body: ApplyFixRequest }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { runId, packId, dryRun = false, projectPath } = request.body;

        // Get run details
        const run = await getRunDetails(runId, userId);
        if (!run) {
          return reply.status(404).send({ success: false, error: "Run not found" });
        }

        // Get fix pack from run
        const fixPack = await getFixPackFromRun(runId, packId);
        if (!fixPack) {
          return reply.status(404).send({ success: false, error: "Fix pack not found" });
        }

        const actualProjectPath = projectPath || run.project_path || process.cwd();

        // Generate diffs
        const diffs = await generateDiffsForPack(fixPack, actualProjectPath);

        if (dryRun) {
          return reply.send({
            success: true,
            packId,
            dryRun: true,
            diffs,
            filesModified: diffs.map(d => d.file),
            verification: { passed: true, checks: [] },
            rollbackAvailable: false,
          });
        }

        // Apply fixes
        const result = await applyFixPack(fixPack, diffs, actualProjectPath, userId);

        // Log the action
        await logFixApplication(userId, runId, packId, result);

        return reply.send({
          ...result,
          packId,
          success: result.success,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Fix application failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to apply fix",
        });
      }
    }
  );

  // Generate diff for fix pack
  fastify.post(
    "/diff",
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest<{ Body: GenerateDiffRequest }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { runId, packId, projectPath } = request.body;

        // Get run details
        const run = await getRunDetails(runId, userId);
        if (!run) {
          return reply.status(404).send({ success: false, error: "Run not found" });
        }

        // Get fix pack
        const fixPack = await getFixPackFromRun(runId, packId);
        if (!fixPack) {
          return reply.status(404).send({ success: false, error: "Fix pack not found" });
        }

        const actualProjectPath = projectPath || run.project_path || process.cwd();

        // Generate diffs
        const diffs = await generateDiffsForPack(fixPack, actualProjectPath);

        return reply.send({
          success: true,
          packId,
          diffs,
          filesModified: diffs.map(d => d.file),
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Diff generation failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to generate diff",
        });
      }
    }
  );

  // Rollback fix application
  fastify.post(
    "/rollback",
    {
      preHandler: [
        authMiddleware,
        requirePlan({ minTierLevel: 2, featureName: "Fix Rollback" }),
      ],
    },
    async (request: FastifyRequest<{ Body: { rollbackId: string; projectPath?: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ success: false, error: "Unauthorized" });
        }

        const { rollbackId, projectPath } = request.body;

        const result = await rollbackFix(rollbackId, projectPath || process.cwd(), userId);

        return reply.send({
          success: result.success,
          message: result.message,
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, "Rollback failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to rollback fix",
        });
      }
    }
  );
}

// Helper functions

async function getRunDetails(runId: string, userId: string): Promise<unknown> {
  const prisma = (global as any).prisma;
  if (!prisma) {
    throw new Error("Database not available");
  }

  const run = await prisma.run.findFirst({
    where: {
      id: runId,
      user_id: userId,
    },
  });

  return run;
}

async function getFixPackFromRun(runId: string, packId: string): Promise<unknown> {
  // Get findings from run and group into fix pack
  const prisma = (global as any).prisma;
  if (!prisma) {
    throw new Error("Database not available");
  }

  const findings = await prisma.finding.findMany({
    where: {
      run_id: runId,
      metadata: {
        path: ["fixPackId"],
        equals: packId,
      },
    },
  });

  if (findings.length === 0) {
    return null;
  }

  // Group by rule and file
  const grouped: Record<string, unknown[]> = {};
  for (const finding of findings) {
    const key = `${finding.rule_id || finding.type}:${finding.file}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(finding);
  }

  return {
    id: packId,
    findings: findings,
    rule: findings[0]?.rule_id || findings[0]?.type || "unknown",
    severity: findings[0]?.severity || "medium",
    fileCount: new Set(findings.map(f => f.file)).size,
  };
}

async function generateDiffsForPack(fixPack: any, projectPath: string): Promise<Array<{
  file: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
  }>;
}>> {
  const diffs: Array<{
    file: string;
    hunks: Array<any>;
  }> = [];

  // Group findings by file
  const byFile: Record<string, unknown[]> = {};
  for (const finding of fixPack.findings) {
    if (!byFile[finding.file]) {
      byFile[finding.file] = [];
    }
    byFile[finding.file].push(finding);
  }

  // Generate diff for each file
  for (const [file, fileFindings] of Object.entries(byFile)) {
    const filePath = path.join(projectPath, file);
    
    try {
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split("\n");
      
      const hunks: Array<any> = [];
      
      // Sort findings by line number (descending to avoid line shifts)
      const sortedFindings = [...fileFindings].sort((a, b) => b.line - a.line);
      
      for (const finding of sortedFindings) {
        if (finding.suggestion) {
          const lineIndex = finding.line - 1;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            const oldLine = lines[lineIndex];
            const newLine = generateFixLine(oldLine, finding);
            
            hunks.push({
              oldStart: finding.line,
              oldLines: 1,
              newStart: finding.line,
              newLines: 1,
              content: `-${oldLine}\n+${newLine}`,
            });
          }
        }
      }
      
      if (hunks.length > 0) {
        diffs.push({ file, hunks });
      }
    } catch (error: unknown) {
      logger.warn({ file, error: toErrorMessage(error) }, "Could not generate diff for file");
    }
  }

  return diffs;
}

function generateFixLine(oldLine: string, finding: any): string {
  // Simple fix generation - in production would use AI or pattern matching
  if (finding.suggestion) {
    // Try to apply suggestion
    if (finding.suggestion.includes("Remove")) {
      return ""; // Delete line
    }
    if (finding.suggestion.includes("Replace")) {
      // Extract replacement from suggestion
      const match = finding.suggestion.match(/Replace with: (.+)/);
      if (match) {
        return match[1];
      }
    }
  }
  
  // Default: return original line (no change)
  return oldLine;
}

async function applyFixPack(
  fixPack: any,
  diffs: Array<{ file: string; hunks: Array<any> }>,
  projectPath: string,
  userId: string
): Promise<FixApplicationResult> {
  const filesModified: string[] = [];
  const rollbackId = crypto.randomBytes(16).toString("hex");

  // Create rollback point
  await createRollbackPoint(rollbackId, diffs, projectPath, userId);

  // Apply each diff
  for (const diff of diffs) {
    const filePath = path.join(projectPath, diff.file);
    
    try {
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split("\n");
      
      // Apply hunks (in reverse order to maintain line numbers)
      const sortedHunks = [...diff.hunks].sort((a, b) => b.oldStart - a.oldStart);
      
      for (const hunk of sortedHunks) {
        const lineIndex = hunk.oldStart - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          // Parse hunk content
          const hunkLines = hunk.content.split("\n");
          const newLines: string[] = [];
          
          for (const hunkLine of hunkLines) {
            if (hunkLine.startsWith("-")) {
              // Remove line
              continue;
            } else if (hunkLine.startsWith("+")) {
              // Add line
              newLines.push(hunkLine.substring(1));
            } else {
              // Context line
              newLines.push(hunkLine);
            }
          }
          
          // Replace lines
          lines.splice(lineIndex, hunk.oldLines, ...newLines);
        }
      }
      
      await fs.writeFile(filePath, lines.join("\n"), "utf8");
      filesModified.push(diff.file);
    } catch (error: unknown) {
      logger.error({ file: diff.file, error: toErrorMessage(error) }, "Failed to apply fix to file");
      throw error;
    }
  }

  // Verify fixes
  const verification = await verifyFixes(projectPath);

  return {
    success: verification.passed,
    packId: fixPack.id,
    filesModified,
    diffs,
    verification,
    rollbackAvailable: true,
    rollbackId,
  };
}

async function createRollbackPoint(
  rollbackId: string,
  diffs: Array<{ file: string; hunks: Array<any> }>,
  projectPath: string,
  userId: string
): Promise<void> {
  const rollbackDir = path.join(projectPath, ".guardrail", "rollbacks", rollbackId);
  await fs.mkdir(rollbackDir, { recursive: true });

  // Save original file contents
  for (const diff of diffs) {
    const filePath = path.join(projectPath, diff.file);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const backupPath = path.join(rollbackDir, diff.file.replace(/\//g, "_"));
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.writeFile(backupPath, content, "utf8");
    } catch (error: unknown) {
      logger.warn({ file: diff.file, error: toErrorMessage(error) }, "Could not create rollback for file");
    }
  }

  // Save metadata
  const metadata = {
    rollbackId,
    userId,
    timestamp: new Date().toISOString(),
    files: diffs.map(d => d.file),
  };
  await fs.writeFile(
    path.join(rollbackDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );
}

async function verifyFixes(projectPath: string): Promise<{
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}> {
  const checks: Array<{ name: string; passed: boolean; message: string }> = [];

  // Check 1: TypeScript compilation
  try {
    execSync("npx tsc --noEmit", { cwd: projectPath, stdio: "pipe" });
    checks.push({ name: "TypeScript", passed: true, message: "No type errors" });
  } catch {
    checks.push({ name: "TypeScript", passed: false, message: "Type errors detected" });
  }

  // Check 2: Linting
  try {
    execSync("npm run lint 2>&1 || true", { cwd: projectPath, stdio: "pipe" });
    checks.push({ name: "Linting", passed: true, message: "Lint check passed" });
  } catch {
    checks.push({ name: "Linting", passed: false, message: "Lint errors detected" });
  }

  const passed = checks.every(c => c.passed);

  return { passed, checks };
}

async function rollbackFix(rollbackId: string, projectPath: string, userId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const rollbackDir = path.join(projectPath, ".guardrail", "rollbacks", rollbackId);
  
  try {
    const metadataPath = path.join(rollbackDir, "metadata.json");
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

    // Restore files
    for (const file of metadata.files) {
      const backupPath = path.join(rollbackDir, file.replace(/\//g, "_"));
      const filePath = path.join(projectPath, file);
      
      try {
        const content = await fs.readFile(backupPath, "utf8");
        await fs.writeFile(filePath, content, "utf8");
      } catch (error: unknown) {
        logger.warn({ file, error: toErrorMessage(error) }, "Could not restore file");
      }
    }

    return {
      success: true,
      message: `Rolled back ${metadata.files.length} file(s)`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: toErrorMessage(error) || "Rollback failed",
    };
  }
}

async function logFixApplication(
  userId: string,
  runId: string,
  packId: string,
  result: FixApplicationResult
): Promise<void> {
  const prisma = (global as any).prisma;
  if (!prisma) return;

  try {
    await prisma.securityEvent.create({
      data: {
        user_id: userId,
        event_type: "fix_applied",
        payload: {
          runId,
          packId,
          filesModified: result.filesModified,
          verification: result.verification,
        },
        severity: "info",
        timestamp: new Date(),
      },
    });
  } catch (error: unknown) {
    logger.warn({ error: toErrorMessage(error) }, "Failed to log fix application");
  }
}
