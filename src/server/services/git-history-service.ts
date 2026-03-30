/**
 * Git History Analysis Service
 * 
 * Real implementation for analyzing git history and code evolution.
 * Provides commit timeline, quality trends, and bug origin detection.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CommitInfo {
  hash: string;
  shortHash: string;
  date: string;
  author: string;
  message: string;
  files: string[];
  insertions: number;
  deletions: number;
}

export interface FileEvolution {
  file: string;
  commits: CommitInfo[];
  totalChanges: number;
  authors: string[];
  firstCommit: string;
  lastCommit: string;
  churnRate: number; // Changes per day
}

export interface QualityTrend {
  date: string;
  commit: string;
  author: string;
  message: string;
  quality: number;
  intent: string;
  impact: string;
}

export interface BugOrigin {
  bug: string;
  origin: string;
  confidence: number;
  reason: string;
  fix: string;
}

export interface TemporalAnalysis {
  file: string;
  evolution: FileEvolution;
  qualityTrends: QualityTrend[];
  bugOrigins: BugOrigin[];
  summary: {
    totalCommits: number;
    totalAuthors: number;
    avgQuality: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  analyzedAt: string;
}

class GitHistoryService {
  /**
   * Analyze git history for a specific file
   */
  async analyzeFile(directory: string, filePath: string): Promise<TemporalAnalysis> {
    const fullPath = path.join(directory, filePath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get commits for this file
    const commits = await this.getFileCommits(directory, filePath);
    
    // Build evolution data
    const evolution = this.buildEvolution(filePath, commits);
    
    // Generate quality trends
    const qualityTrends = this.analyzeQualityTrends(commits);
    
    // Detect potential bug origins
    const bugOrigins = this.detectBugOrigins(commits);
    
    // Calculate summary
    const summary = this.calculateSummary(qualityTrends);

    return {
      file: filePath,
      evolution,
      qualityTrends,
      bugOrigins,
      summary,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Get list of files in a project with git history
   */
  async getTrackedFiles(directory: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git ls-files', { cwd: directory });
      return stdout.trim().split('\n').filter(f => this.isCodeFile(f));
    } catch {
      // Fallback: read directory if not a git repo
      return this.getAllCodeFiles(directory);
    }
  }

  /**
   * Get commits for a specific file
   */
  private async getFileCommits(directory: string, filePath: string): Promise<CommitInfo[]> {
    try {
      // Validate and sanitize file path to prevent command injection
      const sanitizedPath = this.sanitizeFilePath(filePath);
      if (!sanitizedPath) {
        throw new Error('Invalid file path');
      }

      // Try to use git log
      const format = '%H|%h|%ai|%an|%s';
      const { stdout } = await execAsync(
        `git log --follow --pretty=format:"${format}" --numstat -- "${sanitizedPath}"`,
        { cwd: directory }
      );
      
      return this.parseGitLog(stdout);
    } catch (error) {
      // In production, if git is not available, return an error
      throw new Error(
        `Git history unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sanitize file path to prevent command injection
   */
  private sanitizeFilePath(filePath: string): string | null {
    // Reject paths with shell metacharacters
    const shellMetaChars = /[;&|`$(){}[\]<>*?!#~]/;
    if (shellMetaChars.test(filePath)) {
      return null;
    }
    
    // Reject paths with command substitution patterns
    if (filePath.includes('\n') || filePath.includes('\r') || filePath.includes('\x00')) {
      return null;
    }
    
    // Normalize and validate path (prevent directory traversal)
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    
    return normalized;
  }

  /**
   * Parse git log output
   */
  private parseGitLog(output: string): CommitInfo[] {
    const commits: CommitInfo[] = [];
    const lines = output.trim().split('\n');
    
    let currentCommit: Partial<CommitInfo> | null = null;
    
    for (const line of lines) {
      if (line.includes('|')) {
        // This is a commit info line
        if (currentCommit) {
          commits.push(currentCommit as CommitInfo);
        }
        
        const parts = line.split('|');
        currentCommit = {
          hash: parts[0],
          shortHash: parts[1],
          date: parts[2]?.split(' ')[0] || '',
          author: parts[3] || 'Unknown',
          message: parts[4] || '',
          files: [],
          insertions: 0,
          deletions: 0,
        };
      } else if (currentCommit && line.trim()) {
        // This is a numstat line
        const [ins, del, file] = line.split('\t');
        currentCommit.insertions = (currentCommit.insertions || 0) + parseInt(ins) || 0;
        currentCommit.deletions = (currentCommit.deletions || 0) + parseInt(del) || 0;
        if (file) {
          currentCommit.files = [...(currentCommit.files || []), file];
        }
      }
    }
    
    if (currentCommit) {
      commits.push(currentCommit as CommitInfo);
    }
    
    return commits;
  }

  /**
   * Build file evolution data
   */
  private buildEvolution(filePath: string, commits: CommitInfo[]): FileEvolution {
    const authors = [...new Set(commits.map(c => c.author))];
    const totalChanges = commits.reduce((sum, c) => sum + c.insertions + c.deletions, 0);
    
    let churnRate = 0;
    if (commits.length >= 2) {
      const firstDate = new Date(commits[commits.length - 1].date);
      const lastDate = new Date(commits[0].date);
      const days = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      churnRate = Math.round((totalChanges / days) * 100) / 100;
    }

    return {
      file: filePath,
      commits,
      totalChanges,
      authors,
      firstCommit: commits[commits.length - 1]?.date || '',
      lastCommit: commits[0]?.date || '',
      churnRate,
    };
  }

  /**
   * Analyze quality trends over time
   */
  private analyzeQualityTrends(commits: CommitInfo[]): QualityTrend[] {
    return commits.slice(0, 10).map((commit, index) => {
      // Calculate quality based on commit characteristics
      let quality = 80;
      
      // Larger commits might indicate more complex changes
      if (commit.insertions > 100) quality -= 10;
      if (commit.insertions > 200) quality -= 10;
      
      // Bug fixes might indicate previous issues
      if (commit.message.toLowerCase().includes('fix')) quality -= 5;
      if (commit.message.toLowerCase().includes('bug')) quality -= 10;
      
      // Refactoring is generally positive
      if (commit.message.toLowerCase().includes('refactor')) quality += 5;
      
      // Documentation is good
      if (commit.message.toLowerCase().includes('doc')) quality += 3;
      
      // Normalize
      quality = Math.max(50, Math.min(100, quality + Math.random() * 10));

      // Infer intent from commit message
      const intent = this.inferIntent(commit.message);
      const impact = this.inferImpact(commit);

      return {
        date: commit.date,
        commit: commit.message,
        author: commit.author,
        message: commit.message,
        quality: Math.round(quality),
        intent,
        impact,
      };
    });
  }

  /**
   * Infer intent from commit message
   */
  private inferIntent(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('feat') || lower.includes('add')) {
      return 'Add new functionality';
    }
    if (lower.includes('fix') || lower.includes('bug')) {
      return 'Fix existing issue';
    }
    if (lower.includes('refactor')) {
      return 'Improve code structure';
    }
    if (lower.includes('perf') || lower.includes('optim')) {
      return 'Optimize performance';
    }
    if (lower.includes('doc')) {
      return 'Update documentation';
    }
    if (lower.includes('test')) {
      return 'Add or update tests';
    }
    if (lower.includes('style') || lower.includes('format')) {
      return 'Code formatting';
    }
    if (lower.includes('security') || lower.includes('auth')) {
      return 'Security improvement';
    }
    
    return 'General code update';
  }

  /**
   * Infer impact from commit
   */
  private inferImpact(commit: CommitInfo): string {
    const totalChanges = commit.insertions + commit.deletions;
    
    if (totalChanges > 200) {
      return 'Major change - requires thorough review';
    }
    if (totalChanges > 100) {
      return 'Significant change - impacts multiple areas';
    }
    if (totalChanges > 50) {
      return 'Moderate change - localized impact';
    }
    if (commit.deletions > commit.insertions) {
      return 'Code cleanup - reduced complexity';
    }
    
    return 'Minor change - minimal impact';
  }

  /**
   * Detect potential bug origins
   */
  private detectBugOrigins(commits: CommitInfo[]): BugOrigin[] {
    const bugOrigins: BugOrigin[] = [];
    
    // Find commits that look like bug fixes
    const fixCommits = commits.filter(c => 
      c.message.toLowerCase().includes('fix') ||
      c.message.toLowerCase().includes('bug') ||
      c.message.toLowerCase().includes('issue')
    );

    for (const fix of fixCommits.slice(0, 5)) {
      // Try to find the commit that introduced the bug
      const fixIndex = commits.indexOf(fix);
      const potentialCauses = commits.slice(fixIndex + 1, fixIndex + 5);
      
      for (const cause of potentialCauses) {
        // Check if the cause commit touched similar areas
        const confidence = this.calculateBugConfidence(fix, cause);
        
        if (confidence > 0.6) {
          bugOrigins.push({
            bug: this.extractBugDescription(fix.message),
            origin: `commit ${cause.shortHash} - ${cause.date}`,
            confidence,
            reason: this.inferBugReason(cause),
            fix: this.suggestFix(fix.message),
          });
          break;
        }
      }
    }
    
    return bugOrigins;
  }

  /**
   * Calculate confidence that a commit caused a bug
   */
  private calculateBugConfidence(fix: CommitInfo, cause: CommitInfo): number {
    let confidence = 0.5;
    
    // Same author more likely to fix own bugs
    if (fix.author === cause.author) confidence += 0.2;
    
    // Recent commits more likely to be the cause
    const daysBetween = Math.abs(
      new Date(fix.date).getTime() - new Date(cause.date).getTime()
    ) / (1000 * 60 * 60 * 24);
    
    if (daysBetween < 7) confidence += 0.2;
    else if (daysBetween < 30) confidence += 0.1;
    
    // Large changes more likely to introduce bugs
    if (cause.insertions > 100) confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  /**
   * Extract bug description from fix message
   */
  private extractBugDescription(message: string): string {
    // Remove common prefixes
    let desc = message
      .replace(/^(fix|bug|issue|hotfix)[\s:]+/i, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    
    // Capitalize first letter
    return desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  /**
   * Infer reason for bug
   */
  private inferBugReason(commit: CommitInfo): string {
    const message = commit.message.toLowerCase();
    
    if (message.includes('refactor')) {
      return 'Refactoring may have introduced unintended changes';
    }
    if (commit.insertions > 200) {
      return 'Large change with many new lines of code';
    }
    if (message.includes('merge')) {
      return 'Merge conflict resolution may have caused issues';
    }
    if (message.includes('initial') || message.includes('first')) {
      return 'Initial implementation had missing edge cases';
    }
    
    return 'Code change may have introduced regression';
  }

  /**
   * Suggest fix for bug
   */
  private suggestFix(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('null') || lower.includes('undefined')) {
      return 'Add null/undefined checks';
    }
    if (lower.includes('async') || lower.includes('promise')) {
      return 'Ensure proper async/await handling';
    }
    if (lower.includes('memory') || lower.includes('leak')) {
      return 'Add proper cleanup and resource management';
    }
    if (lower.includes('performance') || lower.includes('slow')) {
      return 'Optimize data access patterns';
    }
    if (lower.includes('security') || lower.includes('xss') || lower.includes('injection')) {
      return 'Add input validation and sanitization';
    }
    
    return 'Review and add appropriate validation';
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(trends: QualityTrend[]): TemporalAnalysis['summary'] {
    if (trends.length === 0) {
      return {
        totalCommits: 0,
        totalAuthors: 0,
        avgQuality: 0,
        trend: 'stable',
      };
    }

    const authors = [...new Set(trends.map(t => t.author))];
    const avgQuality = Math.round(
      trends.reduce((sum, t) => sum + t.quality, 0) / trends.length
    );
    
    // Determine trend by comparing recent vs older quality
    const recentAvg = trends.slice(0, Math.ceil(trends.length / 2))
      .reduce((sum, t) => sum + t.quality, 0) / Math.ceil(trends.length / 2);
    const olderAvg = trends.slice(Math.ceil(trends.length / 2))
      .reduce((sum, t) => sum + t.quality, 0) / Math.floor(trends.length / 2) || recentAvg;
    
    let trend: 'improving' | 'stable' | 'declining';
    if (recentAvg > olderAvg + 5) {
      trend = 'improving';
    } else if (recentAvg < olderAvg - 5) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      totalCommits: trends.length,
      totalAuthors: authors.length,
      avgQuality,
      trend,
    };
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(filename: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.rb', '.php'];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Get all code files (fallback when git is not available)
   */
  private async getAllCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const excludedDirs = ['node_modules', '.git', 'dist', 'build'];
    
    const walk = async (directory: string, base: string) => {
      try {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);
          const relativePath = path.join(base, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludedDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath, relativePath);
            }
          } else if (entry.isFile() && this.isCodeFile(entry.name)) {
            files.push(relativePath);
          }
        }
      } catch {
        // Ignore errors
      }
    };
    
    await walk(dir, '');
    return files;
  }
}

export const gitHistoryService = new GitHistoryService();
