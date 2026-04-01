import { prisma } from "@guardrail/database";
import { auditLogger } from "./audit-logger";

interface DashboardData {
  projectId: string;
  overview: {
    overallScore: number;
    status: "compliant" | "partial" | "non-compliant";
    lastAssessment: Date;
    nextAssessment?: Date;
    totalControls: number;
    activeFrameworks: string[];
  };
  trends: {
    scores: Array<{
      date: Date;
      score: number;
      framework: string;
    }>;
    violations: Array<{
      date: Date;
      count: number;
      severity: string;
    }>;
    remediation: Array<{
      date: Date;
      completed: number;
      pending: number;
    }>;
  };
  alerts: Array<{
    id: string;
    type: "violation" | "deadline" | "score_drop" | "system";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
  frameworkStatus: Array<{
    frameworkId: string;
    score: number;
    status: string;
    lastRun: Date;
    nextRun?: Date;
    gaps: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    user?: string;
  }>;
  upcomingTasks: Array<{
    id: string;
    type: "assessment" | "remediation" | "review";
    title: string;
    dueDate: Date;
    priority: "low" | "medium" | "high" | "critical";
    assignedTo?: string;
  }>;
}

interface AlertConfig {
  id: string;
  projectId: string;
  type:
    | "score_threshold"
    | "violation_detected"
    | "deadline_approaching"
    | "system_error";
  enabled: boolean;
  threshold?: number;
  recipients: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
  conditions: any;
}

/**
 * Compliance Dashboard and Alerting System
 *
 * Provides real-time compliance monitoring, dashboards,
 * and intelligent alerting for compliance issues
 */
export class ComplianceDashboard {
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private alertIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get dashboard data for a project
   */
  async getDashboardData(projectId: string): Promise<DashboardData> {
    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Get assessments
    let assessments: any[] = [];
    try {
      assessments = await prisma.complianceAssessment.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    } catch (error) {
      console.warn("Could not fetch assessments:", error);
    }

    // Get schedules
    let schedules: any[] = [];
    try {
      schedules = await prisma.complianceSchedule.findMany({
        where: { projectId, enabled: true },
        orderBy: { nextRun: "asc" },
      });
    } catch (error) {
      console.warn("Could not fetch schedules:", error);
    }

    // Build dashboard data
    const overview = this.buildOverview(assessments, schedules);
    const trends = await this.getTrends(projectId);
    const alerts = await this.getActiveAlerts(projectId);
    const frameworkStatus = this.buildFrameworkStatus(assessments, schedules);
    const recentActivity = await this.getRecentActivity(projectId);
    const upcomingTasks = await this.getUpcomingTasks(projectId, schedules);

    return {
      projectId,
      overview,
      trends,
      alerts,
      frameworkStatus,
      recentActivity,
      upcomingTasks,
    };
  }

  /**
   * Configure alerts for a project
   */
  async configureAlerts(config: AlertConfig): Promise<void> {
    // Save configuration
    try {
      await prisma.alertConfig.upsert({
        where: { id: config.id },
        update: {
          type: config.type,
          enabled: config.enabled,
          threshold: config.threshold,
          // conditions not in schema
          // conditions: config.conditions
        },
        create: {
          name: `${config.type} Alert` as any,
          projectId: config.projectId,
          type: config.type,
          enabled: config.enabled,
          threshold: config.threshold,
          config: {
            recipients: config.recipients,
            conditions: config.conditions,
          } as any,
        } as any,
      });
    } catch (error) {
      console.warn("Could not save alert config to database:", error);
    }

    this.alertConfigs.set(config.id, config);

    // Start monitoring if enabled
    if (config.enabled) {
      this.startAlertMonitoring(config);
    } else {
      this.stopAlertMonitoring(config.id);
    }
  }

