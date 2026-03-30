/**
 * Critical Finding Alerts Service
 * 
 * Sends immediate notifications for critical findings to help users respond quickly.
 */

import { prisma } from '@guardrail/database';
import { logger } from '../logger';
import { emailNotificationService } from "./email-notification-service";

export interface CriticalFinding {
  id: string;
  type: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  scanId: string;
  userId: string;
}

/**
 * Send alert for critical findings
 */
export async function sendCriticalFindingAlert(
  finding: CriticalFinding,
): Promise<void> {
  if (process.env.ENABLE_CRITICAL_ALERTS === 'false') {
    return;
  }

  try {
    // Get user notification preferences
    const user = await prisma.user.findUnique({
      where: { id: finding.userId },
      select: {
        email: true,
        notificationPreferences: {
          where: {
            type: 'email',
            enabled: true,
            events: { has: 'critical_finding' },
          },
        },
      },
    });

    if (!user || !user.email) {
      logger.warn({ userId: finding.userId }, 'User not found or no email for critical alert');
      return;
    }

    // Check if we've already sent an alert for this finding (deduplication)
    const recentAlert = await prisma.auditEvent.findFirst({
      where: {
        userId: finding.userId,
        type: 'critical_finding_alert',
        metadata: {
          path: ['findingId'],
          equals: finding.id,
        },
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (recentAlert) {
      logger.debug({ findingId: finding.id }, 'Critical alert already sent recently, skipping');
      return;
    }

    // Get scan details for context
    const scan = await prisma.scan.findUnique({
      where: { id: finding.scanId },
      select: {
        projectPath: true,
        branch: true,
        createdAt: true,
      },
    });

    // Send email alert
    const subject = `🚨 Critical Finding: ${finding.type} in ${finding.file}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
            .finding { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc2626; }
            .detail { margin: 10px 0; }
            .label { font-weight: bold; color: #6b7280; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Critical Finding Detected</h1>
            </div>
            <div class="content">
              <p>A critical finding was detected in your codebase:</p>
              
              <div class="finding">
                <div class="detail">
                  <span class="label">Type:</span> ${finding.type}
                </div>
                <div class="detail">
                  <span class="label">File:</span> ${finding.file}:${finding.line}
                </div>
                <div class="detail">
                  <span class="label">Message:</span> ${finding.message}
                </div>
                ${scan ? `
                <div class="detail">
                  <span class="label">Project:</span> ${scan.projectPath || 'Unknown'}
                </div>
                <div class="detail">
                  <span class="label">Branch:</span> ${scan.branch}
                </div>
                ` : ''}
              </div>

              <a href="${process.env.FRONTEND_URL || 'https://guardrail.dev'}/dashboard/findings" class="button">
                View Finding
              </a>

              <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
                You're receiving this because critical finding alerts are enabled in your notification preferences.
                <a href="${process.env.FRONTEND_URL || 'https://guardrail.dev'}/settings/notifications">Manage preferences</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Critical Finding Detected

Type: ${finding.type}
File: ${finding.file}:${finding.line}
Message: ${finding.message}
${scan ? `Project: ${scan.projectPath || 'Unknown'}\nBranch: ${scan.branch}` : ''}

View at: ${process.env.FRONTEND_URL || 'https://guardrail.dev'}/dashboard/findings
    `.trim();

    await emailNotificationService.sendEmail({
      to: user.email,
      subject,
      html,
      text,
    });

    // Log alert sent
    await prisma.auditEvent.create({
      data: {
        type: 'critical_finding_alert',
        category: 'notifications',
        userId: finding.userId,
        severity: 'high',
        source: 'system',
        metadata: {
          findingId: finding.id,
          scanId: finding.scanId,
          file: finding.file,
          line: finding.line,
          type: finding.type,
        },
      },
    });

    logger.info(
      { findingId: finding.id, userId: finding.userId, email: user.email },
      'Critical finding alert sent',
    );
  } catch (error) {
    logger.error(
      { error, findingId: finding.id, userId: finding.userId },
      'Failed to send critical finding alert',
    );
  }
}

/**
 * Check for critical findings in a scan and send alerts
 */
export async function checkAndAlertCriticalFindings(scanId: string): Promise<void> {
  try {
    const criticalFindings = await prisma.finding.findMany({
      where: {
        scanId,
        severity: 'critical',
        status: 'open',
      },
      include: {
        scan: {
          select: {
            userId: true,
          },
        },
      },
      take: 10, // Limit to prevent spam
    });

    for (const finding of criticalFindings) {
      await sendCriticalFindingAlert({
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        message: finding.message,
        scanId: finding.scanId,
        userId: finding.scan.userId,
      });
    }

    if (criticalFindings.length > 0) {
      logger.info(
        { scanId, count: criticalFindings.length },
        'Critical finding alerts processed',
      );
    }
  } catch (error) {
    logger.error({ error, scanId }, 'Failed to check critical findings');
  }
}
