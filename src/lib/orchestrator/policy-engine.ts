/**
 * guardrail Policy Engine
 * 
 * OPA-style policy enforcement for deploy gates.
 * Defines machine-readable policies that determine ship/no-ship verdicts.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  STRIPE_LIVE_PREFIX,
  STRIPE_TEST_PREFIX,
  stripeTestSkOrPkTestPatternString,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';

// ============ Types ============

export type PolicySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type PolicyVerdict = 'pass' | 'fail' | 'warn' | 'skip';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  severity: PolicySeverity;
  category: 'mock-data' | 'secrets' | 'config' | 'dependencies' | 'code-quality' | 'compliance';
  check: (context: PolicyContext) => Promise<PolicyResult>;
  autoFix?: (context: PolicyContext) => Promise<AutoFixResult>;
}

export interface PolicyContext {
  projectPath: string;
  environment: 'development' | 'staging' | 'production';
  gitBranch?: string;
  gitCommit?: string;
  changedFiles?: string[];
  config: PolicyConfig;
}

export interface PolicyConfig {
  // Patterns to ban in production
  bannedPatterns: BannedPattern[];
  
  // Required environment variables
  requiredEnvVars: string[];
  
  // Allowed/denied licenses
  licensePolicy: {
    allowed: string[];
    denied: string[];
  };
  
  // Custom rules
  customRules: CustomRule[];
}

export interface BannedPattern {
  pattern: string;
  isRegex: boolean;
  message: string;
  allowedIn: string[]; // Glob patterns for allowed locations
}

export interface CustomRule {
  id: string;
  name: string;
  pattern: string;
  isRegex: boolean;
  severity: PolicySeverity;
  message: string;
}

export interface PolicyResult {
  ruleId: string;
  verdict: PolicyVerdict;
  message: string;
  findings: PolicyFinding[];
  metadata?: Record<string, any>;
}

export interface PolicyFinding {
  file: string;
  line?: number;
  column?: number;
  snippet?: string;
  message: string;
  suggestion?: string;
}

export interface AutoFixResult {
  success: boolean;
  filesModified: string[];
  message: string;
}

export interface DeployVerdict {
  allowed: boolean;
  reason: string;
  timestamp: string;
  environment: string;
  results: PolicyResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  riskScore: number;
  blockers: PolicyResult[];
  warnings: PolicyResult[];
}

// ============ Default Policy Configuration ============

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  bannedPatterns: [
    {
      pattern: 'MockProvider',
      isRegex: false,
      message: 'MockProvider should not be used in production',
      allowedIn: ['**/__tests__/**', '**/test/**', '**/stories/**', '**/landing/**']
    },
    {
      pattern: 'useMock',
      isRegex: false,
      message: 'useMock hook should not be used in production',
      allowedIn: ['**/__tests__/**', '**/test/**', '**/stories/**']
    },
    {
      pattern: 'mock-context',
      isRegex: false,
      message: 'mock-context imports are not allowed in production',
      allowedIn: ['**/__tests__/**', '**/test/**']
    },
    {
      pattern: 'localhost:\\d+',
      isRegex: true,
      message: 'Hardcoded localhost URLs are not allowed in production config',
      allowedIn: ['**/*.test.*', '**/*.spec.*', '**/docs/**', '**/.env.example']
    },
    {
      pattern: stripeTestSkOrPkTestPatternString(),
      isRegex: true,
      message: 'Test API keys should not be in production code',
      allowedIn: ['**/__tests__/**', '**/docs/**']
    },
    {
      pattern: 'TODO:|FIXME:|HACK:',
      isRegex: true,
      message: 'Unresolved TODO/FIXME/HACK comments detected',
      allowedIn: [] // Warn everywhere
    },
    {
      pattern: 'console\\.log\\(',
      isRegex: true,
      message: 'console.log should be replaced with proper logging',
      allowedIn: ['**/scripts/**', '**/__tests__/**']
    }
  ],
  
  requiredEnvVars: [
    'DATABASE_URL',
    'JWT_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'API_BASE_URL'
  ],
  
  licensePolicy: {
    allowed: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0'],
    denied: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.0', 'LGPL-3.0']
  },
  
  customRules: []
};

// ============ Built-in Policy Rules ============

