/**
 * API runtime entry — composes buildServer from server.ts and listens.
 */
<<<<<<< HEAD
import { existsSync } from "fs";
import path from "path";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import "dotenv/config";
import { getEnv } from "@guardrail/core";
import { initializeQueues } from "./lib/queue";
import { logger } from "./logger";
import { buildServer } from "./server";
import { handleGracefulShutdown } from "./utils/gracefulShutdown";
import { toErrorMessage, getErrorStack } from "./utils/toErrorMessage";

const env = getEnv();
const { PORT, HOST } = env;

export async function start() {
  try {
    try {
<<<<<<< HEAD
      const bootstrapPath = path.resolve(
        __dirname,
        "../../../dist/lib/workflow-persistence-bootstrap.js",
      );
      if (existsSync(bootstrapPath)) {
        const mod = require(bootstrapPath) as {
          bootstrapWorkflowPersistence?: (cwd?: string) => Promise<void>;
        };
        if (typeof mod.bootstrapWorkflowPersistence === "function") {
          const root =
            process.env.GUARDRAIL_PROJECT_ROOT?.trim() || process.cwd();
          await mod.bootstrapWorkflowPersistence(root);
          logger.info(
            {
              workflowProjectRoot: root,
              source: process.env.GUARDRAIL_PROJECT_ROOT?.trim()
                ? "GUARDRAIL_PROJECT_ROOT"
                : "process.cwd",
            },
            "Workflow version history hydrated from .guardrail/workflow-versions.json",
          );
        }
      }
    } catch (err: unknown) {
      logger.debug(
        { err: err instanceof Error ? err.message : String(err) },
        "Workflow persistence bootstrap skipped",
      );
    }

    try {
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      await initializeQueues({
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3", 10),
        retryAttempts: parseInt(process.env.WORKER_RETRY_ATTEMPTS || "3", 10),
      });
      logger.info("Job queues initialized");
    } catch (queueErr: unknown) {
      logger.warn(
        {
          err:
            queueErr instanceof Error ? queueErr.message : String(queueErr),
        },
        "Queue initialization skipped; scan enqueue requires Redis",
      );
    }

    const fastify = await buildServer();

    await fastify.listen({ port: PORT, host: HOST });

    logger.info(
      {
        port: PORT,
        host: HOST,
        env: env.NODE_ENV,
        service: "guardrail-api",
      },
      "Server started successfully",
    );

    logger.info(`✅ guardrail API Server running on http://${HOST}:${PORT}`);
    logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
    logger.info(`📚 API Documentation: http://${HOST}:${PORT}/docs`);
    logger.info(`📄 OpenAPI Spec: http://${HOST}:${PORT}/api/openapi.json`);

    try {
      const { scheduledJobsService } = await import("./services/scheduled-jobs");
      scheduledJobsService.start();
      logger.info("📅 Scheduled jobs service started");
    } catch (error: unknown) {
      const message = error instanceof Error ? toErrorMessage(error) : String(error);
      logger.warn({ error: message }, "Failed to start scheduled jobs service");
    }

    try {
      const { scheduledScanService } = await import(
        "./services/scheduled-scan-service"
      );
      await scheduledScanService.start();
      logger.info("📅 Scheduled scan service started");
    } catch (error: unknown) {
      const message = error instanceof Error ? toErrorMessage(error) : String(error);
      logger.warn({ error: message }, "Failed to start scheduled scan service");
    }

    handleGracefulShutdown(fastify.server);
  } catch (err: unknown) {
    const message = err instanceof Error ? toErrorMessage(err) : String(err);
    const stack = err instanceof Error ? getErrorStack(err) : undefined;
    logger.fatal(
      {
        error: message,
        stack,
        fullError: JSON.stringify(err, null, 2),
        component: "server-startup",
      },
      "Server startup failed - exiting",
    );
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
