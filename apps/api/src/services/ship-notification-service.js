"use strict";
/**
 * Ship Decision Notification Service
 *
 * Automatically notifies users when ship decisions change:
 * - Email notifications
 * - Webhook notifications
 * - Slack/Teams integrations
 * - Real-time UI updates
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipNotificationService = exports.ShipNotificationService = void 0;
const logger_1 = require("../logger");
const email_notification_service_1 = require("./email-notification-service");
const webhook_integration_service_1 = require("./webhook-integration-service");
const enhanced_websocket_service_1 = require("./enhanced-websocket-service");
const path = __importStar(require("path"));
class ShipNotificationService {
    emailService;
    webhookService;
    constructor() {
        this.emailService = new email_notification_service_1.EmailNotificationService();
        this.webhookService = new webhook_integration_service_1.WebhookIntegrationService();
    }
    /**
     * Notify about ship decision change
     */
    async notifyDecisionChange(change) {
        const notifications = [];
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
    async sendEmailNotification(change) {
        try {
            const user = await this.getUser(change.userId);
            if (!user || !user.email) {
                return;
            }
            // Check user preferences
            const preferences = await this.getUserPreferences(change.userId);
            if (!preferences.emailNotifications || !preferences.shipDecisionNotifications) {
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
                to: user.email,
                subject: `${verdictEmoji} Ship Decision: ${change.currentVerdict} - ${path.basename(change.projectPath)}`,
                html,
                text: `Ship Decision: ${change.currentVerdict}\nScore: ${change.score}/100\n\n${change.blockers.map(b => `[${b.severity}] ${b.message}`).join("\n")}`,
            });
            logger_1.logger.info({ userId: change.userId, runId: change.runId, verdict: change.currentVerdict }, "Ship decision email sent");
        }
        catch (error) {
            logger_1.logger.error({ error: error.message, userId: change.userId }, "Failed to send ship decision email");
        }
    }
    /**
     * Send webhook notifications
     */
    async sendWebhookNotifications(change) {
        try {
            const subscriptions = await this.getWebhookSubscriptions(change.userId);
            for (const subscription of subscriptions) {
                if (!subscription.events.includes("ship.decision")) {
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
                await this.webhookService.deliverWebhook(subscription.id, `ship-decision-${change.runId}`, 1);
            }
            logger_1.logger.info({ userId: change.userId, runId: change.runId }, "Webhook notifications sent");
        }
        catch (error) {
            logger_1.logger.error({ error: error.message }, "Failed to send webhook notifications");
        }
    }
    /**
     * Send real-time UI update
     */
    async sendRealtimeUpdate(change) {
        try {
            enhanced_websocket_service_1.enhancedWebSocketService.broadcastToUser(change.userId, {
                type: "ship-decision-update",
                data: {
                    runId: change.runId,
                    verdict: change.currentVerdict,
                    score: change.score,
                    confidence: change.confidence,
                    blockers: change.blockers,
                },
            });
            logger_1.logger.debug({ userId: change.userId, runId: change.runId }, "Real-time update sent");
        }
        catch (error) {
            logger_1.logger.warn({ error: error.message }, "Failed to send real-time update");
        }
    }
    /**
     * Get user details
     */
    async getUser(userId) {
        const prisma = global.prisma;
        if (!prisma)
            return null;
        return await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true },
        });
    }
    /**
     * Get user notification preferences
     */
    async getUserPreferences(userId) {
        const prisma = global.prisma;
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
        }
        catch {
            return {
                emailNotifications: true,
                shipDecisionNotifications: true,
            };
        }
    }
    /**
     * Get webhook subscriptions for user
     */
    async getWebhookSubscriptions(userId) {
        const prisma = global.prisma;
        if (!prisma)
            return [];
        try {
            return await prisma.webhookSubscription.findMany({
                where: {
                    user_id: userId,
                    active: true,
                },
            });
        }
        catch {
            return [];
        }
    }
}
exports.ShipNotificationService = ShipNotificationService;
exports.shipNotificationService = new ShipNotificationService();