export const BUILTIN_RULES: PolicyRule[] = [
  {
    id: 'no-mock-providers',
    name: 'No Mock Providers in Production',
    description: 'Ensures MockProvider and mock contexts are not imported in production code',
    severity: 'critical',
    category: 'mock-data',
    check: async (ctx) => {
      const findings: PolicyFinding[] = [];
      const patterns = ctx.config.bannedPatterns.filter(p => 
        ['MockProvider', 'useMock', 'mock-context'].includes(p.pattern)
      );
      
      for (const pattern of patterns) {
        const results = await searchPattern(ctx.projectPath, pattern);
        findings.push(...results);
      }
      
      return {
        ruleId: 'no-mock-providers',
        verdict: findings.length > 0 ? 'fail' : 'pass',
        message: findings.length > 0 
          ? `Found ${findings.length} mock provider references in production code`
          : 'No mock providers found in production code',
        findings
      };
    }
  },
  
  {
    id: 'no-localhost-in-config',
    name: 'No Localhost URLs in Production Config',
    description: 'Ensures no hardcoded localhost URLs in production configuration',
    severity: 'critical',
    category: 'config',
    check: async (ctx) => {
      if (ctx.environment !== 'production') {
        return {
          ruleId: 'no-localhost-in-config',
          verdict: 'skip',
          message: 'Skipped: not a production environment',
          findings: []
        };
      }
      
      const findings: PolicyFinding[] = [];
      const configFiles = [
        'next.config.mjs',
        'next.config.js',
        '.env.production',
        'docker-compose.yml',
        'docker-compose.prod.yml'
      ];
      
      for (const file of configFiles) {
        const filePath = path.join(ctx.projectPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const localhostMatches = content.match(/localhost:\d+/g);
          
          if (localhostMatches) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (/localhost:\d+/.test(lines[i])) {
                findings.push({
                  file,
                  line: i + 1,
                  snippet: lines[i].trim(),
                  message: 'Hardcoded localhost URL found',
                  suggestion: 'Use environment variable instead'
                });
              }
            }
          }
        }
      }
      
      return {
        ruleId: 'no-localhost-in-config',
        verdict: findings.length > 0 ? 'fail' : 'pass',
        message: findings.length > 0
          ? `Found ${findings.length} localhost references in config`
          : 'No localhost URLs in production config',
        findings
      };
    }
  },
  
  {
    id: 'required-env-vars',
    name: 'Required Environment Variables',
    description: 'Ensures all required environment variables are defined',
    severity: 'critical',
    category: 'config',
    check: async (ctx) => {
      if (ctx.environment !== 'production') {
        return {
          ruleId: 'required-env-vars',
          verdict: 'skip',
          message: 'Skipped: not a production environment',
          findings: []
        };
      }
      
      const findings: PolicyFinding[] = [];
      const missing = ctx.config.requiredEnvVars.filter(v => !process.env[v]);
      
      for (const varName of missing) {
        findings.push({
          file: '.env',
          message: `Required environment variable ${varName} is not set`,
          suggestion: `Set ${varName} in your production environment`
        });
      }
      
      return {
        ruleId: 'required-env-vars',
        verdict: findings.length > 0 ? 'fail' : 'pass',
        message: findings.length > 0
          ? `Missing ${findings.length} required environment variables`
          : 'All required environment variables are set',
        findings
      };
    }
  },
  
  {
    id: 'no-demo-routes',
    name: 'No Demo/Mock Routes in Production',
    description: 'Ensures demo billing, mock API routes are not active in production',
    severity: 'critical',
    category: 'mock-data',
    check: async (ctx) => {
      const findings: PolicyFinding[] = [];
      const demoPatterns = [
        { pattern: 'simulate subscription', message: 'Demo subscription logic found' },
        { pattern: 'inv_demo', message: 'Demo invoice ID found' },
        { pattern: 'return a mock response', message: 'Mock response found' },
        { pattern: 'fake avatar', message: 'Fake avatar generation found' },
        { pattern: 'Return mock data', message: 'Mock data return found' },
        { pattern: 'Seed with sample', message: 'Sample data seeding found' }
      ];
      
      for (const { pattern, message } of demoPatterns) {
        const results = await searchPattern(ctx.projectPath, {
          pattern,
          isRegex: false,
          message,
          allowedIn: ['**/__tests__/**', '**/docs/**']
        });
        findings.push(...results);
      }
      
      return {
        ruleId: 'no-demo-routes',
        verdict: findings.length > 0 ? 'fail' : 'pass',
        message: findings.length > 0
          ? `Found ${findings.length} demo/mock route implementations`
          : 'No demo routes in production code',
        findings
      };
    }
  },
  
  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'Detects hardcoded API keys, passwords, and tokens',
    severity: 'critical',
    category: 'secrets',
    check: async (ctx) => {
      const findings: PolicyFinding[] = [];
      const secretPatterns = [
        { pattern: `${STRIPE_LIVE_PREFIX}[a-zA-Z0-9]{24,}`, message: 'Stripe live secret key' },
        { pattern: `${STRIPE_TEST_PREFIX}[a-zA-Z0-9]{24,}`, message: 'Stripe test secret key' },
        { pattern: 'ghp_[a-zA-Z0-9]{36}', message: 'GitHub personal access token' },
        { pattern: 'gho_[a-zA-Z0-9]{36}', message: 'GitHub OAuth token' },
        { pattern: 'glpat-[a-zA-Z0-9\\-]{20}', message: 'GitLab personal access token' },
        { pattern: 'AKIA[A-Z0-9]{16}', message: 'AWS access key ID' },
        { pattern: 'xox[baprs]-[a-zA-Z0-9\\-]{10,}', message: 'Slack token' },
        { pattern: 'eyJ[a-zA-Z0-9\\-_]+\\.eyJ[a-zA-Z0-9\\-_]+\\.[a-zA-Z0-9\\-_]+', message: 'JWT token' }
      ];
      
      for (const { pattern, message } of secretPatterns) {
        const results = await searchPattern(ctx.projectPath, {
          pattern,
          isRegex: true,
          message,
          allowedIn: ['**/__tests__/**', '**/docs/**', '**/*.md']
        });
        findings.push(...results);
      }
      
      return {
        ruleId: 'no-hardcoded-secrets',
        verdict: findings.length > 0 ? 'fail' : 'pass',
        message: findings.length > 0
          ? `Found ${findings.length} potential hardcoded secrets`
          : 'No hardcoded secrets detected',
        findings
      };
    }
  }
];

