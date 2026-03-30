/**
 * Long-Term Improvement Tracking System
 * 
 * Tracks and enforces:
 * - Best practices adoption
 * - Testing coverage and quality
 * - Code review processes
 * - Tool efficiency
 * - Continuous improvement
 */

import * as path from 'path';
import * as fs from 'fs/promises';
// import { execSync } from 'child_process'; // Unused, commented out

export interface BestPractice {
  id: string;
  name: string;
  category: 'testing' | 'code_quality' | 'security' | 'performance' | 'documentation' | 'process';
  description: string;
  status: 'adopted' | 'partial' | 'not_adopted';
  adoptionDate?: string;
  evidence: string[];
  impact: 'high' | 'medium' | 'low';
}

export interface TestMetrics {
  coverage: number; // 0-100
  unitTests: number;
  integrationTests: number;
  e2eTests: number;
  passing: number;
  failing: number;
  lastRun: string;
  trends: Array<{
    date: string;
    coverage: number;
    passing: number;
  }>;
}

export interface CodeReviewMetrics {
  reviewsCompleted: number;
  averageReviewTime: number; // minutes
  issuesFound: number;
  issuesResolved: number;
  reviewQuality: number; // 0-100
  trends: Array<{
    date: string;
    reviews: number;
    quality: number;
  }>;
}

export interface ToolEfficiency {
  tool: string;
  usage: number; // times used
  successRate: number; // 0-100
  averageTime: number; // minutes
  improvements: Array<{
    date: string;
    change: string;
    impact: string;
  }>;
}

export interface ImprovementPlan {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  status: 'planned' | 'in_progress' | 'completed' | 'blocked';
  assignedTo?: string;
  dueDate?: string;
  progress: number; // 0-100
  milestones: Array<{
    id: string;
    title: string;
    completed: boolean;
    completedDate?: string;
  }>;
  blockers: string[];
}

export interface LongTermTrackingReport {
  projectPath: string;
  timestamp: string;
  bestPractices: BestPractice[];
  testMetrics: TestMetrics;
  codeReviewMetrics: CodeReviewMetrics;
  toolEfficiency: ToolEfficiency[];
  improvementPlans: ImprovementPlan[];
  overallScore: number; // 0-100
  recommendations: string[];
}

