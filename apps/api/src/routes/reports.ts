/**
 * Security Report API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { securityReportGenerator } from "../services/security-report-generator";
import { auditLogger } from "../services/audit-logger";
import { z } from "zod";
import { pool, prisma } from "@guardrail/database";

const reportRequestSchema = z.object({
  projectId: z.string(),
  config: z.object({
    type: z.enum(["daily", "weekly", "monthly", "quarterly", "custom"]),
    format: z.enum(["json", "pdf", "html", "csv"]),
    recipients: z.array(z.string().email()),
    includeCharts: z.boolean(),
    includeRecommendations: z.boolean(),
    includeTrends: z.boolean(),
    sections: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        enabled: z.boolean(),
        config: z.record(z.any()),
      }),
    ),
  }),
});

async function generateReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validated = reportRequestSchema.parse(request.body);
    const userId = (request as any).userId || "unknown";

    const report = await securityReportGenerator.generateReport(
      validated.projectId,
      {
        type: validated.config.type,
        format: validated.config.format,
        recipients: validated.config.recipients,
        includeCharts: validated.config.includeCharts,
        includeRecommendations: validated.config.includeRecommendations,
        includeTrends: validated.config.includeTrends,
        sections: validated.config.sections.map((s) => ({
          id: s.id!,
          name: s.name!,
          enabled: s.enabled!,
          config: s.config!,
        })),
      },
      userId,
    );

    reply.send({
      success: true,
      data: {
        reportId: report.id,
        type: report.type,
        generatedAt: report.generatedAt,
        downloadUrl: `/api/reports/${report.id}/download?format=${validated.config.format}`,
        summary: report.summary,
      },
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to generate report");
    reply.status(500).send({
      success: false,
      error: "Failed to generate report",
    });
  }
}

async function downloadReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { reportId } = request.params as { reportId: string };
    const { format = "json" } = request.query as { format?: string };

    const result = await pool.query(
      `SELECT id, project_id, user_id, type, format, content, created_at
       FROM reports WHERE id = $1`,
      [reportId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: "Report not found",
      });
    }

    const report = result.rows[0];
    const reportContent =
      typeof report.content === "string"
        ? JSON.parse(report.content)
        : report.content;

    reply.header("Content-Type", getContentType(format));
    reply.header(
      "Content-Disposition",
      `attachment; filename="security-report-${reportId}.${format}"`,
    );

    switch (format) {
      case "json":
        return reply.send(reportContent);

      case "html":
        const htmlContent = generateHTMLFromReport(reportContent);
        return reply.send(htmlContent);

      case "csv":
        const csvContent = generateCSVFromReport(reportContent);
        return reply.send(csvContent);

      default:
        return reply.send(reportContent);
    }
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to download report");
    reply.status(500).send({
      success: false,
      error: "Failed to download report",
    });
  }
}

function generateHTMLFromReport(report: any): string {
  const summary = report.summary || {};
  const sections = report.sections || [];

  return `<!DOCTYPE html>
<html>
<head>
  <title>Security Report - ${report.id || "Report"}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat { background: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .section { margin: 25px 0; padding: 20px; background: #fafafa; border-radius: 4px; }
    .grade-A { color: #4CAF50; } .grade-B { color: #8BC34A; }
    .grade-C { color: #FFC107; } .grade-D { color: #FF9800; } .grade-F { color: #F44336; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; }
    .meta { color: #888; font-size: 12px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Security Report</h1>
    <div class="meta">
      <p>Report ID: ${report.id || "N/A"}</p>
      <p>Generated: ${report.generatedAt || new Date().toISOString()}</p>
      <p>Type: ${report.type || "custom"}</p>
    </div>
    <h2>Summary</h2>
    <div class="summary">
      <div class="stat">
        <div class="stat-value grade-${summary.securityGrade || "C"}">${summary.securityGrade || "N/A"}</div>
        <div class="stat-label">Security Grade</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.overallRiskScore || 0}</div>
        <div class="stat-label">Risk Score</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.complianceScore || 0}%</div>
        <div class="stat-label">Compliance</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.criticalIssues || 0}</div>
        <div class="stat-label">Critical Issues</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.highIssues || 0}</div>
        <div class="stat-label">High Issues</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.resolvedIssues || 0}</div>
        <div class="stat-label">Resolved</div>
      </div>
    </div>
    ${sections
      .map(
        (s: any) => `
      <div class="section">
        <h2>${s.title || s.sectionId}</h2>
        <pre>${JSON.stringify(s.content, null, 2)}</pre>
      </div>
    `,
      )
      .join("")}
  </div>
</body>
</html>`;
}

function generateCSVFromReport(report: any): string {
  const summary = report.summary || {};
  const rows: string[] = [];

  rows.push("Metric,Value");
  rows.push(`Report ID,${report.id || "N/A"}`);
  rows.push(`Type,${report.type || "custom"}`);
  rows.push(`Generated At,${report.generatedAt || new Date().toISOString()}`);
  rows.push(`Security Grade,${summary.securityGrade || "N/A"}`);
  rows.push(`Risk Score,${summary.overallRiskScore || 0}`);
  rows.push(`Compliance Score,${summary.complianceScore || 0}`);
  rows.push(`Total Scans,${summary.totalScans || 0}`);
  rows.push(`Critical Issues,${summary.criticalIssues || 0}`);
  rows.push(`High Issues,${summary.highIssues || 0}`);
  rows.push(`Medium Issues,${summary.mediumIssues || 0}`);
  rows.push(`Low Issues,${summary.lowIssues || 0}`);
  rows.push(`Resolved Issues,${summary.resolvedIssues || 0}`);
  rows.push(`Risk Trend,${summary.riskTrend || "N/A"}`);

  if (report.recommendations && report.recommendations.length > 0) {
    rows.push("");
    rows.push("Recommendations");
    rows.push("Priority,Category,Title,Description,Status");
    for (const rec of report.recommendations) {
      rows.push(
        `${rec.priority},${rec.category},"${rec.title}","${rec.description}",${rec.status}`,
      );
    }
  }

  return rows.join("\n");
}

async function listReports(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as { projectId: string };
    const { limit = 20, offset = 0 } = request.query as {
      limit?: number;
      offset?: number;
    };

    const limitNum = Math.min(parseInt(String(limit), 10) || 20, 100);
    const offsetNum = parseInt(String(offset), 10) || 0;

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM reports WHERE project_id = $1`,
      [projectId],
    );
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    const result = await pool.query(
      `SELECT id, project_id, user_id, type, format, created_at,
              (content->>'summary') as summary
       FROM reports 
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [projectId, limitNum, offsetNum],
    );

    const reports = result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      type: row.type,
      format: row.format,
      createdAt: row.created_at,
      summary: row.summary
        ? typeof row.summary === "string"
          ? JSON.parse(row.summary)
          : row.summary
        : null,
      downloadUrl: `/api/reports/${row.id}/download?format=${row.format}`,
    }));

    reply.send({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < total,
        },
      },
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to list reports");
    reply.status(500).send({
      success: false,
      error: "Failed to list reports",
    });
  }
}

async function getReportTemplates(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const templates = [
      {
        id: "executive",
        name: "Executive Summary",
        description: "High-level overview for stakeholders",
        sections: [
          {
            id: "executive-summary",
            name: "Executive Summary",
            enabled: true,
            config: {},
          },
          {
            id: "risk-assessment",
            name: "Risk Assessment",
            enabled: true,
            config: {},
          },
          {
            id: "compliance-status",
            name: "Compliance Status",
            enabled: true,
            config: {},
          },
        ],
      },
      {
        id: "technical",
        name: "Technical Report",
        description: "Detailed analysis for security teams",
        sections: [
          {
            id: "vulnerability-analysis",
            name: "Vulnerability Analysis",
            enabled: true,
            config: {},
          },
          {
            id: "asset-inventory",
            name: "Asset Inventory",
            enabled: true,
            config: {},
          },
          {
            id: "incident-response",
            name: "Incident Response",
            enabled: true,
            config: {},
          },
          {
            id: "trend-analysis",
            name: "Trend Analysis",
            enabled: true,
            config: {},
          },
        ],
      },
      {
        id: "compliance",
        name: "Compliance Report",
        description: "Focus on regulatory compliance",
        sections: [
          {
            id: "compliance-status",
            name: "Compliance Status",
            enabled: true,
            config: {},
          },
          {
            id: "risk-assessment",
            name: "Risk Assessment",
            enabled: true,
            config: {},
          },
          {
            id: "executive-summary",
            name: "Executive Summary",
            enabled: true,
            config: {},
          },
        ],
      },
      {
        id: "comprehensive",
        name: "Comprehensive Report",
        description: "Complete security analysis",
        sections: [
          {
            id: "executive-summary",
            name: "Executive Summary",
            enabled: true,
            config: {},
          },
          {
            id: "vulnerability-analysis",
            name: "Vulnerability Analysis",
            enabled: true,
            config: {},
          },
          {
            id: "compliance-status",
            name: "Compliance Status",
            enabled: true,
            config: {},
          },
          {
            id: "risk-assessment",
            name: "Risk Assessment",
            enabled: true,
            config: {},
          },
          {
            id: "trend-analysis",
            name: "Trend Analysis",
            enabled: true,
            config: {},
          },
          {
            id: "asset-inventory",
            name: "Asset Inventory",
            enabled: true,
            config: {},
          },
          {
            id: "incident-response",
            name: "Incident Response",
            enabled: true,
            config: {},
          },
        ],
      },
    ];

    reply.send({
      success: true,
      data: templates,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to get report templates");
    reply.status(500).send({
      success: false,
      error: "Failed to get templates",
    });
  }
}

async function scheduleReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as { projectId: string };
    const { schedule, config, enabled } = request.body as {
      schedule: {
        frequency: "daily" | "weekly" | "monthly";
        time: string; // HH:MM format
        timezone?: string;
      };
      config: any;
      enabled: boolean;
    };

    // In production, save to database
    const scheduledReport = {
      id: `schedule_${Date.now()}`,
      projectId,
      schedule,
      config,
      enabled,
      createdAt: new Date(),
      nextRun: calculateNextRun(schedule.frequency, schedule.time),
    };

    // Log to audit
    await auditLogger.log({
      userId: (request as any).userId,
      action: "report_scheduled",
      resource: projectId,
      resourceType: "project",
      outcome: "success",
      risk: "low",
      category: "system",
      details: {
        scheduleId: scheduledReport.id,
        frequency: schedule.frequency,
      },
    });

    reply.send({
      success: true,
      data: scheduledReport,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to schedule report");
    reply.status(500).send({
      success: false,
      error: "Failed to schedule report",
    });
  }
}

async function getScheduledReports(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { projectId } = request.params as { projectId: string };

    const scheduledReportsData = await prisma.scheduledScan.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const scheduledReports = scheduledReportsData.map((schedule: any) => ({
      id: schedule.id,
      projectId: schedule.projectId,
      schedule: {
        frequency: schedule.frequency || 'weekly',
        time: schedule.scheduleTime || '08:00',
        timezone: schedule.timezone || 'UTC',
      },
      enabled: schedule.enabled !== false,
      lastRun: schedule.lastRunAt || null,
      nextRun: schedule.nextRunAt || null,
      createdAt: schedule.createdAt,
    }));

    return reply.send({
      success: true,
      reports: scheduledReports,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to get scheduled reports");
    reply.status(500).send({
      success: false,
      error: "Failed to get scheduled reports",
    });
  }
}

async function updateScheduledReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { scheduleId } = request.params as { scheduleId: string };
    const updates = request.body;

    // In production, update in database
    const updatedReport = {
      id: scheduleId,
      ...(updates as any),
      updatedAt: new Date(),
    };

    reply.send({
      success: true,
      data: updatedReport,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to update scheduled report");
    reply.status(500).send({
      success: false,
      error: "Failed to update scheduled report",
    });
  }
}

async function deleteScheduledReport(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { scheduleId } = request.params as { scheduleId: string };

    // In production, delete from database
    // Also cancel any scheduled jobs

    reply.send({
      success: true,
      message: "Scheduled report deleted",
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to delete scheduled report");
    reply.status(500).send({
      success: false,
      error: "Failed to delete scheduled report",
    });
  }
}

function getContentType(format: string): string {
  switch (format) {
    case "json":
      return "application/json";
    case "pdf":
      return "application/pdf";
    case "html":
      return "text/html";
    case "csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}

function calculateNextRun(frequency: string, time: string): Date {
  const now = new Date();
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr || "8", 10);
  const minutes = parseInt(minutesStr || "0", 10);

  if (isNaN(hours) || isNaN(minutes)) {
    // Default to 8 AM if time is invalid
    const nextRun = new Date();
    nextRun.setHours(8, 0, 0, 0);
    return nextRun;
  }

  const nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  if (nextRun <= now) {
    switch (frequency) {
      case "daily":
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case "weekly":
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case "monthly":
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
    }
  }

  return nextRun;
}

export async function reportRoutes(fastify: FastifyInstance) {
  // Schemas are registered centrally in registerSchemas.ts

  // Report generation routes
  fastify.post(
    "/generate",
    {
      schema: {
        tags: ["Reports"],
        summary: "Generate security report",
        body: { $ref: "reportRequest" },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  reportId: { type: "string" },
                  type: { type: "string" },
                  generatedAt: { type: "string" },
                  downloadUrl: { type: "string" },
                  summary: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
    generateReport,
  );

  fastify.get(
    "/:reportId/download",
    {
      schema: {
        tags: ["Reports"],
        summary: "Download security report",
        params: {
          type: "object",
          properties: {
            reportId: { type: "string" },
          },
          required: ["reportId"],
        },
        querystring: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "pdf", "html", "csv"],
              default: "json",
            },
          },
        },
      },
    },
    downloadReport,
  );

  fastify.get(
    "/project/:projectId/list",
    {
      schema: {
        tags: ["Reports"],
        summary: "List project reports",
        params: {
          type: "object",
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", default: 20 },
            offset: { type: "number", default: 0 },
          },
        },
      },
    },
    listReports,
  );

  fastify.get(
    "/templates",
    {
      schema: {
        tags: ["Reports"],
        summary: "Get report templates",
      },
    },
    getReportTemplates,
  );

  // Scheduled reports
  fastify.post(
    "/project/:projectId/schedule",
    {
      schema: {
        tags: ["Reports"],
        summary: "Schedule automated report",
        params: {
          type: "object",
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
        body: {
          type: "object",
          properties: {
            schedule: {
              type: "object",
              properties: {
                frequency: {
                  type: "string",
                  enum: ["daily", "weekly", "monthly"],
                },
                time: {
                  type: "string",
                  pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
                },
                timezone: { type: "string" },
              },
            },
            config: { type: "object" },
            enabled: { type: "boolean" },
          },
        },
      },
    },
    scheduleReport,
  );

  fastify.get(
    "/project/:projectId/scheduled",
    {
      schema: {
        tags: ["Reports"],
        summary: "Get scheduled reports",
        params: {
          type: "object",
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
      },
    },
    getScheduledReports,
  );

  fastify.put(
    "/scheduled/:scheduleId",
    {
      schema: {
        tags: ["Reports"],
        summary: "Update scheduled report",
        params: {
          type: "object",
          properties: {
            scheduleId: { type: "string" },
          },
          required: ["scheduleId"],
        },
      },
    },
    updateScheduledReport,
  );

  fastify.delete(
    "/scheduled/:scheduleId",
    {
      schema: {
        tags: ["Reports"],
        summary: "Delete scheduled report",
        params: {
          type: "object",
          properties: {
            scheduleId: { type: "string" },
          },
          required: ["scheduleId"],
        },
      },
    },
    deleteScheduledReport,
  );
}
