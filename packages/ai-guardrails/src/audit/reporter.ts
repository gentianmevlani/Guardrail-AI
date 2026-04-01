import { DateRange, ReportType, Report, AuditQuery } from '@guardrail/core';
import { auditQueryService } from './query';

/**
 * Audit Reporter
 *
 * Generate compliance and audit reports
 */
export class AuditReporter {
  /**
   * Generate compliance report
   */
  async generateReport(type: ReportType, period: DateRange): Promise<Report> {
    const generatedAt = new Date();

    switch (type) {
      case 'audit':
        return this.generateAuditReport(period, generatedAt);

      case 'compliance':
        return this.generateComplianceReport(period, generatedAt);

      case 'security':
        return this.generateSecurityReport(period, generatedAt);

      case 'attribution':
        return this.generateAttributionReport(period, generatedAt);

      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  /**
   * Generate audit report
   */
  private async generateAuditReport(period: DateRange, generatedAt: Date): Promise<Report> {
    const query: AuditQuery = {
      startDate: period.start,
      endDate: period.end,
    };

    const result = await auditQueryService.query(query);
    const riskSummary = await auditQueryService.getRiskSummary(period);

    const summary = {
      totalActions: result.total,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      riskDistribution: riskSummary,
      actionTypes: this.groupBy(result.events, 'actionType'),
    };

    return {
      type: 'audit',
      period,
      summary,
      details: result.events,
      generatedAt,
    };
  }

  /**
   * Generate compliance report
   */
  private async generateComplianceReport(period: DateRange, generatedAt: Date): Promise<Report> {
    const query: AuditQuery = {
      startDate: period.start,
      endDate: period.end,
    };

    const result = await auditQueryService.query(query);

    const sensitiveDataAccess = result.events.filter((e: any) => e.sensitiveData).length;
    const piiInvolved = result.events.filter((e: any) => e.piiInvolved).length;
    const blockedActions = result.events.filter((e: any) => e.status === 'BLOCKED').length;

    const summary = {
      totalActions: result.total,
      sensitiveDataAccess,
      piiInvolved,
      blockedActions,
      complianceScore: this.calculateComplianceScore(result.total, blockedActions, sensitiveDataAccess),
    };

    return {
      type: 'compliance',
      period,
      summary,
      details: result.events.filter((e: any) => e.sensitiveData || e.piiInvolved || e.status === 'BLOCKED'),
      generatedAt,
    };
  }

  /**
   * Generate security report
   */
  private async generateSecurityReport(period: DateRange, generatedAt: Date): Promise<Report> {
    const riskSummary = await auditQueryService.getRiskSummary(period);

    const query: AuditQuery = {
      startDate: period.start,
      endDate: period.end,
      riskLevel: 'HIGH',
    };

    const highRiskActions = await auditQueryService.query(query);

    const summary = {
      riskDistribution: riskSummary,
      highRiskActions: highRiskActions.total,
      criticalActions: riskSummary['CRITICAL'] || 0,
      securityScore: this.calculateSecurityScore(riskSummary),
    };

    return {
      type: 'security',
      period,
      summary,
      details: highRiskActions.events,
      generatedAt,
    };
  }

  /**
   * Generate attribution report
   */
  private async generateAttributionReport(period: DateRange, generatedAt: Date): Promise<Report> {
    const attribution = await auditQueryService.getAttribution('default', period);

    const summary = {
      aiContribution: attribution.aiGenerated,
      humanContribution: attribution.humanWritten,
      agentBreakdown: attribution.breakdown,
    };

    return {
      type: 'attribution',
      period,
      summary,
      details: attribution.breakdown,
      generatedAt,
    };
  }

  /**
   * Export to CSV
   */
  async exportCSV(query: AuditQuery): Promise<string> {
    const result = await auditQueryService.query(query);

    const headers = [
      'Timestamp',
      'Agent ID',
      'Task ID',
      'Action Type',
      'Category',
      'Status',
      'Risk Level',
      'Duration (ms)',
    ];

    const rows = result.events.map((event) => [
      event.timestamp.toISOString(),
      event.agentId,
      event.taskId,
      event.actionType,
      event.category,
      event.status,
      event.riskLevel,
      event.duration?.toString() || '0',
    ]);

    return [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
  }

  /**
   * Export to JSON
   */
  async exportJSON(query: AuditQuery): Promise<object> {
    const result = await auditQueryService.query(query);
    return {
      query,
      result,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper: Group events by field
   */
  private groupBy(events: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const event of events) {
      const value = event[field];
      groups[value] = (groups[value] || 0) + 1;
    }

    return groups;
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(
    total: number,
    blocked: number,
    sensitiveAccess: number
  ): number {
    if (total === 0) return 100;

    const blockedRate = (blocked / total) * 100;
    const sensitiveRate = (sensitiveAccess / total) * 100;

    // Lower is better for these rates
    const score = 100 - (blockedRate * 0.5 + sensitiveRate * 0.5);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate security score
   */
  private calculateSecurityScore(riskSummary: Record<string, number>): number {
    const total = Object.values(riskSummary).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 100;

    const weights = { CRITICAL: 40, HIGH: 20, MEDIUM: 5, LOW: 1 };
    const weightedSum = Object.entries(riskSummary).reduce(
      (sum, [level, count]) => sum + count * ((weights as any)[level] || 0),
      0
    );

    const maxPossibleScore = total * weights.CRITICAL;
    const score = 100 - (weightedSum / maxPossibleScore) * 100;

    return Math.max(0, Math.min(100, score));
  }
}

// Export singleton instance
export const auditReporter = new AuditReporter();
