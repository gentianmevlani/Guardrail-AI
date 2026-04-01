/**
 * Scan API Routes
 *
 * Endpoints for code analysis:
 * - POST /scans - Start a new scan
 * - GET /scans - List user's scans
 * - GET /scans/:id - Get scan details
 * - GET /scans/:id/findings - Get scan findings
 * - POST /scans/:id/explain - AI explain a finding
 * - DELETE /scans/:id - Delete a scan
 */

import { pool } from "@guardrail/database";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import * as scansDAL from "../db/scans";
import { cancelJob, enqueueScan, getJobStatus } from "../lib/queue";
import { logger } from "../logger";
import { authMiddleware } from "../middleware/fastify-auth";
import { requirePlan } from "../middleware/plan-gating";
import { getAuthUser } from "../types/auth";

// ============================================================================
// TYPES
// ============================================================================

interface ScanRow {
  id: string;
  user_id: string;
  repository_id: string | null;
  project_path: string | null;
  branch: string;
  commit_sha: string | null;
  status: string;
  progress: number;
  verdict: string | null;
  score: number | null;
  files_scanned: number;
  lines_scanned: number;
  issues_found: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

interface FindingRow {
  id: string;
  scan_id: string;
  type: string;
  severity: string;
  category: string;
  file: string;
  line: number;
  column: number | null;
  end_line: number | null;
  end_column: number | null;
  title: string;
  message: string;
  code_snippet: string | null;
  suggestion: string | null;
  confidence: number;
  ai_explanation: string | null;
  ai_generated: boolean;
  status: string;
  rule_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const createScanSchema = z
  .object({
    repositoryId: z.string().optional(),
    repositoryUrl: z.string().url().optional(),
    localPath: z.string().optional(),
    branch: z.string().default("main"),
    enableLLM: z.boolean().default(false),
    llmProvider: z.enum(["openai", "anthropic"]).optional(),
    llmApiKey: z.string().optional(),
  })
  .refine(
    (data) => data.repositoryId || data.repositoryUrl || data.localPath,
    "Either repositoryId, repositoryUrl, or localPath is required",
  );

const listScansSchema = z.object({
  limit: z.string().transform(Number).default("20"),
  offset: z.string().transform(Number).default("0"),
  status: z
    .enum(["queued", "running", "completed", "failed", "all"])
    .default("all"),
  verdict: z.enum(["pass", "fail", "review", "all"]).default("all"),
});

const findingsQuerySchema = z.object({
  severity: z.enum(["critical", "warning", "info", "all"]).default("all"),
  type: z.string().optional(),
  limit: z.string().transform(Number).default("50"),
  offset: z.string().transform(Number).default("0"),
});

const explainFindingSchema = z.object({
  findingId: z.string(),
  llmProvider: z.enum(["openai", "anthropic"]).optional(),
  llmApiKey: z.string().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function scanRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook("preHandler", authMiddleware);

  /**
   * POST /scans - Start a new scan
   */
  fastify.post(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const body = createScanSchema.parse(request.body);

        // Get repository info if repositoryId provided
        let projectPath = body.localPath;
        let repoUrl: string | undefined;

        if (body.repositoryId) {
          const repo = await scansDAL.getRepositoryById(body.repositoryId, user.id);

          if (!repo) {
            return reply
              .status(404)
              .send({ success: false, error: "Repository not found" });
          }

          projectPath = repo.fullName;
          repoUrl = repo.cloneUrl;
        } else if (body.repositoryUrl) {
          repoUrl = body.repositoryUrl;
          projectPath = body.repositoryUrl
            .split("/")
            .slice(-2)
            .join("/")
            .replace(".git", "");
        }

        // Create scan record
        const scan = await scansDAL.createScan({
          userId: user.id,
          repositoryId: body.repositoryId || null,
          projectPath: projectPath || null,
          branch: body.branch,
          commitSha: null,
        });

        const scanId = scan.id;

        logger.info({ scanId, userId: user.id, projectPath }, "Scan created and enqueued");

        // Enqueue scan job
        const jobId = await enqueueScan({
          scanId,
          userId: user.id,
          repositoryId: body.repositoryId,
          repositoryUrl: repoUrl,
          localPath: body.localPath,
          branch: body.branch,
          enableLLM: body.enableLLM,
          llmConfig:
            body.llmProvider && body.llmApiKey
              ? {
                  provider: body.llmProvider,
                  apiKey: body.llmApiKey,
                }
              : undefined,
          requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });

        return reply.status(201).send({
          success: true,
          data: {
            scanId,
            jobId,
            status: "queued",
            message: "Scan enqueued successfully",
          },
        });
      } catch (error) {
        logger.error({ error }, "Failed to create scan");
        if (error instanceof z.ZodError) {
          return reply
            .status(400)
            .send({ success: false, error: error.errors });
        }
        return reply
          .status(500)
          .send({ success: false, error: "Failed to create scan" });
      }
    },
  );