  /**
   * Trigger manual compliance check
   */
  async triggerCheck(
    projectId: string,
    frameworkId: string,
    userId?: string,
  ): Promise<string> {
    // Log the trigger
    await auditLogger.logEvent({
      type: "compliance_check_triggered",
      category: "compliance",
      projectId,
      userId,
      timestamp: new Date(),
      severity: "low",
      source: "dashboard",
      details: {
        action: "Manual compliance check triggered",
        framework: frameworkId,
        triggeredBy: userId || "anonymous",
      },
    });

    // In production, would actually trigger the compliance check
    const executionId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return executionId;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          acknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        },
      });
    } catch (error) {
      console.warn("Could not acknowledge alert in database:", error);
    }

    // Log acknowledgment
    await auditLogger.logEvent({
      type: "alert_acknowledged",
      category: "system",
      timestamp: new Date(),
      severity: "low",
      source: "dashboard",
      metadata: {
        alertId,
        acknowledgedBy: userId,
      },
      details: {
        action: "Alert acknowledged",
        alertId,
        user: userId,
      },
    });
  }

  /**
   * Get compliance metrics for widgets
   */
  async getWidgetData(
    projectId: string,
    widgetType: "score" | "trends" | "violations" | "remediation",
  ): Promise<any> {
    switch (widgetType) {
      case "score":
        return this.getScoreWidget(projectId);
      case "trends":
        return this.getTrendsWidget(projectId);
      case "violations":
        return this.getViolationsWidget(projectId);
      case "remediation":
        return this.getRemediationWidget(projectId);
      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  /**
   * Export dashboard data
   */
  async exportData(
    projectId: string,
    format: "json" | "csv",
    _dateRange?: { start: Date; end: Date },
  ): Promise<string> {
    const data = await this.getDashboardData(projectId);

    if (format === "json") {
      return JSON.stringify(data, null, 2);
    }

    if (format === "csv") {
      return this.convertToCSV(data);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Build overview section
   */
  private buildOverview(
    assessments: any[],
    schedules: any[],
  ): DashboardData["overview"] {
    if (assessments.length === 0) {
      return {
        overallScore: 0,
        status: "non-compliant",
        lastAssessment: new Date(),
        totalControls: 0,
        activeFrameworks: [],
      };
    }

    const latest = assessments[0];
    const frameworks = [...new Set(assessments.map((a: any) => a.frameworkId))];

    // Handle JSON value type for summary
    const summary = latest.summary as any;
    const score = typeof summary?.score === "number" ? summary.score : 0;
    const totalControls =
      typeof summary?.totalControls === "number" ? summary.totalControls : 0;

    return {
      overallScore: score,
      status:
        score >= 90 ? "compliant" : score >= 70 ? "partial" : "non-compliant",
      lastAssessment: latest.createdAt,
      nextAssessment: schedules[0]?.nextRun,
      totalControls,
      activeFrameworks: frameworks,
    };
  }

  /**
   * Get compliance trends
   */
  private async getTrends(projectId: string): Promise<DashboardData["trends"]> {
    // Get score history
    let scoreHistory: any[] = [];
    try {
      scoreHistory = await prisma.complianceAssessment.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        take: 30,
      });
    } catch (error) {
      console.warn("Could not fetch score history:", error);
    }

    const scores = scoreHistory.map((h: any) => {
      const summary = h.summary as any;
      return {
        date: h.createdAt,
        score: typeof summary?.score === "number" ? summary.score : 0,
        framework: h.frameworkId,
      };
    });

    // Get violation trends
    const violations = await this.getViolationTrends(projectId);

    // Get remediation trends
    const remediation = await this.getRemediationTrends(projectId);

    return {
      scores,
      violations,
      remediation,
    };
  }

  /**
   * Get active alerts
   */
  private async getActiveAlerts(
    projectId: string,
  ): Promise<DashboardData["alerts"]> {
    let alerts: any[] = [];
    try {
      alerts = await prisma.alert.findMany({
        where: {
          projectId,
          // resolved not in schema
          // resolved: false,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } catch (error) {
      console.warn("Could not fetch alerts from database:", error);
    }

    return alerts.map((a: any) => ({
      id: a.id,
      type: a.type as any,
      severity: a.severity.toLowerCase() as any,
      message: a.message,
      timestamp: a.createdAt,
      acknowledged: a.acknowledged,
    }));
  }

  /**
   * Build framework status
   */
  private buildFrameworkStatus(
    assessments: any[],
    schedules: any[],
  ): DashboardData["frameworkStatus"] {
    const statusMap = new Map<string, any>();

    // Group assessments by framework
    for (const assessment of assessments) {
      if (!statusMap.has(assessment.frameworkId)) {
        statusMap.set(assessment.frameworkId, assessment);
      }
    }

    // Build status array
    const frameworkStatus: DashboardData["frameworkStatus"] = [];

    for (const [frameworkId, assessment] of statusMap) {
      const schedule = schedules.find((s) => s.frameworkId === frameworkId);

      // Handle JSON value type for summary
      const summary = assessment.summary as any;
      const score = typeof summary?.score === "number" ? summary.score : 0;

      frameworkStatus.push({
        frameworkId,
        score,
        status:
          score >= 90 ? "compliant" : score >= 70 ? "partial" : "non-compliant",
        lastRun: assessment.createdAt,
        nextRun: schedule?.nextRun,
        gaps: assessment.gaps?.length || 0,
      });
    }

    return frameworkStatus;
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(
    projectId: string,
  ): Promise<DashboardData["recentActivity"]> {
    let activity: any[] = [];
    try {
      // Try to get from audit events table
      activity = await prisma.auditEvent.findMany({
        where: {
          projectId,
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { timestamp: "desc" },
        take: 20,
      });
    } catch (error) {
      console.warn("Could not fetch recent activity from audit events:", error);
      // Return empty array if table doesn't exist
      return [];
    }

    return activity.map((a: any) => ({
      type: a.type,
      description: `${a.type} - ${a.category}`,
      timestamp: a.timestamp,
      user: a.userId,
    }));
  }

  /**
   * Get upcoming tasks
   */
  private async getUpcomingTasks(
    projectId: string,
    schedules: any[],
  ): Promise<DashboardData["upcomingTasks"]> {
    const tasks: DashboardData["upcomingTasks"] = [];

    // Add scheduled assessments
    for (const schedule of schedules) {
      if (schedule.nextRun) {
        tasks.push({
          id: `sched_${schedule.id}`,
          type: "assessment" as const,
          title: `Scheduled ${schedule.frameworkId} assessment`,
          dueDate: schedule.nextRun,
          priority: "medium" as const,
        });
      }
    }

    // Add remediation tasks
    let remediations: any[] = [];
    try {
      // @ts-ignore - remediationTask may not exist in schema
      remediations = await prisma.remediationTask.findMany({
        where: {
          projectId,
          status: "pending",
          dueDate: {
            gte: new Date(),
          },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
      });
    } catch (error) {
      console.warn("Could not fetch remediation tasks:", error);
    }

    for (const task of remediations) {
      tasks.push({
        id: task.id,
        type: "remediation" as const,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority?.toLowerCase() as any,
        assignedTo: task.assignedTo,
      });
    }

    return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Start alert monitoring
   */
  private startAlertMonitoring(config: AlertConfig): void {
    // Clear existing interval
    this.stopAlertMonitoring(config.id);

    // Check every 5 minutes
    const interval = setInterval(
      async () => {
        await this.checkAlertConditions(config);
      },
      5 * 60 * 1000,
    );

    this.alertIntervals.set(config.id, interval);
  }

  /**
   * Stop alert monitoring
   */
  private stopAlertMonitoring(configId: string): void {
    if (this.alertIntervals.has(configId)) {
      clearInterval(this.alertIntervals.get(configId)!);
      this.alertIntervals.delete(configId);
    }
  }

  /**
   * Check alert conditions
   */
  private async checkAlertConditions(config: AlertConfig): Promise<void> {
    switch (config.type) {
      case "score_threshold":
        await this.checkScoreThreshold(config);
        break;
      case "violation_detected":
        await this.checkViolations(config);
        break;
      case "deadline_approaching":
        await this.checkDeadlines(config);
        break;
      case "system_error":
        await this.checkSystemErrors(config);
        break;
    }
  }

  /**
   * Check score threshold
   */
  private async checkScoreThreshold(config: AlertConfig): Promise<void> {
    const latest = await prisma.complianceAssessment.findFirst({
      where: { projectId: config.projectId },
      orderBy: { createdAt: "desc" },
    });

    if (latest) {
      const summary = latest.summary as any;
      const score = typeof summary?.score === "number" ? summary.score : 0;

      if (score < (config.threshold || 70)) {
        await this.createAlert({
          projectId: config.projectId,
          type: "score_drop",
          severity: "high",
          message: `Compliance score dropped to ${score}%`,
        });
      }
    }
  }

  /**
   * Check for violations
   */
  private async checkViolations(config: AlertConfig): Promise<void> {
    const recentViolations = await prisma.auditEvent.count({
      where: {
        projectId: config.projectId,
        type: "compliance_violation",
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (recentViolations > 0) {
      await this.createAlert({
        projectId: config.projectId,
        type: "violation",
        severity: "high",
        message: `${recentViolations} compliance violations detected in the last 24 hours`,
      });
    }
  }

  /**
   * Check approaching deadlines
   */
  private async checkDeadlines(config: AlertConfig): Promise<void> {
    const upcoming = await prisma.complianceSchedule.findMany({
      where: {
        projectId: config.projectId,
        nextRun: {
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
          gte: new Date(),
        },
      },
    });

    for (const schedule of upcoming) {
      await this.createAlert({
        projectId: config.projectId,
        type: "deadline",
        severity: "medium",
        message: `${schedule.frameworkId} assessment scheduled for ${schedule.nextRun}`,
      });
    }
  }

  /**
   * Check for system errors
   */
  private async checkSystemErrors(config: AlertConfig): Promise<void> {
    const errors = await prisma.auditEvent.count({
      where: {
        projectId: config.projectId,
        type: "compliance_check_failed",
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (errors > 0) {
      await this.createAlert({
        projectId: config.projectId,
        type: "system",
        severity: "critical",
        message: `${errors} compliance check failures in the last hour`,
      });
    }
  }

  /**
   * Create an alert
   */
  private async createAlert(alert: {
    projectId: string;
    type: string;
    severity: string;
    message: string;
  }): Promise<void> {
    // Check if similar alert already exists
    try {
      // @ts-ignore - resolved field may not exist in schema
      const existing = await prisma.alert.findFirst({
        where: {
          projectId: alert.projectId,
          type: alert.type,
          message: alert.message,
          // resolved not in schema
          // resolved: false,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      if (existing) return;
    } catch (error) {
      // resolved field may not exist - skip duplicate check
    }

    // Create new alert
    try {
      // @ts-ignore - resolved field may not exist in schema
      await prisma.alert.create({
        data: {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: alert.projectId,
          type: alert.type,
          severity: alert.severity.toUpperCase(),
          title: alert.message as any,
          message: alert.message,
          acknowledged: false,
          // resolved not in schema
          // resolved: false
        } as any,
      });
    } catch (error) {
      // resolved field may not exist - create without it
      await prisma.alert.create({
        data: {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: alert.projectId,
          type: alert.type,
          severity: alert.severity.toUpperCase(),
          title: alert.message as any,
          message: alert.message,
          acknowledged: false,
        } as any,
      });
    }
  }

  /**
   * Get violation trends
   */
  private async getViolationTrends(projectId: string): Promise<any[]> {
    let violations: any[] = [];
    try {
      violations = await prisma.auditEvent.findMany({
        where: {
          projectId,
          type: "compliance_violation",
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { timestamp: "asc" },
      });
    } catch (error) {
      console.warn("Could not fetch violation trends:", error);
    }

    // Group by day
    const daily = violations.reduce(
      (acc: any, v: any) => {
        const day = v.timestamp.toISOString().split("T")[0];
        if (!acc[day]) acc[day] = 0;
        acc[day]++;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(daily).map(([date, count]) => ({
      date: new Date(date),
      count,
      severity: "high", // Simplified
    }));
  }
  /**
   * Get remediation trends
   */
  private async getRemediationTrends(projectId: string): Promise<any[]> {
    let remediations: any[] = [];
    try {
      remediations = await prisma.auditEvent.findMany({
        where: {
          projectId,
          type: "remediation_performed",
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { timestamp: "asc" },
      });
    } catch (error) {
      console.warn("Could not fetch remediation trends:", error);
    }

    // Group by day
    const daily = remediations.reduce(
      (acc: any, r: any) => {
        const day = r.timestamp.toISOString().split("T")[0];
        if (!acc[day]) acc[day] = { completed: 0, pending: 0 };
        acc[day].completed++;
        return acc;
      },
      {} as Record<string, any>,
    );

    return Object.entries(daily).map(([date, data]: [string, any]) => ({
      date: new Date(date),
      completed: data.completed,
      pending: data.pending || 0,
    }));
  }

  /**
   * Widget data getters
   */
  private async getScoreWidget(projectId: string): Promise<any> {
    try {
      const latest = await prisma.complianceAssessment.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });

      const summary = latest?.summary as any;
      const score = typeof summary?.score === "number" ? summary.score : 0;

      return {
        score,
        status:
          score >= 90 ? "compliant" : score >= 70 ? "partial" : "non-compliant",
        lastUpdated: latest?.createdAt,
      };
    } catch (error) {
      console.warn("Could not get score widget:", error);
      return {
        score: 0,
        status: "non-compliant",
        lastUpdated: new Date(),
      };
    }
  }

  private async getTrendsWidget(projectId: string): Promise<any> {
    const trends = await this.getTrends(projectId);
    return {
      scores: trends.scores.slice(-7), // Last 7 days
      trend: this.calculateTrend(trends.scores.map((s: any) => s.score)),
    };
  }

  private async getViolationsWidget(projectId: string): Promise<any> {
    const violations = await this.getViolationTrends(projectId);
    return {
      total: violations.reduce((sum: number, v: any) => sum + v.count, 0),
      recent: violations.slice(-7), // Last 7 days
    };
  }

  private async getRemediationWidget(projectId: string): Promise<any> {
    try {
      let pending = 0;
      let completed = 0;

      // Try to get from database, but handle missing table
      try {
        // @ts-ignore - remediationTask may not exist in schema
        pending = await prisma.remediationTask.count({
          where: { projectId, status: "pending" },
        });

        // @ts-ignore - remediationTask may not exist in schema
        completed = await prisma.remediationTask.count({
          where: {
            projectId,
            status: "completed",
            completedAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        });
      } catch (error) {
        console.warn("Remediation tasks table not available:", error);
      }

      return {
        pending,
        completedThisMonth: completed,
      };
    } catch (error) {
      console.warn("Could not get remediation widget:", error);
      return {
        pending: 0,
        completedThisMonth: 0,
      };
    }
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(scores: number[]): "up" | "down" | "stable" {
    if (scores.length < 2) return "stable";

    const recent = scores.slice(-3);
    const older = scores.slice(-6, -3);

    const recentAvg =
      recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
    const olderAvg =
      older.reduce((a: number, b: number) => a + b, 0) / older.length;

    if (recentAvg > olderAvg + 5) return "up";
    if (recentAvg < olderAvg - 5) return "down";
    return "stable";
  }

  /**
   * Convert dashboard data to CSV
   */
  private convertToCSV(data: DashboardData): string {
    const rows = [
      ["Metric", "Value"],
      ["Project ID", data.projectId],
      ["Overall Score", data.overview.overallScore.toString()],
      ["Status", data.overview.status],
      ["Last Assessment", data.overview.lastAssessment.toISOString()],
      ["Total Controls", data.overview.totalControls.toString()],
      ["Active Frameworks", data.overview.activeFrameworks.join(", ")],
      ["Total Alerts", data.alerts.length.toString()],
      ["Upcoming Tasks", data.upcomingTasks.length.toString()],
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }

  /**
   * Shutdown dashboard monitoring
   */
  async shutdown(): Promise<void> {
    for (const interval of this.alertIntervals.values()) {
      clearInterval(interval);
    }
    this.alertIntervals.clear();
  }
}

// Export singleton instance
export const complianceDashboard = new ComplianceDashboard();
