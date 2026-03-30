/**
 * Scheduled Jobs Service
 * 
 * Manages background scheduled tasks:
 * - Weekly digest emails
 * - Usage counter resets
 * - Cleanup tasks
 * - Health checks
 */

import { PrismaClient } from "@prisma/client";
import { autopilotService } from "./autopilot-service";
import { emailNotificationService } from "./email-notification-service";
import { logger } from "../logger";
import { reconcileSubscriptions } from "./subscription-reconciliation";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const prisma = new PrismaClient();

interface ScheduledJob {
  name: string;
  schedule: string; // Cron expression
  handler: () => Promise<void>;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

class ScheduledJobsService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    // Register default jobs
    this.registerJob({
      name: "weekly-digest",
      schedule: "0 9 * * 1", // Monday at 9 AM
      handler: this.sendWeeklyDigests.bind(this),
      enabled: true,
    });

    this.registerJob({
      name: "daily-usage-reset",
      schedule: "0 0 * * *", // Midnight daily
      handler: this.resetDailyUsageCounters.bind(this),
      enabled: true,
    });

    this.registerJob({
      name: "cleanup-expired-tokens",
      schedule: "0 3 * * *", // 3 AM daily
      handler: this.cleanupExpiredTokens.bind(this),
      enabled: true,
    });

    this.registerJob({
      name: "stale-scan-cleanup",
      schedule: "0 4 * * *", // 4 AM daily
      handler: this.cleanupStaleScans.bind(this),
      enabled: true,
    });

    this.registerJob({
      name: "webhook-retry-processor",
      schedule: "*/5 * * * *", // Every 5 minutes
      handler: this.processWebhookRetries.bind(this),
      enabled: true,
    });

