import { prisma } from "@guardrail/database";
import { ComplianceAssessmentResult } from "../frameworks/engine";
import { EvidenceArtifact } from "./evidence-collector";
import { auditLogger } from "./audit-logger";

interface ReportRequest {
  projectId: string;
  frameworkId: string;
  type: "compliance" | "audit" | "executive" | "technical" | "remediation";
  format: "pdf" | "html" | "json" | "csv";
  period?: {
    start: Date;
    end: Date;
  };
  includeEvidence?: boolean;
  includeRecommendations?: boolean;
  includeCharts?: boolean;
  recipients?: string[];
}

interface ComplianceReport {
  id: string;
  projectId: string;
  frameworkId: string;
  type: string;
  format: string;
  generatedAt: Date;
  period?: {
    start: Date;
    end: Date;
  };
  summary: {
    overallScore: number;
    status: "compliant" | "partial" | "non-compliant";
    totalControls: number;
    compliantControls: number;
    partialControls: number;
    nonCompliantControls: number;
    highRiskGaps: number;
    mediumRiskGaps: number;
    lowRiskGaps: number;
  };
  sections: ReportSection[];
  evidence?: EvidenceArtifact[];
  recommendations: Recommendation[];
  charts?: ChartData[];
  metadata: {
    version: string;
    generatedBy: string;
    reviewStatus?: "pending" | "approved" | "rejected";
    reviewedBy?: string;
    reviewedAt?: Date;
  };
}

interface ReportSection {
  id: string;
  title: string;
  type: "summary" | "details" | "evidence" | "recommendations" | "appendix";
  content: any;
  order: number;
}

interface Recommendation {
  id: string;
  controlId: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  dueDate?: Date;
  assignedTo?: string;
  status: "open" | "in-progress" | "completed" | "deferred";
}

interface ChartData {
  id: string;
  type: "pie" | "bar" | "line" | "heatmap";
  title: string;
  data: any;
  description?: string;
}

/**
 * Automated Compliance Reporting Engine
 *
 * Generates comprehensive compliance reports with evidence,
 * recommendations, and visual analytics
 */
