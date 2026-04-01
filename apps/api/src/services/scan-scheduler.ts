/**
 * Scan Scheduler Service
 * 
 * Manages automated recurring scans for repositories.
 * - Schedules jobs using BullMQ
 * - Manages cron schedules per repository
 * - Handles manual trigger overrides
 */

import { Queue, QueueEvents } from "bullmq";
import { prisma } from "@guardrail/database";
import { logger } from "../logger";
import { redisConfig } from "../config/redis";

export class ScanSchedulerService {
  private scanQueue: Queue;
  private queueEvents: QueueEvents;

  constructor() {
    this.scanQueue = new Queue("scheduled-scans", { connection: redisConfig });
    this.queueEvents = new QueueEvents("scheduled-scans", { connection: redisConfig });
    
    this.scanQueue.on("error", (err) => {
      logger.error({ err }, "Scan scheduler queue error");
    });
  }

  /**
   * Schedule a recurring scan for a repository
   */
  async scheduleScan(
    repositoryId: string, 
    userId: string,
    schedule: string = "0 0 * * *" // Default: Daily at midnight
  ): Promise<void> {
    const jobId = `scan-${repositoryId}`;
    
    // Remove existing job if any
    await this.scanQueue.removeRepeatableByKey(jobId);

    // Add new repeatable job
    await this.scanQueue.add(
      "run-scheduled-scan",
      { repositoryId, userId },
      {
        jobId,
        repeat: { pattern: schedule },
        removeOnComplete: true,
        removeOnFail: 100
      }
    );

    // Store schedule in DB
    await prisma.scheduledScan.upsert({
      where: { 
        // This assumes a unique constraint or ID, but for now we'll find first or create
        // In real schema we'd use a unique compound key
        id: `sched_${repositoryId}` 
      },
      create: {
        id: `sched_${repositoryId}`,
        repositoryId,
        userId,
        schedule,
        enabled: true,
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000) // Approx
      },
      update: {
        schedule,
        enabled: true,
        updatedAt: new Date()
      }
    });

    logger.info({ repositoryId, schedule }, "Scheduled scan configured");
  }

  /**
   * Unschedule a scan
   */
  async unscheduleScan(repositoryId: string): Promise<void> {
    const jobs = await this.scanQueue.getRepeatableJobs();
    const job = jobs.find(j => j.id === `scan-${repositoryId}`);
    
    if (job) {
      await this.scanQueue.removeRepeatableByKey(job.key);
    }

    await prisma.scheduledScan.update({
      where: { id: `sched_${repositoryId}` },
      data: { enabled: false }
    });

    logger.info({ repositoryId }, "Scheduled scan disabled");
  }

  /**
   * List all scheduled jobs
   */
  async getScheduledJobs() {
    return this.scanQueue.getRepeatableJobs();
  }
}

export const scanSchedulerService = new ScanSchedulerService();
