/**
 * Scheduled Scan Service
 * 
 * Manages user-scheduled scans that run automatically on a cron schedule.
 * Integrates with the job queue to execute scans asynchronously.
 */

import type { Job } from "bullmq";
import { prisma } from "@guardrail/database";
import { CronJob } from "cron";
import { logger } from "../logger";
import { enqueueScan, getScanQueue } from "../lib/queue";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
import type { ScheduledScan as ScheduledScanRow } from "@prisma/client";

interface ScheduledScan {
  id: string;
  userId: string;
  repositoryId: string | null;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
}

export class ScheduledScanService {
  private recurringJobs: Map<string, Job> = new Map();
  private isRunning = false;

  /**
   * Start the scheduled scan service
   * Loads all enabled scheduled scans and starts their cron jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Scheduled scan service already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting scheduled scan service");

    try {
      // Load all enabled scheduled scans
      const schedules = await prisma.scheduledScan.findMany({
        where: { enabled: true },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const schedule of schedules) {
        await this.scheduleScan(schedule);
      }

      logger.info(
        { count: schedules.length },
        "Scheduled scan service started",
      );
    } catch (error: unknown) {
      logger.error(
        { error: toErrorMessage(error) },
        "Failed to start scheduled scan service",
      );
      throw error;
    }
  }

  /**
   * Schedule a scan to run on a cron schedule using BullMQ recurring jobs
   */
  private async scheduleScan(schedule: any): Promise<void> {
    try {
      // Validate cron expression
      if (!this.isValidCronExpression(schedule.schedule)) {
        logger.warn(
          { scheduleId: schedule.id, schedule: schedule.schedule },
          "Invalid cron expression, skipping",
        );
        return;
      }

      const queue = getScanQueue();
      if (!queue) {
        throw new Error("Scan queue not initialized");
      }

      // Remove existing recurring job if it exists
      const existingJob = this.recurringJobs.get(schedule.id);
      if (existingJob) {
        await existingJob.remove();
      }

      // Create recurring job with BullMQ
      const job = await queue.add(
        `scheduled-scan-${schedule.id}`,
        {
          scanId: `scheduled-${schedule.id}`,
          userId: schedule.userId,
          repositoryId: schedule.repositoryId ?? undefined,
          branch: "main",
          type: "scheduled",
          scheduleId: schedule.id,
        },
        {
          repeat: {
            pattern: schedule.schedule, // Cron expression
            tz: "UTC",
          },
          jobId: `scheduled-scan-${schedule.id}`, // Unique ID for this schedule
        },
      );

      this.recurringJobs.set(schedule.id, job);

      // Calculate next run time (approximate)
      const nextRun = this.calculateNextRun(schedule.schedule);

      logger.info(
        {
          scheduleId: schedule.id,
          userId: schedule.userId,
          schedule: schedule.schedule,
          jobId: job.id,
          nextRun: nextRun.toISOString(),
        },
        "Scheduled scan registered with BullMQ",
      );
    } catch (error: unknown) {
      logger.error(
        {
          error: toErrorMessage(error),
          scheduleId: schedule.id,
          schedule: schedule.schedule,
        },
        "Failed to schedule scan",
      );
    }
  }

  /**
   * Execute a scheduled scan
   */
  private async executeScheduledScan(
    schedule: ScheduledScanRow & { user?: { id: string; email: string } },
  ): Promise<void> {
    logger.info(
      {
        scheduleId: schedule.id,
        userId: schedule.userId,
        repositoryId: schedule.repositoryId,
      },
      "Executing scheduled scan",
    );

    try {
      // Create scan record first
      const scan = await prisma.scan.create({
        data: {
          userId: schedule.userId,
          repositoryId: schedule.repositoryId || null,
          projectPath: null,
          branch: "main", // Default branch, could be configurable
          status: "queued",
        },
      });

      // Enqueue scan job
      await enqueueScan({
        scanId: scan.id,
        userId: schedule.userId,
        repositoryId: schedule.repositoryId || undefined,
        branch: "main",
        enableLLM: false,
        requestId: `scheduled-${schedule.id}-${Date.now()}`,
      });

      // Calculate next run time
      const nextRun = this.calculateNextRun(schedule.schedule);

      // Update schedule record
      await prisma.scheduledScan.update({
        where: { id: schedule.id },
        data: {
          lastRun: new Date(),
          nextRun,
        },
      });

      logger.info(
        {
          scheduleId: schedule.id,
          scanId: scan.id,
          nextRun: nextRun?.toISOString(),
        },
        "Scheduled scan enqueued successfully",
      );

      // Emit telemetry
      // telemetry.track('scan.scheduled.triggered', {
      //   scheduleId: schedule.id,
      //   userId: schedule.userId,
      //   scanId,
      // });
    } catch (error: unknown) {
      logger.error(
        {
          error: toErrorMessage(error),
          scheduleId: schedule.id,
          userId: schedule.userId,
        },
        "Failed to execute scheduled scan",
      );

      // Update schedule with error (don't disable, allow retry)
      await prisma.scheduledScan.update({
        where: { id: schedule.id },
        data: {
          lastRun: new Date(), // Mark as attempted
        },
      });

      throw error;
    }
  }

