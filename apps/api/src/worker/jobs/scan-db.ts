/**
 * Scan job database helpers (worker)
 */

import { pool } from "@guardrail/database";
import { logger } from "../../lib/enhanced-logger";
import type { ScanJobResult } from "../../lib/queue";

export async function updateScanStatus(
  scanId: string,
  status: string,
  progress = 0,
  error?: string,
): Promise<void> {
  try {
    const query = `
      UPDATE scans 
      SET status = $1, progress = $2, updated_at = NOW()
      ${status === "running" ? ", started_at = NOW()" : ""}
      ${status === "completed" || status === "failed" ? ", completed_at = NOW()" : ""}
      ${error ? ", error = $3" : ""}
      WHERE id = $${error ? 4 : 3}
    `;
    const params = error
      ? [status, progress, error, scanId]
      : [status, progress, scanId];
    await pool.query(query, params);
    logger.debug("Scan status updated", { scanId, status, progress });
  } catch (err: unknown) {
    logger.error("Failed to update scan status", {
      scanId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function storeFindings(
  scanId: string,
  findings: unknown[],
): Promise<void> {
  try {
    for (const raw of findings) {
      const finding = raw as Record<string, unknown>;
      await pool.query(
        `INSERT INTO findings (
          scan_id, type, severity, category, file, line, "column",
          end_line, end_column, title, message, code_snippet,
          suggestion, confidence, ai_generated, rule_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          scanId,
          finding.type,
          finding.severity,
          finding.category,
          finding.file,
          finding.line,
          finding.column,
          finding.endLine,
          finding.endColumn,
          finding.title,
          finding.message,
          finding.codeSnippet,
          finding.suggestion,
          finding.confidence,
          false,
          finding.ruleId,
          finding.metadata || null,
        ],
      );
    }
    logger.info("Findings stored successfully", {
      scanId,
      count: findings.length,
    });
  } catch (err: unknown) {
    logger.error("Failed to store findings", {
      scanId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function updateScanResults(
  scanId: string,
  result: ScanJobResult,
): Promise<void> {
  try {
    if (!result.success || !result.metrics) return;
    await pool.query(
      `UPDATE scans SET
        status = 'completed', progress = 100, verdict = $1, score = $2,
        files_scanned = $3, lines_scanned = $4, issues_found = $5,
        critical_count = $6, warning_count = $7, info_count = $8,
        completed_at = NOW(), duration_ms = $9
      WHERE id = $10`,
      [
        result.verdict,
        result.score,
        result.metrics.filesScanned,
        result.metrics.linesScanned,
        result.metrics.issuesFound,
        result.metrics.criticalCount,
        result.metrics.warningCount,
        result.metrics.infoCount,
        Date.now(),
        scanId,
      ],
    );
    logger.info("Scan results updated", {
      scanId,
      verdict: result.verdict,
      score: result.score,
    });
  } catch (err: unknown) {
    logger.error("Failed to update scan results", {
      scanId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function shouldRetryScan(
  scanId: string,
  error?: string,
): Promise<{ shouldRetry: boolean; retryCount: number } | null> {
  if (process.env.ENABLE_SCAN_AUTO_RETRY === "false") {
    return null;
  }

  try {
    const result = await pool.query<{
      retry_count: number;
      max_retries: number;
    }>(
      `SELECT retry_count, COALESCE(max_retries, 3) as max_retries FROM scans WHERE id = $1`,
      [scanId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { retry_count, max_retries } = result.rows[0];

    if (retry_count >= max_retries) {
      return null;
    }

    const retryableErrors = [
      "timeout",
      "network",
      "connection",
      "temporary",
      "rate limit",
      "503",
      "502",
      "504",
    ];

    const errorLower = (error || "").toLowerCase();
    const isRetryable = retryableErrors.some((e) => errorLower.includes(e));

    if (!isRetryable) {
      return null;
    }

    return {
      shouldRetry: true,
      retryCount: retry_count,
    };
  } catch (err: unknown) {
    logger.error("Failed to check retry status", {
      scanId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function scheduleScanRetry(
  scanId: string,
  userId: string,
  currentRetryCount: number,
): Promise<void> {
  try {
    const delays = [60, 300, 900];
    const delaySeconds = delays[Math.min(currentRetryCount, delays.length - 1)];

    await pool.query(
      `UPDATE scans SET 
        status = 'queued', 
        retry_count = retry_count + 1,
        last_retry_at = NOW(),
        error = NULL
      WHERE id = $1`,
      [scanId],
    );

    const scanResult = await pool.query<{
      repository_id: string | null;
      project_path: string | null;
      branch: string;
    }>(
      `SELECT repository_id, project_path, branch FROM scans WHERE id = $1`,
      [scanId],
    );

    if (scanResult.rows.length === 0) {
      throw new Error("Scan not found");
    }

    const scan = scanResult.rows[0];

    const { enqueueScan } = await import("../../lib/queue");
    await enqueueScan(
      {
        scanId,
        userId,
        repositoryId: scan.repository_id || undefined,
        localPath: scan.project_path || undefined,
        branch: scan.branch,
        enableLLM: false,
        requestId: `retry-${scanId}-${currentRetryCount + 1}`,
      },
      {
        delay: delaySeconds * 1000,
      },
    );

    logger.info("Scan retry scheduled", {
      scanId,
      retryCount: currentRetryCount + 1,
      delaySeconds,
    });
  } catch (error: unknown) {
    logger.error("Failed to schedule scan retry", {
      scanId,
      error: error instanceof Error ? error.message : String(error),
    });
    const msg = error instanceof Error ? error.message : String(error);
    await pool.query(`UPDATE scans SET status = 'failed', error = $1 WHERE id = $2`, [
      `Failed to schedule retry: ${msg}`,
      scanId,
    ]);
  }
}
