/**
 * Background run pipeline (security + reality + guardrails)
 */
import { pool } from "@guardrail/database";
import { SecretsGuardian } from "guardrail-security";
import * as fs from "fs";
import { existsSync, readFileSync } from "fs";
import * as path from "path";
import { logger } from "../logger";
import { GitHubCloner } from "./github-cloner";
import { PlaywrightAgent } from "./playwright-agent";
import { realtimeEventsService } from "./realtime-events";
import type {
  GuardrailResult,
  RealityResult,
  SecurityResult,
} from "./runs-types";

export interface RunExecutionOptions {
  repo: string;
  branch: string;
  projectPath?: string;
  runSecurity: boolean;
  runReality: boolean;
  runGuardrails: boolean;
}

function scanProjectFiles(projectPath: string): string[] {
  const files: string[] = [];
  const excludeDirs = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    "__pycache__",
  ];
  const includeExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".java",
    ".rb",
    ".rs",
  ];

  const walkDir = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            !excludeDirs.includes(entry.name) &&
            !entry.name.startsWith(".")
          ) {
            walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (includeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      logger.warn({ error: err }, "Failed to process scan metadata");
    }
  };

  walkDir(projectPath);
  return files.slice(0, 500);
}

export function getArtifactContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".zip": "application/zip",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".html": "text/html",
    ".txt": "text/plain",
  };
  return types[ext] || "application/octet-stream";
}

