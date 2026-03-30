/**
 * Analytics and Usage Tracking
 * 
 * Tracks usage, errors, and provides insights
 * Premium feature for all paid tiers
 */

import { licenseManager, LicenseTier } from './license-manager';

export interface AnalyticsData {
  projectId: string;
  period: 'day' | 'week' | 'month';
  validations: number;
  errorsCaught: number;
  issuesFixed: number;
  apiEndpointsRegistered: number;
  mockDataDetected: number;
  structureIssues: number;
  timeSaved: number; // in hours
  costSavings: number; // estimated
}

export interface ErrorAnalytics {
  type: string;
  count: number;
  files: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  trend: 'increasing' | 'stable' | 'decreasing';
}

class AnalyticsTracker {
  private analytics: Map<string, AnalyticsData[]> = new Map();
  private errors: Map<string, ErrorAnalytics[]> = new Map();

  /**
   * Track validation
   */
  trackValidation(
    projectId: string,
    data: {
      errorsCaught?: number;
      issuesFixed?: number;
      mockDataDetected?: number;
      structureIssues?: number;
    }
  ): void {
    const license = licenseManager.getLicense(projectId);
    
    // Check if analytics is available for this tier
    if (license.tier === 'free') {
      return; // Free tier doesn't get analytics
    }

    const today = new Date().toISOString().split('T')[0];
    const key = `${projectId}-${today}`;

    if (!this.analytics.has(projectId)) {
      this.analytics.set(projectId, []);
    }

    const analytics = this.analytics.get(projectId)!;
    let todayData = analytics.find((a) => a.period === 'day');

    if (!todayData) {
      todayData = {
        projectId,
        period: 'day',
        validations: 0,
        errorsCaught: 0,
        issuesFixed: 0,
        apiEndpointsRegistered: 0,
        mockDataDetected: 0,
        structureIssues: 0,
        timeSaved: 0,
        costSavings: 0,
      };
      analytics.push(todayData);
    }

    todayData.validations += 1;
    todayData.errorsCaught += data.errorsCaught || 0;
    todayData.issuesFixed += data.issuesFixed || 0;
    todayData.mockDataDetected += data.mockDataDetected || 0;
    todayData.structureIssues += data.structureIssues || 0;

    // Estimate time saved (average 5 minutes per issue caught)
    const timeSaved = (data.errorsCaught || 0) * (5 / 60);
    todayData.timeSaved += timeSaved;

    // Estimate cost savings ($50/hour developer rate)
    todayData.costSavings += timeSaved * 50;

    licenseManager.trackUsage(projectId, 'validations', 1);
  }

  /**
   * Track API endpoint registration
   */
  trackApiEndpoint(projectId: string): void {
    const license = licenseManager.getLicense(projectId);
    
    if (license.tier === 'free') {
      return;
    }

    const analytics = this.analytics.get(projectId);
    if (analytics && analytics.length > 0) {
      const latest = analytics[analytics.length - 1];
      latest.apiEndpointsRegistered += 1;
    }

    licenseManager.trackUsage(projectId, 'apiEndpoints', 1);
  }

  /**
   * Get analytics report
   */
  getAnalytics(
    projectId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): AnalyticsData | null {
    const license = licenseManager.getLicense(projectId);
    
    if (license.tier === 'free') {
      return null; // Free tier doesn't get analytics
    }

    const analytics = this.analytics.get(projectId);
    if (!analytics || analytics.length === 0) {
      return null;
    }

    // Aggregate data for the period
    const now = new Date();
    const periodStart = new Date();

    switch (period) {
      case 'day':
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'week':
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(now.getMonth() - 1);
        break;
    }

    const periodData = analytics.filter(
      (a) => new Date(a.projectId) >= periodStart
    );

    if (periodData.length === 0) {
      return null;
    }

    return periodData.reduce(
      (acc, data) => ({
        ...acc,
        validations: acc.validations + data.validations,
        errorsCaught: acc.errorsCaught + data.errorsCaught,
        issuesFixed: acc.issuesFixed + data.issuesFixed,
        apiEndpointsRegistered:
          acc.apiEndpointsRegistered + data.apiEndpointsRegistered,
        mockDataDetected: acc.mockDataDetected + data.mockDataDetected,
        structureIssues: acc.structureIssues + data.structureIssues,
        timeSaved: acc.timeSaved + data.timeSaved,
        costSavings: acc.costSavings + data.costSavings,
      }),
      {
        projectId,
        period,
        validations: 0,
        errorsCaught: 0,
        issuesFixed: 0,
        apiEndpointsRegistered: 0,
        mockDataDetected: 0,
        structureIssues: 0,
        timeSaved: 0,
        costSavings: 0,
      }
    );
  }

  /**
   * Get error analytics
   */
  getErrorAnalytics(projectId: string): ErrorAnalytics[] {
    const license = licenseManager.getLicense(projectId);
    
    if (license.tier === 'free') {
      return []; // Free tier doesn't get error analytics
    }

    return this.errors.get(projectId) || [];
  }

  /**
   * Generate insights report
   */
  generateInsightsReport(projectId: string): string {
    const analytics = this.getAnalytics(projectId, 'month');
    
    if (!analytics) {
      return 'Analytics not available for free tier. Upgrade to see insights.';
    }

    let report = `# Analytics Report\n\n`;
    report += `## Summary (Last Month)\n\n`;
    report += `- **Validations**: ${analytics.validations}\n`;
    report += `- **Errors Caught**: ${analytics.errorsCaught}\n`;
    report += `- **Issues Fixed**: ${analytics.issuesFixed}\n`;
    report += `- **API Endpoints**: ${analytics.apiEndpointsRegistered}\n`;
    report += `- **Mock Data Detected**: ${analytics.mockDataDetected}\n`;
    report += `- **Structure Issues**: ${analytics.structureIssues}\n\n`;
    report += `## Impact\n\n`;
    report += `- **Time Saved**: ${analytics.timeSaved.toFixed(1)} hours\n`;
    report += `- **Estimated Cost Savings**: $${analytics.costSavings.toFixed(2)}\n\n`;

    return report;
  }
}

export const analyticsTracker = new AnalyticsTracker();

