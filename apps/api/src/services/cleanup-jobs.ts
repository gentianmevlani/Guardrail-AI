/**
 * Cleanup Jobs Service
 * 
 * Scheduled background jobs for:
 * - Expired token cleanup
 * - Old run data cleanup
 * - Stale webhook delivery history
 * - Orphaned records cleanup
 */

import { prisma } from '@guardrail/database';
import { logger } from '../logger';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface CleanupStats {
  tokensDeleted: number;
  runsDeleted: number;
  webhookHistoryDeleted: number;
  orphanedRecordsDeleted: number;
  errors: number;
}

class CleanupJobsService {
  private intervals: NodeJS.Timeout[] = [];
  private lastDailyRun: Date | null = null;
  private lastWeeklyRun: Date | null = null;

  /**
   * Initialize all cleanup jobs using setInterval
   */
  initialize(): void {
    // Hourly cleanup for expired tokens (runs every hour)
    const hourlyTokenCleanup = setInterval(async () => {
      try {
        logger.info('Starting hourly token cleanup');
        await this.cleanupExpiredTokens();
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Hourly token cleanup failed');
      }
    }, 60 * 60 * 1000); // 1 hour

    // Daily cleanup check (runs every hour, executes at 2 AM UTC)
    const dailyCleanupCheck = setInterval(async () => {
      const now = new Date();
      const utcHour = now.getUTCHours();
      const shouldRun = utcHour === 2 && (!this.lastDailyRun || 
        (now.getTime() - this.lastDailyRun.getTime()) > 20 * 60 * 60 * 1000); // At least 20 hours since last run

      if (shouldRun) {
        try {
          logger.info('Starting daily cleanup job');
          await this.runDailyCleanup();
          this.lastDailyRun = now;
        } catch (error: unknown) {
          logger.error({ error: toErrorMessage(error) }, 'Daily cleanup failed');
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    // Weekly cleanup check (runs every hour, executes on Sundays at 3 AM UTC)
    const weeklyCleanupCheck = setInterval(async () => {
      const now = new Date();
      const utcDay = now.getUTCDay(); // 0 = Sunday
      const utcHour = now.getUTCHours();
      const shouldRun = utcDay === 0 && utcHour === 3 && (!this.lastWeeklyRun || 
        (now.getTime() - this.lastWeeklyRun.getTime()) > 6 * 24 * 60 * 60 * 1000); // At least 6 days since last run

      if (shouldRun) {
        try {
          logger.info('Starting weekly cleanup job');
          await this.runWeeklyCleanup();
          this.lastWeeklyRun = now;
        } catch (error: unknown) {
          logger.error({ error: toErrorMessage(error) }, 'Weekly cleanup failed');
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    this.intervals = [hourlyTokenCleanup, dailyCleanupCheck, weeklyCleanupCheck];
    logger.info('Cleanup jobs initialized');

    // Run initial token cleanup
    this.cleanupExpiredTokens().catch(err => 
      logger.error({ error: err.message }, 'Initial token cleanup failed')
    );
  }

  /**
   * Stop all cleanup jobs
   */
  stop(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    logger.info('Cleanup jobs stopped');
  }

  /**
   * Run daily cleanup tasks
   */
  private async runDailyCleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      tokensDeleted: 0,
      runsDeleted: 0,
      webhookHistoryDeleted: 0,
      orphanedRecordsDeleted: 0,
      errors: 0,
    };

    try {
      // Cleanup expired tokens
      stats.tokensDeleted = await this.cleanupExpiredTokens();

      // Cleanup old webhook delivery history (older than 90 days)
      stats.webhookHistoryDeleted = await this.cleanupOldWebhookHistory();

      logger.info({ stats }, 'Daily cleanup completed');
    } catch (error: unknown) {
      stats.errors++;
      logger.error({ error: toErrorMessage(error) }, 'Daily cleanup failed');
    }

    return stats;
  }

  /**
   * Run weekly cleanup tasks
   */
  private async runWeeklyCleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      tokensDeleted: 0,
      runsDeleted: 0,
      webhookHistoryDeleted: 0,
      orphanedRecordsDeleted: 0,
      errors: 0,
    };

    try {
      // Cleanup old runs (older than 90 days, completed or failed)
      stats.runsDeleted = await this.cleanupOldRuns();

      // Cleanup orphaned records
      stats.orphanedRecordsDeleted = await this.cleanupOrphanedRecords();

      logger.info({ stats }, 'Weekly cleanup completed');
    } catch (error: unknown) {
      stats.errors++;
      logger.error({ error: toErrorMessage(error) }, 'Weekly cleanup failed');
    }

    return stats;
  }

  /**
   * Cleanup expired tokens
   */
  private async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = new Date();

      // Cleanup expired refresh tokens
      const refreshTokensResult = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      // Cleanup expired token blacklist entries
      const blacklistResult = await prisma.tokenBlacklist.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      // Cleanup expired OAuth states (older than 1 hour)
      const oauthStatesResult = await prisma.oAuthState.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      });

      const total = refreshTokensResult.count + blacklistResult.count + oauthStatesResult.count;
      logger.info({ total }, 'Expired tokens cleaned up');
      return total;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to cleanup expired tokens');
      throw error;
    }
  }