export async function executeRunPipeline(
  runId: string,
  userId: string,
  opts: RunExecutionOptions,
): Promise<void> {
  const { repo, branch, projectPath, runSecurity, runReality, runGuardrails } = opts;
  let clonedProjectPath: string | null = null;
  let actualProjectPath = projectPath;
  
  try {
    logger.info({ runId, repo, branch }, "Starting combined run");

    // Emit running status
    realtimeEventsService.emitStatus(runId, userId, "running");
    realtimeEventsService.emitProgress(runId, userId, 5);
    realtimeEventsService.emitLog(runId, userId, `Starting run for ${repo}@${branch}`);

    let securityResult: SecurityResult | null = null;
    let realityResult: RealityResult | null = null;
    let guardrailResult: GuardrailResult | null = null;
    let verdict = "pass";
    let score = 100;
    let traceUrl: string | null = null;
    let videoUrl: string | null = null;

    await pool.query(
      `UPDATE runs SET progress = 10, status = 'running' WHERE id = $1`,
      [runId],
    );
    
    realtimeEventsService.emitProgress(runId, userId, 10);

    // Handle GitHub repository cloning if no projectPath provided
    if (!projectPath && repo.includes("/")) {
      try {
        logger.info({ runId, repo }, "Cloning GitHub repository");
        const cloneResult = await GitHubCloner.cloneRepository(userId, repo);
        clonedProjectPath = cloneResult.projectPath;
        actualProjectPath = cloneResult.projectPath;
        
        // Update run with repository info
        await pool.query(
          `UPDATE runs SET repository_id = $1 WHERE id = $2`,
          [cloneResult.repoInfo.id, runId]
        );
        
        logger.info({ runId, repo, clonedProjectPath }, "GitHub repository cloned successfully");
      } catch (cloneError: any) {
        logger.error({ runId, repo, error: cloneError.message }, "Failed to clone GitHub repository");
        throw new Error(`Failed to clone repository ${repo}: ${cloneError.message}`);
      }
    }

    if (runSecurity) {
      try {
        const guardian = new SecretsGuardian();

        if (actualProjectPath && existsSync(actualProjectPath)) {
          const scanReport = await guardian.scanProject(
            actualProjectPath,
            runId,
            {
              excludeTests: false,
              minConfidence: 0.5,
            },
          );

          const byRisk = scanReport.summary.byRisk;
          securityResult = {
            verdict:
              byRisk.high > 0
                ? "fail"
                : byRisk.medium > 2
                  ? "review"
                  : "pass",
            critical: byRisk.high,
            high: byRisk.high,
            medium: byRisk.medium,
            low: byRisk.low,
            total: scanReport.summary.totalSecrets,
            scannedFiles: scanReport.scannedFiles,
            totalFiles: scanReport.totalFiles,
            detections: scanReport.detections.slice(0, 20).map((d) => ({
              filePath: d.filePath,
              secretType: d.secretType,
              maskedValue: d.maskedValue,
              line: d.location.line,
              confidence: d.confidence,
              isTest: d.isTest,
              recommendation: d.recommendation.action,
            })),
            byType: scanReport.summary.byType as Record<string, number>,
          };
        } else {
          const securityQuery = `
            SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE severity = 'critical') as critical,
              COUNT(*) FILTER (WHERE severity = 'high') as high,
              COUNT(*) FILTER (WHERE severity = 'medium') as medium,
              COUNT(*) FILTER (WHERE severity = 'low') as low
            FROM findings
            WHERE user_id = $1 AND repo ILIKE $2 AND status = 'open'
          `;
          const secResult = await pool.query(securityQuery, [
            userId,
            `%${repo}%`,
          ]);
          const stats = secResult.rows[0] || {};

          securityResult = {
            verdict:
              parseInt(stats.critical) > 0 || parseInt(stats.high) > 2
                ? "fail"
                : "pass",
            critical: parseInt(stats.critical) || 0,
            high: parseInt(stats.high) || 0,
            medium: parseInt(stats.medium) || 0,
            low: parseInt(stats.low) || 0,
            total: parseInt(stats.total) || 0,
            note: "No projectPath provided - using existing findings from database",
          };
        }

        if (securityResult) {
          if (securityResult.verdict === "fail") {
            verdict = "fail";
            score -= 30;
          } else if (
            securityResult.verdict === "review" ||
            (securityResult.medium ?? 0) > 5
          ) {
            score -= 10;
          }
        }
      } catch (secError: any) {
        logger.error(
          { runId, error: secError.message },
          "Security check error",
        );
        securityResult = { verdict: "error", error: secError.message };
      }
    }

    await pool.query(
      `UPDATE runs SET progress = 40, security_result = $2 WHERE id = $1`,
      [runId, JSON.stringify(securityResult)],
    );
    
    realtimeEventsService.emitProgress(runId, userId, 40);
    realtimeEventsService.emitLog(
      runId,
      userId,
      `Security scan complete: ${securityResult?.verdict || "unknown"}`,
    );

    if (runReality && actualProjectPath) {
      try {
        const agent = new PlaywrightAgent(actualProjectPath);
        const testResult = await agent.runTests({
          captureTrace: true,
          captureVideo: true,
          timeout: 180000,
        });

        realityResult = {
          verdict: testResult.verdict,
          totalTests: testResult.totalTests,
          passed: testResult.passed,
          failed: testResult.failed,
          skipped: testResult.skipped,
          duration: testResult.duration,
          failures: testResult.failures.slice(0, 10),
        };

        if (testResult.traceFiles.length > 0) {
          traceUrl = testResult.traceFiles[0];
        }
        if (testResult.videoFiles.length > 0) {
          videoUrl = testResult.videoFiles[0];
        }

        if (testResult.verdict === "fail") {
          verdict = "fail";
          score -= 40;
        } else if (testResult.verdict === "error") {
          score -= 20;
        }
      } catch (realityError: any) {
        logger.error(
          { runId, error: realityError.message },
          "Reality check error",
        );
        realityResult = {
          verdict: "error",
          error: realityError.message,
        };
      }
    } else if (runReality) {
      realityResult = {
        verdict: "skipped",
        message: "No projectPath provided for reality check",
      };
    }

    await pool.query(
      `UPDATE runs SET progress = 70, reality_result = $2 WHERE id = $1`,
      [runId, JSON.stringify(realityResult)],
    );
    
    realtimeEventsService.emitProgress(runId, userId, 70);
    realtimeEventsService.emitLog(
      runId,
      userId,
      `Reality check complete: ${realityResult?.verdict || "unknown"}`,
    );

    if (runGuardrails) {
      try {
        const violations: string[] = [];
        const findings: Array<{
          file: string;
          type: string;
          severity: string;
        }> = [];
        let guardrailScore = 100;

        const checks = {
          noMockData: true,
          noHardcodedSecrets: true,
          realApiCalls: realityResult?.verdict === "pass",
          properErrorHandling: true,
          noEval: true,
          noConsoleLog: true,
          balancedBraces: true,
        };

        if (projectPath && existsSync(projectPath)) {
          const filesToScan = await scanProjectFiles(projectPath);

          for (const file of filesToScan) {
            try {
              const content = readFileSync(file, "utf-8");

              if (
                /mock|fake|dummy|placeholder|lorem|example\.com|test@test/i.test(
                  content,
                )
              ) {
                checks.noMockData = false;
                violations.push(
                  `Mock/placeholder data detected in ${path.basename(file)}`,
                );
                findings.push({
                  file: path.basename(file),
                  type: "mock_data",
                  severity: "warning",
                });
                guardrailScore -= 5;
              }

              if (/\beval\s*\(/.test(content)) {
                checks.noEval = false;
                violations.push(
                  `eval() usage detected in ${path.basename(file)}`,
                );
                findings.push({
                  file: path.basename(file),
                  type: "eval_usage",
                  severity: "error",
                });
                guardrailScore -= 15;
              }

              if (
                /console\.(log|debug|info)\s*\(/.test(content) &&
                !file.includes("test")
              ) {
                checks.noConsoleLog = false;
                findings.push({
                  file: path.basename(file),
                  type: "console_log",
                  severity: "info",
                });
                guardrailScore -= 2;
              }

              const openBraces = (content.match(/{/g) || []).length;
              const closeBraces = (content.match(/}/g) || []).length;
              if (openBraces !== closeBraces) {
                checks.balancedBraces = false;
                violations.push(
                  `Unbalanced braces in ${path.basename(file)}`,
                );
                findings.push({
                  file: path.basename(file),
                  type: "syntax_error",
                  severity: "error",
                });
                guardrailScore -= 10;
              }
            } catch (fileError) {
              logger.warn({ error: fileError, file }, "Failed to analyze file for syntax errors");
            }
          }
        }

        if (
          securityResult?.verdict === "fail" ||
          (securityResult?.total && securityResult.total > 0)
        ) {
          checks.noHardcodedSecrets = false;
          violations.push(
            "Hardcoded secrets detected in security scan",
          );
          guardrailScore -= 20;
        }

        if (!checks.realApiCalls && runReality) {
          violations.push("API calls not verified by reality check");
          guardrailScore -= 5;
        }

        guardrailScore = Math.max(0, Math.min(100, guardrailScore));
        const guardrailVerdict =
          guardrailScore >= 80
            ? "pass"
            : guardrailScore >= 60
              ? "review"
              : "fail";

        guardrailResult = {
          verdict: guardrailVerdict,
          score: guardrailScore,
          checks,
          violations,
          findings: findings.slice(0, 20),
          filesScanned: actualProjectPath
            ? (await scanProjectFiles(actualProjectPath)).length
            : 0,
        };

        if (guardrailResult.verdict === "fail") {
          verdict = "fail";
          score -= 30;
        } else if (guardrailResult.verdict === "review") {
          score -= 10;
        }
      } catch (guardrailError: any) {
        logger.error(
          { runId, error: guardrailError.message },
          "guardrail check error",
        );
        guardrailResult = {
          verdict: "error",
          error: guardrailError.message,
        };
      }
    }

    score = Math.max(0, Math.min(100, score));
    if (score < 60) verdict = "fail";
    else if (score < 80) verdict = "review";

    await pool.query(
      `UPDATE runs SET 
        status = 'completed',
        progress = 100,
        verdict = $2,
        score = $3,
        security_result = $4,
        reality_result = $5,
        guardrail_result = $6,
        trace_url = $7,
        video_url = $8,
        completed_at = NOW()
      WHERE id = $1`,
      [
        runId,
        verdict,
        score,
        JSON.stringify(securityResult),
        JSON.stringify(realityResult),
        JSON.stringify(guardrailResult),
        traceUrl,
        videoUrl,
      ],
    );

    // Emit completion
    realtimeEventsService.emitProgress(runId, userId, 100);
    realtimeEventsService.emitLog(
      runId,
      userId,
      `Run completed: ${verdict} (score: ${score})`,
    );
    realtimeEventsService.emitStatus(runId, userId, "complete");

    logger.info({ runId, verdict, score }, "Run completed");
  } catch (runError) {
    const errorMessage = runError instanceof Error ? runError.message : "Unknown error";
    logger.error({ runId, error: runError }, "Run error");
    await pool.query(
      `UPDATE runs SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [runId],
    );
    
    // Emit error
    realtimeEventsService.emitLog(runId, userId, `Run failed: ${errorMessage}`);
    realtimeEventsService.emitStatus(runId, userId, "error", errorMessage);
  } finally {
    // Clean up cloned repository if it was created
    if (clonedProjectPath) {
      await GitHubCloner.cleanupClone(clonedProjectPath);
    }
  }
}
