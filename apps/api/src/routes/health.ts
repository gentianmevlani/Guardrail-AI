import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { checkDatabaseConnection } from "@guardrail/database";
import * as Sentry from "@sentry/node";

// Version from package.json or environment
const APP_VERSION =
  process.env.npm_package_version || process.env.APP_VERSION || "1.0.0";
const GIT_SHA =
  process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || "unknown";
const DEPLOY_ID =
  process.env.RAILWAY_DEPLOYMENT_ID || process.env.NETLIFY_BUILD_ID || "local";

// Required environment variables that must be set for the app to function
const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET"] as const;

// Production-required environment variables
const PRODUCTION_REQUIRED_ENV_VARS = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
] as const;

// Check if all required env vars are set
function checkRequiredEnvVars(): { ok: boolean; missing: string[] } {
  const isProd =
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
  const requiredVars = isProd
    ? [...REQUIRED_ENV_VARS, ...PRODUCTION_REQUIRED_ENV_VARS]
    : [...REQUIRED_ENV_VARS];

  const missing = requiredVars.filter((key) => !process.env[key]);
  return { ok: missing.length === 0, missing };
}

export async function healthRoutes(fastify: FastifyInstance) {
  // ==========================================================================
  // Simple health check - /health (no /api prefix)
  // ==========================================================================
  // Frontend calls /health for basic health status
  fastify.get(
    "/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .send({
          status: "ok",
          timestamp: new Date().toISOString(),
          version: APP_VERSION,
        });
    },
  );

  // ==========================================================================
  // Liveness probe - is the server responding?
  // ==========================================================================
  // Use this for container orchestration liveness checks.
  // Returns 200 if the server is running, regardless of dependencies.
  fastify.get(
    "/api/live",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .send({ status: "alive", ts: new Date().toISOString() });
    },
  );

  // ==========================================================================
  // Health check - comprehensive status including dependencies
  // ==========================================================================
  // Use this for monitoring dashboards and alerting.
  fastify.get(
    "/api/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const started = Date.now();

      try {
        // Check database connection with timeout
        let dbOk = false;
        let dbLatency = 0;
        const dbStart = Date.now();
        try {
          dbOk = await checkDatabaseConnection();
          dbLatency = Date.now() - dbStart;
        } catch {
          dbOk = false;
          dbLatency = Date.now() - dbStart;
        }

        // Check required environment variables
        const envCheck = checkRequiredEnvVars();

        const ms = Date.now() - started;
        const allOk = dbOk && envCheck.ok;

        return reply
          .header("Cache-Control", "no-cache, no-store, must-revalidate")
          .status(allOk ? 200 : 503)
          .send({
            ok: allOk,
            status: allOk ? "healthy" : "unhealthy",
            db: dbOk ? "ok" : "error",
            ms,
            ts: new Date().toISOString(),
            version: APP_VERSION,
            git_sha: GIT_SHA.substring(0, 7),
            deploy_id: DEPLOY_ID,
            environment: process.env.NODE_ENV || "development",
            services: {
              database: dbOk ? "connected" : "disconnected",
              github: process.env.GITHUB_CLIENT_ID
                ? "configured"
                : "not_configured",
              stripe: process.env.STRIPE_SECRET_KEY
                ? "configured"
                : "not_configured",
              openai: process.env.OPENAI_API_KEY
                ? "configured"
                : "not_configured",
              sentry: process.env.SENTRY_DSN ? "configured" : "not_configured",
            },
          });
      } catch (error) {
        const ms = Date.now() - started;
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";

        fastify.log.error({
          msg: "Health check failed",
          error: errorMsg,
        });

        // Report to Sentry if configured
        if (process.env.SENTRY_DSN) {
          Sentry.captureException(error, {
            tags: { component: "health_check" },
          });
        }

        return reply
          .header("Cache-Control", "no-cache, no-store, must-revalidate")
          .status(503)
          .send({
            ok: false,
            status: "unhealthy",
            db: "error",
            ms,
            ts: new Date().toISOString(),
            version: APP_VERSION,
            environment: process.env.NODE_ENV || "development",
            error: errorMsg,
          });
      }
    },
  );

  // ==========================================================================
  // Readiness probe - is the app ready to receive traffic?
  // ==========================================================================
  // Use this for container orchestration readiness checks.
  // Returns 200 only if all critical dependencies are available.
  fastify.get(
    "/api/ready",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const started = Date.now();

      try {
        // Check all critical services
        const checks: Record<string, boolean> = {
          database: false,
          config: false,
        };

        // Test database
        try {
          checks.database = await checkDatabaseConnection();
        } catch {
          checks.database = false;
        }

        // Test required config
        const envCheck = checkRequiredEnvVars();
        checks.config = envCheck.ok;

        // In production, also require OAuth
        const isProd = process.env.NODE_ENV === "production";
        if (isProd) {
          checks.github_oauth =
            !!process.env.GITHUB_CLIENT_ID &&
            !!process.env.GITHUB_CLIENT_SECRET;
        }

        const allReady = Object.values(checks).every(Boolean);
        const ms = Date.now() - started;

        return reply
          .header("Cache-Control", "no-cache, no-store, must-revalidate")
          .status(allReady ? 200 : 503)
          .send({
            status: allReady ? "ready" : "not_ready",
            ms,
            checks,
            ...(envCheck.missing.length > 0 && {
              missingConfig: envCheck.missing,
            }),
          });
      } catch (error) {
        return reply
          .header("Cache-Control", "no-cache, no-store, must-revalidate")
          .status(503)
          .send({
            status: "not_ready",
            error: error instanceof Error ? error.message : "Unknown error",
          });
      }
    },
  );

  // ==========================================================================
  // Startup probe - has the app finished initializing?
  // ==========================================================================
  // Use this for slow-starting containers in Kubernetes.
  fastify.get(
    "/api/startup",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // For now, if we got here the server has started
      // Add any additional startup checks here if needed
      const checks = {
        server: true,
        database: await checkDatabaseConnection().catch(() => false),
      };

      const ready = Object.values(checks).every(Boolean);

      return reply
        .header("Cache-Control", "no-cache, no-store, must-revalidate")
        .status(ready ? 200 : 503)
        .send({
          status: ready ? "started" : "starting",
          checks,
        });
    },
  );
}
