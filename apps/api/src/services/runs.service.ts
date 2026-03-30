/**
 * Runs persistence, queries, and orchestration (non-pipeline).
 */

import { createReadStream, existsSync, statSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import type { z } from "zod";
import { pool } from "@guardrail/database";
import { logger } from "../logger";
import { CreateRunSchema } from "../routes/runs.schema";
import { executeRunPipeline } from "./run-execution.service";
import {
  applyFixesForPack,
  generateDiffPreview,
} from "./fix-application-service";
import { realtimeEventsService } from "./realtime-events";
import type { CountDbRow, RunDbRow, RunResponse } from "./runs-types";

export async function ensureRunsTable(): Promise<void> {
  try {
    // Create table first
    await pool.query(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL,
        repository_id TEXT,
        repo TEXT NOT NULL,
        branch TEXT,
        commit_sha TEXT,
        verdict TEXT DEFAULT 'pending',
        score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        security_result JSONB,
        reality_result JSONB,
        guardrail_result JSONB,
        report_json JSONB,
        trace_url TEXT,
        video_url TEXT,
        started_at TIMESTAMP(3),
        completed_at TIMESTAMP(3),
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes separately
    await pool.query(`CREATE INDEX IF NOT EXISTS runs_user_id_idx ON runs(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS runs_repository_id_idx ON runs(repository_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS runs_created_at_idx ON runs(created_at DESC)`);
    
    logger.info("Runs table ensured");
  } catch (error: unknown) {
    logger.error("Failed to ensure runs table: " + String(error));
  }
}

void ensureRunsTable();

export interface ListQueryParams {
  limit?: string;
  offset?: string;
  status?: string;
  verdict?: string;
  repo?: string;
  sortBy?: string;
  sortOrder?: string;
  dateFrom?: string;
  dateTo?: string;
  severity?: string;
  search?: string;
}

export async function listRunsGlobal(query: ListQueryParams) {
  const {
    limit = "20",
    offset = "0",
    status,
    verdict,
    repo,
    sortBy = "created_at",
    sortOrder = "desc",
    dateFrom,
    dateTo,
    severity,
    search,
  } = query;

  const limitNum = Math.min(parseInt(limit, 10) || 20, 50);
  const offsetNum = parseInt(offset, 10) || 0;

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Status filter
  if (status && ["pending", "running", "completed", "failed"].includes(status)) {
    conditions.push(`status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  // Verdict filter
  if (verdict && ["pass", "fail", "review", "pending"].includes(verdict)) {
    conditions.push(`verdict = $${paramIndex}`);
    params.push(verdict);
    paramIndex++;
  }

  // Repo filter (exact match or partial)
  if (repo) {
    conditions.push(`repo ILIKE $${paramIndex}`);
    params.push(`%${repo}%`);
    paramIndex++;
  }

  // Date range filters
  if (dateFrom) {
    try {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(`created_at >= $${paramIndex}`);
        params.push(fromDate);
        paramIndex++;
      }
    } catch {
      // Ignore invalid date
    }
  }

  if (dateTo) {
    try {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate.getTime())) {
        conditions.push(`created_at <= $${paramIndex}`);
        params.push(toDate);
        paramIndex++;
      }
    } catch {
      // Ignore invalid date
    }
  }

  // Severity filter (looks at security_result)
  if (severity && ["critical", "high", "medium", "low"].includes(severity)) {
    const severityCondition =
      severity === "critical"
        ? `(security_result->>'critical')::int > 0`
        : severity === "high"
          ? `((security_result->>'critical')::int > 0 OR (security_result->>'high')::int > 0)`
          : severity === "medium"
            ? `((security_result->>'critical')::int > 0 OR (security_result->>'high')::int > 0 OR (security_result->>'medium')::int > 0)`
            : `(security_result IS NOT NULL)`;
    conditions.push(severityCondition);
  }

  // Search filter (searches repo, branch, commit)
  if (search && search.trim()) {
    conditions.push(
      `(repo ILIKE $${paramIndex} OR branch ILIKE $${paramIndex} OR commit_sha ILIKE $${paramIndex})`,
    );
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const validSortColumns = ["created_at", "score", "status", "verdict", "repo"];
  const safeSortBy =
    sortBy && validSortColumns.includes(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";

  const sqlList = `
  SELECT id, repo, branch, commit_sha, verdict, score, status, progress,
         security_result, reality_result, guardrail_result,
         trace_url, video_url, started_at, completed_at, created_at
  FROM runs
  ${whereClause}
  ORDER BY ${safeSortBy} ${safeSortOrder}
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`;

  params.push(limitNum, offsetNum);

  const runsResult = await pool.query<RunDbRow>(sqlList, params);

  const runs = runsResult.rows.map((row: RunDbRow) => ({
    id: row.id,
    repo: row.repo,
    branch: row.branch,
    commitSha: row.commit_sha,
    verdict: row.verdict,
    score: row.score || 0,
    status: row.status,
    progress: row.progress || 0,
    securityResult: row.security_result,
    realityResult: row.reality_result,
    guardrailResult: row.guardrail_result,
    traceUrl: row.trace_url,
    videoUrl: row.video_url,
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
  }));

  const countParams = params.slice(0, -2);
  const countSql = `SELECT COUNT(*) as total FROM runs ${whereClause}`;
  const countResult = await pool.query<CountDbRow>(countSql, countParams);
  const total = parseInt(countResult.rows[0]?.total || "0", 10);

  const facetsSql = `
  SELECT 
    COUNT(*) FILTER (WHERE status = 'running') as running_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE verdict = 'pass') as pass_count,
    COUNT(*) FILTER (WHERE verdict = 'fail') as fail_count,
    COUNT(*) FILTER (WHERE verdict = 'review') as review_count
  FROM runs
  ${whereClause}
`;
  const facetsResult = await pool.query<CountDbRow>(facetsSql, countParams);
  const facets = facetsResult.rows[0] || {};

  return {
    success: true as const,
    data: {
      runs,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
        page: Math.floor(offsetNum / limitNum) + 1,
        totalPages: Math.ceil(total / limitNum),
      },
      filters: {
        applied: {
          status,
          verdict,
          repo,
          dateFrom,
          dateTo,
          severity,
          search,
          sortBy: safeSortBy,
          sortOrder: safeSortOrder,
        },
      },
      facets: {
        status: {
          running: parseInt(facets.running_count || "0", 10),
          completed: parseInt(facets.completed_count || "0", 10),
          failed: parseInt(facets.failed_count || "0", 10),
        },
        verdict: {
          pass: parseInt(facets.pass_count || "0", 10),
          fail: parseInt(facets.fail_count || "0", 10),
          review: parseInt(facets.review_count || "0", 10),
        },
      },
    },
  };
}

export type CreateRunInput = z.infer<typeof CreateRunSchema>;

export interface SaveRunInput {
  repo: string;
  branch?: string;
  commitSha?: string;
  verdict: string | number;
  score: string | number;
  securityResult?: unknown;
  realityResult?: unknown;
  guardrailResult?: unknown;
  traceUrl?: string;
  videoUrl?: string;
  source?: "cli" | "mcp" | "vscode" | "github" | "ci";
  findings?: unknown[];
}

export async function saveRunRecord(userId: string, body: SaveRunInput) {
  const {
    repo,
    branch = "main",
    commitSha,
    verdict,
    score,
    securityResult,
    realityResult,
    guardrailResult,
    traceUrl,
    videoUrl,
    source,
    findings,
  } = body;

  let mergedGuardrail: unknown = guardrailResult;
  if (source || (Array.isArray(findings) && findings.length > 0)) {
    const base =
      guardrailResult &&
      typeof guardrailResult === "object" &&
      guardrailResult !== null
        ? { ...(guardrailResult as Record<string, unknown>) }
        : {};
    mergedGuardrail = {
      ...base,
      ...(source ? { source } : {}),
      ...(Array.isArray(findings) && findings.length > 0 ? { findings } : {}),
    };
  }

  const insertRunQuery = `
          INSERT INTO runs (user_id, repo, branch, commit_sha, verdict, score, status, 
                           security_result, reality_result, guardrail_result, 
                           trace_url, video_url, started_at, completed_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9, $10, $11, NOW(), NOW())
          RETURNING id, repo, branch, commit_sha, verdict, score, status, created_at
        `;
  const runResult = await pool.query(insertRunQuery, [
    userId,
    repo.trim(),
    branch.trim(),
    commitSha?.trim() || null,
    verdict,
    score,
    JSON.stringify(securityResult ?? null),
    JSON.stringify(realityResult ?? null),
    JSON.stringify(mergedGuardrail ?? null),
    traceUrl || null,
    videoUrl || null,
  ]);
  const run = runResult.rows[0];

  logger.info(
    { runId: run.id, repo, verdict, score },
    "Run saved from GitHub scan",
  );

  return {
    id: run.id,
    repo: run.repo,
    branch: run.branch,
    commitSha: run.commit_sha,
    verdict: run.verdict,
    score: run.score,
    status: run.status,
    createdAt: run.created_at?.toISOString(),
  };
}

export async function startRunAndScheduleExecution(
  userId: string,
  body: CreateRunInput,
) {
  const {
    repo,
    branch = "main",
    commitSha,
    projectPath,
    runSecurity = true,
    runReality = true,
    runGuardrails = true,
  } = body;

  const insertRunQuery = `
          INSERT INTO runs (user_id, repo, branch, commit_sha, verdict, status, started_at)
          VALUES ($1, $2, $3, $4, 'pending', 'running', NOW())
          RETURNING id, repo, branch, commit_sha, verdict, status, started_at, created_at
        `;
  const runResult = await pool.query(insertRunQuery, [
    userId,
    repo.trim(),
    branch.trim(),
    commitSha?.trim() || null,
  ]);
  const run = runResult.rows[0];

  realtimeEventsService.emitStatus(run.id, userId, "queued");
  realtimeEventsService.emitProgress(run.id, userId, 0);

  const r = repo.trim();
  const b = branch.trim();

  void executeRunPipeline(run.id, userId, {
    repo: r,
    branch: b,
    projectPath,
    runSecurity,
    runReality,
    runGuardrails,
  }).catch((err: unknown) => {
    logger.error({ runId: run.id, error: err }, "Unhandled run error");
  });

  return {
    run,
    repo: r,
    branch: b,
  };
}

export async function fetchRunningRunsStatus(userId: string) {
  const statusQuery = `
          SELECT id, repo, branch, status, progress, verdict, score, started_at
          FROM runs
          WHERE user_id = $1 AND status = 'running'
          ORDER BY started_at DESC
          LIMIT 10
        `;
  const result = await pool.query(statusQuery, [userId]);

  const runningRuns = result.rows.map((row) => ({
    id: row.id,
    repo: row.repo,
    branch: row.branch,
    status: row.status,
    progress: row.progress || 0,
    verdict: row.verdict,
    score: row.score,
    startedAt: row.started_at?.toISOString(),
  }));

  return { running: runningRuns, count: runningRuns.length };
}

export async function listRunsForUser(
  userId: string,
  query: ListQueryParams,
) {
  const { status, verdict, repo, limit = "20", offset = "0" } = query;

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const offsetNum = parseInt(offset, 10) || 0;

  let queryText = `
          SELECT id, repo, branch, commit_sha, verdict, score, status, progress,
                 security_result, reality_result, guardrail_result,
                 trace_url, video_url, started_at, completed_at, created_at
          FROM runs
          WHERE user_id = $1
        `;
  const queryParams: (string | number)[] = [userId];
  let paramIndex = 2;

  if (status && status !== "all") {
    queryText += ` AND status = $${paramIndex}`;
    queryParams.push(status);
    paramIndex++;
  }
  if (verdict && verdict !== "all") {
    queryText += ` AND verdict = $${paramIndex}`;
    queryParams.push(verdict);
    paramIndex++;
  }
  if (repo) {
    queryText += ` AND repo ILIKE $${paramIndex}`;
    queryParams.push(`%${repo}%`);
    paramIndex++;
  }

  const countQuery = queryText.replace(
    /SELECT.*FROM/s,
    "SELECT COUNT(*) as total FROM",
  );
  const countResult = await pool.query(countQuery, queryParams);
  const total = parseInt(countResult.rows[0]?.total || "0", 10);

  queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limitNum, offsetNum);

  const runsResult = await pool.query(queryText, queryParams);

  const runs: RunResponse[] = runsResult.rows.map((row) => ({
    id: row.id,
    repo: row.repo,
    branch: row.branch,
    commitSha: row.commit_sha,
    verdict: row.verdict,
    score: row.score || 0,
    status: row.status,
    progress: row.progress || 0,
    securityResult: row.security_result,
    realityResult: row.reality_result,
    guardrailResult: row.guardrail_result,
    traceUrl: row.trace_url,
    videoUrl: row.video_url,
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
  }));

  const summaryQuery = `
          SELECT 
            COUNT(*) FILTER (WHERE status = 'running') as running_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
            COUNT(*) FILTER (WHERE verdict = 'pass') as pass_count,
            COUNT(*) FILTER (WHERE verdict = 'fail') as fail_count,
            COUNT(*) FILTER (WHERE verdict = 'review') as review_count,
            AVG(score) FILTER (WHERE status = 'completed') as avg_score
          FROM runs
          WHERE user_id = $1
        `;
  const summaryResult = await pool.query(summaryQuery, [userId]);
  const summaryRow = summaryResult.rows[0] || {};

  const summary = {
    total,
    running: parseInt(summaryRow.running_count || "0", 10),
    completed: parseInt(summaryRow.completed_count || "0", 10),
    failed: parseInt(summaryRow.failed_count || "0", 10),
    byVerdict: {
      pass: parseInt(summaryRow.pass_count || "0", 10),
      fail: parseInt(summaryRow.fail_count || "0", 10),
      review: parseInt(summaryRow.review_count || "0", 10),
    },
    avgScore: Math.round(parseFloat(summaryRow.avg_score || "0")),
  };

  return {
    runs,
    pagination: {
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < total,
    },
    summary,
  };
}

export async function getRunDetailForUser(runId: string, userId: string) {
  const runQuery = `
          SELECT id, repo, branch, commit_sha, verdict, score, status, progress,
                 security_result, reality_result, guardrail_result, report_json,
                 trace_url, video_url, started_at, completed_at, created_at
          FROM runs
          WHERE id = $1 AND user_id = $2
        `;
  const runResult = await pool.query(runQuery, [runId, userId]);

  if (runResult.rows.length === 0) {
    return null;
  }

  const row = runResult.rows[0];
  const run: RunResponse = {
    id: row.id,
    repo: row.repo,
    branch: row.branch,
    commitSha: row.commit_sha,
    verdict: row.verdict,
    score: row.score || 0,
    status: row.status,
    progress: row.progress || 0,
    securityResult: row.security_result,
    realityResult: row.reality_result,
    guardrailResult: row.guardrail_result,
    traceUrl: row.trace_url,
    videoUrl: row.video_url,
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
  };

  return { run, reportJson: row.report_json };
}

export async function getReplayPayloadForUser(runId: string, userId: string) {
  const runQuery = `
          SELECT id, repo, trace_url, video_url, reality_result, report_json
          FROM runs
          WHERE id = $1 AND user_id = $2
        `;
  const runResult = await pool.query(runQuery, [runId, userId]);

  if (runResult.rows.length === 0) {
    return null;
  }

  const row = runResult.rows[0];

  const replayData: Record<string, unknown> = {
    runId: row.id,
    repo: row.repo,
    traceUrl: row.trace_url,
    videoUrl: row.video_url,
    available: !!(row.trace_url || row.video_url),
  };

  if (row.trace_url && fs.existsSync(row.trace_url)) {
    const st = fs.statSync(row.trace_url);
    replayData.traceSize = st.size;
    replayData.traceModified = st.mtime.toISOString();
  }

  if (row.video_url && fs.existsSync(row.video_url)) {
    const st = fs.statSync(row.video_url);
    replayData.videoSize = st.size;
    replayData.videoModified = st.mtime.toISOString();
  }

  if (row.reality_result) {
    const realityResult =
      typeof row.reality_result === "string"
        ? JSON.parse(row.reality_result)
        : row.reality_result;
    replayData.testSummary = {
      totalTests: realityResult.totalTests || 0,
      passed: realityResult.passed || 0,
      failed: realityResult.failed || 0,
      duration: realityResult.duration || 0,
    };
  }

  return replayData;
}

export async function deleteRunForUser(runId: string, userId: string) {
  const deleteQuery = `
          DELETE FROM runs
          WHERE id = $1 AND user_id = $2
          RETURNING id
        `;
  const result = await pool.query(deleteQuery, [runId, userId]);

  if (result.rowCount === 0) {
    return null;
  }

  return { id: result.rows[0].id as string, deleted: true as const };
}

export type ArtifactResolveResult =
  | { status: "ok"; filePath: string }
  | { status: "no_run" }
  | { status: "no_artifact" };

export async function resolveArtifactStreamPath(
  runId: string,
  filename: string,
  userId: string,
): Promise<ArtifactResolveResult> {
  const runQuery = `
          SELECT id, trace_url, video_url
          FROM runs
          WHERE id = $1 AND user_id = $2
        `;
  const runResult = await pool.query(runQuery, [runId, userId]);

  if (runResult.rows.length === 0) {
    return { status: "no_run" };
  }

  const row = runResult.rows[0];
  let filePath: string | null = null;

  if (row.trace_url && path.basename(row.trace_url) === filename) {
    filePath = row.trace_url;
  } else if (row.video_url && path.basename(row.video_url) === filename) {
    filePath = row.video_url;
  }

  if (row.trace_url && filename.includes("trace")) {
    const traceDir = path.dirname(row.trace_url);
    const potentialPath = path.join(traceDir, filename);
    if (existsSync(potentialPath)) {
      filePath = potentialPath;
    }
  }

  if (
    row.video_url &&
    (filename.endsWith(".webm") || filename.endsWith(".mp4"))
  ) {
    const videoDir = path.dirname(row.video_url);
    const potentialPath = path.join(videoDir, filename);
    if (existsSync(potentialPath)) {
      filePath = potentialPath;
    }
  }

  if (!filePath || !existsSync(filePath)) {
    return { status: "no_artifact" };
  }

  return { status: "ok", filePath };
}

export function createArtifactReadStream(filePath: string) {
  const stats = statSync(filePath);
  const stream = createReadStream(filePath);
  return { stream, size: stats.size };
}

export async function assertRunOwnedByUser(
  runId: string,
  userId: string,
): Promise<boolean> {
  const runQuery = `SELECT id FROM runs WHERE id = $1 AND user_id = $2`;
  const runResult = await pool.query(runQuery, [runId, userId]);
  return runResult.rows.length > 0;
}

export async function previewFixPackDiff(runId: string, packId: string) {
  return generateDiffPreview(runId, packId);
}

export async function applyFixPackForRun(
  runId: string,
  packId: string,
  userId: string,
  dryRun: boolean,
) {
  const applyResult = await applyFixesForPack(runId, packId, { dryRun });

  if (applyResult.success && !dryRun) {
    realtimeEventsService.emitLog(
      runId,
      userId,
      `Applied ${applyResult.applied} fixes from pack ${packId}`,
    );
  }

  return applyResult;
}
