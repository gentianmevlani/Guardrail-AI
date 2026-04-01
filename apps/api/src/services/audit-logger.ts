/**
 * Comprehensive Audit Logging System
 *
 * Tracks all security-relevant events for compliance and forensics
 */

import { createHash } from "crypto";
import { safeFetch } from '../lib/safe-fetch';
import { logger } from "../logger";

interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  action: string;
  resource: string;
  resourceType: string;
  outcome: "success" | "failure" | "error";
  details: Record<string, unknown>;
  risk: "low" | "medium" | "high" | "critical";
  category: "auth" | "data" | "config" | "security" | "compliance" | "system";
  correlationId?: string;
  metadata: Record<string, unknown>;
}

interface AuditFilter {
  userId?: string;
  action?: string;
  resourceType?: string;
  category?: string;
  outcome?: string;
  risk?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface AuditReport {
  id: string;
  generatedAt: Date;
  generatedBy: string;
  filters: AuditFilter;
  summary: {
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByRisk: Record<string, number>;
    failureRate: number;
    topUsers: Array<{ userId: string; eventCount: number }>;
    topActions: Array<{ action: string; eventCount: number }>;
  };
  events: AuditEvent[];
}

class AuditLogger {
  private logger = logger.child({ service: "audit" });
  private events: AuditEvent[] = []; // In production, use a database
  private retentionDays = parseInt(
    process.env["AUDIT_RETENTION_DAYS"] || "365",
    10,
  );

  /**
   * Log an audit event
   */
  async log(event: Partial<AuditEvent>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ipAddress: event.ipAddress || "unknown",
      action: event.action || "unknown",
      resource: event.resource || "unknown",
      resourceType: event.resourceType || "unknown",
      outcome: event.outcome || "success",
      details: event.details || {},
      risk: event.risk || "low",
      category: event.category || "system",
      metadata: event.metadata || {},
      ...event,
    };

    // Store event
    this.events.push(auditEvent);

    // Log to structured logger
    this.logger.info(
      {
        auditId: auditEvent.id,
        userId: auditEvent.userId,
        action: auditEvent.action,
        resource: auditEvent.resource,
        outcome: auditEvent.outcome,
        risk: auditEvent.risk,
        category: auditEvent.category,
      },
      `AUDIT: ${auditEvent.action}`,
    );

    // In production, also send to external audit system
    await this.sendToExternalSystem(auditEvent);

    // Check for high-risk events and alert
    if (auditEvent.risk === "critical" || auditEvent.risk === "high") {
      await this.triggerAlert(auditEvent);
    }
  }