export class LongTermTrackingSystem {
  private projectPath: string;
  private dataPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.dataPath = path.join(projectPath, '.guardrail', 'improvements');
  }

  /**
   * Generate comprehensive tracking report
   */
  async generateReport(): Promise<LongTermTrackingReport> {
    // Load or initialize data
    const bestPractices = await this.loadBestPractices();
    const testMetrics = await this.analyzeTestMetrics();
    const codeReviewMetrics = await this.analyzeCodeReviewMetrics();
    const toolEfficiency = await this.analyzeToolEfficiency();
    const improvementPlans = await this.loadImprovementPlans();

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      bestPractices,
      testMetrics,
      codeReviewMetrics,
      toolEfficiency
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      bestPractices,
      testMetrics,
      codeReviewMetrics,
      toolEfficiency,
      improvementPlans
    );

    return {
      projectPath: this.projectPath,
      timestamp: new Date().toISOString(),
      bestPractices,
      testMetrics,
      codeReviewMetrics,
      toolEfficiency,
      improvementPlans,
      overallScore,
      recommendations,
    };
  }

  /**
   * Track best practice adoption
   */
  async trackBestPractice(practice: BestPractice): Promise<void> {
    const practices = await this.loadBestPractices();
    const index = practices.findIndex(p => p.id === practice.id);
    
    if (index >= 0) {
      practices[index] = practice;
    } else {
      practices.push(practice);
    }

    await this.saveBestPractices(practices);
  }

  /**
   * Record test run
   */
  async recordTestRun(metrics: Partial<TestMetrics>): Promise<void> {
    const currentMetrics = await this.analyzeTestMetrics();
    
    // Update metrics
    const updated: TestMetrics = {
      ...currentMetrics,
      ...metrics,
      lastRun: new Date().toISOString(),
    };

    // Add to trends
    updated.trends.push({
      date: new Date().toISOString(),
      coverage: updated.coverage,
      passing: updated.passing,
    });

    // Keep only last 30 trends
    if (updated.trends.length > 30) {
      updated.trends = updated.trends.slice(-30);
    }

    await this.saveTestMetrics(updated);
  }

  /**
   * Record code review
   */
  async recordCodeReview(review: {
    issuesFound: number;
    issuesResolved: number;
    reviewTime: number; // minutes
    quality: number; // 0-100
  }): Promise<void> {
    const metrics = await this.analyzeCodeReviewMetrics();
    
    metrics.reviewsCompleted++;
    metrics.issuesFound += review.issuesFound;
    metrics.issuesResolved += review.issuesResolved;
    
    // Update average review time
    const totalTime = metrics.averageReviewTime * (metrics.reviewsCompleted - 1) + review.reviewTime;
    metrics.averageReviewTime = totalTime / metrics.reviewsCompleted;

    // Update review quality
    const totalQuality = metrics.reviewQuality * (metrics.reviewsCompleted - 1) + review.quality;
    metrics.reviewQuality = totalQuality / metrics.reviewsCompleted;

    // Add to trends
    metrics.trends.push({
      date: new Date().toISOString(),
      reviews: metrics.reviewsCompleted,
      quality: metrics.reviewQuality,
    });

    // Keep only last 30 trends
    if (metrics.trends.length > 30) {
      metrics.trends = metrics.trends.slice(-30);
    }

    await this.saveCodeReviewMetrics(metrics);
  }

  /**
   * Track tool usage
   */
  async trackToolUsage(
    tool: string,
    success: boolean,
    duration: number // minutes
  ): Promise<void> {
    const efficiency = await this.analyzeToolEfficiency();
    let toolData = efficiency.find(t => t.tool === tool);

    if (!toolData) {
      toolData = {
        tool,
        usage: 0,
        successRate: 0,
        averageTime: 0,
        improvements: [],
      };
      efficiency.push(toolData);
    }

    toolData.usage++;
    const successCount = toolData.successRate * (toolData.usage - 1) / 100;
    const newSuccessCount = successCount + (success ? 1 : 0);
    toolData.successRate = (newSuccessCount / toolData.usage) * 100;

    const totalTime = toolData.averageTime * (toolData.usage - 1) + duration;
    toolData.averageTime = totalTime / toolData.usage;

    await this.saveToolEfficiency(efficiency);
  }

  /**
   * Create improvement plan
   */
  async createImprovementPlan(plan: ImprovementPlan): Promise<void> {
    const plans = await this.loadImprovementPlans();
    plans.push(plan);
    await this.saveImprovementPlans(plans);
  }

  /**
   * Update improvement plan progress
   */
  async updateImprovementPlan(
    planId: string,
    updates: Partial<ImprovementPlan>
  ): Promise<void> {
    const plans = await this.loadImprovementPlans();
    const index = plans.findIndex(p => p.id === planId);
    
    if (index >= 0 && plans[index]) {
      const existingPlan = plans[index];
      plans[index] = { 
        ...existingPlan, 
        ...updates,
        id: existingPlan.id, // Ensure id is always defined
      } as ImprovementPlan;
      await this.saveImprovementPlans(plans);
    }
  }

  // Analysis methods
  private async analyzeTestMetrics(): Promise<TestMetrics> {
    try {
      const saved = await this.loadTestMetrics();
      if (saved) return saved;
    } catch {
      // No saved data
    }

    // Analyze test files
    const testFiles = await this.findTestFiles();
    const unitTests = testFiles.filter(f => f.includes('.test.') || f.includes('.spec.')).length;
    const integrationTests = testFiles.filter(f => f.includes('integration')).length;
    const e2eTests = testFiles.filter(f => f.includes('e2e') || f.includes('playwright')).length;

    // Try to get coverage from test output
    let coverage = 0;
    try {
      const coverageFile = path.join(this.projectPath, 'coverage', 'coverage-summary.json');
      const coverageData = JSON.parse(await fs.readFile(coverageFile, 'utf8'));
      coverage = coverageData.total?.lines?.pct || 0;
    } catch {
      // Coverage file not found
    }

    return {
      coverage,
      unitTests,
      integrationTests,
      e2eTests,
      passing: 0, // Would be populated from test run
      failing: 0,
      lastRun: new Date().toISOString(),
      trends: [],
    };
  }

  private async analyzeCodeReviewMetrics(): Promise<CodeReviewMetrics> {
    try {
      const saved = await this.loadCodeReviewMetrics();
      if (saved) return saved;
    } catch {
      // No saved data
    }

    return {
      reviewsCompleted: 0,
      averageReviewTime: 0,
      issuesFound: 0,
      issuesResolved: 0,
      reviewQuality: 0,
      trends: [],
    };
  }

  private async analyzeToolEfficiency(): Promise<ToolEfficiency[]> {
    try {
      const saved = await this.loadToolEfficiency();
      if (saved) return saved;
    } catch {
      // No saved data
    }

    return [];
  }

  private async loadBestPractices(): Promise<BestPractice[]> {
    try {
      const filePath = path.join(this.dataPath, 'best-practices.json');
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultBestPractices();
    }
  }

  private getDefaultBestPractices(): BestPractice[] {
    return [
      {
        id: 'unit-testing',
        name: 'Unit Testing',
        category: 'testing',
        description: 'Write unit tests for all critical functions',
        status: 'not_adopted',
        evidence: [],
        impact: 'high',
      },
      {
        id: 'code-review',
        name: 'Code Review Process',
        category: 'process',
        description: 'All code changes require peer review',
        status: 'not_adopted',
        evidence: [],
        impact: 'high',
      },
      {
        id: 'ci-cd',
        name: 'CI/CD Pipeline',
        category: 'process',
        description: 'Automated testing and deployment',
        status: 'not_adopted',
        evidence: [],
        impact: 'high',
      },
      {
        id: 'documentation',
        name: 'Code Documentation',
        category: 'documentation',
        description: 'Document all public APIs and complex logic',
        status: 'not_adopted',
        evidence: [],
        impact: 'medium',
      },
      {
        id: 'security-scanning',
        name: 'Security Scanning',
        category: 'security',
        description: 'Regular security vulnerability scanning',
        status: 'not_adopted',
        evidence: [],
        impact: 'high',
      },
    ];
  }

  private calculateOverallScore(
    practices: BestPractice[],
    tests: TestMetrics,
    reviews: CodeReviewMetrics,
    tools: ToolEfficiency[]
  ): number {
    let score = 0;
    let weight = 0;

    // Best practices (40%)
    const adoptedPractices = practices.filter(p => p.status === 'adopted').length;
    const practiceScore = (adoptedPractices / practices.length) * 100;
    score += practiceScore * 0.4;
    weight += 0.4;

    // Test coverage (30%)
    score += tests.coverage * 0.3;
    weight += 0.3;

    // Code reviews (20%)
    const reviewScore = reviews.reviewsCompleted > 0 ? reviews.reviewQuality : 0;
    score += reviewScore * 0.2;
    weight += 0.2;

    // Tool efficiency (10%)
    if (tools.length > 0) {
      const avgSuccessRate = tools.reduce((sum, t) => sum + t.successRate, 0) / tools.length;
      score += avgSuccessRate * 0.1;
      weight += 0.1;
    }

    return weight > 0 ? Math.round(score / weight) : 0;
  }

  private generateRecommendations(
    practices: BestPractice[],
    tests: TestMetrics,
    reviews: CodeReviewMetrics,
    tools: ToolEfficiency[],
    _plans: ImprovementPlan[] // Unused parameter, prefixed with underscore
  ): string[] {
    const recommendations: string[] = [];

    // Best practices
    const notAdopted = practices.filter(p => p.status === 'not_adopted' && p.impact === 'high');
    for (const practice of notAdopted.slice(0, 3)) {
      recommendations.push(`Adopt best practice: ${practice.name}`);
    }

    // Testing
    if (tests.coverage < 80) {
      recommendations.push(`Increase test coverage from ${tests.coverage}% to at least 80%`);
    }

    // Code reviews
    if (reviews.reviewsCompleted === 0) {
      recommendations.push('Establish code review process');
    }

    // Tools
    const inefficientTools = tools.filter(t => t.successRate < 70);
    for (const tool of inefficientTools) {
      recommendations.push(`Improve ${tool.tool} efficiency (current: ${tool.successRate.toFixed(0)}%)`);
    }

    return recommendations;
  }

  // File operations
  private async findTestFiles(): Promise<string[]> {
    const testFiles: string[] = [];
    const testDirs = ['tests', '__tests__', 'test', 'specs', 'e2e'];

    for (const dir of testDirs) {
      const dirPath = path.join(this.projectPath, dir);
      try {
        const files = await this.walkDirectory(dirPath);
        testFiles.push(...files.filter(f => 
          f.includes('.test.') || f.includes('.spec.') || f.includes('test')
        ));
      } catch {
        // Directory doesn't exist
      }
    }

    return testFiles;
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.walkDirectory(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
    return files;
  }

  private async ensureDataDir(): Promise<void> {
    await fs.mkdir(this.dataPath, { recursive: true });
  }

  private async saveBestPractices(practices: BestPractice[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(
      path.join(this.dataPath, 'best-practices.json'),
      JSON.stringify(practices, null, 2)
    );
  }

  private async loadTestMetrics(): Promise<TestMetrics | null> {
    try {
      const filePath = path.join(this.dataPath, 'test-metrics.json');
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveTestMetrics(metrics: TestMetrics): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(
      path.join(this.dataPath, 'test-metrics.json'),
      JSON.stringify(metrics, null, 2)
    );
  }

  private async loadCodeReviewMetrics(): Promise<CodeReviewMetrics | null> {
    try {
      const filePath = path.join(this.dataPath, 'code-review-metrics.json');
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveCodeReviewMetrics(metrics: CodeReviewMetrics): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(
      path.join(this.dataPath, 'code-review-metrics.json'),
      JSON.stringify(metrics, null, 2)
    );
  }

  private async loadToolEfficiency(): Promise<ToolEfficiency[] | null> {
    try {
      const filePath = path.join(this.dataPath, 'tool-efficiency.json');
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveToolEfficiency(efficiency: ToolEfficiency[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(
      path.join(this.dataPath, 'tool-efficiency.json'),
      JSON.stringify(efficiency, null, 2)
    );
  }

  private async loadImprovementPlans(): Promise<ImprovementPlan[]> {
    try {
      const filePath = path.join(this.dataPath, 'improvement-plans.json');
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async saveImprovementPlans(plans: ImprovementPlan[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(
      path.join(this.dataPath, 'improvement-plans.json'),
      JSON.stringify(plans, null, 2)
    );
  }
}

export function createLongTermTracking(projectPath: string): LongTermTrackingSystem {
  return new LongTermTrackingSystem(projectPath);
}
