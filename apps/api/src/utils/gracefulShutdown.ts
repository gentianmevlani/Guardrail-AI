import { Server } from "http";
import { logger } from "../logger";
import { closePool } from "@guardrail/database";

let isShuttingDown = false;

export function handleGracefulShutdown(server: Server) {
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn("Shutdown already in progress, ignoring signal");
      return;
    }
    isShuttingDown = true;

    logger.info(
      { signal },
      "Received shutdown signal, starting graceful shutdown",
    );

    // Stop scheduled jobs
    try {
      const { scheduledJobsService } = await import("../services/scheduled-jobs");
      scheduledJobsService.stop();
      logger.info("Scheduled jobs stopped");
    } catch (jobErr) {
      logger.error({ error: jobErr }, "Error stopping scheduled jobs");
    }

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error({ error: err }, "Error during server shutdown");
      }

      // Close database connections
      try {
        logger.info("Closing database connections...");
        await closePool();
        logger.info("Database connections closed");
      } catch (dbErr) {
        logger.error({ error: dbErr }, "Error closing database connections");
      }

      logger.info("Server closed successfully");
      process.exit(err ? 1 : 0);
    });

    // Force close after 15 seconds
    setTimeout(() => {
      logger.error("Forcing server shutdown after timeout");
      process.exit(1);
    }, 15000);
  };

  // Handle shutdown signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    logger.error({ error: err }, "Uncaught exception");
    gracefulShutdown("uncaughtException");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled promise rejection");
  });
}
