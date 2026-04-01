/**
 * BullMQ processor: scheduled repository scans
 */

import { Job } from "bullmq";
import { pool } from "@guardrail/database";
import { logger } from "../../lib/enhanced-logger";

export async function processScheduledScan(
  job: Job<{ repositoryId: string; userId: string }>,
): Promise<void> {
  const { repositoryId, userId } = job.data;
  logger.info("Processing scheduled scan", { repositoryId, userId });

  try {
    const repoResult = await pool.query(
      `SELECT full_name, default_branch FROM repositories WHERE id = $1`,
      [repositoryId],
    );

    if (repoResult.rows.length === 0) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    const { full_name, default_branch } = repoResult.rows[0];

    const mockFastify = { log: logger } as unknown;

    const { prisma } = await import("@guardrail/database");
    const { triggerScan } = await import("../../routes/webhooks");

    await triggerScan(
      mockFastify as any,
      prisma,
      full_name,
      default_branch || "main",
      "",
      undefined,
      userId,
    );

    logger.info("Scheduled scan triggered successfully", { repositoryId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Failed to process scheduled scan", {
      repositoryId,
      error: msg,
    });
    throw error;
  }
}
