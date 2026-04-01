/**
 * Worker entry: queues, processors, graceful shutdown
 */

import { Worker } from "bullmq";
import { logger } from "../lib/enhanced-logger";
import { redisConfig } from "../config/redis";
import { processScanJob } from "./jobs/process-scan-job";
import { processScheduledScan } from "./jobs/process-scheduled-scan";

export async function startWorker(): Promise<void> {
  try {
    logger.info("Starting scan worker process...");

    const { initializeQueues, initializeWorker } = await import("../lib/queue");

    await initializeQueues({
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3", 10),
      retryAttempts: parseInt(process.env.WORKER_RETRY_ATTEMPTS || "3", 10),
    });

    await initializeWorker(processScanJob);

    const scheduledScanWorker = new Worker(
      "scheduled-scans",
      processScheduledScan,
      {
        connection: redisConfig,
        concurrency: 1,
      },
    );

    scheduledScanWorker.on("completed", (job) => {
      logger.info("Scheduled scan job completed", { jobId: job.id });
    });

    scheduledScanWorker.on("failed", (job, err) => {
      logger.error("Scheduled scan job failed", {
        jobId: job?.id,
        error: err.message,
      });
    });

    logger.info("Scan worker started successfully");

    const shutdown = async (signal: string) => {
      logger.info("Received shutdown signal", { signal });
      const { shutdownQueues } = await import("../lib/queue");
      await shutdownQueues();
      await scheduledScanWorker.close();
      process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error: unknown) {
    logger.error("Failed to start worker", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}
