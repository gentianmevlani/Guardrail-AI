import { prisma } from "@guardrail/database";
import { complianceAutomationEngine } from "../frameworks/engine";
import { evidenceCollector } from "./evidence-collector";
import { reportingEngine } from "./reporting-engine";
import { emailService } from "./email-service";
// import { auditLogger } from './audit-logger'; // Currently unused
// import { CronJob } from 'cron'; // Commented out until dependency is installed

interface ComplianceSchedule {
  id: string;
  projectId: string;
  frameworkId: string;
  frequency: string; // Cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  notifications?: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
}

interface ComplianceExecutionResult {
  scheduleId: string;
  executionId: string;
  startTime: Date;
  endTime: Date;
  status: "running" | "completed" | "failed";
  result?: {
    assessment?: any;
    evidence?: any;
    report?: any;
  };
  error?: string;
}

/**
 * Compliance Scheduler
 *
 * Manages scheduled compliance checks and notifications
 */
export class ComplianceScheduler {
  private jobs = new Map<string, any>();
  private executions = new Map<string, ComplianceExecutionResult>();

  /**
   * Initialize scheduler and load existing schedules
   */
  async initialize(): Promise<void> {
    const schedules = await prisma.complianceSchedule.findMany({
      where: { enabled: true },
    });

    for (const schedule of schedules) {
      await this.scheduleJob(schedule);
    }
  }

  /**
   * Create or update a schedule
   */
  async upsertSchedule(
    schedule: Omit<ComplianceSchedule, "id" | "lastRun" | "nextRun">,
  ): Promise<string> {
    if (!this.isValidCron(schedule.frequency)) {
      throw new Error("Invalid cron expression");
    }

    let dbSchedule: any;

    try {
      dbSchedule = await prisma.complianceSchedule.upsert({
        where: {
          id: `${schedule.projectId}_${schedule.frameworkId}`,
        },
        update: {
          schedule: schedule.frequency as any,
          enabled: schedule.enabled,
        },
        create: {
          projectId: schedule.projectId,
          frameworkId: schedule.frameworkId,
          schedule: schedule.frequency as any,
          enabled: schedule.enabled,
          nextRun: new Date(),
        } as any,
      });
    } catch (error) {
      console.warn("Could not upsert schedule in database:", error);
      // Create a mock schedule object for in-memory operation
      dbSchedule = {
        id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...schedule,
        lastRun: null,
        nextRun: new Date(),
      };
    }

    if (schedule.enabled) {
      await this.scheduleJob(dbSchedule);
    }

    return dbSchedule.id;
  }

