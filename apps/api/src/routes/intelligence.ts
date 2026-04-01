/**
 * Intelligence Suite API Routes (Fastify)
 *
 * Provides REST API endpoints for all power suites:
 * - POST /api/intelligence/ai - AI Code Analysis
 * - POST /api/intelligence/security - Security Scanning
 * - POST /api/intelligence/architecture - Architecture Health
 * - POST /api/intelligence/supply-chain - Supply Chain Analysis
 * - POST /api/intelligence/team - Team Intelligence
 * - POST /api/intelligence/predictive - Predictive Analytics
 * - POST /api/intelligence/full - Run All Suites
 * - GET  /api/intelligence/status/:jobId - Get analysis status
 */

import { spawnSync, SpawnSyncReturns } from "child_process";
import { FastifyInstance, FastifyReply } from "fastify";
import fs from "fs/promises";
import path from "path";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// ============================================================================
// SECURITY: Input Validation Helpers
// ============================================================================

/** Allowlist of valid suite names */
const VALID_SUITES = new Set([
  "ai",
  "security",
  "arch",
  "supply",
  "team",
  "predict",
  "full",
]);

/** Shell metacharacters that could enable command injection */
const SHELL_METACHARACTERS = /[;&|`$(){}\[\]<>\n\r\\"'!#~*?]/;

/**
 * Validates that a suite name is in the allowlist.
 * @throws Error if suite is not valid
 */
function validateSuite(suite: string): void {
  if (!VALID_SUITES.has(suite)) {
    throw new Error(
      `Invalid suite: ${suite}. Valid suites: ${Array.from(VALID_SUITES).join(", ")}`,
    );
  }
}

/**
 * Validates that a path contains no shell metacharacters.
 * Defense-in-depth measure even when using argument arrays.
 * @throws Error if path contains dangerous characters
 */
function validatePathSafe(inputPath: string): void {
  if (SHELL_METACHARACTERS.test(inputPath)) {
    throw new Error("Invalid path: contains potentially dangerous characters");
  }

  // Additional checks for path traversal attempts
  const normalized = path.normalize(inputPath);
  if (normalized.includes("..") && normalized !== inputPath) {
    // Allow .. only if it was in the original path and normalized correctly
    const resolvedOriginal = path.resolve(inputPath);
    const resolvedNormalized = path.resolve(normalized);
    if (resolvedOriginal !== resolvedNormalized) {
      throw new Error("Invalid path: potential path traversal detected");
    }
  }
}

/**
 * Safely logs command execution without exposing sensitive paths in production.
 */
function logCommandExecution(
  suite: string,
  projectPath: string,
  logger: { info: (msg: string) => void },
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const safePath = isProduction
    ? `[project:${path.basename(projectPath)}]`
    : projectPath;
  logger.info(`Executing intelligence suite: ${suite} on ${safePath}`);
}

// Types
interface AnalysisJob {
  id: string;
  suite: string;
  status: "pending" | "running" | "complete" | "error";
  startTime: Date;
  endTime?: Date;
  result?: unknown;
  error?: string;
}

interface AnalysisBody {
  projectPath?: string;
  async?: boolean;
  file?: string;
  checks?: string[];
  visualize?: boolean;
  sbomFormat?: string;
  timeframe?: string;
}

interface StatusParams {
  jobId: string;
}

// Analysis job storage (in production, use Redis or database)
const analysisJobs = new Map<string, AnalysisJob>();

// Generate job ID
function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Run CLI command (SECURE: uses spawnSync with argument array, no shell)
async function runCLICommand(
  suite: string,
  projectPath: string,
  logger?: { info: (msg: string) => void },
): Promise<unknown> {
  // Validate inputs before execution
  validateSuite(suite);
  validatePathSafe(projectPath);

  const cliPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "bin",
    "runners",
    "runIntelligence.js",
  );

  // Log execution (safe logging)
  if (logger) {
    logCommandExecution(suite, projectPath, logger);
  }

  return new Promise((resolve, reject) => {
    try {
      // SECURE: Use spawnSync with argument array - NO string interpolation
      // This prevents command injection as each argument is passed separately
      const result: SpawnSyncReturns<string> = spawnSync(
        "node",
        [cliPath, suite, "--json", "--path", projectPath],
        {
          encoding: "utf8",
          maxBuffer: 50 * 1024 * 1024,
          timeout: 300000, // 5 minutes
          shell: false, // CRITICAL: Never use shell
        },
      );

      // Handle spawn errors (e.g., node not found)
      if (result.error) {
        reject(new Error(`Spawn failed: ${toErrorMessage(result.error)}`));
        return;
      }

      // Handle non-zero exit codes
      if (result.status !== 0) {
        // Try to parse stdout even on failure (CLI might output JSON errors)
        if (result.stdout) {
          try {
            resolve(JSON.parse(result.stdout));
            return;
          } catch {
            // stdout wasn't valid JSON, continue to error handling
          }
        }

        // Build error message from available information
        const errorMsg =
          result.stderr?.trim() || `Process exited with code ${result.status}`;
        reject(new Error(errorMsg));
        return;
      }

      // Handle signal termination (e.g., timeout)
      if (result.signal) {
        reject(new Error(`Process terminated by signal: ${result.signal}`));
        return;
      }

      // Parse successful output
      if (!result.stdout || result.stdout.trim() === "") {
        reject(new Error("Analysis produced no output"));
        return;
      }

      try {
        resolve(JSON.parse(result.stdout));
      } catch (parseError) {
        reject(new Error("Failed to parse analysis output as JSON"));
      }
    } catch (error: unknown) {
      reject(new Error(toErrorMessage(error) || "Analysis failed"));
    }
  });
}

// Start async analysis job
async function startAnalysisJob(
  suite: string,
  projectPath: string,
  jobId: string,
): Promise<void> {
  const job = analysisJobs.get(jobId);
  if (!job) return;

  job.status = "running";

  try {
    const result = await runCLICommand(suite, projectPath);
    job.status = "complete";
    job.endTime = new Date();
    job.result = result;
  } catch (error: unknown) {
    job.status = "error";
    job.endTime = new Date();
    job.error = toErrorMessage(error);
  }
}

// ============================================================================
// FASTIFY ROUTES PLUGIN
// ============================================================================

import { requirePlan } from "../middleware/plan-gating";
import { authMiddleware, AuthenticatedRequest } from "../middleware/fastify-auth";

export async function intelligenceRoutes(fastify: FastifyInstance) {
  // Add auth middleware
  fastify.addHook("preHandler", async (request, reply) => {
    await authMiddleware(request as AuthenticatedRequest, reply);
  });
  // Helper to run analysis
  async function runAnalysis(
    suite: string,
    projectPath: string,
    isAsync: boolean,
    reply: FastifyReply,
  ) {
    const resolvedPath = path.resolve(projectPath);

    // Validate path exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return reply.status(400).send({ error: "Project path not found" });
    }

    if (isAsync) {
      const jobId = generateJobId();
      analysisJobs.set(jobId, {
        id: jobId,
        suite,
        status: "pending",
        startTime: new Date(),
      });

      startAnalysisJob(suite, resolvedPath, jobId);

      return reply.send({ jobId, status: "pending" });
    }

    const result = await runCLICommand(suite, resolvedPath);
    return reply.send(result);
  }

  // AI Intelligence - Requires Pro tier
  fastify.post<{ Body: AnalysisBody }>(
    "/ai",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "AI Intelligence" }),
    },
    async (request, reply) => {
    try {
      const { projectPath = ".", async: isAsync = false } = request.body || {};
      return runAnalysis("ai", projectPath, isAsync, reply);
    } catch (error: unknown) {
      return reply.status(500).send({ error: toErrorMessage(error) });
    }
  });

  // Security - Starter tier (minTierLevel: 1)
  fastify.post<{ Body: AnalysisBody }>(
    "/security",
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: "Security Intelligence" }),
    },
    async (request, reply) => {
      try {
        const { projectPath = ".", async: isAsync = false } = request.body || {};
        return runAnalysis("security", projectPath, isAsync, reply);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    }
  );

  // Architecture - Pro tier
  fastify.post<{ Body: AnalysisBody }>(
    "/architecture",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "Architecture Intelligence" }),
    },
    async (request, reply) => {
      try {
        const { projectPath = ".", async: isAsync = false } =
          request.body || {};
        return runAnalysis("arch", projectPath, isAsync, reply);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // Supply Chain - Starter tier
  fastify.post<{ Body: AnalysisBody }>(
    "/supply-chain",
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: "Supply Chain Intelligence" }),
    },
    async (request, reply) => {
      try {
        const { projectPath = ".", async: isAsync = false } =
          request.body || {};
        return runAnalysis("supply", projectPath, isAsync, reply);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // Team Intelligence - Compliance tier
  fastify.post<{ Body: AnalysisBody }>(
    "/team",
    {
      preHandler: requirePlan({ minTierLevel: 3, featureName: "Team Intelligence" }),
    },
    async (request, reply) => {
      try {
        const { projectPath = ".", async: isAsync = false } = request.body || {};
        return runAnalysis("team", projectPath, isAsync, reply);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    }
  );

  // Predictive Analytics - Pro tier
  fastify.post<{ Body: AnalysisBody }>(
    "/predictive",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "Predictive Analytics" }),
    },
    async (request, reply) => {
      try {
        const { projectPath = ".", async: isAsync = false } =
          request.body || {};
        return runAnalysis("predict", projectPath, isAsync, reply);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // Full Analysis (always async) - Requires Pro tier
  fastify.post<{ Body: AnalysisBody }>(
    "/full",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "Full Intelligence Analysis" }),
    },
    async (request, reply) => {
    try {
      const { projectPath = "." } = request.body || {};
      const resolvedPath = path.resolve(projectPath);

      try {
        await fs.access(resolvedPath);
      } catch {
        return reply.status(400).send({ error: "Project path not found" });
      }

      const jobId = generateJobId();
      analysisJobs.set(jobId, {
        id: jobId,
        suite: "full",
        status: "pending",
        startTime: new Date(),
      });

      startAnalysisJob("full", resolvedPath, jobId);

      return reply.send({
        jobId,
        status: "pending",
        message:
          "Full analysis started. Use GET /api/intelligence/status/:jobId to check progress.",
      });
    } catch (error: unknown) {
      return reply.status(500).send({ error: toErrorMessage(error) });
    }
  });

  // Job Status
  fastify.get<{ Params: StatusParams }>(
    "/status/:jobId",
    async (request, reply) => {
      try {
        const { jobId } = request.params;
        const job = analysisJobs.get(jobId);

        if (!job) {
          return reply.status(404).send({ error: "Job not found" });
        }

        const response: any = {
          id: job.id,
          suite: job.suite,
          status: job.status,
          startTime: job.startTime,
        };

        if (job.endTime) {
          response.endTime = job.endTime;
          response.duration = job.endTime.getTime() - job.startTime.getTime();
        }

        if (job.status === "complete") {
          response.result = job.result;
        }

        if (job.status === "error") {
          response.error = job.error;
        }

        return reply.send(response);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // List Jobs
  fastify.get("/jobs", async (request, reply) => {
    try {
      const jobs = Array.from(analysisJobs.values()).map((job) => ({
        id: job.id,
        suite: job.suite,
        status: job.status,
        startTime: job.startTime,
        endTime: job.endTime,
      }));

      return reply.send({ jobs });
    } catch (error: unknown) {
      return reply.status(500).send({ error: toErrorMessage(error) });
    }
  });

  // Quick Score
  fastify.get<{ Querystring: { projectPath?: string } }>(
    "/score",
    async (request, reply) => {
      try {
        const { projectPath = "." } = request.query;
        const resolvedPath = path.resolve(String(projectPath));

        const summaryPath = path.join(
          resolvedPath,
          ".guardrail",
          "intelligence-summary.json",
        );

        try {
          const summary = JSON.parse(await fs.readFile(summaryPath, "utf-8"));
          return reply.send(summary);
        } catch {
          return reply.send({
            overallScore: null,
            message:
              "No analysis results. Run POST /api/intelligence/full to generate.",
          });
        }
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );
}

export default intelligenceRoutes;