  /**
   * Add a new scheduled scan
   */
  async addScheduledScan(data: {
    userId: string;
    repositoryId?: string | null;
    schedule: string;
    enabled?: boolean;
  }): Promise<ScheduledScan> {
    // Validate cron expression
    if (!this.isValidCronExpression(data.schedule)) {
      throw new Error(`Invalid cron expression: ${data.schedule}`);
    }

    // Calculate next run time
    const nextRun = this.calculateNextRun(data.schedule);

    // Create scheduled scan
    const scheduledScan = await prisma.scheduledScan.create({
      data: {
        userId: data.userId,
        repositoryId: data.repositoryId || null,
        schedule: data.schedule,
        enabled: data.enabled ?? true,
        nextRun,
      },
    });

    // If service is running, schedule it immediately
    if (this.isRunning && scheduledScan.enabled) {
      await this.scheduleScan(scheduledScan);
    }

    logger.info(
      {
        scheduleId: scheduledScan.id,
        userId: data.userId,
        schedule: data.schedule,
      },
      "Scheduled scan created",
    );

    return scheduledScan as ScheduledScan;
  }

  /**
   * Update a scheduled scan
   */
  async updateScheduledScan(
    scheduleId: string,
    data: {
      schedule?: string;
      enabled?: boolean;
      repositoryId?: string | null;
    },
  ): Promise<ScheduledScan> {
    // Validate cron expression if provided
    if (data.schedule && !this.isValidCronExpression(data.schedule)) {
      throw new Error(`Invalid cron expression: ${data.schedule}`);
    }

    // Remove existing recurring job if it exists
    const existingJob = this.recurringJobs.get(scheduleId);
    if (existingJob) {
      await existingJob.remove();
      this.recurringJobs.delete(scheduleId);
    }

    // Calculate next run time if schedule changed
    const updateData: any = { ...data };
    if (data.schedule) {
      updateData.nextRun = this.calculateNextRun(data.schedule);
    }

    // Update scheduled scan
    const scheduledScan = await prisma.scheduledScan.update({
      where: { id: scheduleId },
      data: updateData,
    });

    // Reschedule if enabled
    if (this.isRunning && scheduledScan.enabled) {
      await this.scheduleScan(scheduledScan);
    }

    logger.info({ scheduleId, ...data }, "Scheduled scan updated");

    return scheduledScan as ScheduledScan;
  }

  /**
   * Delete a scheduled scan
   */
  async deleteScheduledScan(scheduleId: string): Promise<void> {
    // Remove recurring job
    const job = this.recurringJobs.get(scheduleId);
    if (job) {
      await job.remove();
      this.recurringJobs.delete(scheduleId);
    }

    // Delete from database
    await prisma.scheduledScan.delete({
      where: { id: scheduleId },
    });

    logger.info({ scheduleId }, "Scheduled scan deleted");
  }

  /**
   * Get all scheduled scans for a user
   */
  async getUserScheduledScans(userId: string): Promise<ScheduledScan[]> {
    return (await prisma.scheduledScan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) as ScheduledScan[];
  }

  /**
   * Stop the scheduled scan service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Remove all recurring jobs
    for (const [id, job] of this.recurringJobs) {
      try {
        await job.remove();
      } catch (error: unknown) {
        logger.warn({ scheduleId: id, error: toErrorMessage(error) }, "Failed to remove recurring job");
      }
    }
    this.recurringJobs.clear();

    this.isRunning = false;
    logger.info("Scheduled scan service stopped");
  }

  /**
   * Validate cron expression
   */
  private isValidCronExpression(expression: string): boolean {
    try {
      // Basic validation - cron format: second minute hour day month dayOfWeek
      const parts = expression.trim().split(/\s+/);
      if (parts.length !== 5 && parts.length !== 6) {
        return false;
      }

      // Try to create a cron job to validate
      new CronJob(expression, () => {}, null, false, "UTC");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate next run time from cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    try {
      const job = new CronJob(cronExpression, () => {}, null, false, "UTC");
      return job.nextDate().toJSDate();
    } catch {
      // Fallback to 1 hour from now if invalid
      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + 1);
      return nextRun;
    }
  }
}

// Singleton instance
export const scheduledScanService = new ScheduledScanService();
