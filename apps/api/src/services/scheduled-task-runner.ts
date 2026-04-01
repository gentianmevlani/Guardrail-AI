/**
 * Scheduled Task Runner Service
 * 
 * Handles automated execution of scheduled tasks:
 * - Compliance report generation (ReportSchedule)
 * - Cleanup jobs
 * - Scheduled scans
 * - Other recurring tasks
 */

import { prisma } from "@guardrail/database";
import { logger } from "../logger";
import { enqueueScan } from "../lib/queue";
import { EmailNotificationService } from "./email-notification-service";

export interface ScheduledTask {
  id: string;
  type: 'compliance_report' | 'cleanup' | 'scheduled_scan' | 'usage_sync';
  scheduleId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  nextRun: Date;
}

interface GeneratedComplianceReport {
  id: string;
  content: string;
  filename: string;
  format: string;
}

export class ScheduledTaskRunner {
  private emailService: EmailNotificationService;
  private running: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

  constructor() {
    this.emailService = new EmailNotificationService();
  }

  /**
   * Start the scheduled task runner
   */
  start(): void {
    if (this.running) {
      logger.warn("Scheduled task runner already running");
      return;
    }

    this.running = true;
    logger.info("Starting scheduled task runner");

    // Run immediately on start
    this.processScheduledTasks().catch((error) => {
      logger.error({ error }, "Error in initial scheduled task run");
    });

    // Then check every minute
    this.checkInterval = setInterval(() => {
      this.processScheduledTasks().catch((error) => {
        logger.error({ error }, "Error processing scheduled tasks");
      });
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the scheduled task runner
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info("Scheduled task runner stopped");
  }

  /**
   * Process all scheduled tasks that are due
   */
  async processScheduledTasks(): Promise<void> {
    if (!this.running) {
      return;
    }

    const now = new Date();
    const tasks: ScheduledTask[] = [];

    try {
      // Find compliance report schedules that are due
      const dueReportSchedules = await prisma.reportSchedule.findMany({
        where: {
          enabled: true,
          nextRun: { lte: now },
        },
        include: {
          project: {
            include: {
              user: true,
            },
          },
        },
      });

      for (const schedule of dueReportSchedules) {
        tasks.push({
          id: schedule.id,
          type: 'compliance_report',
          scheduleId: schedule.id,
          projectId: schedule.projectId,
          metadata: {
            frameworkId: schedule.frameworkId,
            frequency: schedule.frequency,
            format: schedule.format,
            recipients: schedule.recipients,
          },
          nextRun: schedule.nextRun,
        });
      }

      // Process each task
      for (const task of tasks) {
        try {
          await this.executeTask(task);
        } catch (error) {
          logger.error(
            { error, taskId: task.id, taskType: task.type },
            "Failed to execute scheduled task"
          );
        }
      }
    } catch (error) {
      logger.error({ error }, "Error finding scheduled tasks");
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    logger.info(
      { taskId: task.id, taskType: task.type },
      "Executing scheduled task"
    );

    switch (task.type) {
      case 'compliance_report':
        await this.generateComplianceReport(task);
        break;
      case 'cleanup':
        await this.runCleanupTask(task);
        break;
      case 'scheduled_scan':
        await this.runScheduledScan(task);
        break;
      case 'usage_sync':
        await this.syncUsageData(task);
        break;
      default:
        logger.warn({ taskType: task.type }, "Unknown task type");
    }
  }

  /**
   * Generate a compliance report for a scheduled task
   */
  private async generateComplianceReport(task: ScheduledTask): Promise<void> {
    if (!task.scheduleId || !task.projectId) {
      throw new Error("Missing required fields for compliance report");
    }

    const schedule = await prisma.reportSchedule.findUnique({
      where: { id: task.scheduleId },
      include: {
        project: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new Error(`Report schedule ${task.scheduleId} not found`);
    }

    const { frameworkId, format, recipients } = task.metadata || {};

    try {
      // Generate the report
      const report = await this.generateReport(
        task.projectId!,
        frameworkId as string,
        format as string || 'html',
        schedule
      );

      // Update schedule with last run and calculate next run
      const nextRun = this.calculateNextRun(
        schedule.frequency,
        schedule.nextRun
      );

      await prisma.reportSchedule.update({
        where: { id: task.scheduleId },
        data: {
          lastRun: new Date(),
          nextRun,
        },
      });

      // Send report to recipients
      if (recipients && Array.isArray(recipients) && recipients.length > 0) {
        await this.sendReportToRecipients(
          report,
          recipients as string[],
          schedule.project.user.email
        );
      }

      logger.info(
        {
          scheduleId: task.scheduleId,
          projectId: task.projectId,
          reportId: report.id,
          nextRun,
        },
        "Compliance report generated and sent"
      );
    } catch (error) {
      logger.error(
        { error, scheduleId: task.scheduleId, projectId: task.projectId },
        "Failed to generate compliance report"
      );
      throw error;
    }
  }

  /**
   * Generate a compliance report
   */
  private async generateReport(
    projectId: string,
    frameworkId: string,
    format: string,
    schedule: any
  ): Promise<GeneratedComplianceReport> {
    // Calculate period dates
    const now = new Date();
    const periodEnd = now;
    const periodStart = this.calculatePeriodStart(schedule.frequency, periodEnd);

    // Get compliance assessment data
    const assessment = await prisma.complianceAssessment.findFirst({
      where: {
        projectId,
        frameworkId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!assessment) {
      throw new Error(`No compliance assessment found for project ${projectId} and framework ${frameworkId}`);
    }

    // Generate report content based on format
    let reportContent: string;
    let filename: string;

    if (format === 'json') {
      reportContent = JSON.stringify({
        projectId,
        frameworkId,
        periodStart,
        periodEnd,
        summary: assessment.summary,
        controls: assessment.controls,
        gaps: assessment.gaps,
        generatedAt: new Date(),
      }, null, 2);
      filename = `compliance-report-${projectId}-${Date.now()}.json`;
    } else {
      // HTML format (default)
      reportContent = this.generateHtmlReport(assessment, periodStart, periodEnd);
      filename = `compliance-report-${projectId}-${Date.now()}.html`;
    }

    // Create report record
    const report = await prisma.complianceReport.create({
      data: {
        projectId,
        frameworkId,
        type: 'compliance',
        format,
        periodStart,
        periodEnd,
        summary: assessment.summary,
        controls: assessment.controls,
        gaps: assessment.gaps,
        status: 'approved',
        generatedAt: new Date(),
      },
    });

    return {
      id: report.id,
      content: reportContent,
      filename,
      format,
    };
  }

  /**
   * Generate HTML report content
   */
  private generateHtmlReport(assessment: any, periodStart: Date, periodEnd: Date): string {
    const summary = assessment.summary as any || {};
    const controls = assessment.controls as any || {};
    const gaps = assessment.gaps as any || {};

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Compliance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .control { margin: 10px 0; padding: 10px; border-left: 3px solid #007bff; }
    .gap { margin: 10px 0; padding: 10px; border-left: 3px solid #dc3545; background: #fff5f5; }
    .score { font-size: 24px; font-weight: bold; color: #28a745; }
  </style>
</head>
<body>
  <h1>Compliance Report</h1>
  <p><strong>Period:</strong> ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Overall Score:</strong> <span class="score">${summary.score || 'N/A'}%</span></p>
    <p><strong>Total Controls:</strong> ${summary.totalControls || 0}</p>
    <p><strong>Compliant Controls:</strong> ${summary.compliantControls || 0}</p>
    <p><strong>Non-Compliant Controls:</strong> ${summary.nonCompliantControls || 0}</p>
  </div>

  <h2>Controls Assessment</h2>
  ${Object.entries(controls).map(([key, value]: [string, any]) => `
    <div class="control">
      <strong>${key}:</strong> ${value.status || 'Unknown'}
      ${value.description ? `<p>${value.description}</p>` : ''}
    </div>
  `).join('')}

  ${gaps && Object.keys(gaps).length > 0 ? `
    <h2>Compliance Gaps</h2>
    ${Object.entries(gaps).map(([key, value]: [string, any]) => `
      <div class="gap">
        <strong>${key}:</strong> ${value.description || 'No description'}
        ${value.severity ? `<p><strong>Severity:</strong> ${value.severity}</p>` : ''}
      </div>
    `).join('')}
  ` : ''}

  <p><em>Report generated on ${new Date().toLocaleString()}</em></p>
</body>
</html>
    `.trim();
  }

  /**
   * Send report to recipients
   */
  private async sendReportToRecipients(
    report: GeneratedComplianceReport,
    recipients: string[],
    projectOwnerEmail?: string | null
  ): Promise<void> {
    const ownerList =
      projectOwnerEmail != null && projectOwnerEmail !== ""
        ? [projectOwnerEmail]
        : [];
    const allRecipients = [...new Set([...recipients, ...ownerList])];

    for (const email of allRecipients) {
      try {
        await this.emailService.sendEmail({
          to: email,
          subject: `Compliance Report - ${report.filename}`,
          html: `
            <p>Your scheduled compliance report is ready.</p>
            <p>Please find the report attached.</p>
            <p>If you have any questions, please contact support.</p>
          `,
          text: `Your scheduled compliance report is ready. Please check the attached file.`,
          attachments: report.format === 'json' ? [] : [], // TODO: Add file attachment support
        });

        logger.info({ email, reportId: report.id }, "Report sent to recipient");
      } catch (error) {
        logger.error({ error, email, reportId: report.id }, "Failed to send report to recipient");
      }
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: string, currentNextRun: Date): Date {
    const next = new Date(currentNextRun);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      default:
        next.setDate(next.getDate() + 7); // Default to weekly
    }

    return next;
  }

  /**
   * Calculate period start date based on frequency
   */
  private calculatePeriodStart(frequency: string, periodEnd: Date): Date {
    const start = new Date(periodEnd);

    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }

    return start;
  }

  /**
   * Run cleanup tasks
   */
  private async runCleanupTask(task: ScheduledTask): Promise<void> {
    logger.info({ taskId: task.id }, "Running cleanup task");

    // Clean up old scan records (older than 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const deletedScans = await prisma.scan.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ['completed', 'failed'] },
      },
    });

    // Clean up old audit logs (older than 1 year)
    const auditCutoffDate = new Date();
    auditCutoffDate.setFullYear(auditCutoffDate.getFullYear() - 1);

    const deletedAuditLogs = await prisma.adminAuditLog.deleteMany({
      where: {
        timestamp: { lt: auditCutoffDate },
      },
    });

    logger.info(
      {
        deletedScans: deletedScans.count,
        deletedAuditLogs: deletedAuditLogs.count,
      },
      "Cleanup task completed"
    );
  }

  /**
   * Run scheduled scan
   */
  private async runScheduledScan(task: ScheduledTask): Promise<void> {
    if (!task.projectId) {
      throw new Error("Project ID required for scheduled scan");
    }

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { user: true },
    });

    if (!project) {
      throw new Error(`Project ${task.projectId} not found`);
    }

    // Enqueue scan job
    await enqueueScan({
      scanId: `scheduled_${Date.now()}_${task.projectId}`,
      userId: project.userId,
      localPath: project.path || undefined,
      repositoryUrl: project.repositoryUrl || undefined,
      branch: 'main',
    });

    logger.info({ projectId: task.projectId }, "Scheduled scan enqueued");
  }

  /**
   * Sync usage data
   */
  private async syncUsageData(task: ScheduledTask): Promise<void> {
    logger.info({ taskId: task.id }, "Syncing usage data");
    // TODO: Implement usage data synchronization
  }
}

// Singleton instance
let taskRunnerInstance: ScheduledTaskRunner | null = null;

export function getScheduledTaskRunner(): ScheduledTaskRunner {
  if (!taskRunnerInstance) {
    taskRunnerInstance = new ScheduledTaskRunner();
  }
  return taskRunnerInstance;
}
