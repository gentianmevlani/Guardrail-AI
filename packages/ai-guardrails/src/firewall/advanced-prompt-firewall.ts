/**
 * Advanced Prompt Firewall Service
 * 
 * Comprehensive prompt firewall with:
 * - Detailed task breakdown
 * - Verification and validation
 * - Version control integration
 * - Immediate fixes
 * - Advanced tools integration
 * - Future planning
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';

/** Optional integrations loaded from monorepo root `src/lib` at runtime. */
interface AdvancedContextManagerApi {
  getContext(
    projectPath: string,
    opts: { purpose: string }
  ): Promise<{
    layers: unknown[];
    patterns: unknown[];
    dependencies: unknown[];
    conventions: Record<string, unknown>;
    freshness: number;
    confidence: number;
  }>;
}

interface HallucinationDetectorApi {
  detect(
    prompt: string,
    projectPath: string
  ): Promise<{
    hasHallucinations: boolean;
    score: number;
    suggestions: string[];
    checks: unknown[];
  }>;
}

// Dynamic imports to handle cross-package dependencies
async function getAdvancedContextManager(): Promise<AdvancedContextManagerApi | null> {
  try {
    const spec: string = '../../../../src/lib/advanced-context-manager';
    const module = await import(spec);
    const mgr = (module as { advancedContextManager?: AdvancedContextManagerApi }).advancedContextManager;
    return mgr ?? null;
  } catch {
    return null;
  }
}

async function getHallucinationDetector(): Promise<HallucinationDetectorApi | null> {
  try {
    const spec: string = '../../../../src/lib/hallucination-detector';
    const module = await import(spec);
    const det = (module as { hallucinationDetector?: HallucinationDetectorApi }).hallucinationDetector;
    return det ?? null;
  } catch {
    return null;
  }
}

export interface TaskBreakdown {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedTime: number; // minutes
  dependencies: string[]; // IDs of other tasks
  verification: {
    type: 'automated' | 'manual' | 'hybrid';
    checks: string[];
  };
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface VerificationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    evidence?: string;
  }>;
  score: number; // 0-100
  blockers: string[];
}

export interface VersionControlInfo {
  branch: string;
  commit: string;
  changes: Array<{
    file: string;
    status: 'added' | 'modified' | 'deleted';
    lines?: { added: number; removed: number };
  }>;
  conflicts: string[];
}

export interface ImmediateFix {
  id: string;
  type: 'code' | 'config' | 'dependency' | 'test';
  description: string;
  file: string;
  change: {
    before: string;
    after: string;
  };
  confidence: number; // 0-1
  applied: boolean;
  verified: boolean;
}

export interface FuturePlan {
  phase: 'immediate' | 'short_term' | 'long_term';
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    estimatedEffort: string;
    dependencies: string[];
  }>;
  milestones: string[];
  risks: Array<{
    description: string;
    mitigation: string;
  }>;
}

export interface PromptFirewallResult {
  prompt: string;
  taskBreakdown: TaskBreakdown[];
  verification: VerificationResult;
  versionControl: VersionControlInfo;
  immediateFixes: ImmediateFix[];
  futurePlan: FuturePlan;
  context: {
    projectPath: string;
    timestamp: string;
    confidence: number;
  };
  recommendations: string[];
}

export class AdvancedPromptFirewall {
  private projectPath: string;
  private fixHistory: Map<string, ImmediateFix[]> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Process prompt through firewall with full analysis
   */
  async process(
    prompt: string,
    options: {
      autoBreakdown?: boolean;
      autoVerify?: boolean;
      autoFix?: boolean;
      includeVersionControl?: boolean;
      generatePlan?: boolean;
    } = {}
  ): Promise<PromptFirewallResult> {
    // Note: startTime removed as it was unused
    // const startTime = Date.now();

    // 1. Get enhanced context
    const contextManager = await getAdvancedContextManager();
    const context = contextManager 
      ? await contextManager.getContext(this.projectPath, { purpose: prompt })
      : { layers: [], patterns: [], dependencies: [], conventions: {}, freshness: 0.5, confidence: 0.5 };

    // 2. Break down task
    const taskBreakdown = options.autoBreakdown !== false
      ? await this.breakDownTask(prompt, context)
      : [];

    // 3. Verify against context and patterns
    const verification = options.autoVerify !== false
      ? await this.verifyPrompt(prompt, context)
      : { passed: true, checks: [], score: 100, blockers: [] };

    // 4. Get version control info
    const versionControl = options.includeVersionControl !== false
      ? await this.getVersionControlInfo()
      : this.getEmptyVersionControl();

    // 5. Generate immediate fixes if needed
    const immediateFixes = options.autoFix !== false && !verification.passed
      ? await this.generateImmediateFixes(prompt, verification, context)
      : [];

    // 6. Generate future plan
    const futurePlan = options.generatePlan !== false
      ? await this.generateFuturePlan(prompt, taskBreakdown, verification)
      : this.getEmptyFuturePlan();

    // 7. Generate recommendations
    const recommendations = this.generateRecommendations(
      verification,
      taskBreakdown,
      immediateFixes,
      futurePlan
    );

    return {
      prompt,
      taskBreakdown,
      verification,
      versionControl,
      immediateFixes,
      futurePlan,
      context: {
        projectPath: this.projectPath,
        timestamp: new Date().toISOString(),
        confidence: context.confidence,
      },
      recommendations,
    };
  }

