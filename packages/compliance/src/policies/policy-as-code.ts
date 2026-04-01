/**
 * Policy-as-Code Engine
 *
 * Version-controlled YAML/JSON policy definitions that define org-wide rules.
 * Supports: guardrail policy init, push, pull, validate, evaluate
 *
 * Enterprise feature for enforcing organization-wide code standards.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Policy Schema ────────────────────────────────────────────

export const PolicySeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type PolicySeverity = z.infer<typeof PolicySeveritySchema>;

export const PolicyActionSchema = z.enum(['block', 'warn', 'audit', 'ignore']);
export type PolicyAction = z.infer<typeof PolicyActionSchema>;

export const PolicyConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals', 'not_equals',
    'contains', 'not_contains',
    'matches', 'not_matches',       // regex
    'greater_than', 'less_than',
    'in', 'not_in',
    'exists', 'not_exists',
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

export const PolicyRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string().optional(),
  severity: PolicySeveritySchema,
  action: PolicyActionSchema,
  category: z.string(),
  conditions: z.array(PolicyConditionSchema).min(1),
  remediation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const PolicyFileSchema = z.object({
  apiVersion: z.literal('guardrailai.dev/v1'),
  kind: z.literal('Policy'),
  metadata: z.object({
    name: z.string(),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    description: z.string().optional(),
    organization: z.string().optional(),
    labels: z.record(z.string()).optional(),
  }),
  spec: z.object({
    target: z.enum(['scan', 'ship', 'gate', 'all']).default('all'),
    scope: z.enum(['project', 'organization']).default('project'),
    rules: z.array(PolicyRuleSchema).min(1),
    overrides: z.array(z.object({
      ruleId: z.string(),
      action: PolicyActionSchema,
      reason: z.string(),
      approvedBy: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
    })).optional(),
    thresholds: z.object({
      minScore: z.number().min(0).max(100).optional(),
      maxCritical: z.number().min(0).optional(),
      maxHigh: z.number().min(0).optional(),
      maxMedium: z.number().min(0).optional(),
    }).optional(),
  }),
});
export type PolicyFile = z.infer<typeof PolicyFileSchema>;

// ─── Policy Evaluation ────────────────────────────────────────

export interface PolicyEvalInput {
  scanResults?: {
    score: number;
    grade: string;
    issues: Array<{
      id: string;
      severity: string;
      category: string;
      message: string;
      file?: string;
      line?: number;
    }>;
  };
  project?: {
    name: string;
    path: string;
    framework?: string;
    dependencies?: Record<string, string>;
  };
  git?: {
    branch: string;
    commit: string;
    author: string;
  };
  environment?: string;
  custom?: Record<string, unknown>;
}

export interface PolicyEvalResult {
  policyName: string;
  policyVersion: string;
  passed: boolean;
  action: 'allow' | 'block' | 'warn';
  ruleResults: RuleEvalResult[];
  thresholdResults: ThresholdResult[];
  summary: {
    totalRules: number;
    passed: number;
    failed: number;
    warned: number;
    blocked: number;
  };
  evaluatedAt: string;
  durationMs: number;
  hash: string; // SHA-256 of the result for audit
}

export interface RuleEvalResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  action: PolicyAction;
  severity: PolicySeverity;
  message: string;
  remediation?: string;
  overridden: boolean;
  overrideReason?: string;
}

export interface ThresholdResult {
  name: string;
  threshold: number;
  actual: number;
  passed: boolean;
}

// ─── Policy Manager ───────────────────────────────────────────

const POLICY_DIR = '.guardrail/policies';

interface PolicyIndex {
  version: string;
  policies: Array<{
    name: string;
    path: string;
    version: string;
    hash: string;
    lastUpdated: string;
  }>;
  lastSync?: string;
}

export class PolicyManager {
  private basePath: string;
  private policies: Map<string, PolicyFile> = new Map();

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Initialize policy directory with a default policy file
   */
  async init(): Promise<string> {
    const policyDir = path.join(this.basePath, POLICY_DIR);

    if (!fs.existsSync(policyDir)) {
      fs.mkdirSync(policyDir, { recursive: true });
    }

    const defaultPolicy: PolicyFile = {
      apiVersion: 'guardrailai.dev/v1',
      kind: 'Policy',
      metadata: {
        name: 'default',
        version: '1.0.0',
        description: 'Default organization policy',
      },
      spec: {
        target: 'all',
        scope: 'project',
        rules: [
          {
            id: 'min-scan-score',
            name: 'Minimum Scan Score',
            description: 'Projects must achieve a minimum scan score',
            severity: 'high',
            action: 'block',
            category: 'quality',
            conditions: [
              { field: 'scan.score', operator: 'greater_than', value: 60 },
            ],
            remediation: 'Fix critical and high severity issues to improve score',
            enabled: true,
          },
          {
            id: 'no-critical-issues',
            name: 'No Critical Issues',
            description: 'No critical severity issues allowed in ship-ready code',
            severity: 'critical',
            action: 'block',
            category: 'security',
            conditions: [
              { field: 'scan.criticalCount', operator: 'equals', value: 0 },
            ],
            remediation: 'Resolve all critical security issues before shipping',
            enabled: true,
          },
          {
            id: 'no-leaked-secrets',
            name: 'No Leaked Secrets',
            description: 'No hardcoded secrets or API keys in source code',
            severity: 'critical',
            action: 'block',
            category: 'security',
            conditions: [
              { field: 'scan.categories.secrets', operator: 'equals', value: 0 },
            ],
            remediation: 'Move secrets to environment variables or a secret manager',
            enabled: true,
          },
          {
            id: 'dependency-audit',
            name: 'Dependency Audit',
            description: 'Warn on high severity dependency vulnerabilities',
            severity: 'high',
            action: 'warn',
            category: 'dependencies',
            conditions: [
              { field: 'scan.categories.vulnerabilities', operator: 'less_than', value: 5 },
            ],
            remediation: 'Update vulnerable dependencies to patched versions',
            enabled: true,
          },
        ],
        thresholds: {
          minScore: 60,
          maxCritical: 0,
          maxHigh: 5,
        },
      },
    };

    const filePath = path.join(policyDir, 'default.policy.json');
    fs.writeFileSync(filePath, JSON.stringify(defaultPolicy, null, 2), 'utf8');

    // Create index
    const index: PolicyIndex = {
      version: '1.0.0',
      policies: [{
        name: 'default',
        path: 'default.policy.json',
        version: '1.0.0',
        hash: createHash('sha256').update(JSON.stringify(defaultPolicy)).digest('hex'),
        lastUpdated: new Date().toISOString(),
      }],
    };
    fs.writeFileSync(
      path.join(policyDir, 'index.json'),
      JSON.stringify(index, null, 2),
      'utf8'
    );

    return filePath;
  }

  /**
   * Load all policies from directory
   */
  async loadPolicies(): Promise<PolicyFile[]> {
    const policyDir = path.join(this.basePath, POLICY_DIR);

    if (!fs.existsSync(policyDir)) {
      return [];
    }

    const files = fs.readdirSync(policyDir)
      .filter(f => f.endsWith('.policy.json') || f.endsWith('.policy.yaml') || f.endsWith('.policy.yml'));

    this.policies.clear();

    for (const file of files) {
      const filePath = path.join(policyDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        const validated = PolicyFileSchema.parse(parsed);
        this.policies.set(validated.metadata.name, validated);
      } catch (error) {
        console.error(`Failed to load policy ${file}: ${error}`);
      }
    }

    return Array.from(this.policies.values());
  }

  /**
   * Validate a policy file
   */
  validate(policy: unknown): { valid: boolean; errors: string[] } {
    const result = PolicyFileSchema.safeParse(policy);

    if (result.success) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    };
  }

  /**
   * Evaluate policies against scan input
   */
  async evaluate(input: PolicyEvalInput, policyName?: string): Promise<PolicyEvalResult[]> {
    await this.loadPolicies();
    const results: PolicyEvalResult[] = [];

    const policiesToEval = policyName
      ? [this.policies.get(policyName)].filter(Boolean) as PolicyFile[]
      : Array.from(this.policies.values());

    for (const policy of policiesToEval) {
      const result = this.evaluatePolicy(policy, input);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate a single policy
   */
  private evaluatePolicy(policy: PolicyFile, input: PolicyEvalInput): PolicyEvalResult {
    const startTime = Date.now();
    const ruleResults: RuleEvalResult[] = [];
    const thresholdResults: ThresholdResult[] = [];

    let hasBlock = false;
    let hasWarn = false;

    // Evaluate rules
    for (const rule of policy.spec.rules) {
      if (!rule.enabled) continue;

      // Check for overrides
      const override = policy.spec.overrides?.find(o => o.ruleId === rule.id);
      if (override) {
        // Check expiry
        if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
          // Override expired, evaluate normally
        } else {
          ruleResults.push({
            ruleId: rule.id,
            ruleName: rule.name,
            passed: true,
            action: override.action,
            severity: rule.severity,
            message: `Rule overridden: ${override.reason}`,
            overridden: true,
            overrideReason: override.reason,
          });
          continue;
        }
      }

      const passed = this.evaluateConditions(rule.conditions, input);
      const action = passed ? 'audit' as PolicyAction : rule.action;

      if (!passed && rule.action === 'block') hasBlock = true;
      if (!passed && rule.action === 'warn') hasWarn = true;

      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        passed,
        action,
        severity: rule.severity,
        message: passed ? 'Rule satisfied' : `Rule violated: ${rule.description || rule.name}`,
        remediation: passed ? undefined : rule.remediation,
        overridden: false,
      });
    }

    // Evaluate thresholds
    if (policy.spec.thresholds && input.scanResults) {
      const { thresholds } = policy.spec;
      const scan = input.scanResults;

      if (thresholds.minScore !== undefined) {
        const passed = scan.score >= thresholds.minScore;
        thresholdResults.push({
          name: 'Minimum Score',
          threshold: thresholds.minScore,
          actual: scan.score,
          passed,
        });
        if (!passed) hasBlock = true;
      }

      if (thresholds.maxCritical !== undefined) {
        const criticalCount = scan.issues.filter(i => i.severity === 'critical').length;
        const passed = criticalCount <= thresholds.maxCritical;
        thresholdResults.push({
          name: 'Max Critical Issues',
          threshold: thresholds.maxCritical,
          actual: criticalCount,
          passed,
        });
        if (!passed) hasBlock = true;
      }

      if (thresholds.maxHigh !== undefined) {
        const highCount = scan.issues.filter(i => i.severity === 'high').length;
        const passed = highCount <= thresholds.maxHigh;
        thresholdResults.push({
          name: 'Max High Issues',
          threshold: thresholds.maxHigh,
          actual: highCount,
          passed,
        });
        if (!passed) hasBlock = true;
      }

      if (thresholds.maxMedium !== undefined) {
        const mediumCount = scan.issues.filter(i => i.severity === 'medium').length;
        const passed = mediumCount <= thresholds.maxMedium;
        thresholdResults.push({
          name: 'Max Medium Issues',
          threshold: thresholds.maxMedium,
          actual: mediumCount,
          passed,
        });
        if (!passed) hasWarn = true;
      }
    }

    const summary = {
      totalRules: ruleResults.length,
      passed: ruleResults.filter(r => r.passed).length,
      failed: ruleResults.filter(r => !r.passed).length,
      warned: ruleResults.filter(r => !r.passed && r.action === 'warn').length,
      blocked: ruleResults.filter(r => !r.passed && r.action === 'block').length,
    };

    const allThresholdsPassed = thresholdResults.every(t => t.passed);

    const evalResult: Omit<PolicyEvalResult, 'hash'> = {
      policyName: policy.metadata.name,
      policyVersion: policy.metadata.version,
      passed: !hasBlock && allThresholdsPassed,
      action: hasBlock ? 'block' : hasWarn ? 'warn' : 'allow',
      ruleResults,
      thresholdResults,
      summary,
      evaluatedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };

    const hash = createHash('sha256')
      .update(JSON.stringify(evalResult))
      .digest('hex');

    return { ...evalResult, hash };
  }

  /**
   * Evaluate conditions against input data
   */
  private evaluateConditions(conditions: PolicyCondition[], input: PolicyEvalInput): boolean {
    // ALL conditions must pass (AND logic)
    return conditions.every(cond => this.evaluateCondition(cond, input));
  }

  private evaluateCondition(condition: PolicyCondition, input: PolicyEvalInput): boolean {
    const value = this.resolveField(condition.field, input);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
      case 'less_than':
        return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
      case 'contains':
        return typeof value === 'string' && typeof condition.value === 'string' && value.includes(condition.value);
      case 'not_contains':
        return typeof value === 'string' && typeof condition.value === 'string' && !value.includes(condition.value);
      case 'matches':
        return typeof value === 'string' && typeof condition.value === 'string' && new RegExp(condition.value).test(value);
      case 'not_matches':
        return typeof value === 'string' && typeof condition.value === 'string' && !new RegExp(condition.value).test(value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(String(value));
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(String(value));
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  /**
   * Resolve a dotted field path against the input
   */
  private resolveField(field: string, input: PolicyEvalInput): unknown {
    const parts = field.split('.');
    let current: unknown = input;

    // Map short field names to actual input paths
    const fieldMap: Record<string, string[]> = {
      'scan.score': ['scanResults', 'score'],
      'scan.grade': ['scanResults', 'grade'],
      'scan.criticalCount': ['scanResults', 'issues'],
      'scan.highCount': ['scanResults', 'issues'],
      'scan.categories.secrets': ['scanResults', 'issues'],
      'scan.categories.vulnerabilities': ['scanResults', 'issues'],
    };

    const mappedPath = fieldMap[field];
    if (mappedPath) {
      for (const part of mappedPath) {
        if (current && typeof current === 'object') {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }

      // Special handling for count fields
      if (field === 'scan.criticalCount' && Array.isArray(current)) {
        return (current as Array<{ severity: string }>).filter(i => i.severity === 'critical').length;
      }
      if (field === 'scan.highCount' && Array.isArray(current)) {
        return (current as Array<{ severity: string }>).filter(i => i.severity === 'high').length;
      }
      if (field.startsWith('scan.categories.') && Array.isArray(current)) {
        const category = field.split('.').pop();
        return (current as Array<{ category: string }>).filter(i => i.category === category).length;
      }

      return current;
    }

    // Generic dotted path resolution
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get a specific policy by name
   */
  getPolicy(name: string): PolicyFile | undefined {
    return this.policies.get(name);
  }

  /**
   * List all loaded policies
   */
  listPolicies(): PolicyFile[] {
    return Array.from(this.policies.values());
  }

  /**
   * Save a policy to disk
   */
  async savePolicy(policy: PolicyFile): Promise<string> {
    const policyDir = path.join(this.basePath, POLICY_DIR);
    if (!fs.existsSync(policyDir)) {
      fs.mkdirSync(policyDir, { recursive: true });
    }

    const filePath = path.join(policyDir, `${policy.metadata.name}.policy.json`);
    fs.writeFileSync(filePath, JSON.stringify(policy, null, 2), 'utf8');
    this.policies.set(policy.metadata.name, policy);

    return filePath;
  }
}

/**
 * Format policy evaluation results for CLI display
 */
export function formatPolicyResults(results: PolicyEvalResult[]): string {
  const lines: string[] = [''];

  for (const result of results) {
    const statusIcon = result.passed ? '\u2705' : result.action === 'warn' ? '\u26A0\uFE0F' : '\u274C';

    lines.push(`  ${statusIcon} Policy: ${result.policyName} v${result.policyVersion}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Status: ${result.passed ? 'PASSED' : result.action === 'block' ? 'BLOCKED' : 'WARNING'}`);
    lines.push(`  Rules: ${result.summary.passed}/${result.summary.totalRules} passed`);

    if (result.summary.blocked > 0) {
      lines.push(`  Blocking: ${result.summary.blocked} rule(s)`);
    }
    if (result.summary.warned > 0) {
      lines.push(`  Warnings: ${result.summary.warned} rule(s)`);
    }

    // Show failed rules
    const failedRules = result.ruleResults.filter(r => !r.passed);
    if (failedRules.length > 0) {
      lines.push('');
      lines.push('  Failed Rules:');
      for (const rule of failedRules) {
        const icon = rule.action === 'block' ? '\u274C' : '\u26A0\uFE0F';
        lines.push(`    ${icon} [${rule.severity.toUpperCase()}] ${rule.ruleName}`);
        lines.push(`      ${rule.message}`);
        if (rule.remediation) {
          lines.push(`      Fix: ${rule.remediation}`);
        }
      }
    }

    // Show threshold results
    const failedThresholds = result.thresholdResults.filter(t => !t.passed);
    if (failedThresholds.length > 0) {
      lines.push('');
      lines.push('  Threshold Violations:');
      for (const t of failedThresholds) {
        lines.push(`    \u274C ${t.name}: ${t.actual} (threshold: ${t.threshold})`);
      }
    }

    lines.push(`  Duration: ${result.durationMs}ms`);
    lines.push('');
  }

  return lines.join('\n');
}