  /**
   * Cleanup old runs (completed or failed, older than retention days)
   */
  private async cleanupOldRuns(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old completed/failed runs and their findings
      const result = await prisma.run.deleteMany({
        where: {
          AND: [
            {
              status: {
                in: ['completed', 'failed'],
              },
            },
            {
              createdAt: {
                lt: cutoffDate,
              },
            },
          ],
        },
      });

      logger.info({ count: result.count, retentionDays }, 'Old runs cleaned up');
      return result.count;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to cleanup old runs');
      throw error;
    }
  }

  /**
   * Cleanup old webhook delivery history
   */
  private async cleanupOldWebhookHistory(retentionDays: number = 90): Promise<number> {
    try {
      // Note: This assumes webhook delivery history is stored in a table
      // If stored in memory (Map), this would need to be implemented differently
      // For now, we'll log that this should be implemented when webhook history
      // is persisted to database
      
      logger.info({ retentionDays }, 'Webhook history cleanup (to be implemented with DB persistence)');
      return 0;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to cleanup webhook history');
      throw error;
    }
  }

  /**
   * Cleanup orphaned records
   */
  private async cleanupOrphanedRecords(): Promise<number> {
    try {
      let total = 0;

      // Cleanup orphaned findings (runs that no longer exist)
      // Note: Prisma cascades should handle this, but we'll verify
      const orphanedFindings = await prisma.finding.findMany({
        where: {
          scan: null, // If scan relation is null
        },
        take: 1000, // Limit batch size
      });

      if (orphanedFindings.length > 0) {
        const deleted = await prisma.finding.deleteMany({
          where: {
            id: {
              in: orphanedFindings.map((f: { id: string }) => f.id),
            },
          },
        });
        total += deleted.count;
      }

      // Cleanup orphaned usage records (users that no longer exist)
      const orphanedUsage = await prisma.usageRecord.deleteMany({
        where: {
          user: null,
        },
      });
      total += orphanedUsage.count;

      logger.info({ total }, 'Orphaned records cleaned up');
      return total;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to cleanup orphaned records');
      throw error;
    }
  }

  /**
   * Manual cleanup trigger (for testing/admin)
   */
  async runManualCleanup(type: 'daily' | 'weekly' | 'tokens'): Promise<CleanupStats> {
    switch (type) {
      case 'daily':
        return await this.runDailyCleanup();
      case 'weekly':
        return await this.runWeeklyCleanup();
      case 'tokens':
        const count = await this.cleanupExpiredTokens();
        return {
          tokensDeleted: count,
          runsDeleted: 0,
          webhookHistoryDeleted: 0,
          orphanedRecordsDeleted: 0,
          errors: 0,
        };
      default:
        throw new Error(`Unknown cleanup type: ${type}`);
    }
  }
}

// Export singleton
export const cleanupJobsService = new CleanupJobsService();