  /**
   * Remove a schedule
   */
  async removeSchedule(projectId: string, frameworkId: string): Promise<void> {
    const jobKey = `${projectId}:${frameworkId}`;

    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey)!.stop();
      this.jobs.delete(jobKey);
    }

    try {
      await prisma.complianceSchedule.deleteMany({
        where: {
          projectId,
          frameworkId,
        },
      });
    } catch (error) {
      console.warn("Could not delete schedule from database:", error);
    }
  }

  /**
   * Run a compliance check
   */
  async runCheck(
    projectId: string,
    frameworkId: string,
    options?: {
      collectEvidence?: boolean;
      generateReport?: boolean;
      notifyOnCompletion?: boolean;
    },
  ): Promise<ComplianceExecutionResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result: ComplianceExecutionResult = {
      scheduleId: `${projectId}:${frameworkId}`,
      executionId,
      startTime: new Date(),
      endTime: new Date(),
      status: "running",
    };

    this.executions.set(executionId, result);

    try {
      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Run compliance assessment
      const assessment = await complianceAutomationEngine.assess(
        project.path || "",
        frameworkId,
        projectId,
      );

      // Collect evidence if requested
      let evidence: any = null;
      if (options?.collectEvidence !== false) {
        evidence = await evidenceCollector.collectForAssessment(
          projectId,
          frameworkId,
          assessment,
        );
      }

      // Generate report if requested
      let report: any = null;
      if (options?.generateReport) {
        report = await reportingEngine.generateReport({
          projectId,
          frameworkId,
          type: "compliance",
          format: "json",
          includeEvidence: !!evidence,
          includeRecommendations: true,
          includeCharts: false,
        });
      }

      // Update result
      result.result = {
        assessment,
        evidence,
        report,
      };
      result.status = "completed";
      result.endTime = new Date();

      // Send notifications if requested
      if (options?.notifyOnCompletion) {
        setTimeout(() => {
          this.sendNotifications(projectId, frameworkId, result);
        }, 1000);
      }
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : "Unknown error";
      result.endTime = new Date();
    }

    return result;
  }

  /**
   * Get execution status
   */
  getExecutionStatus(
    executionId: string,
  ): ComplianceExecutionResult | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all schedules
   */
  async getSchedules(projectId?: string): Promise<ComplianceSchedule[]> {
    const schedules = await prisma.complianceSchedule.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { nextRun: "asc" },
    });

    return schedules.map((s: any) => ({
      id: s.id,
      projectId: s.projectId,
      frameworkId: s.frameworkId,
      frequency: (s as any).schedule,
      enabled: s.enabled,
      lastRun: s.lastRun || undefined,
      nextRun: s.nextRun || undefined,
      notifications: (s as any).notifications || undefined,
    }));
  }

  /**
   * Schedule a job
   */
  private async scheduleJob(schedule: any): Promise<void> {
    const jobKey = `${schedule.projectId}:${schedule.frameworkId}`;

    // Remove existing job if any
    if (this.jobs.has(jobKey)) {
      this.jobs.get(jobKey)!.stop();
    }

    // Create new cron job
    // const job = new CronJob(schedule.schedule, async () => {
    //   await this.executeScheduledCheck(schedule);
    // }, null, true, 'UTC');

    // this.jobs.set(jobKey, job);

    // Update next run time
    try {
      await prisma.complianceSchedule.update({
        where: { id: schedule.id },
        data: { nextRun: new Date() },
      });
    } catch (error) {
      console.warn("Could not update next run time in database:", error);
    }
  }

  // Execute a scheduled check - currently unused
  /*
  private async executeScheduledCheck(schedule: any): Promise<void> {
    try {
      const result = await this.runCheck(
        schedule.projectId,
        schedule.frameworkId,
        {
          collectEvidence: true,
          generateReport: true,
          notifyOnCompletion: true
        }
      );

      // Update last run time
      try {
        await prisma.complianceSchedule.update({
          where: { id: schedule.id },
          data: { lastRun: new Date() }
        });
      } catch (error) {
        console.warn('Could not update last run time in database:', error);
      }

      // Check for compliance failures and send alerts
      if (result.result?.assessment?.summary?.score < 70) {
        await this.sendAlert(schedule, result);
      }

    } catch (error) {
      console.error(`Scheduled check failed for ${schedule.projectId}:${schedule.frameworkId}:`, error);
      await this.sendErrorAlert(schedule, error);
    }
  }
  */

  /**
   * Send notifications for completed checks
   */
  private async sendNotifications(
    projectId: string,
    frameworkId: string,
    result: ComplianceExecutionResult,
  ): Promise<void> {
    try {
      const schedule = await prisma.complianceSchedule.findFirst({
        where: {
          projectId,
          frameworkId,
        },
      });

      if (!(schedule as any)?.notifications) return;

      const notifications = (schedule as any).notifications;

      // Send email notifications
      if (notifications.email?.length) {
        const score = result.result?.assessment?.summary?.score;
        const status = result.status === "completed" ? "completed" : "failed";

        const emailResult = await emailService.sendComplianceNotification(
          notifications.email,
          projectId,
          frameworkId,
          {
            status,
            score,
            summary: result.error || undefined,
          },
        );

        if (!emailResult.success) {
          console.error(
            `Failed to send compliance email to ${notifications.email.join(", ")}: ${emailResult.error}`,
          );
        } else {
          console.log(
            `Sent compliance check email to ${notifications.email.join(", ")} (messageId: ${emailResult.messageId})`,
          );
        }
      }

      // Send Slack notifications
      if (notifications.slack) {
        try {
          const score = result.result?.assessment?.summary?.score || 0;
          const status =
            score >= 90 ? "passed" : score >= 70 ? "warning" : "failed";
          const statusIcon =
            status === "passed" ? "✅" : status === "warning" ? "⚠️" : "❌";

          const slackPayload = {
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: `${statusIcon} Compliance Check ${status.toUpperCase()}`,
                  emoji: true,
                },
              },
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Project:*\n${projectId}`,
                  },
                  {
                    type: "mrkdwn",
                    text: `*Framework:*\n${frameworkId}`,
                  },
                ],
              },
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Score:*\n${score}%`,
                  },
                  {
                    type: "mrkdwn",
                    text: `*Status:*\n${status}`,
                  },
                ],
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `Check completed at ${new Date().toLocaleString()}`,
                },
              },
            ],
          };

          await fetch(notifications.slack, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload),
          });
          console.log(`Sending Slack notification to ${notifications.slack}`);
        } catch (slackError) {
          console.error("Failed to send Slack notification:", slackError);
        }
      }

      // Send webhook notifications
      if (notifications.webhook) {
        console.log(`Sending webhook notification to ${notifications.webhook}`);
        try {
          const response = await fetch(notifications.webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(result),
          });

          if (!response.ok) {
            console.error(
              `Failed to send webhook notification: ${response.status} ${response.statusText}`,
            );
          }
        } catch (webhookError) {
          console.error("Error sending webhook notification:", webhookError);
        }
      }
    } catch (error) {
      console.error("Failed to send notifications:", error);
    }
  }

  /*
  private async sendAlert(schedule: any, result: ComplianceExecutionResult): Promise<void> {
    const score = result.result?.assessment?.summary?.score || 0;
    const message = `Compliance check failed for project ${schedule.projectId} (${schedule.frameworkId}). Score: ${score}%`;

    await auditLogger.logEvent({
      type: 'compliance_failure',
      category: 'compliance',
      projectId: schedule.projectId,
      timestamp: new Date(),
      severity: 'high',
      source: 'scheduler',
      details: {
        action: 'Compliance check failed',
        framework: schedule.frameworkId,
        score,
        message
      }
    });

    await this.sendNotifications(schedule.projectId, schedule.frameworkId, result);
  }
  */

  /*
  private async sendErrorAlert(schedule: any, error: any): Promise<void> {
    await auditLogger.logEvent({
      type: 'compliance_error',
      category: 'system',
      projectId: schedule.projectId,
      timestamp: new Date(),
      severity: 'critical',
      source: 'scheduler',
      details: {
        action: 'Compliance check error',
        framework: schedule.frameworkId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
  */

  /**
   * Validate cron expression
   */
  private isValidCron(cron: string): boolean {
    // Basic validation - should be more sophisticated
    const parts = cron.split(" ");
    return parts.length === 5;
  }

  /**
   * Stop all jobs
   */
  stopAll(): void {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }
}

// Export singleton instance
export const complianceScheduler = new ComplianceScheduler();
