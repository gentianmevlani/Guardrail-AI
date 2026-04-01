/**
 * Dashboard Trend Analytics
 *
 * Trust score over time, violation hotspots, team-level metrics.
 * Enterprise feature for ROI visibility and compliance reporting.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Data Types ───────────────────────────────────────────────

export interface TrustScoreEntry {
  timestamp: string;       // ISO 8601
  score: number;           // 0-100
  grade: string;           // A-F
  projectPath: string;
  branch?: string;
  commit?: string;
  author?: string;
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categories: Record<string, number>; // category -> issue count
  metadata?: Record<string, unknown>;
}

export interface TrendData {
  period: string;           // e.g., "2024-01-15", "2024-W03", "2024-01"
  averageScore: number;
  minScore: number;
  maxScore: number;
  scanCount: number;
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ViolationHotspot {
  file: string;
  totalViolations: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  trend: 'improving' | 'worsening' | 'stable';
  firstSeen: string;
  lastSeen: string;
}

export interface TeamMetrics {
  teamId?: string;
  teamName?: string;
  members: number;
  averageScore: number;
  scoreChange: number;       // Delta from previous period
  totalScans: number;
  fixRate: number;           // Percentage of issues fixed
  meanTimeToFix: number;     // Average hours to resolve
  topCategories: Array<{ category: string; count: number }>;
}

export interface AnalyticsDashboard {
  generatedAt: string;
  period: { from: string; to: string };
  project: {
    name: string;
    path: string;
    currentScore: number;
    currentGrade: string;
  };
  scoreTrend: TrendData[];
  hotspots: ViolationHotspot[];
  categoryBreakdown: Record<string, { count: number; trend: 'up' | 'down' | 'stable' }>;
  severityDistribution: Record<string, number>;
  riskScore: number;         // Computed risk indicator
  complianceGaps: string[];  // Specific compliance gaps found
}

// ─── Analytics Engine ─────────────────────────────────────────

const ANALYTICS_DIR = '.guardrail/analytics';
const HISTORY_FILE = 'score-history.jsonl';

export class TrendAnalyticsEngine {
  private basePath: string;
  private historyPath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
    const analyticsDir = path.join(basePath, ANALYTICS_DIR);
    this.historyPath = path.join(analyticsDir, HISTORY_FILE);
  }

  /**
   * Record a new scan result for trend tracking
   */
  async recordScan(entry: TrustScoreEntry): Promise<void> {
    const dir = path.dirname(this.historyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(this.historyPath, JSON.stringify(entry) + '\n', 'utf8');
  }

  /**
   * Load all historical scan entries
   */
  async loadHistory(options?: {
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<TrustScoreEntry[]> {
    if (!fs.existsSync(this.historyPath)) return [];

    const content = fs.readFileSync(this.historyPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    let entries: TrustScoreEntry[] = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch { /* skip malformed */ }
    }

    // Apply date filters
    if (options?.from) {
      entries = entries.filter(e => new Date(e.timestamp) >= options.from!);
    }
    if (options?.to) {
      entries = entries.filter(e => new Date(e.timestamp) <= options.to!);
    }
    if (options?.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * Generate trend data aggregated by period
   */
  async getTrends(options: {
    period: 'day' | 'week' | 'month';
    from?: Date;
    to?: Date;
  }): Promise<TrendData[]> {
    const entries = await this.loadHistory({ from: options.from, to: options.to });
    if (entries.length === 0) return [];

    // Group by period
    const groups = new Map<string, TrustScoreEntry[]>();

    for (const entry of entries) {
      const key = this.getPeriodKey(entry.timestamp, options.period);
      const group = groups.get(key) || [];
      group.push(entry);
      groups.set(key, group);
    }

    // Aggregate each period
    const trends: TrendData[] = [];

    for (const [period, periodEntries] of groups) {
      const scores = periodEntries.map(e => e.score);
      const issuesByCategory: Record<string, number> = {};
      const issuesBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

      for (const entry of periodEntries) {
        issuesBySeverity.critical += entry.issues.critical;
        issuesBySeverity.high += entry.issues.high;
        issuesBySeverity.medium += entry.issues.medium;
        issuesBySeverity.low += entry.issues.low;

        for (const [cat, count] of Object.entries(entry.categories)) {
          issuesByCategory[cat] = (issuesByCategory[cat] || 0) + count;
        }
      }

      trends.push({
        period,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        scanCount: periodEntries.length,
        totalIssues: issuesBySeverity.critical + issuesBySeverity.high + issuesBySeverity.medium + issuesBySeverity.low,
        issuesByCategory,
        issuesBySeverity,
      });
    }

    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Identify violation hotspots — files with recurring issues
   */
  async getHotspots(options?: {
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<ViolationHotspot[]> {
    const entries = await this.loadHistory({ from: options?.from, to: options?.to });
    if (entries.length === 0) return [];

    const fileMap = new Map<string, {
      totalViolations: number;
      bySeverity: Record<string, number>;
      byCategory: Record<string, number>;
      firstSeen: string;
      lastSeen: string;
      recentCount: number;
      olderCount: number;
    }>();

    const midpoint = entries.length > 1
      ? entries[Math.floor(entries.length / 2)]!.timestamp
      : entries[0]!.timestamp;

    for (const entry of entries) {
      const isRecent = entry.timestamp >= midpoint;

      // Simulate file-level tracking from category data
      // In production, this would use detailed scan results
      for (const [category, count] of Object.entries(entry.categories)) {
        const fileKey = `${entry.projectPath}/${category}`;

        const existing = fileMap.get(fileKey) || {
          totalViolations: 0,
          bySeverity: {},
          byCategory: {},
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          recentCount: 0,
          olderCount: 0,
        };

        existing.totalViolations += count;
        existing.byCategory[category] = (existing.byCategory[category] || 0) + count;
        if (entry.timestamp < existing.firstSeen) existing.firstSeen = entry.timestamp;
        if (entry.timestamp > existing.lastSeen) existing.lastSeen = entry.timestamp;

        if (isRecent) {
          existing.recentCount += count;
        } else {
          existing.olderCount += count;
        }

        fileMap.set(fileKey, existing);
      }
    }

    // Convert to hotspots
    const hotspots: ViolationHotspot[] = [];

    for (const [file, data] of fileMap) {
      let trend: ViolationHotspot['trend'] = 'stable';
      if (data.recentCount > data.olderCount * 1.2) trend = 'worsening';
      if (data.recentCount < data.olderCount * 0.8) trend = 'improving';

      hotspots.push({
        file,
        totalViolations: data.totalViolations,
        bySeverity: data.bySeverity,
        byCategory: data.byCategory,
        trend,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
      });
    }

    return hotspots
      .sort((a, b) => b.totalViolations - a.totalViolations)
      .slice(0, options?.limit || 20);
  }

  /**
   * Generate a full analytics dashboard
   */
  async generateDashboard(options?: {
    from?: Date;
    to?: Date;
  }): Promise<AnalyticsDashboard> {
    const from = options?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const to = options?.to || new Date();

    const entries = await this.loadHistory({ from, to });
    const trends = await this.getTrends({ period: 'day', from, to });
    const hotspots = await this.getHotspots({ from, to, limit: 10 });

    const latestEntry = entries[entries.length - 1];
    const previousEntry = entries.length > 1 ? entries[entries.length - 2] : undefined;

    // Category breakdown with trend
    const categoryBreakdown: Record<string, { count: number; trend: 'up' | 'down' | 'stable' }> = {};
    if (latestEntry) {
      for (const [cat, count] of Object.entries(latestEntry.categories)) {
        const prevCount = previousEntry?.categories[cat] || 0;
        categoryBreakdown[cat] = {
          count,
          trend: count > prevCount ? 'up' : count < prevCount ? 'down' : 'stable',
        };
      }
    }

    // Severity distribution
    const severityDistribution: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    if (latestEntry) {
      severityDistribution['critical'] = latestEntry.issues.critical;
      severityDistribution['high'] = latestEntry.issues.high;
      severityDistribution['medium'] = latestEntry.issues.medium;
      severityDistribution['low'] = latestEntry.issues.low;
    }

    // Risk score: weighted sum of severity issues
    const riskScore = Math.min(100, Math.max(0,
      100 - (
        (severityDistribution['critical'] || 0) * 25 +
        (severityDistribution['high'] || 0) * 10 +
        (severityDistribution['medium'] || 0) * 3 +
        (severityDistribution['low'] || 0) * 1
      )
    ));

    // Compliance gaps
    const complianceGaps: string[] = [];
    if ((severityDistribution['critical'] ?? 0) > 0) complianceGaps.push('Critical security vulnerabilities present');
    if (!latestEntry?.categories['encryption']) complianceGaps.push('Encryption at rest not verified');
    if ((latestEntry?.score || 0) < 60) complianceGaps.push('Trust score below minimum threshold');

    const pkgJsonPath = path.join(this.basePath, 'package.json');
    let projectName = path.basename(this.basePath);
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        projectName = pkg.name || projectName;
      } catch { /* use basename */ }
    }

    return {
      generatedAt: new Date().toISOString(),
      period: { from: from.toISOString(), to: to.toISOString() },
      project: {
        name: projectName,
        path: this.basePath,
        currentScore: latestEntry?.score || 0,
        currentGrade: latestEntry?.grade || 'N/A',
      },
      scoreTrend: trends,
      hotspots,
      categoryBreakdown,
      severityDistribution,
      riskScore,
      complianceGaps,
    };
  }

  /**
   * Format dashboard for CLI display
   */
  formatDashboard(dashboard: AnalyticsDashboard): string {
    const lines: string[] = [
      '',
      `  Trust Score Dashboard — ${dashboard.project.name}`,
      `  ${'═'.repeat(55)}`,
      `  Current Score: ${dashboard.project.currentScore}/100 (${dashboard.project.currentGrade})`,
      `  Risk Score:    ${dashboard.riskScore}/100`,
      `  Period:        ${dashboard.period.from.split('T')[0]} to ${dashboard.period.to.split('T')[0]}`,
      '',
      '  Severity Distribution:',
      `    Critical: ${dashboard.severityDistribution['critical'] || 0}`,
      `    High:     ${dashboard.severityDistribution['high'] || 0}`,
      `    Medium:   ${dashboard.severityDistribution['medium'] || 0}`,
      `    Low:      ${dashboard.severityDistribution['low'] || 0}`,
      '',
    ];

    // Score trend sparkline
    if (dashboard.scoreTrend.length > 0) {
      lines.push('  Score Trend (last 14 periods):');
      const recent = dashboard.scoreTrend.slice(-14);
      const scores = recent.map(t => t.averageScore);
      const sparkline = scores.map(s => {
        if (s >= 80) return '\u2588';
        if (s >= 60) return '\u2586';
        if (s >= 40) return '\u2584';
        if (s >= 20) return '\u2582';
        return '\u2581';
      }).join('');
      lines.push(`    ${sparkline}  (${Math.min(...scores)}-${Math.max(...scores)})`);
      lines.push('');
    }

    // Top hotspots
    if (dashboard.hotspots.length > 0) {
      lines.push('  Top Violation Hotspots:');
      for (const h of dashboard.hotspots.slice(0, 5)) {
        const trendIcon = h.trend === 'improving' ? '\u2193' : h.trend === 'worsening' ? '\u2191' : '\u2192';
        lines.push(`    ${trendIcon} ${h.file} (${h.totalViolations} violations)`);
      }
      lines.push('');
    }

    // Compliance gaps
    if (dashboard.complianceGaps.length > 0) {
      lines.push('  Compliance Gaps:');
      for (const gap of dashboard.complianceGaps) {
        lines.push(`    \u26A0 ${gap}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ─── Helpers ──────────────────────────────────────────────

  private getPeriodKey(timestamp: string, period: 'day' | 'week' | 'month'): string {
    const date = new Date(timestamp);

    switch (period) {
      case 'day':
        return date.toISOString().split('T')[0]!;
      case 'week': {
        const year = date.getFullYear();
        const weekNum = this.getWeekNumber(date);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      }
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}