export class ReportingEngine {
  private readonly reportTemplates = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate compliance report
   */
  async generateReport(
    request: ReportRequest & {
      assessment?: ComplianceAssessmentResult;
      evidence?: EvidenceArtifact[];
    },
  ): Promise<ComplianceReport> {
    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: request.projectId },
    });

    if (!project) {
      throw new Error(`Project ${request.projectId} not found`);
    }

    // Get assessment if not provided
    let assessment = request.assessment;
    if (!assessment) {
      const latest = await prisma.complianceAssessment.findFirst({
        where: {
          projectId: request.projectId,
          frameworkId: request.frameworkId,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) {
        throw new Error("No assessment found for this project and framework");
      }

      // Convert database record to assessment result with proper type handling
      assessment = {
        projectId: latest.projectId,
        frameworkId: latest.frameworkId,
        summary: (latest.summary as any) || {
          totalControls: 0,
          compliant: 0,
          partial: 0,
          nonCompliant: 0,
          score: 0,
        },
        evidence: (latest.evidence as any) || [],
        controls: (latest.controls as any) || [],
        gaps: (latest.gaps as any) || [],
      };
    }

    // Get evidence if requested
    let evidence = request.evidence;
    if (request.includeEvidence && !evidence) {
      // For now, skip evidence collection if no database table exists
      evidence = [];
    }

    // Generate report ID
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build report sections based on type
    if (!assessment) {
      throw new Error("No assessment data available");
    }
    const sections = await this.buildSections(
      request.type,
      assessment,
      evidence,
    );

    // Generate recommendations if needed
    const recommendations = request.includeRecommendations
      ? await this.generateRecommendations(assessment!)
      : [];

    // Generate charts if needed
    const charts = request.includeCharts
      ? await this.generateCharts(assessment!)
      : [];

    // Create report
    const report: ComplianceReport = {
      id: reportId,
      projectId: request.projectId,
      frameworkId: request.frameworkId,
      type: request.type,
      format: request.format,
      generatedAt: new Date(),
      period: request.period,
      summary: this.generateSummary(assessment!),
      sections, // Use the sections we already built
      evidence: request.includeEvidence ? evidence : undefined,
      recommendations, // Use the recommendations we already built
      charts, // Use the charts we already built
      metadata: {
        version: "1.0",
        generatedBy: "guardrail Compliance Engine",
      },
    };

    // Save report to database - skip if table doesn't exist
    try {
      await this.saveReport(report);
    } catch (error) {
      console.warn("Could not save report to database:", error);
    }

    // Log report generation
    await auditLogger.logEvent({
      type: "report_generated",
      category: "compliance",
      projectId: request.projectId,
      frameworkId: request.frameworkId,
      timestamp: new Date(),
      severity: "low",
      source: "reporting-engine",
      metadata: {
        reportId,
        type: request.type,
        format: request.format,
        includeEvidence: request.includeEvidence,
        recipientCount: request.recipients?.length || 0,
      },
      details: {
        action: "Compliance report generated",
        reportId,
        type: request.type,
        score: report.summary.overallScore,
      },
    });

    // Send report if recipients specified
    if (request.recipients?.length) {
      await this.sendReport(report, request.recipients);
    }

    return report;
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string): Promise<ComplianceReport | null> {
    try {
      const report = await prisma.complianceReport.findUnique({
        where: { id: reportId },
      });

      if (!report) return null;

      // Convert database report to ComplianceReport format
      // @ts-ignore - Prisma client type issue
      return {
        id: report.id,
        projectId: report.projectId,
        frameworkId: (report as any).frameworkId,
        type: (report as any).type,
        format: (report as any).format,
        generatedAt: (report as any).generatedAt || report.createdAt,
        period: (report as any).period,
        summary: report.summary as any,
        sections: (report as any).sections || [],
        evidence: (report as any).evidence || undefined,
        recommendations: (report as any).recommendations || [],
        charts: (report as any).charts || [],
        metadata: (report as any).metadata || {
          version: "1.0",
          generatedBy: "guardrail Compliance Engine",
        },
      };
    } catch (error) {
      console.warn("Could not retrieve report from database:", error);
      return null;
    }
  }

  /**
   * List reports for project
   */
  async listReports(
    projectId: string,
    frameworkId?: string,
    limit: number = 50,
  ): Promise<ComplianceReport[]> {
    try {
      const reports = await prisma.complianceReport.findMany({
        where: {
          projectId,
          ...(frameworkId && { frameworkId }),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      // Convert database reports to ComplianceReport format
      // @ts-ignore - Prisma client type issue
      return reports.map((report: any) => ({
        id: report.id,
        projectId: report.projectId,
        frameworkId: report.frameworkId,
        type: report.type,
        format: report.format,
        generatedAt: report.generatedAt || report.createdAt,
        period: report.period,
        summary: report.summary as any,
        sections: report.sections || [],
        evidence: report.evidence || undefined,
        recommendations: report.recommendations || [],
        charts: report.charts || [],
        metadata: report.metadata || {
          version: "1.0",
          generatedBy: "guardrail Compliance Engine",
        },
      }));
    } catch (error) {
      console.warn("Could not retrieve reports from database:", error);
      return [];
    }
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      await prisma.complianceReport.delete({
        where: { id: reportId },
      });
    } catch (error) {
      console.warn("Could not delete report from database:", error);
    }
  }

  private async saveReport(report: ComplianceReport): Promise<void> {
    // @ts-ignore - Prisma client type issue
    await prisma.complianceReport.create({
      data: {
        projectId: report.projectId,
        title: `${report.type} Report - ${report.frameworkId}` as any,
        content: report as any,
        summary: report.summary as any,
        status: "draft",
      } as any,
    });
  }

  private async sendReport(
    report: ComplianceReport,
    recipients: string[],
  ): Promise<void> {
    // In production, implement email delivery service
    console.log(`Sending report ${report.id} to ${recipients.join(", ")}`);
  }

  private initializeTemplates(): void {
    // Initialize report templates
    this.reportTemplates.set("compliance", "standard-compliance-template");
    this.reportTemplates.set("audit", "audit-report-template");
    this.reportTemplates.set("executive", "executive-summary-template");
    this.reportTemplates.set("technical", "technical-detail-template");
    this.reportTemplates.set("remediation", "remediation-plan-template");
  }

  private async buildSections(
    _type: string,
    assessment: ComplianceAssessmentResult,
    evidence?: EvidenceArtifact[],
  ): Promise<ReportSection[]> {
    const sections: ReportSection[] = [
      {
        id: "summary",
        title: "Executive Summary",
        type: "summary",
        content: assessment.summary,
        order: 1,
      },
      {
        id: "details",
        title: "Compliance Details",
        type: "details",
        content: {
          controls: assessment.controls,
          gaps: assessment.gaps,
        },
        order: 2,
      },
    ];

    if (evidence && evidence.length > 0) {
      sections.push({
        id: "evidence",
        title: "Evidence",
        type: "evidence",
        content: evidence,
        order: 3,
      });
    }

    return sections;
  }

  private async generateRecommendations(
    assessment: ComplianceAssessmentResult,
  ): Promise<Recommendation[]> {
    // Generate recommendations based on gaps and failed controls
    const recommendations: Recommendation[] = [];

    for (const gap of assessment.gaps) {
      recommendations.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        controlId: gap.controlId,
        priority: gap.severity as any,
        category: "compliance",
        title: `Address compliance gap for ${gap.controlId}`,
        description: gap.description,
        impact: "Non-compliance risk",
        effort: "medium",
        status: "open",
      });
    }

    return recommendations;
  }

  private async generateCharts(
    assessment: ComplianceAssessmentResult,
  ): Promise<ChartData[]> {
    return [
      {
        id: "chart_compliance_score",
        type: "pie",
        title: "Compliance Score Distribution",
        data: {
          compliant: assessment.summary.compliant,
          partial: assessment.summary.partial,
          nonCompliant: assessment.summary.nonCompliant,
        },
      },
    ];
  }

  private generateSummary(assessment: ComplianceAssessmentResult): any {
    return {
      overallScore: assessment.summary.score,
      status:
        assessment.summary.score >= 90
          ? "compliant"
          : assessment.summary.score >= 70
            ? "partial"
            : "non-compliant",
      totalControls: assessment.summary.totalControls,
      compliantControls: assessment.summary.compliant,
      partialControls: assessment.summary.partial,
      nonCompliantControls: assessment.summary.nonCompliant,
      highRiskGaps: assessment.gaps.filter((g) => g.severity === "high").length,
      mediumRiskGaps: assessment.gaps.filter((g) => g.severity === "medium")
        .length,
      lowRiskGaps: assessment.gaps.filter((g) => g.severity === "low").length,
    };
  }
}

// Export singleton instance
export const reportingEngine = new ReportingEngine();