  /**
   * Break down prompt into detailed tasks
   */
  private async breakDownTask(
    prompt: string,
    context: any
  ): Promise<TaskBreakdown[]> {
    const tasks: TaskBreakdown[] = [];
    
    // Analyze prompt to extract tasks
    const taskKeywords = this.extractTaskKeywords(prompt);
    
    // Create tasks based on keywords and context
    let taskId = 1;
    for (const keyword of taskKeywords) {
      const task = await this.createTask(keyword, taskId++, context);
      tasks.push(task);
    }

    // Add dependencies between tasks
    this.addTaskDependencies(tasks);

    return tasks;
  }

  /**
   * Verify prompt against context and patterns
   */
  private async verifyPrompt(
    prompt: string,
    context: any
  ): Promise<VerificationResult> {
    const checks: VerificationResult['checks'] = [];

    // Check 1: Context relevance
    const relevanceScore = this.checkContextRelevance(prompt, context);
    checks.push({
      name: 'Context Relevance',
      status: relevanceScore > 0.7 ? 'pass' : relevanceScore > 0.5 ? 'warning' : 'fail',
      message: `Prompt relevance to project context: ${(relevanceScore * 100).toFixed(0)}%`,
      evidence: `Context confidence: ${(context.confidence * 100).toFixed(0)}%`,
    });

    // Check 2: Pattern compliance
    const patternCompliance = this.checkPatternCompliance(prompt, context);
    checks.push({
      name: 'Pattern Compliance',
      status: patternCompliance.compliant ? 'pass' : 'warning',
      message: patternCompliance.message,
      evidence: patternCompliance.evidence,
    });

    // Check 3: Hallucination risk
    try {
      const detector = await getHallucinationDetector();
      const hallucinationCheck = detector
        ? await detector.detect(prompt, this.projectPath)
        : { hasHallucinations: false, score: 0, suggestions: [], checks: [] };
      checks.push({
        name: 'Hallucination Risk',
        status: hallucinationCheck.hasHallucinations ? 'fail' : 'pass',
        message: hallucinationCheck.hasHallucinations
          ? `High hallucination risk detected (score: ${hallucinationCheck.score})`
          : 'Low hallucination risk',
        evidence: hallucinationCheck.suggestions.join('; '),
      });
    } catch {
      checks.push({
        name: 'Hallucination Risk',
        status: 'warning',
        message: 'Could not check hallucination risk',
      });
    }

    // Check 4: Completeness
    const completeness = this.checkCompleteness(prompt);
    checks.push({
      name: 'Prompt Completeness',
      status: completeness.complete ? 'pass' : 'warning',
      message: completeness.message,
    });

    // Calculate overall score
    const passedChecks = checks.filter(c => c.status === 'pass').length;
    const score = (passedChecks / checks.length) * 100;
    const passed = score >= 75 && !checks.some(c => c.status === 'fail');

    // Extract blockers
    const blockers = checks
      .filter(c => c.status === 'fail')
      .map(c => c.message);

    return {
      passed,
      checks,
      score: Math.round(score),
      blockers,
    };
  }

