/**
 * Ship Decision Notification Service
 * 
 * Automatically notifies users when ship decisions change:
 * - Email notifications
 * - Webhook notifications
 * - Slack/Teams integrations
 * - Real-time UI updates
 */

import { logger } from "../logger";
import { EmailNotificationService } from "./email-notification-service";
import { WebhookIntegrationService } from "./webhook-integration-service";
import { advancedWebSocketService } from "./advanced-websocket-service";
import * as path from "path";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

export interface ShipDecisionChange {
  runId: string;
  userId: string;
  projectPath: string;
  previousVerdict: "SHIP" | "NO_SHIP" | "REVIEW" | null;
  currentVerdict: "SHIP" | "NO_SHIP" | "REVIEW";
  score: number;
  confidence: number;
  blockers: Array<{
    id: string;
    severity: string;
    message: string;
  }>;
  timestamp: string;
}

export class ShipNotificationService {
  private emailService: EmailNotificationService;
  private webhookService: WebhookIntegrationService;

  constructor() {
    this.emailService = new EmailNotificationService();
    this.webhookService = new WebhookIntegrationService();
  }

  /**
   * Notify about ship decision change
   */
  async notifyDecisionChange(change: ShipDecisionChange): Promise<void> {
    const notifications: Promise<unknown>[] = [];

    // 1. Email notification
    notifications.push(this.sendEmailNotification(change));

    // 2. Webhook notifications
    notifications.push(this.sendWebhookNotifications(change));

    // 3. Real-time UI update
    notifications.push(this.sendRealtimeUpdate(change));

    // Run all notifications in parallel
    await Promise.allSettled(notifications);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(change: ShipDecisionChange): Promise<void> {
    try {
      const user = await this.getUser(change.userId);
      const userEmail =
        user &&
        typeof user === "object" &&
        "email" in user &&
        typeof (user as { email: unknown }).email === "string"
          ? (user as { email: string }).email
          : null;
      if (!userEmail) {
        return;
      }

      // Check user preferences
      const preferencesRaw = await this.getUserPreferences(change.userId);
      const preferences =
        preferencesRaw &&
        typeof preferencesRaw === "object" &&
        preferencesRaw !== null
          ? (preferencesRaw as Record<string, unknown>)
          : {};
      if (
        preferences["emailNotifications"] === false ||
        preferences["shipDecisionNotifications"] === false
      ) {
        return;
      }

      const verdictEmoji = change.currentVerdict === "SHIP" ? "✅" :
                          change.currentVerdict === "NO_SHIP" ? "❌" : "⚠️";
      
      const verdictColor = change.currentVerdict === "SHIP" ? "#10b981" :
                          change.currentVerdict === "NO_SHIP" ? "#ef4444" : "#f59e0b";

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .verdict { font-size: 24px; font-weight: bold; margin: 20px 0; color: ${verdictColor}; }
            .score { font-size: 18px; margin: 10px 0; }
            .blockers { margin: 20px 0; }
            .blocker { background: #fee2e2; border-left: 4px solid #ef4444; padding: 10px; margin: 10px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${verdictEmoji} Ship Decision Update</h1>
            </div>
            <div class="content">
              <div class="verdict">Verdict: ${change.currentVerdict}</div>
              <div class="score">Score: ${change.score}/100 (${(change.confidence * 100).toFixed(0)}% confidence)</div>
              
              ${change.previousVerdict ? `<p>Previous verdict: ${change.previousVerdict}</p>` : ""}
              
              ${change.blockers.length > 0 ? `
                <div class="blockers">
                  <h3>Blockers (${change.blockers.length}):</h3>
                  ${change.blockers.map(b => `
                    <div class="blocker">
                      <strong>[${b.severity.toUpperCase()}]</strong> ${b.message}
                    </div>
                  `).join("")}
                </div>
              ` : ""}
              
              <a href="${process.env.WEB_UI_URL || "https://app.guardrail.io"}/runs/${change.runId}" class="button">
                View Full Report
              </a>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.emailService.sendEmail({
        to: userEmail,
        subject: `${verdictEmoji} Ship Decision: ${change.currentVerdict} - ${path.basename(change.projectPath)}`,
        html,
        text: `Ship Decision: ${change.currentVerdict}\nScore: ${change.score}/100\n\n${change.blockers.map(b => `[${b.severity}] ${b.message}`).join("\n")}`,
      });

      logger.info({ userId: change.userId, runId: change.runId, verdict: change.currentVerdict }, "Ship decision email sent");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), userId: change.userId }, "Failed to send ship decision email");
    }
  }

  /**
   * Send webhook notifications
   */
  private async sendWebhookNotifications(change: ShipDecisionChange): Promise<void> {
    try {
      const subscriptions = await this.getWebhookSubscriptions(change.userId);
      
      for (const subscriptionRaw of subscriptions) {
        if (
          !subscriptionRaw ||
          typeof subscriptionRaw !== "object" ||
          !("events" in subscriptionRaw) ||
          !("id" in subscriptionRaw)
        ) {
          continue;
        }
        const subscription = subscriptionRaw as {
          id: string;
          events: unknown;
        };
        const events = Array.isArray(subscription.events)
          ? subscription.events
          : [];
        if (!events.includes("ship.decision")) {
          continue;
        }

        const payload = {
          event: "ship.decision",
          data: {
            runId: change.runId,
            projectPath: change.projectPath,
            previousVerdict: change.previousVerdict,
            currentVerdict: change.currentVerdict,
            score: change.score,
            confidence: change.confidence,
            blockers: change.blockers,
            timestamp: change.timestamp,
          },
          timestamp: change.timestamp,
        };

        await this.webhookService.deliverWebhook(
          subscription.id,
          `ship-decision-${change.runId}`,
          1
        );
      }

      logger.info({ userId: change.userId, runId: change.runId }, "Webhook notifications sent");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Failed to send webhook notifications");
    }
  }

  /**
   * Send real-time UI update
   */
  private async sendRealtimeUpdate(change: ShipDecisionChange): Promise<void> {
    try {
      advancedWebSocketService.sendToUser(change.userId, {
        type: "ship-decision-update",
        data: {
          runId: change.runId,
          verdict: change.currentVerdict,
          score: change.score,
          confidence: change.confidence,
          blockers: change.blockers,
        },
      });

      logger.debug({ userId: change.userId, runId: change.runId }, "Real-time update sent");
    } catch (error: unknown) {
      logger.warn({ error: toErrorMessage(error) }, "Failed to send real-time update");
    }
  }

  /**
   * Get user details
   */
  private async getUser(userId: string): Promise<unknown> {
    const prisma = (global as any).prisma;
    if (!prisma) return null;

    return await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string): Promise<unknown> {
    const prisma = (global as any).prisma;
    if (!prisma) {
      return {
        emailNotifications: true,
        shipDecisionNotifications: true,
      };
    }

    try {
      const profile = await prisma.userProfile.findUnique({
        where: { user_id: userId },
        select: { preferences: true },
      });

      return profile?.preferences || {
        emailNotifications: true,
        shipDecisionNotifications: true,
      };
    } catch {
      return {
        emailNotifications: true,
        shipDecisionNotifications: true,
      };
    }
  }

  /**
   * Get webhook subscriptions for user
   */
  private async getWebhookSubscriptions(userId: string): Promise<unknown[]> {
    const prisma = (global as any).prisma;
    if (!prisma) return [];

    try {
      return await prisma.webhookSubscription.findMany({
        where: {
          user_id: userId,
          active: true,
        },
      });
    } catch {
      return [];
    }
  }
}

export const shipNotificationService = new ShipNotificationService();