// ============ Helper Functions ============

async function searchPattern(
  projectPath: string,
  pattern: BannedPattern
): Promise<PolicyFinding[]> {
  const { execSync } = require('child_process');
  const findings: PolicyFinding[] = [];
  
  try {
    const excludes = pattern.allowedIn.map(p => `--glob '!${p}'`).join(' ');
    const searchPattern = pattern.isRegex ? pattern.pattern : escapeRegex(pattern.pattern);
    
    const cmd = `rg -n --hidden --glob '!**/node_modules/**' ${excludes} "${searchPattern}" "${projectPath}"`;
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    
    const lines = output.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        findings.push({
          file: path.relative(projectPath, match[1]),
          line: parseInt(match[2], 10),
          snippet: match[3].trim().substring(0, 100),
          message: pattern.message
        });
      }
    }
  } catch (error) {
    // rg returns non-zero when no matches found
  }
  
  return findings;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ Policy Engine Class ============

export class PolicyEngine {
  private rules: PolicyRule[] = [];
  private config: PolicyConfig;
  
  constructor(config: Partial<PolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
    this.rules = [...BUILTIN_RULES];
  }
  
  /**
   * Add a custom policy rule
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }
  
  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
  
  /**
   * Run all policy checks and return deploy verdict
   */
  async evaluate(context: Omit<PolicyContext, 'config'>): Promise<DeployVerdict> {
    const ctx: PolicyContext = { ...context, config: this.config };
    const results: PolicyResult[] = [];
    
    console.log(`\n🔍 Running ${this.rules.length} policy checks...\n`);
    
    for (const rule of this.rules) {
      try {
        console.log(`  Checking: ${rule.name}...`);
        const result = await rule.check(ctx);
        results.push(result);
        
        const icon = result.verdict === 'pass' ? '✅' : 
                     result.verdict === 'fail' ? '❌' :
                     result.verdict === 'warn' ? '⚠️' : '⏭️';
        console.log(`  ${icon} ${result.message}`);
      } catch (error) {
        console.error(`  ❌ Rule ${rule.id} failed with error:`, error);
        results.push({
          ruleId: rule.id,
          verdict: 'fail',
          message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          findings: []
        });
      }
    }
    
    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.verdict === 'pass').length,
      failed: results.filter(r => r.verdict === 'fail').length,
      warnings: results.filter(r => r.verdict === 'warn').length,
      skipped: results.filter(r => r.verdict === 'skip').length
    };
    
    // Calculate risk score (0-100, higher = more risk)
    const riskScore = this.calculateRiskScore(results);
    
    // Get blockers and warnings
    const blockers = results.filter(r => r.verdict === 'fail');
    const warnings = results.filter(r => r.verdict === 'warn');
    
    // Determine if deploy is allowed
    const allowed = blockers.length === 0;
    const reason = allowed 
      ? 'All policy checks passed'
      : `${blockers.length} blocking issue(s) detected`;
    
    return {
      allowed,
      reason,
      timestamp: new Date().toISOString(),
      environment: context.environment,
      results,
      summary,
      riskScore,
      blockers,
      warnings
    };
  }
  
  /**
   * Calculate risk score based on findings
   */
  private calculateRiskScore(results: PolicyResult[]): number {
    let score = 0;
    const weights = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      info: 1
    };
    
    for (const result of results) {
      if (result.verdict === 'fail') {
        const rule = this.rules.find(r => r.id === result.ruleId);
        if (rule) {
          score += weights[rule.severity] * Math.min(result.findings.length, 5);
        }
      } else if (result.verdict === 'warn') {
        const rule = this.rules.find(r => r.id === result.ruleId);
        if (rule) {
          score += (weights[rule.severity] / 2) * Math.min(result.findings.length, 3);
        }
      }
    }
    
    return Math.min(100, score);
  }
  
  /**
   * Generate a deploy contract (policy-as-code) file
   */
  generateDeployContract(): string {
    return JSON.stringify({
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      policies: this.config,
      rules: this.rules.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        severity: r.severity,
        category: r.category
      }))
    }, null, 2);
  }
  
  /**
   * Load policy config from file
   */
  static loadConfig(configPath: string): PolicyConfig {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_POLICY_CONFIG;
    }
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const loaded = JSON.parse(content);
    
    return {
      ...DEFAULT_POLICY_CONFIG,
      ...loaded
    };
  }
}