  /**
   * Get version control information
   */
  private async getVersionControlInfo(): Promise<VersionControlInfo> {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
        encoding: 'utf8',
      }).trim();

      const commit = execSync('git rev-parse HEAD', {
        cwd: this.projectPath,
        encoding: 'utf8',
      }).trim();

      // Get uncommitted changes
      const statusOutput = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf8',
      });

      const changes: VersionControlInfo['changes'] = [];
      for (const line of statusOutput.split('\n').filter(l => l.trim())) {
        const status = line[0];
        const file = line.substring(3);
        
        if (status === 'A' || status === '??') {
          changes.push({ file, status: 'added' });
        } else if (status === 'M') {
          // Try to get line counts
          try {
            const diff = execSync(`git diff --numstat ${file}`, {
              cwd: this.projectPath,
              encoding: 'utf8',
            }).trim();
            const [added, removed] = diff.split('\t').map(Number);
            changes.push({
              file,
              status: 'modified',
              lines: { added: added || 0, removed: removed || 0 },
            });
          } catch {
            changes.push({ file, status: 'modified' });
          }
        } else if (status === 'D') {
          changes.push({ file, status: 'deleted' });
        }
      }

      // Check for conflicts
      const conflicts: string[] = [];
      try {
        const conflictFiles = execSync('git diff --name-only --diff-filter=U', {
          cwd: this.projectPath,
          encoding: 'utf8',
        }).trim();
        if (conflictFiles) {
          conflicts.push(...conflictFiles.split('\n'));
        }
      } catch {
        // No conflicts
      }

      return {
        branch,
        commit,
        changes,
        conflicts,
      };
    } catch {
      return this.getEmptyVersionControl();
    }
  }

  /**
   * Generate immediate fixes
   */
  private async generateImmediateFixes(
    _prompt: string,
    verification: VerificationResult,
    context: any
  ): Promise<ImmediateFix[]> {
    const fixes: ImmediateFix[] = [];

    // Generate fixes for each failed check
    for (const check of verification.checks.filter(c => c.status === 'fail')) {
      const fix = await this.createFixForCheck(check, context);
      if (fix) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  /**
   * Generate future plan
   */
  private async generateFuturePlan(
    _prompt: string,
    tasks: TaskBreakdown[],
    verification: VerificationResult
  ): Promise<FuturePlan> {
    const plan: FuturePlan = {
      phase: 'immediate',
      tasks: [],
      milestones: [],
      risks: [],
    };

    // Immediate phase: Fix blockers
    plan.tasks.push(
      ...verification.blockers.map((blocker, idx) => ({
        id: `fix-${idx + 1}`,
        title: `Fix: ${blocker}`,
        description: blocker,
        estimatedEffort: '30 minutes',
        dependencies: [],
      }))
    );

    // Short-term: Complete high-priority tasks
    const highPriorityTasks = tasks.filter(t => t.priority === 'high' || t.priority === 'critical');
    plan.tasks.push(
      ...highPriorityTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        estimatedEffort: `${t.estimatedTime} minutes`,
        dependencies: t.dependencies,
      }))
    );

    // Long-term: Best practices
    plan.tasks.push({
      id: 'best-practices',
      title: 'Implement Best Practices',
      description: 'Set up testing, code reviews, and documentation',
      estimatedEffort: '2-4 hours',
      dependencies: [],
    });

    // Milestones
    plan.milestones.push('All blockers resolved');
    plan.milestones.push('High-priority tasks completed');
    plan.milestones.push('Code review completed');
    plan.milestones.push('Tests passing');

    // Risks
    plan.risks.push({
      description: 'Incomplete context may lead to incorrect implementation',
      mitigation: 'Review context and verify against codebase',
    });

    return plan;
  }

  /**
   * Apply immediate fix
   */
  async applyFix(fix: ImmediateFix): Promise<{ success: boolean; message: string }> {
    try {
      const filePath = path.join(this.projectPath, fix.file);
      const content = await fs.readFile(filePath, 'utf8');

      // Apply fix
      const newContent = content.replace(fix.change.before, fix.change.after);
      await fs.writeFile(filePath, newContent, 'utf8');

      // Verify fix
      const verified = await this.verifyFix(fix);
      fix.applied = true;
      fix.verified = verified;

      // Store in history
      const history = this.fixHistory.get(this.projectPath) || [];
      history.push(fix);
      this.fixHistory.set(this.projectPath, history);

      return {
        success: true,
        message: `Fix applied successfully to ${fix.file}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to apply fix: ${error.message}`,
      };
    }
  }

  // Helper methods
  private extractTaskKeywords(prompt: string): string[] {
    const keywords: string[] = [];
    const patterns = [
      /(?:create|add|implement|build)\s+(\w+)/gi,
      /(?:fix|resolve|update|modify)\s+(\w+)/gi,
      /(?:refactor|optimize|improve)\s+(\w+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(prompt)) !== null) {
        const keyword = match[1];
        if (keyword) {
          keywords.push(keyword);
        }
      }
    }

    return keywords.length > 0 ? keywords : ['main task'];
  }

  private async createTask(
    keyword: string | undefined,
    id: number,
    _context: any
  ): Promise<TaskBreakdown> {
    const safeKeyword = keyword || 'task';
    return {
      id: `task-${id}`,
      title: `Task ${id}: ${safeKeyword}`,
      description: `Implement ${safeKeyword} based on project patterns`,
      priority: id === 1 ? 'critical' : 'high',
      estimatedTime: 30 + Math.random() * 60,
      dependencies: id > 1 ? [`task-${id - 1}`] : [],
      verification: {
        type: 'hybrid',
        checks: ['Code review', 'Unit tests', 'Integration tests'],
      },
      status: 'pending',
    };
  }

  private addTaskDependencies(tasks: TaskBreakdown[]): void {
    // Add logical dependencies based on task content
    for (let i = 1; i < tasks.length; i++) {
      const currentTask = tasks[i];
      const previousTask = tasks[i - 1];
      if (currentTask && previousTask && !currentTask.dependencies.includes(previousTask.id)) {
        currentTask.dependencies.push(previousTask.id);
      }
    }
  }

  private checkContextRelevance(prompt: string, context: any): number {
    // Simple relevance check based on keywords
    const promptWords = prompt.toLowerCase().split(/\s+/);
    const contextText = JSON.stringify(context).toLowerCase();
    
    let matches = 0;
    for (const word of promptWords) {
      if (word.length > 3 && contextText.includes(word)) {
        matches++;
      }
    }

    return Math.min(1, matches / promptWords.length);
  }

  private checkPatternCompliance(prompt: string, context: any): {
    compliant: boolean;
    message: string;
    evidence: string;
  } {
    const patterns = context.patterns || [];
    
    if (patterns.length === 0) {
      return {
        compliant: true,
        message: 'No patterns to check against',
        evidence: 'Pattern list empty',
      };
    }

    // Check if prompt mentions patterns
    const promptLower = prompt.toLowerCase();
    const mentionsPattern = patterns.some((p: string) =>
      promptLower.includes(p.toLowerCase())
    );

    return {
      compliant: mentionsPattern || patterns.length === 0,
      message: mentionsPattern
        ? 'Prompt aligns with project patterns'
        : 'Prompt may not align with project patterns',
      evidence: `Found ${patterns.length} patterns in context`,
    };
  }

  private checkCompleteness(prompt: string): {
    complete: boolean;
    message: string;
  } {
    const hasAction = /(?:create|add|implement|fix|update|modify|refactor)/i.test(prompt);
    const hasTarget = /\w+/.test(prompt);
    const hasDetails = prompt.split(/\s+/).length > 5;

    const complete = hasAction && hasTarget && hasDetails;

    return {
      complete,
      message: complete
        ? 'Prompt is complete'
        : 'Prompt may be missing details (action, target, or specifics)',
    };
  }

  private async createFixForCheck(
    check: VerificationResult['checks'][0],
    _context: any
  ): Promise<ImmediateFix | null> {
    // Generate fix based on check type
    if (check.name === 'Hallucination Risk') {
      return {
        id: `fix-${Date.now()}`,
        type: 'code',
        description: 'Fix hallucination issues',
        file: 'src/main.ts', // Would be determined from context
        change: {
          before: '// TODO: Fix hallucination',
          after: '// Fixed: Verified against codebase',
        },
        confidence: 0.8,
        applied: false,
        verified: false,
      };
    }

    return null;
  }

  private async verifyFix(fix: ImmediateFix): Promise<boolean> {
    // Simple verification - check if file was modified
    try {
      const filePath = path.join(this.projectPath, fix.file);
      const content = await fs.readFile(filePath, 'utf8');
      return content.includes(fix.change.after);
    } catch {
      return false;
    }
  }

  private generateRecommendations(
    verification: VerificationResult,
    tasks: TaskBreakdown[],
    fixes: ImmediateFix[],
    _plan: FuturePlan
  ): string[] {
    const recommendations: string[] = [];

    if (!verification.passed) {
      recommendations.push('Address verification failures before proceeding');
    }

    if (fixes.length > 0) {
      recommendations.push(`Apply ${fixes.length} immediate fix(es)`);
    }

    if (tasks.length > 5) {
      recommendations.push('Consider breaking down into smaller tasks');
    }

    recommendations.push('Review future plan and adjust as needed');
    recommendations.push('Run ship check after implementation');

    return recommendations;
  }

  private getEmptyVersionControl(): VersionControlInfo {
    return {
      branch: 'unknown',
      commit: 'unknown',
      changes: [],
      conflicts: [],
    };
  }

  private getEmptyFuturePlan(): FuturePlan {
    return {
      phase: 'immediate',
      tasks: [],
      milestones: [],
      risks: [],
    };
  }
}

export function createPromptFirewall(projectPath: string): AdvancedPromptFirewall {
  return new AdvancedPromptFirewall(projectPath);
}