  /**
   * GET /scans - List user's scans
   */
  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const query = listScansSchema.parse(request.query);
        const params: (string | number)[] = [user.id];
        let paramIndex = 2;

        let sql = `
        SELECT id, repository_id, project_path, branch, commit_sha,
               status, progress, verdict, score,
               files_scanned, lines_scanned, issues_found,
               critical_count, warning_count, info_count,
               started_at, completed_at, duration_ms, error,
               created_at, updated_at
        FROM scans
        WHERE user_id = $1
      `;

        if (query.status !== "all") {
          sql += ` AND status = $${paramIndex}`;
          params.push(query.status);
          paramIndex++;
        }

        if (query.verdict !== "all") {
          sql += ` AND verdict = $${paramIndex}`;
          params.push(query.verdict);
          paramIndex++;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(query.limit, query.offset);

        const result = await pool.query<ScanRow>(sql, params);

        // Get total count
        const countResult = await pool.query<{ count: string }>(
          "SELECT COUNT(*) as count FROM scans WHERE user_id = $1",
          [user.id],
        );

        return reply.send({
          success: true,
          data: {
            scans: result.rows.map(formatScan),
            pagination: {
              total: parseInt(countResult.rows[0].count, 10),
              limit: query.limit,
              offset: query.offset,
            },
          },
        });
      } catch (error) {
        logger.error({ error }, "Failed to list scans");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to list scans" });
      }
    },
  );

  /**
   * GET /scans/:id - Get scan details
   */
  fastify.get(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };

        const result = await pool.query<ScanRow>(
          `SELECT * FROM scans WHERE id = $1 AND user_id = $2`,
          [id, user.id],
        );

        if (result.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Scan not found" });
        }

        // Get findings summary
        const findingsSummary = await pool.query<{
          severity: string;
          count: string;
        }>(
          `SELECT severity, COUNT(*) as count FROM findings WHERE scan_id = $1 GROUP BY severity`,
          [id],
        );

        const scan = formatScan(result.rows[0]);
        const findingsBySeverity: Record<string, number> = {};
        for (const row of findingsSummary.rows) {
          findingsBySeverity[row.severity] = parseInt(row.count, 10);
        }

        return reply.send({
          success: true,
          data: {
            ...scan,
            findingsBySeverity,
          },
        });
      } catch (error) {
        logger.error({ error }, "Failed to get scan");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to get scan" });
      }
    },
  );

  /**
   * GET /scans/:id/findings - Get scan findings
   */
  fastify.get(
    "/:id/findings",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };
        const query = findingsQuerySchema.parse(request.query);

        // Verify user owns the scan
        const scanCheck = await pool.query(
          "SELECT id FROM scans WHERE id = $1 AND user_id = $2",
          [id, user.id],
        );

        if (scanCheck.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Scan not found" });
        }

        const params: (string | number)[] = [id];
        let paramIndex = 2;

        let sql = `
        SELECT id, type, severity, category, file, line, "column",
               end_line, end_column, title, message, code_snippet,
               suggestion, confidence, ai_explanation, ai_generated,
               status, rule_id, metadata, created_at
        FROM findings
        WHERE scan_id = $1
      `;

        if (query.severity !== "all") {
          sql += ` AND severity = $${paramIndex}`;
          params.push(query.severity);
          paramIndex++;
        }

        if (query.type) {
          sql += ` AND type = $${paramIndex}`;
          params.push(query.type);
          paramIndex++;
        }

        sql += ` ORDER BY 
        CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        file, line
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(query.limit, query.offset);

        const result = await pool.query<FindingRow>(sql, params);

        // Get total count
        let countSql =
          "SELECT COUNT(*) as count FROM findings WHERE scan_id = $1";
        const countParams: (string | number)[] = [id];

        if (query.severity !== "all") {
          countSql += " AND severity = $2";
          countParams.push(query.severity);
        }

        const countResult = await pool.query<{ count: string }>(
          countSql,
          countParams,
        );

        return reply.send({
          success: true,
          data: {
            findings: result.rows.map(formatFinding),
            pagination: {
              total: parseInt(countResult.rows[0].count, 10),
              limit: query.limit,
              offset: query.offset,
            },
          },
        });
      } catch (error) {
        logger.error({ error }, "Failed to get findings");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to get findings" });
      }
    },
  );

  /**
   * POST /scans/:id/explain - AI explain a finding
   * Requires: Starter tier or higher (AI features)
   */
  fastify.post(
    "/:id/explain",
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: "AI Finding Explanations" }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };
        const body = explainFindingSchema.parse(request.body);

        // Verify user owns the scan
        const scanCheck = await pool.query(
          "SELECT id FROM scans WHERE id = $1 AND user_id = $2",
          [id, user.id],
        );

        if (scanCheck.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Scan not found" });
        }

        // Get the finding
        const findingResult = await pool.query<FindingRow>(
          "SELECT * FROM findings WHERE id = $1 AND scan_id = $2",
          [body.findingId, id],
        );

        if (findingResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Finding not found" });
        }

        const finding = findingResult.rows[0];

        // If we already have an AI explanation, return it
        if (finding.ai_explanation) {
          return reply.send({
            success: true,
            data: {
              explanation: finding.ai_explanation,
              cached: true,
            },
          });
        }

        // Generate explanation using LLM (simplified - would use llmAnalyzer in production)
        const explanation = await generateExplanation(
          finding,
          body.llmProvider,
          body.llmApiKey,
        );

        // Store the explanation
        await pool.query(
          "UPDATE findings SET ai_explanation = $1, ai_generated = true WHERE id = $2",
          [explanation, body.findingId],
        );

        return reply.send({
          success: true,
          data: {
            explanation,
            cached: false,
          },
        });
      } catch (error) {
        logger.error({ error }, "Failed to explain finding");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to generate explanation" });
      }
    },
  );

  /**
   * GET /scans/:id/status - Get scan job status
   */
  fastify.get(
    "/:id/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };

        // Verify user owns the scan
        const scanCheck = await pool.query(
          "SELECT id FROM scans WHERE id = $1 AND user_id = $2",
          [id, user.id],
        );

        if (scanCheck.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Scan not found" });
        }

        const jobStatus = await getJobStatus(id);

        return reply.send({
          success: true,
          data: {
            jobId: jobStatus.id,
            status: jobStatus.status,
            progress: jobStatus.progress,
            error: jobStatus.error,
          },
        });
      } catch (error) {
        logger.error({ error }, "Failed to get scan status");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to get scan status" });
      }
    },
  );

  /**
   * POST /scans/:id/cancel - Cancel a running scan
   */
  fastify.post(
    "/:id/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };

        // Verify user owns the scan
        const scanCheck = await pool.query(
          "SELECT id, status FROM scans WHERE id = $1 AND user_id = $2",
          [id, user.id],
        );

        if (scanCheck.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Scan not found" });
        }

        const currentStatus = scanCheck.rows[0].status;
        if (currentStatus === 'completed' || currentStatus === 'failed') {
          return reply
            .status(400)
            .send({ success: false, error: "Cannot cancel completed scan" });
        }

        const cancelled = await cancelJob(id);
        if (cancelled) {
          // Update scan status in database
          await pool.query(
            "UPDATE scans SET status = 'cancelled', completed_at = NOW() WHERE id = $1",
            [id]
          );

          logger.info({ scanId: id, userId: user.id }, "Scan cancelled");

          return reply.send({
            success: true,
            data: { cancelled: true, message: "Scan cancelled successfully" },
          });
        } else {
          return reply
            .status(400)
            .send({ success: false, error: "Scan cannot be cancelled (already completed or not found)" });
        }
      } catch (error) {
        logger.error({ error }, "Failed to cancel scan");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to cancel scan" });
      }
    },
  );

  /**
   * DELETE /scans/:id - Delete a scan
   */
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getAuthUser(request);
        if (!user) {
          return reply
            .status(401)
            .send({ success: false, error: "Unauthorized" });
        }

        const { id } = request.params as { id: string };

        const result = await pool.query(
          "DELETE FROM scans WHERE id = $1 AND user_id = $2 RETURNING id",
          [id, user.id],
        );

        if (result.rows.length === 0) {
          return reply
            .status(404)
            .send({ success: false, error: "Scan not found" });
        }

        logger.info({ scanId: id, userId: user.id }, "Scan deleted");

        return reply.send({
          success: true,
          data: { deleted: true },
        });
      } catch (error) {
        logger.error({ error }, "Failed to delete scan");
        return reply
          .status(500)
          .send({ success: false, error: "Failed to delete scan" });
      }
    },
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatScan(row: ScanRow) {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    projectPath: row.project_path,
    branch: row.branch,
    commitSha: row.commit_sha,
    status: row.status,
    progress: row.progress,
    verdict: row.verdict,
    score: row.score,
    metrics: {
      filesScanned: row.files_scanned,
      linesScanned: row.lines_scanned,
      issuesFound: row.issues_found,
      criticalCount: row.critical_count,
      warningCount: row.warning_count,
      infoCount: row.info_count,
      durationMs: row.duration_ms,
    },
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function formatFinding(row: FindingRow) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    category: row.category,
    file: row.file,
    line: row.line,
    column: row.column,
    endLine: row.end_line,
    endColumn: row.end_column,
    title: row.title,
    message: row.message,
    codeSnippet: row.code_snippet,
    suggestion: row.suggestion,
    confidence: row.confidence,
    aiExplanation: row.ai_explanation,
    aiGenerated: row.ai_generated,
    status: row.status,
    ruleId: row.rule_id,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Generate AI explanation for a finding (simplified)
 */
async function generateExplanation(
  finding: FindingRow,
  provider?: "openai" | "anthropic",
  apiKey?: string,
): Promise<string> {
  // If no LLM configured, return a template explanation
  if (!provider || !apiKey) {
    return getTemplateExplanation(finding);
  }

  // Use template explanation - LLM analysis runs via CLI
  return getTemplateExplanation(finding);
}

/**
 * Get template explanation without LLM
 */
function getTemplateExplanation(finding: FindingRow): string {
  const templates: Record<string, string> = {
    empty_function: `This function "${finding.title}" has no implementation. Empty functions are often placeholders that indicate incomplete code. In production, calling this function will do nothing, which may cause unexpected behavior or silent failures.`,
    console_only: `This function only contains console.log statements and no actual logic. While useful for debugging, console-only functions don't provide real functionality and may indicate that the implementation was never completed.`,
    hardcoded_return: `This function always returns the same hardcoded value regardless of input. This is often a stub implementation used during development. In production, this will return incorrect results that don't reflect actual data.`,
    mock_data: `This code contains mock/placeholder data like "John Doe" or "example.com". While fine for testing, mock data in production can confuse users and indicate that real data integration was never completed.`,
    fake_api_call: `This code calls a mock API endpoint (like jsonplaceholder.typicode.com or localhost). These endpoints won't work in production and will cause your application to fail or return fake data.`,
    todo_without_impl: `This TODO/FIXME comment indicates planned work that was never completed. The surrounding code may be incomplete or non-functional.`,
    stub_implementation: `This code throws a "not implemented" error or is marked as a stub. Calling this code in production will cause crashes.`,
    unused_export: `This export is not imported anywhere in the project. It may be dead code that can be safely removed, or it may indicate that integration was never completed.`,
  };

  return templates[finding.type] || finding.message;
}