// ============ CLI Entry Point ============

export async function runPolicyCheck(
  projectPath: string,
  environment: 'development' | 'staging' | 'production' = 'production'
): Promise<DeployVerdict> {
  const configPath = path.join(projectPath, '.guardrail', 'policy.json');
  const config = PolicyEngine.loadConfig(configPath);
  
  const engine = new PolicyEngine(config);
  
  const verdict = await engine.evaluate({
    projectPath,
    environment
  });
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DEPLOY VERDICT');
  console.log('='.repeat(60));
  console.log(`Environment: ${verdict.environment}`);
  console.log(`Timestamp: ${verdict.timestamp}`);
  console.log(`Risk Score: ${verdict.riskScore}/100`);
  console.log('');
  console.log(`Total Checks: ${verdict.summary.total}`);
  console.log(`  ✅ Passed: ${verdict.summary.passed}`);
  console.log(`  ❌ Failed: ${verdict.summary.failed}`);
  console.log(`  ⚠️  Warnings: ${verdict.summary.warnings}`);
  console.log(`  ⏭️  Skipped: ${verdict.summary.skipped}`);
  console.log('');
  
  if (verdict.allowed) {
    console.log('🚀 DEPLOY ALLOWED');
  } else {
    console.log('🛑 DEPLOY BLOCKED');
    console.log('\nBlockers:');
    for (const blocker of verdict.blockers) {
      console.log(`  - ${blocker.ruleId}: ${blocker.message}`);
      for (const finding of blocker.findings.slice(0, 5)) {
        console.log(`    → ${finding.file}:${finding.line || '?'}: ${finding.message}`);
      }
      if (blocker.findings.length > 5) {
        console.log(`    ... and ${blocker.findings.length - 5} more`);
      }
    }
  }
  
  if (verdict.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of verdict.warnings) {
      console.log(`  - ${warning.ruleId}: ${warning.message}`);
    }
  }
  
  console.log('='.repeat(60) + '\n');
  
  return verdict;
}
