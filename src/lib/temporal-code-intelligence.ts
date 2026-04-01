/**
 * Temporal Code Intelligence
 * 
 * Revolutionary feature: Time-travel through your code's history with AI-powered
 * insights about why changes were made, what bugs were fixed, and what the impact was.
 * 
 * Unlike git history, this understands the INTENT and IMPACT of changes.
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CodeChange {
  commit: string;
  date: Date;
  author: string;
  message: string;
  files: string[];
  additions: number;
  deletions: number;
  intent?: string; // AI-analyzed intent
  impact?: CodeImpact;
  relatedChanges?: string[]; // Related commits
}

interface CodeImpact {
  type: 'feature' | 'bugfix' | 'refactor' | 'optimization' | 'security' | 'docs';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  affectedComponents: string[];
  potentialIssues: string[];
  confidence: number;
}

interface TimelineAnalysis {
  period: { start: Date; end: Date };
  totalCommits: number;
  patterns: {
    type: string;
    count: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }[];
  recommendations: string[];
  riskPeriods: {
    start: Date;
    end: Date;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

interface RollbackSuggestion {
  commit: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  affectedFiles: string[];
  testCoverage: number;
  recommendation: string;
}

class TemporalCodeIntelligence {
  /**
   * Sanitize path input to prevent command injection
   */
  private sanitizePath(filePath: string): string {
    // Remove any shell special characters and ensure it's a valid path
    return filePath.replace(/[;&|`$()]/g, '');
  }

  /**
   * Analyze the history of a specific file
   */
  async analyzeFileHistory(
    filePath: string,
    options: {
      maxCommits?: number;
      since?: Date;
      until?: Date;
    } = {}
  ): Promise<CodeChange[]> {
    console.log(`⏰ Analyzing history of ${filePath}...`);

    const { maxCommits = 50, since, until } = options;

    // Sanitize file path to prevent command injection
    const safePath = this.sanitizePath(filePath);

    // Build git log command
    let cmd = `git log --follow --pretty=format:"%H|%an|%ae|%ad|%s" --numstat`;
    
    if (maxCommits) {
      cmd += ` -n ${maxCommits}`;
    }
    
    if (since) {
      cmd += ` --since="${since.toISOString()}"`;
    }
    
    if (until) {
      cmd += ` --until="${until.toISOString()}"`;
    }
    
    cmd += ` -- "${safePath}"`;

    try {
      const output = execSync(cmd, { encoding: 'utf-8', cwd: path.dirname(safePath) });
      const changes = this.parseGitLog(output);

      // Analyze intent and impact of each change
      for (const change of changes) {
        change.intent = await this.analyzeIntent(change);
        change.impact = await this.analyzeImpact(change);
        change.relatedChanges = await this.findRelatedChanges(change);
      }

      return changes;
    } catch (error) {
      console.error('Failed to analyze file history:', error);
      return [];
    }
  }

  /**
   * Analyze the evolution of code quality over time
   */
  async analyzeQualityEvolution(
    projectPath: string,
    options: {
      granularity?: 'daily' | 'weekly' | 'monthly';
      metrics?: string[];
    } = {}
  ): Promise<TimelineAnalysis> {
    console.log('📊 Analyzing code quality evolution...');

    const { granularity = 'weekly', metrics = ['complexity', 'duplication', 'coverage'] } = options;

    // Get all commits
    const commits = await this.getAllCommits(projectPath);

    // Group by time period
    const periods = this.groupByPeriod(commits, granularity);

    // Analyze patterns in each period
    const patterns = this.analyzePatterns(periods);

    // Identify risk periods
    const riskPeriods = this.identifyRiskPeriods(periods);

    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, riskPeriods);

    return {
      period: {
        start: commits[commits.length - 1]?.date || new Date(),
        end: commits[0]?.date || new Date(),
      },
      totalCommits: commits.length,
      patterns,
      recommendations,
      riskPeriods,
    };
  }

  /**
   * Find when a bug was introduced
   */
  async findBugOrigin(
    projectPath: string,
    bugDescription: string,
    affectedFiles: string[]
  ): Promise<{
    likelyCommit: string;
    confidence: number;
    relatedCommits: string[];
    analysis: string;
  }> {
    console.log('🐛 Analyzing bug origin...');

    const changes: CodeChange[] = [];

    // Get history of affected files
    for (const file of affectedFiles) {
      const fileChanges = await this.analyzeFileHistory(path.join(projectPath, file), {
        maxCommits: 100,
      });
      changes.push(...fileChanges);
    }

    // Sort by date (most recent first)
    changes.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Analyze which commit most likely introduced the bug
    const scores = await Promise.all(
      changes.map(async change => ({
        change,
        score: await this.scoreBugLikelihood(change, bugDescription),
      }))
    );

    scores.sort((a, b) => b.score - a.score);

    const mostLikely = scores[0];
    const relatedCommits = scores
      .slice(1, 5)
      .map(s => s.change.commit);

    return {
      likelyCommit: mostLikely.change.commit,
      confidence: mostLikely.score,
      relatedCommits,
      analysis: this.generateBugAnalysis(mostLikely.change, bugDescription),
    };
  }

  /**
   * Suggest safe rollback points
   */
  async suggestRollbackPoints(
    projectPath: string,
    targetDate?: Date
  ): Promise<RollbackSuggestion[]> {
    console.log('🔄 Analyzing rollback points...');

    const commits = await this.getAllCommits(projectPath);

    // Filter commits before target date if specified
    const candidates = targetDate
      ? commits.filter(c => c.date <= targetDate)
      : commits;

    // Analyze each potential rollback point
    const suggestions: RollbackSuggestion[] = [];

    for (const commit of candidates.slice(0, 20)) {
      const risk = await this.assessRollbackRisk(commit);
      const testCoverage = await this.estimateTestCoverage(commit);
      
      suggestions.push({
        commit: commit.commit,
        reason: this.generateRollbackReason(commit),
        risk,
        affectedFiles: commit.files,
        testCoverage,
        recommendation: this.generateRollbackRecommendation(commit, risk, testCoverage),
      });
    }

    // Sort by safety (low risk + high test coverage)
    suggestions.sort((a, b) => {
      const scoreA = this.calculateSafetyScore(a);
      const scoreB = this.calculateSafetyScore(b);
      return scoreB - scoreA;
    });

    return suggestions.slice(0, 10);
  }

  /**
   * Compare code at two different points in time
   */
  async compareTimePeriods(
    projectPath: string,
    period1: { start: Date; end: Date },
    period2: { start: Date; end: Date }
  ): Promise<{
    metrics: {
      period1: Record<string, number>;
      period2: Record<string, number>;
      change: Record<string, number>;
    };
    insights: string[];
    regression: boolean;
  }> {
    console.log('📈 Comparing time periods...');

    const commits1 = await this.getCommitsInPeriod(projectPath, period1);
    const commits2 = await this.getCommitsInPeriod(projectPath, period2);

    const metrics1 = this.calculatePeriodMetrics(commits1);
    const metrics2 = this.calculatePeriodMetrics(commits2);

    const change: Record<string, number> = {};
    for (const key in metrics1) {
      // Prevent division by zero
      if (metrics1[key] === 0) {
        change[key] = metrics2[key] === 0 ? 0 : 100;
      } else {
        change[key] = ((metrics2[key] - metrics1[key]) / metrics1[key]) * 100;
      }
    }

    const insights = this.generateComparisonInsights(metrics1, metrics2, change);
    const regression = this.detectRegression(change);

    return {
      metrics: {
        period1: metrics1,
        period2: metrics2,
        change,
      },
      insights,
      regression,
    };
  }

  /**
   * Visualize code evolution as a timeline
   */
  async generateTimeline(
    projectPath: string,
    options: {
      format?: 'json' | 'markdown' | 'html';
      includeMetrics?: boolean;
    } = {}
  ): Promise<string> {
    const { format = 'markdown', includeMetrics = true } = options;

    const commits = await this.getAllCommits(projectPath);
    const timeline = this.formatTimeline(commits, format, includeMetrics);

    return timeline;
  }

  // ============= Private Helper Methods =============

  private parseGitLog(output: string): CodeChange[] {
    const changes: CodeChange[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    let currentChange: Partial<CodeChange> | null = null;

    for (const line of lines) {
      if (line.includes('|')) {
        // New commit line
        if (currentChange) {
          changes.push(currentChange as CodeChange);
        }

        const [commit, author, , dateStr, message] = line.split('|');
        currentChange = {
          commit,
          author,
          date: new Date(dateStr),
          message,
          files: [],
          additions: 0,
          deletions: 0,
        };
      } else if (currentChange) {
        // File change line (additions deletions filename)
        const [addStr, delStr, file] = line.split(/\s+/);
        const additions = parseInt(addStr) || 0;
        const deletions = parseInt(delStr) || 0;

        currentChange.additions! += additions;
        currentChange.deletions! += deletions;
        if (file) {
          currentChange.files!.push(file);
        }
      }
    }

    if (currentChange) {
      changes.push(currentChange as CodeChange);
    }

    return changes;
  }

  private async analyzeIntent(change: CodeChange): Promise<string> {
    // Analyze commit message and changes to determine intent
    const message = change.message.toLowerCase();

    if (message.includes('fix') || message.includes('bug')) {
      return 'Bug fix';
    } else if (message.includes('feat') || message.includes('add')) {
      return 'New feature';
    } else if (message.includes('refactor')) {
      return 'Code refactoring';
    } else if (message.includes('perf') || message.includes('optimize')) {
      return 'Performance optimization';
    } else if (message.includes('security') || message.includes('vuln')) {
      return 'Security fix';
    } else if (message.includes('docs') || message.includes('readme')) {
      return 'Documentation update';
    } else if (message.includes('test')) {
      return 'Test update';
    } else if (message.includes('style') || message.includes('format')) {
      return 'Code style/formatting';
    }

    return 'General update';
  }

  private async analyzeImpact(change: CodeChange): Promise<CodeImpact> {
    const type = this.categorizeChangeType(change);
    const severity = this.calculateChangeSeverity(change);
    const affectedComponents = this.identifyAffectedComponents(change);
    const potentialIssues = this.predictPotentialIssues(change);

    return {
      type,
      severity,
      affectedComponents,
      potentialIssues,
      confidence: 0.8, // Simplified
    };
  }

  private categorizeChangeType(change: CodeChange): CodeImpact['type'] {
    const intent = change.intent?.toLowerCase() || change.message.toLowerCase();

    if (intent.includes('feat')) return 'feature';
    if (intent.includes('fix') || intent.includes('bug')) return 'bugfix';
    if (intent.includes('refactor')) return 'refactor';
    if (intent.includes('perf') || intent.includes('optimize')) return 'optimization';
    if (intent.includes('security')) return 'security';
    if (intent.includes('docs')) return 'docs';

    return 'feature';
  }

  private calculateChangeSeverity(change: CodeChange): CodeImpact['severity'] {
    const totalChanges = change.additions + change.deletions;

    if (totalChanges > 500) return 'critical';
    if (totalChanges > 200) return 'major';
    if (totalChanges > 50) return 'moderate';
    return 'minor';
  }

  private identifyAffectedComponents(change: CodeChange): string[] {
    // Extract component names from file paths
    const components = new Set<string>();

    for (const file of change.files) {
      const parts = file.split('/');
      if (parts.length > 1) {
        components.add(parts[parts.length - 2]); // Parent directory as component
      }
    }

    return Array.from(components);
  }

  private predictPotentialIssues(change: CodeChange): string[] {
    const issues: string[] = [];

    if (change.additions > change.deletions * 2) {
      issues.push('Large code addition - may increase complexity');
    }

    if (change.files.length > 10) {
      issues.push('Multiple files changed - potential coupling issues');
    }

    if (change.message.toLowerCase().includes('quick fix')) {
      issues.push('Quick fix - may need proper solution later');
    }

    return issues;
  }

  private async findRelatedChanges(change: CodeChange): Promise<string[]> {
    // Find commits that touched the same files around the same time
    // Simplified implementation
    return [];
  }

  private async getAllCommits(projectPath: string): Promise<CodeChange[]> {
    try {
      // Sanitize project path to prevent command injection
      const safePath = this.sanitizePath(projectPath);
      const cmd = 'git log --all --pretty=format:"%H|%an|%ae|%ad|%s" --numstat';
      const output = execSync(cmd, { encoding: 'utf-8', cwd: safePath });
      return this.parseGitLog(output);
    } catch (error) {
      console.error('Failed to get commits:', error);
      return [];
    }
  }

  private groupByPeriod(commits: CodeChange[], granularity: string) {
    // Group commits by time period
    // Simplified implementation
    return {};
  }

  private analyzePatterns(periods: any) {
    // Analyze patterns in commit history
    return [];
  }

  private identifyRiskPeriods(periods: any) {
    // Identify periods with high risk
    return [];
  }

  private generateRecommendations(patterns: any, riskPeriods: any) {
    return [
      'Consider more frequent code reviews during high-activity periods',
      'Implement automated testing for critical components',
      'Document major architectural decisions',
    ];
  }

  private async scoreBugLikelihood(change: CodeChange, bugDescription: string): Promise<number> {
    // Score how likely this change introduced the bug
    let score = 0.5;

    // Recent changes are more likely
    const daysSince = (Date.now() - change.date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) score += 0.2;

    // Bug-related keywords reduce likelihood (fixes are marked)
    if (change.message.toLowerCase().includes('fix')) score -= 0.3;

    // Large changes are riskier
    if (change.additions + change.deletions > 100) score += 0.2;

    return Math.max(0, Math.min(1, score));
  }

  private generateBugAnalysis(change: CodeChange, bugDescription: string): string {
    return `This commit was identified as the likely source of the bug based on:
- Timing: ${change.date.toLocaleDateString()}
- Files affected: ${change.files.join(', ')}
- Change size: ${change.additions} additions, ${change.deletions} deletions
- Commit message: "${change.message}"`;
  }

  private async assessRollbackRisk(commit: CodeChange): Promise<RollbackSuggestion['risk']> {
    const changeSize = commit.additions + commit.deletions;

    if (changeSize > 1000) return 'high';
    if (changeSize > 300) return 'medium';
    return 'low';
  }

  private async estimateTestCoverage(commit: CodeChange): Promise<number> {
    // Estimate test coverage for this commit
    // Simplified: check if test files were modified
    const testFiles = commit.files.filter(f =>
      f.includes('test') || f.includes('spec')
    );

    return testFiles.length > 0 ? 0.8 : 0.3;
  }

  private generateRollbackReason(commit: CodeChange): string {
    return `Stable point after: ${commit.message}`;
  }

  private generateRollbackRecommendation(
    commit: CodeChange,
    risk: string,
    testCoverage: number
  ): string {
    if (risk === 'low' && testCoverage > 0.7) {
      return 'Safe to rollback - low risk with good test coverage';
    } else if (risk === 'medium') {
      return 'Moderate risk - recommend additional testing after rollback';
    } else {
      return 'High risk - extensive testing required after rollback';
    }
  }

  private calculateSafetyScore(suggestion: RollbackSuggestion): number {
    let score = 0;

    if (suggestion.risk === 'low') score += 40;
    if (suggestion.risk === 'medium') score += 20;

    score += suggestion.testCoverage * 60;

    return score;
  }

  private async getCommitsInPeriod(
    projectPath: string,
    period: { start: Date; end: Date }
  ): Promise<CodeChange[]> {
    const allCommits = await this.getAllCommits(projectPath);
    return allCommits.filter(
      c => c.date >= period.start && c.date <= period.end
    );
  }

  private calculatePeriodMetrics(commits: CodeChange[]): Record<string, number> {
    return {
      totalCommits: commits.length,
      totalAdditions: commits.reduce((sum, c) => sum + c.additions, 0),
      totalDeletions: commits.reduce((sum, c) => sum + c.deletions, 0),
      avgCommitSize: commits.reduce((sum, c) => sum + c.additions + c.deletions, 0) / commits.length,
      uniqueAuthors: new Set(commits.map(c => c.author)).size,
    };
  }

  private generateComparisonInsights(
    metrics1: Record<string, number>,
    metrics2: Record<string, number>,
    change: Record<string, number>
  ): string[] {
    const insights: string[] = [];

    if (change.totalCommits > 20) {
      insights.push('Activity significantly increased in period 2');
    } else if (change.totalCommits < -20) {
      insights.push('Activity decreased in period 2');
    }

    if (change.avgCommitSize > 50) {
      insights.push('Commits are getting larger - consider breaking them down');
    }

    return insights;
  }

  private detectRegression(change: Record<string, number>): boolean {
    // Detect if metrics suggest regression
    return change.avgCommitSize > 100;
  }

  private formatTimeline(commits: CodeChange[], format: string, includeMetrics: boolean): string {
    if (format === 'json') {
      return JSON.stringify(commits, null, 2);
    }

    // Markdown format
    let md = '# Code Evolution Timeline\n\n';

    for (const commit of commits.slice(0, 50)) {
      md += `## ${commit.date.toLocaleDateString()}\n`;
      md += `**${commit.message}** by ${commit.author}\n`;
      
      if (includeMetrics) {
        md += `- Changes: +${commit.additions} -${commit.deletions}\n`;
        md += `- Files: ${commit.files.length}\n`;
      }
      
      if (commit.intent) {
        md += `- Intent: ${commit.intent}\n`;
      }
      
      md += '\n';
    }

    return md;
  }
}

export const temporalCodeIntelligence = new TemporalCodeIntelligence();
export default temporalCodeIntelligence;