    this.registerJob({
      name: "subscription-reconciliation",
      schedule: "0 * * * *", // Every hour at :00
      handler: this.reconcileSubscriptions.bind(this),
      enabled: true,
    });
  }

  /**
   * Register a new scheduled job
   */
  registerJob(job: ScheduledJob): void {
    this.jobs.set(job.name, job);
    logger.info({ jobName: job.name, schedule: job.schedule }, "Registered scheduled job");
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Scheduled jobs already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting scheduled jobs service");

    for (const [name, job] of this.jobs) {
      if (!job.enabled) continue;

      const intervalMs = this.cronToInterval(job.schedule);
      
      // Run immediately on startup if configured
      if (process.env.RUN_JOBS_ON_STARTUP === "true") {
        this.runJob(name);
      }

      // Schedule recurring runs
      const interval = setInterval(() => {
        if (this.shouldRunNow(job.schedule)) {
          this.runJob(name);
        }
      }, 60000); // Check every minute

      this.intervals.set(name, interval);
      logger.info({ jobName: name, intervalMs }, "Scheduled job started");
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.isRunning = false;

    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.info({ jobName: name }, "Scheduled job stopped");
    }

    this.intervals.clear();
  }

  /**
   * Run a specific job immediately
   */
  async runJob(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) {
      logger.warn({ jobName: name }, "Attempted to run unknown job");
      return;
    }

    try {
      logger.info({ jobName: name }, "Running scheduled job");
      const startTime = Date.now();

      await job.handler();

      const duration = Date.now() - startTime;
      job.lastRun = new Date();

      logger.info(
        { jobName: name, durationMs: duration },
        "Scheduled job completed successfully"
      );
    } catch (error: unknown) {
      logger.error(
        { jobName: name, error: toErrorMessage(error) },
        "Scheduled job failed"
      );
    }
  }

  /**
   * Send weekly digest emails to all users with autopilot enabled
   */
  private async sendWeeklyDigests(): Promise<void> {
    logger.info("Starting weekly digest job");

    // Get all autopilot configs with weekly digest enabled
    const configs = await prisma.$queryRaw<
      Array<{
        repository_id: string;
        user_id: string;
        notification_email: string | null;
        full_name: string;
      }>
    >`
      SELECT ac.repository_id, ac.user_id, ac.notification_email, r.full_name
      FROM autopilot_configs ac
      JOIN repositories r ON r.id = ac.repository_id
      WHERE ac.enabled = true 
        AND ac.weekly_digest_enabled = true
    `;

    logger.info({ configCount: configs.length }, "Found autopilot configs for digest");

    let sentCount = 0;
    let errorCount = 0;

    for (const config of configs) {
      try {
        // Generate digest
        const digest = await autopilotService.generateWeeklyDigest(config.repository_id);
        const emailContent = autopilotService.formatDigestEmail(digest);

        // Get user email if notification_email not set
        let recipientEmail = config.notification_email;
        if (!recipientEmail) {
          const user = await prisma.user.findUnique({
            where: { id: config.user_id },
            select: { email: true },
          });
          recipientEmail = user?.email || null;
        }

        if (!recipientEmail) {
          logger.warn(
            { repositoryId: config.repository_id },
            "No email address for weekly digest"
          );
          continue;
        }

        // Send email
        await emailNotificationService.sendEmail({
          to: recipientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });

        // Log activity
        await prisma.$executeRaw`
          INSERT INTO autopilot_activity (id, repository_id, action_type, details, created_at)
          VALUES (
            gen_random_uuid()::text,
            ${config.repository_id},
            'digest_sent',
            ${JSON.stringify({ email: recipientEmail, week: new Date().toISOString().split('T')[0] })}::jsonb,
            NOW()
          )
        `;

        sentCount++;
        logger.debug(
          { repositoryId: config.repository_id, email: recipientEmail },
          "Weekly digest sent"
        );
      } catch (error: unknown) {
        errorCount++;
        logger.error(
          { repositoryId: config.repository_id, error: toErrorMessage(error) },
          "Failed to send weekly digest"
        );
      }
    }

    logger.info(
      { sentCount, errorCount, totalConfigs: configs.length },
      "Weekly digest job completed"
    );
  }

  /**
   * Reset daily usage counters for API keys
   */
  private async resetDailyUsageCounters(): Promise<void> {
    logger.info("Starting daily usage counter reset");

    const result = await prisma.apiKey.updateMany({
      where: {
        lastDayReset: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      data: {
        currentDayRequests: 0,
        currentDayExpensive: 0,
        lastDayReset: new Date(),
      },
    });

    logger.info({ resetCount: result.count }, "Daily usage counters reset");
  }

  /**
   * Clean up expired tokens and sessions
   */
  private async cleanupExpiredTokens(): Promise<void> {
    logger.info("Starting expired token cleanup");

    const now = new Date();

    // Clean up refresh tokens
    const refreshResult = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revoked: true },
        ],
      },
    });

    // Clean up token blacklist entries
    const blacklistResult = await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    // Clean up OAuth states
    const oauthResult = await prisma.oAuthState.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    // Clean up old usage tokens
    const usageTokenResult = await prisma.usageToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revoked: true },
        ],
      },
    });

    logger.info(
      {
        refreshTokens: refreshResult.count,
        blacklistEntries: blacklistResult.count,
        oauthStates: oauthResult.count,
        usageTokens: usageTokenResult.count,
      },
      "Expired token cleanup completed"
    );
  }

  /**
   * Clean up stale scans that are stuck in running state
   */
  private async cleanupStaleScans(): Promise<void> {
    logger.info("Starting stale scan cleanup");

    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours

    const result = await prisma.scan.updateMany({
      where: {
        status: { in: ["queued", "running"] },
        updatedAt: { lt: staleThreshold },
      },
      data: {
        status: "error",
        error: "Scan timed out after 2 hours",
      },
    });

    if (result.count > 0) {
      logger.warn({ staleCount: result.count }, "Cleaned up stale scans");
    } else {
      logger.info("No stale scans found");
    }
  }

  /**
   * Process pending webhook retries
   */
  private async processWebhookRetries(): Promise<void> {
    try {
      const { processPendingRetries } = await import("./webhook-delivery-service");
      const result = await processPendingRetries();
      
      if (result.processed > 0) {
        logger.info(
          {
            processed: result.processed,
            succeeded: result.succeeded,
            failed: result.failed,
          },
          "Webhook retry processor completed"
        );
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Webhook retry processor failed");
    }
  }

  /**
   * Parse cron expression to rough interval
   * This is a simplified implementation - production should use a proper cron parser
   */
  private cronToInterval(cron: string): number {
    const parts = cron.split(" ");
    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];

    // Weekly job (specific day of week)
    if (dayOfWeek !== "*") {
      return 7 * 24 * 60 * 60 * 1000; // 1 week
    }

    // Daily job (specific hour)
    if (hour !== "*") {
      return 24 * 60 * 60 * 1000; // 1 day
    }

    // Hourly job
    return 60 * 60 * 1000; // 1 hour
  }

  /**
   * Check if a cron job should run now based on schedule
   */
  private shouldRunNow(cron: string): boolean {
    const now = new Date();
    const parts = cron.split(" ");

    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];

    // Check minute
    if (minute !== "*" && parseInt(minute) !== now.getMinutes()) {
      return false;
    }

    // Check hour
    if (hour !== "*" && parseInt(hour) !== now.getHours()) {
      return false;
    }

    // Check day of month
    if (dayOfMonth !== "*" && parseInt(dayOfMonth) !== now.getDate()) {
      return false;
    }

    // Check month
    if (month !== "*" && parseInt(month) !== now.getMonth() + 1) {
      return false;
    }

    // Check day of week (0 = Sunday)
    if (dayOfWeek !== "*" && parseInt(dayOfWeek) !== now.getDay()) {
      return false;
    }

    return true;
  }

  /**
   * Reconcile subscription state from Stripe
   * Runs hourly to sync subscription status, tier, and billing periods
   */
  private async reconcileSubscriptions(): Promise<void> {
    logger.info("Starting subscription reconciliation job");
    try {
      const result = await reconcileSubscriptions();
      logger.info(
        {
          totalChecked: result.totalChecked,
          synced: result.synced,
          skipped: result.skipped,
          errors: result.errors,
        },
        "Subscription reconciliation job completed"
      );
    } catch (error: unknown) {
      logger.error(
        { error: toErrorMessage(error) },
        "Subscription reconciliation job failed"
      );
    }
  }

  /**
   * Get status of all jobs
   */
  getJobStatus(): Array<{
    name: string;
    schedule: string;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
  }> {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
    }));
  }
}

// Export singleton instance
export const scheduledJobsService = new ScheduledJobsService();
