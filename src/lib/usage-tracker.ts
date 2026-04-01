/**
 * Usage Tracking and Enforcement
 * 
 * Tracks usage across projects and enforces subscription limits
 */

import * as fs from 'fs';
import * as path from 'path';
import { SubscriptionTier, subscriptionTierManager } from './subscription-tiers';
import { codebaseSizeTracker } from './codebase-size';

export interface UsageData {
  projectId: string;
  projectPath: string;
  tier: SubscriptionTier;
  metrics: {
    files: number;
    lines: number;
    size: number;
  };
  lastUpdated: string;
}

export interface UsageSummary {
  totalProjects: number;
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  projects: UsageData[];
  tier: SubscriptionTier;
}

class UsageTracker {
  private usageFile: string;

  constructor(usageFile: string = '.guardrails-usage.json') {
    this.usageFile = usageFile;
  }

  /**
   * Track project usage
   */
  async trackProject(
    projectPath: string,
    tier: SubscriptionTier
  ): Promise<UsageData> {
    const metrics = await codebaseSizeTracker.calculateSize(projectPath);
    const projectId = this.getProjectId(projectPath);

    const usageData: UsageData = {
      projectId,
      projectPath,
      tier,
      metrics: {
        files: metrics.totalFiles,
        lines: metrics.totalLines,
        size: metrics.totalSize,
      },
      lastUpdated: new Date().toISOString(),
    };

    await this.saveUsage(usageData);
    return usageData;
  }

  /**
   * Get usage summary
   */
  async getUsageSummary(): Promise<UsageSummary> {
    const allUsage = await this.loadAllUsage();
    
    const summary: UsageSummary = {
      totalProjects: allUsage.length,
      totalFiles: 0,
      totalLines: 0,
      totalSize: 0,
      projects: allUsage,
      tier: allUsage[0]?.tier || 'free',
    };

    for (const usage of allUsage) {
      summary.totalFiles += usage.metrics.files;
      summary.totalLines += usage.metrics.lines;
      summary.totalSize += usage.metrics.size;
    }

    return summary;
  }

  /**
   * Check if usage is within limits
   */
  async checkLimits(tier: SubscriptionTier): Promise<{
    withinLimits: boolean;
    summary: UsageSummary;
    exceeded: Record<string, unknown>;
    recommendedTier?: SubscriptionTier;
    message: string;
  }> {
    const summary = await this.getUsageSummary();

    const check = subscriptionTierManager.checkUsage(
      {
        files: summary.totalFiles,
        lines: summary.totalLines,
        size: summary.totalSize,
        projects: summary.totalProjects,
        teamMembers: 1, // TODO: Track team members
      },
      tier
    );

    let message = 'Usage is within limits.';
    if (!check.withinLimits && check.recommendedTier) {
      message = subscriptionTierManager.getUpgradeMessage(tier, check.recommendedTier);
    }

    return {
      withinLimits: check.withinLimits,
      summary,
      exceeded: check.exceeded,
      recommendedTier: check.recommendedTier,
      message,
    };
  }

  /**
   * Enforce limits (throw error if exceeded)
   */
  async enforceLimits(tier: SubscriptionTier): Promise<void> {
    const check = await this.checkLimits(tier);

    if (!check.withinLimits) {
      throw new Error(
        `Usage limits exceeded for ${tier} tier. ${check.message}`
      );
    }
  }

  private getProjectId(projectPath: string): string {
    // Use path hash as project ID
    return Buffer.from(projectPath).toString('base64').substring(0, 16);
  }

  private async saveUsage(usageData: UsageData): Promise<void> {
    const usageDir = path.dirname(this.usageFile);
    if (usageDir && !await this.pathExists(usageDir)) {
      await fs.promises.mkdir(usageDir, { recursive: true });
    }

    const allUsage = await this.loadAllUsage();
    const existingIndex = allUsage.findIndex(
      (u) => u.projectId === usageData.projectId
    );

    if (existingIndex >= 0) {
      allUsage[existingIndex] = usageData;
    } else {
      allUsage.push(usageData);
    }

    await fs.promises.writeFile(
      this.usageFile,
      JSON.stringify(allUsage, null, 2)
    );
  }

  private async loadAllUsage(): Promise<UsageData[]> {
    if (!await this.pathExists(this.usageFile)) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(this.usageFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const usageTracker = new UsageTracker();

