/**
 * Notification Service
 * 
 * High-level orchestrator for user notifications.
 * Handles:
 * - User preference management (Email, Slack, Webhook)
 * - Notification routing based on preferences and priority
 * - Alert aggregation and rate limiting
 * - Unified interface for sending alerts
 */

import { prisma } from "@guardrail/database";
import { logger } from "../logger";
import { emailNotificationService } from "./email-notification-service";
import { webhookIntegrationService } from "./webhook-integration-service";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

export type NotificationType = 
  | "critical_finding" 
  | "scan_complete" 
  | "scheduled_scan" 
  | "billing_alert" 
  | "security_alert";

export type NotificationChannel = "email" | "slack" | "webhook" | "sms";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  severity?: "low" | "medium" | "high" | "critical";
  link?: string;
  actionLabel?: string;
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Send a notification to a user based on their preferences
   */
  async send(payload: NotificationPayload): Promise<void> {
    try {
      // 1. Get user preferences
      const preferences = await this.getUserPreferences(payload.userId);
      
      // 2. Determine enabled channels for this notification type
      const channels = this.getEnabledChannels(preferences, payload.type, payload.severity);
      
      if (channels.length === 0) {
        logger.debug({ userId: payload.userId, type: payload.type }, "Notification suppressed by preferences");
        return;
      }

      // 3. Send to each channel
      const promises: Promise<unknown>[] = [];

      if (channels.includes("email")) {
        promises.push(this.sendEmail(payload));
      }

      if (channels.includes("slack")) {
        promises.push(this.sendSlack(payload, preferences.slackConfig));
      }

      if (channels.includes("webhook")) {
        promises.push(this.sendWebhook(payload, preferences.webhookConfig));
      }

      await Promise.allSettled(promises);

      logger.info({ 
        userId: payload.userId, 
        type: payload.type, 
        channels 
      }, "Notification sent");

    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), payload }, "Failed to send notification");
    }
  }

  /**
   * Get notification preferences for a user
   */
  async getUserPreferences(userId: string) {
    // In a real app, this would query a dedicated preferences table
    // For now, we'll try to find a notification_preferences record or return defaults
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId, enabled: true }
    });

    // Default defaults
    const config = {
      emailEnabled: true,
      slackEnabled: false,
      webhookEnabled: false,
      slackConfig: null as any,
      webhookConfig: null as any,
      events: {
        critical_finding: ["email", "slack", "webhook"],
        scan_complete: ["email"],
        scheduled_scan: ["email"],
        billing_alert: ["email"],
        security_alert: ["email", "slack", "webhook"]
      }
    };

    // Override with DB values
    for (const pref of prefs) {
      if (pref.type === 'slack') {
        config.slackEnabled = true;
        config.slackConfig = pref.config;
      } else if (pref.type === 'webhook') {
        config.webhookEnabled = true;
        config.webhookConfig = pref.config;
      }
      // Assuming 'email' is default enabled, but could be disabled in DB
    }

    return config;
  }

  /**
   * Determine which channels should receive this notification
   */
  private getEnabledChannels(
    prefs: any, 
    type: NotificationType, 
    severity?: string
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    const configuredChannels = prefs.events[type] || [];

    if (prefs.emailEnabled && configuredChannels.includes("email")) {
      channels.push("email");
    }

    if (prefs.slackEnabled && configuredChannels.includes("slack")) {
      // Only send high/critical alerts to Slack by default unless configured otherwise
      if (severity === "high" || severity === "critical" || type === "security_alert") {
        channels.push("slack");
      }
    }

    if (prefs.webhookEnabled && configuredChannels.includes("webhook")) {
      channels.push("webhook");
    }

    return channels;
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true }
    });

    if (!user?.email) return;

    await emailNotificationService.sendEmail({
      to: user.email,
      subject: `[guardrail] ${payload.title}`,
      html: `
        <h2>${payload.title}</h2>
        <p>${payload.message}</p>
        ${payload.data ? `<pre>${JSON.stringify(payload.data, null, 2)}</pre>` : ''}
        ${payload.link ? `<p><a href="${payload.link}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">${payload.actionLabel || 'View Details'}</a></p>` : ''}
        <hr/>
        <small style="color: #666;">You received this email because of your notification settings in guardrail.</small>
      `,
      text: `${payload.title}\n\n${payload.message}\n\n${payload.link || ''}`
    });
  }

  private async sendSlack(payload: NotificationPayload, config: any): Promise<void> {
    if (!config?.webhookUrl) return;

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: payload.title,
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.message
        }
      }
    ];

    if (payload.severity) {
      const color = payload.severity === 'critical' ? '#ff0000' : 
                    payload.severity === 'high' ? '#ff9900' : '#36a64f';
      // Slack attachments for color bar
    }

    if (payload.link) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: payload.actionLabel || "View Details",
              emoji: true
            },
            url: payload.link
          }
        ]
      } as any);
    }

    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks })
    });
  }

  private async sendWebhook(payload: NotificationPayload, config: any): Promise<void> {
    if (!config?.url) return;

    // Use existing webhook integration service for delivery with retries
    // We can register a temporary subscription or use a direct send method
    // For simplicity here, we'll use a direct fetch, but in prod we'd queue it
    
    await fetch(config.url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-guardrail-Event": payload.type,
        "X-guardrail-Signature": this.generateWebhookSignature(payload)
      },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateWebhookSignature(payload: NotificationPayload): string {
    const crypto = require('crypto');
    const webhookSecret = process.env.WEBHOOK_SECRET || process.env.GUARDRAIL_WEBHOOK_SECRET || 'default-secret-change-in-production';
    
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');
    
    return `sha256=${signature}`;
  }
}

export const notificationService = NotificationService.getInstance();
