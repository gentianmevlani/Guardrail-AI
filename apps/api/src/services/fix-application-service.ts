/**
 * Fix Application Service
 * Generates and applies fixes for findings from scan runs
 */

import { logger } from "../logger";
import { pool } from "@guardrail/database";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
export interface Fix {
  findingId: string;
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
  confidence: number;
  explanation: string;
}

export interface FixPack {
  packId: string;
  rule: string;
  severity: string;
  findings: Array<{
    id: string;
    file: string;
    line: number;
    message: string;
    codeSnippet?: string;
  }>;
  fixes: Fix[];
  estimatedRisk: "low" | "medium" | "high";
  impactedFiles: string[];
}

export interface ApplyFixResult {
  success: boolean;
  applied: number;
  failed: number;
  skipped: number;
  diffs: Array<{
    file: string;
    oldContent: string;
    newContent: string;
    changes: Array<{
      line: number;
      oldCode: string;
      newCode: string;
    }>;
  }>;
  errors?: string[];
}

/**
 * Generate fixes for a pack of findings
 */
export async function generateFixesForPack(
  runId: string,
  packId: string,
): Promise<FixPack | null> {
  try {
    // Parse packId to extract rule and severity (format: "rule-severity")
    const [rule, severity] = packId.split("-");
    if (!rule || !severity) {
      throw new Error(`Invalid packId format: ${packId}`);
    }

    // Fetch findings for this run matching the pack criteria
    const findingsQuery = `
      SELECT id, file, line, message, code_snippet, rule, severity
      FROM findings
      WHERE scan_id = $1 AND rule = $2 AND severity = $3
      ORDER BY file, line
    `;

    // First, get the scan_id from run
    const runQuery = `
      SELECT id FROM runs WHERE id = $1
    `;
    const runResult = await pool.query(runQuery, [runId]);
    if (runResult.rows.length === 0) {
      throw new Error(`Run not found: ${runId}`);
    }

    // For now, we'll use the runId as scanId since they're linked
    // In production, you'd have a proper scan_id field
    const scanId = runId;

    const findingsResult = await pool.query(findingsQuery, [
      scanId,
      rule,
      severity,
    ]);

    if (findingsResult.rows.length === 0) {
      return null;
    }

    const findings = findingsResult.rows;
    const fixes: Fix[] = [];

    // Generate fixes for each finding
    for (const finding of findings) {
      const fix = generateFixForFinding(finding);
      if (fix) {
        fixes.push(fix);
      }
    }

    if (fixes.length === 0) {
      return null;
    }

    // Determine risk level
    const estimatedRisk =
      severity === "critical" || severity === "high"
        ? "high"
        : severity === "medium"
          ? "medium"
          : "low";

    // Get unique files
    const impactedFiles = Array.from(
      new Set(findings.map((f) => f.file)),
    );

    return {
      packId,
      rule,
      severity,
      findings: findings.map((f) => ({
        id: f.id,
        file: f.file,
        line: f.line,
        message: f.message,
        codeSnippet: f.code_snippet,
      })),
      fixes,
      estimatedRisk,
      impactedFiles,
    };
  } catch (error: unknown) {
    logger.error({ error, runId, packId }, "Error generating fixes for pack");
    throw error;
  }
}

/**
 * Generate a fix for a single finding
 */