  /**
   * Query audit events
   */
  async query(filter: AuditFilter): Promise<AuditEvent[]> {
    let filtered = [...this.events];

    // Apply filters
    if (filter.userId) {
      filtered = filtered.filter((e) => e.userId === filter.userId);
    }
    if (filter.action) {
      filtered = filtered.filter((e) => e.action.includes(filter.action!));
    }
    if (filter.resourceType) {
      filtered = filtered.filter((e) => e.resourceType === filter.resourceType);
    }
    if (filter.category) {
      filtered = filtered.filter((e) => e.category === filter.category);
    }
    if (filter.outcome) {
      filtered = filtered.filter((e) => e.outcome === filter.outcome);
    }
    if (filter.risk) {
      filtered = filtered.filter((e) => e.risk === filter.risk);
    }
    if (filter.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= filter.endDate!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (filter.offset) {
      filtered = filtered.slice(filter.offset);
    }
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Generate audit report
   */
  async generateReport(
    filter: AuditFilter,
    generatedBy: string,
  ): Promise<AuditReport> {
    const events = await this.query(filter);

    const summary = {
      totalEvents: events.length,
      eventsByCategory: this.groupBy(events, "category"),
      eventsByRisk: this.groupBy(events, "risk"),
      failureRate:
        (events.filter((e) => e.outcome === "failure").length / events.length) *
        100,
      topUsers: this.getTopUsers(events),
      topActions: this.getTopActions(events),
    };

    return {
      id: this.generateReportId(),
      generatedAt: new Date(),
      generatedBy,
      filters: filter,
      summary,
      events,
    };
  }

  /**
   * Cleanup old audit events
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const beforeCount = this.events.length;
    this.events = this.events.filter((e) => e.timestamp > cutoffDate);
    const afterCount = this.events.length;

    this.logger.info(
      {
        deleted: beforeCount - afterCount,
        remaining: afterCount,
        cutoffDate,
      },
      "Audit cleanup completed",
    );
  }

  /**
   * Export audit events for compliance
   */
  async export(
    filter: AuditFilter,
    format: "json" | "csv" | "xml",
  ): Promise<string> {
    const events = await this.query(filter);

    switch (format) {
      case "json":
        return JSON.stringify(events, null, 2);

      case "csv":
        return this.convertToCSV(events);

      case "xml":
        return this.convertToXML(events);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${createHash("sha256")
      .update(Math.random().toString())
      .digest("hex")
      .substr(0, 8)}`;
  }

  private async sendToExternalSystem(event: AuditEvent): Promise<void> {
    // In production, send to SIEM, audit database, or log aggregation system
    const auditWebhookUrl = process.env["AUDIT_WEBHOOK_URL"];
    if (auditWebhookUrl) {
      try {
        const response = await safeFetch(auditWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env["AUDIT_WEBHOOK_TOKEN"] || ""}`,
          },
          body: JSON.stringify(event),
          allowlist: [new URL(auditWebhookUrl).hostname], // Allow the webhook URL
        });

        if (!response.ok) {
          this.logger.warn(
            {
              status: response.status,
              eventId: event.id,
            },
            "Failed to send audit event to external system",
          );
        }
      } catch (error) {
        this.logger.error(
          {
            error,
            eventId: event.id,
          },
          "Error sending audit event to external system",
        );
      }
    }
  }

  private async triggerAlert(event: AuditEvent): Promise<void> {
    // Send alert for high-risk events
    this.logger.warn(
      {
        eventId: event.id,
        action: event.action,
        userId: event.userId,
        risk: event.risk,
      },
      "High-risk audit event detected",
    );

    // In production, send to alerting system
    const alertWebhookUrl = process.env["ALERT_WEBHOOK_URL"];
    if (alertWebhookUrl) {
      try {
        await safeFetch(alertWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "security_alert",
            severity: event.risk,
            event,
            timestamp: new Date().toISOString(),
          }),
          allowlist: [new URL(alertWebhookUrl).hostname], // Allow the alert webhook URL
        });
      } catch (error) {
        this.logger.error({ error }, "Failed to send security alert");
      }
    }
  }

  private groupBy(
    events: AuditEvent[],
    field: keyof AuditEvent,
  ): Record<string, number> {
    return events.reduce(
      (acc, event) => {
        const key = String(event[field]);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private getTopUsers(
    events: AuditEvent[],
  ): Array<{ userId: string; eventCount: number }> {
    const userCounts = this.groupBy(events, "userId");
    return Object.entries(userCounts)
      .filter(([userId]) => userId !== "undefined")
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
  }

  private getTopActions(
    events: AuditEvent[],
  ): Array<{ action: string; eventCount: number }> {
    const actionCounts = this.groupBy(events, "action");
    return Object.entries(actionCounts)
      .map(([action, eventCount]) => ({ action, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      "id",
      "timestamp",
      "userId",
      "action",
      "resource",
      "resourceType",
      "outcome",
      "risk",
      "category",
      "ipAddress",
    ];

    const rows = events.map((event) => [
      event.id,
      event.timestamp.toISOString(),
      event.userId || "",
      event.action,
      event.resource,
      event.resourceType,
      event.outcome,
      event.risk,
      event.category,
      event.ipAddress,
    ]);

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  private convertToXML(events: AuditEvent[]): string {
    const xmlEvents = events
      .map(
        (event) => `
      <event>
        <id>${event.id}</id>
        <timestamp>${event.timestamp.toISOString()}</timestamp>
        <userId>${event.userId || ""}</userId>
        <action>${event.action}</action>
        <resource>${event.resource}</resource>
        <resourceType>${event.resourceType}</resourceType>
        <outcome>${event.outcome}</outcome>
        <risk>${event.risk}</risk>
        <category>${event.category}</category>
        <ipAddress>${event.ipAddress}</ipAddress>
      </event>
    `,
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
    <auditEvents>
      ${xmlEvents}
    </auditEvents>`;
  }
}

// Create and export singleton
export const auditLogger = new AuditLogger();

// Helper functions for common audit events
export const auditAuth = {
  login: async (
    userId: string,
    userEmail: string,
    outcome: "success" | "failure",
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      userEmail,
      action: "user_login",
      resource: "auth",
      resourceType: "authentication",
      outcome,
      risk: outcome === "failure" ? "medium" : "low",
      category: "auth",
      details: { loginMethod: "password" },
    });
  },

  logout: async (userId: string, userEmail: string, ipAddress: string) => {
    await auditLogger.log({
      userId,
      userEmail,
      action: "user_logout",
      resource: "auth",
      resourceType: "authentication",
      outcome: "success",
      risk: "low",
      category: "auth",
    });
  },

  tokenRefresh: async (
    userId: string,
    outcome: "success" | "failure",
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      action: "token_refresh",
      resource: "auth",
      resourceType: "authentication",
      outcome,
      risk: outcome === "failure" ? "medium" : "low",
      category: "auth",
    });
  },
};

export const auditData = {
  access: async (
    userId: string,
    resource: string,
    resourceType: string,
    outcome: "success" | "failure",
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      action: "data_access",
      resource,
      resourceType,
      outcome,
      risk: outcome === "failure" ? "medium" : "low",
      category: "data",
    });
  },

  export: async (
    userId: string,
    resourceType: string,
    recordCount: number,
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      action: "data_export",
      resource: `export_${resourceType}`,
      resourceType,
      outcome: "success",
      risk: recordCount > 1000 ? "medium" : "low",
      category: "data",
      details: { recordCount },
    });
  },

  delete: async (
    userId: string,
    resource: string,
    resourceType: string,
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      action: "data_delete",
      resource,
      resourceType,
      outcome: "success",
      risk: "medium",
      category: "data",
    });
  },
};

export const auditSecurity = {
  scan: async (
    userId: string,
    projectId: string,
    scanType: string,
    outcome: "success" | "failure",
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      action: "security_scan",
      resource: projectId,
      resourceType: "project",
      outcome,
      risk: "low",
      category: "security",
      details: { scanType },
    });
  },

  vulnerabilityFound: async (
    projectId: string,
    severity: string,
    count: number,
  ) => {
    await auditLogger.log({
      action: "vulnerability_detected",
      resource: projectId,
      resourceType: "project",
      outcome: "success",
      risk:
        severity === "critical"
          ? "critical"
          : severity === "high"
            ? "high"
            : "medium",
      category: "security",
      details: { severity, count },
    });
  },

  configChange: async (
    userId: string,
    configType: string,
    oldValue: any,
    newValue: any,
    ipAddress: string,
  ) => {
    await auditLogger.log({
      userId,
      action: "config_change",
      resource: configType,
      resourceType: "configuration",
      outcome: "success",
      risk: "medium",
      category: "config",
      details: { oldValue, newValue },
    });
  },
};