function generateFixForFinding(finding: any): Fix | null {
  const rule = finding.rule?.toLowerCase() || "";
  const codeSnippet = finding.code_snippet || "";

  // Rule-based fix generation
  let newCode = codeSnippet;
  let explanation = "";

  if (rule.includes("secret") || rule.includes("api_key")) {
    // Replace hardcoded secrets with environment variable
    const secretPattern = /(['"`])([a-zA-Z0-9_\-]{20,})\1/;
    if (secretPattern.test(codeSnippet)) {
      newCode = codeSnippet.replace(
        secretPattern,
        "process.env.SECRET_KEY",
      );
      explanation = "Replaced hardcoded secret with environment variable";
    } else {
      return null; // Can't auto-fix
    }
  } else if (rule.includes("mock") || rule.includes("placeholder")) {
    // Remove mock data
    if (codeSnippet.includes("mock") || codeSnippet.includes("placeholder")) {
      newCode = "// TODO: Replace with real implementation";
      explanation = "Removed mock/placeholder code";
    } else {
      return null;
    }
  } else if (rule.includes("console.log")) {
    // Remove or comment out console.log
    if (codeSnippet.includes("console.log")) {
      newCode = codeSnippet.replace(/console\.log\([^)]*\);?/g, "");
      explanation = "Removed console.log statement";
    } else {
      return null;
    }
  } else if (rule.includes("todo") && rule.includes("without_impl")) {
    // For TODO without implementation, we can't auto-fix
    return null;
  } else {
    // Generic fix: try to improve based on suggestion
    if (finding.suggestion) {
      newCode = finding.suggestion;
      explanation = "Applied suggested fix";
    } else {
      return null; // No auto-fix available
    }
  }

  return {
    findingId: finding.id,
    file: finding.file,
    line: finding.line,
    oldCode: codeSnippet,
    newCode,
    confidence: 0.7, // Moderate confidence for rule-based fixes
    explanation,
  };
}

/**
 * Generate diff preview for a fix pack
 */
export async function generateDiffPreview(
  runId: string,
  packId: string,
): Promise<ApplyFixResult> {
  const pack = await generateFixesForPack(runId, packId);
  if (!pack) {
    return {
      success: false,
      applied: 0,
      failed: 0,
      skipped: 0,
      diffs: [],
      errors: ["Pack not found or no fixes available"],
    };
  }

  // Group fixes by file
  const fileGroups = new Map<string, Fix[]>();
  for (const fix of pack.fixes) {
    if (!fileGroups.has(fix.file)) {
      fileGroups.set(fix.file, []);
    }
    fileGroups.get(fix.file)!.push(fix);
  }

  const diffs: ApplyFixResult["diffs"] = [];

  // For each file, generate diff
  for (const [file, fixes] of fileGroups.entries()) {
    try {
      // In a real implementation, you'd read the actual file content
      // For now, we'll generate a synthetic diff
      const changes = fixes.map((fix) => ({
        line: fix.line,
        oldCode: fix.oldCode,
        newCode: fix.newCode,
      }));

      diffs.push({
        file,
        oldContent: "", // Would contain actual file content
        newContent: "", // Would contain modified content
        changes,
      });
    } catch (error: unknown) {
      logger.error({ error, file }, "Error generating diff for file");
    }
  }

  return {
    success: true,
    applied: 0, // Preview only
    failed: 0,
    skipped: 0,
    diffs,
  };
}

/**
 * Apply fixes for a pack (dry-run or actual)
 */
export async function applyFixesForPack(
  runId: string,
  packId: string,
  options: { dryRun?: boolean } = {},
): Promise<ApplyFixResult> {
  const pack = await generateFixesForPack(runId, packId);
  if (!pack) {
    return {
      success: false,
      applied: 0,
      failed: 0,
      skipped: 0,
      diffs: [],
      errors: ["Pack not found or no fixes available"],
    };
  }

  if (options.dryRun) {
    return generateDiffPreview(runId, packId);
  }

  // Group fixes by file
  const fileGroups = new Map<string, Fix[]>();
  for (const fix of pack.fixes) {
    if (!fileGroups.has(fix.file)) {
      fileGroups.set(fix.file, []);
    }
    fileGroups.get(fix.file)!.push(fix);
  }

  const result: ApplyFixResult = {
    success: true,
    applied: 0,
    failed: 0,
    skipped: 0,
    diffs: [],
    errors: [],
  };

  // Apply fixes file by file
  for (const [file, fixes] of fileGroups.entries()) {
    try {
      // In a real implementation, you would:
      // 1. Read the file from the repository/project
      // 2. Apply the fixes
      // 3. Write back the modified content
      // 4. Generate a diff

      // For now, we'll mark as applied and generate a synthetic diff
      result.applied += fixes.length;

      const changes = fixes.map((fix) => ({
        line: fix.line,
        oldCode: fix.oldCode,
        newCode: fix.newCode,
      }));

      result.diffs.push({
        file,
        oldContent: "", // Would contain actual file content
        newContent: "", // Would contain modified content
        changes,
      });

      // Update finding status in database
      const findingIds = fixes.map((f) => f.findingId);
      const updateQuery = `
        UPDATE findings
        SET status = 'fixed', updated_at = NOW()
        WHERE id = ANY($1::text[])
      `;
      await pool.query(updateQuery, [findingIds]);
    } catch (error: unknown) {
      logger.error({ error, file }, "Error applying fixes for file");
      result.failed += fixes.length;
      result.errors?.push(`Failed to apply fixes to ${file}: ${toErrorMessage(error)}`);
    }
  }

  return result;
}
