/**
 * Semgrep Integration for guardrail
 * 
 * Wraps Semgrep for SAST analysis and presents unified findings.
 * Supports custom rules, auto-fix suggestions, and CI integration.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============ Types ============

export interface SemgrepConfig {
  // Path to semgrep binary (defaults to 'semgrep')
  binaryPath: string;
  
  // Rule sources
  rules: {
    // Use default rulesets
    useDefaults: boolean;
    
    // Semgrep registry rulesets to use
    registryRulesets: string[];
    
    // Local rule files/directories
    localRules: string[];
    
    // Inline rules
    inlineRules: SemgrepRule[];
  };
  
  // Paths to scan
  includePaths: string[];
  excludePaths: string[];
  
  // Output format
  outputFormat: 'json' | 'sarif' | 'text';
  
  // Timeout per file (seconds)
  timeout: number;
  
  // Max memory (MB)
  maxMemory: number;
  
  // Enable autofix
  autofix: boolean;
}

export interface SemgrepRule {
  id: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  languages: string[];
  pattern?: string;
  patterns?: SemgrepPattern[];
  fix?: string;
  metadata?: {
    category?: string;
    cwe?: string[];
    owasp?: string[];
    references?: string[];
  };
}

export interface SemgrepPattern {
  pattern?: string;
  'pattern-not'?: string;
  'pattern-inside'?: string;
  'pattern-not-inside'?: string;
  'pattern-either'?: SemgrepPattern[];
  'metavariable-regex'?: {
    metavariable: string;
    regex: string;
  };
}

export interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    message: string;
    severity: string;
    lines: string;
    metadata?: Record<string, any>;
    fix?: string;
  };
}

export interface SemgrepResult {
  success: boolean;
  findings: SemgrepFinding[];
  errors: string[];
  stats: {
    filesScanned: number;
    rulesRun: number;
    findingsCount: number;
    errorCount: number;
    scanTime: number;
  };
}

export interface UnifiedFinding {
  id: string;
  tool: 'semgrep';
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  snippet: string;
  fix?: string;
  metadata: {
    cwe?: string[];
    owasp?: string[];
    references?: string[];
  };
}

// ============ Default Configuration ============

export const DEFAULT_SEMGREP_CONFIG: SemgrepConfig = {
  binaryPath: 'semgrep',
  rules: {
    useDefaults: true,
    registryRulesets: [
      'p/security-audit',
      'p/secrets',
      'p/owasp-top-ten',
      'p/typescript',
      'p/javascript',
      'p/react'
    ],
    localRules: [],
    inlineRules: []
  },
  includePaths: ['.'],
  excludePaths: [
    'node_modules',
    'dist',
    'build',
    '.next',
    'coverage',
    '__tests__',
    '*.test.*',
    '*.spec.*'
  ],
  outputFormat: 'json',
  timeout: 30,
  maxMemory: 2048,
  autofix: false
};

// ============ guardrail Custom Rules ============

export const Guardrail_RULES: SemgrepRule[] = [
  {
    id: 'guardrail.mock-provider-in-prod',
    message: 'MockProvider should not be used in production code',
    severity: 'ERROR',
    languages: ['typescript', 'javascript', 'tsx', 'jsx'],
    pattern: 'MockProvider',
    metadata: {
      category: 'production-readiness',
      references: ['https://guardrailai.dev/rules/no-mock-in-prod']
    }
  },
  {
    id: 'guardrail.usemock-hook',
    message: 'useMock hook should not be used in production code',
    severity: 'ERROR',
    languages: ['typescript', 'javascript', 'tsx', 'jsx'],
    pattern: 'useMock()',
    metadata: {
      category: 'production-readiness'
    }
  },
  {
    id: 'guardrail.localhost-url',
    message: 'Hardcoded localhost URL detected - use environment variables',
    severity: 'WARNING',
    languages: ['typescript', 'javascript', 'tsx', 'jsx', 'json'],
    pattern: '"http://localhost:$PORT"',
    fix: 'process.env.API_URL || "http://localhost:$PORT"',
    metadata: {
      category: 'configuration'
    }
  },
  {
    id: 'guardrail.sql-injection',
    message: 'Potential SQL injection - use parameterized queries',
    severity: 'ERROR',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        'pattern-either': [
          { pattern: '$DB.query(`...${$VAR}...`)' },
          { pattern: '$DB.execute(`...${$VAR}...`)' },
          { pattern: '$DB.raw(`...${$VAR}...`)' }
        ]
      }
    ],
    metadata: {
      category: 'security',
      cwe: ['CWE-89'],
      owasp: ['A03:2021']
    }
  },
  {
    id: 'guardrail.missing-auth-middleware',
    message: 'API route may be missing authentication middleware',
    severity: 'WARNING',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        pattern: 'fastify.$METHOD($PATH, async ($REQ, $REP) => { ... })',
        'pattern-not-inside': 'fastify.$METHOD($PATH, { preHandler: $AUTH }, ...)'
      }
    ],
    metadata: {
      category: 'security',
      cwe: ['CWE-306'],
      owasp: ['A07:2021']
    }
  },
  {
    id: 'guardrail.exposed-error-details',
    message: 'Error details exposed to client - sanitize error messages',
    severity: 'WARNING',
    languages: ['typescript', 'javascript'],
    pattern: 'reply.send({ error: $ERR.message })',
    fix: 'reply.send({ error: "An error occurred" })',
    metadata: {
      category: 'security',
      cwe: ['CWE-209']
    }
  },
  {
    id: 'guardrail.console-log-in-prod',
    message: 'console.log should be replaced with proper logging',
    severity: 'INFO',
    languages: ['typescript', 'javascript', 'tsx', 'jsx'],
    pattern: 'console.log(...)',
    fix: 'logger.info(...)',
    metadata: {
      category: 'code-quality'
    }
  },
  {
    id: 'guardrail.unhandled-promise',
    message: 'Promise without error handling - add .catch() or try/catch',
    severity: 'WARNING',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        pattern: '$PROMISE.then(...)',
        'pattern-not': '$PROMISE.then(...).catch(...)'
      }
    ],
    metadata: {
      category: 'code-quality',
      cwe: ['CWE-755']
    }
  },
  {
    id: 'guardrail.hardcoded-jwt-secret',
    message: 'Hardcoded JWT secret detected - use environment variable',
    severity: 'ERROR',
    languages: ['typescript', 'javascript'],
    pattern: 'jwt.sign($PAYLOAD, "$SECRET")',
    fix: 'jwt.sign($PAYLOAD, process.env.JWT_SECRET)',
    metadata: {
      category: 'security',
      cwe: ['CWE-798']
    }
  },
  {
    id: 'guardrail.insecure-cors',
    message: 'CORS allows all origins - restrict in production',
    severity: 'WARNING',
    languages: ['typescript', 'javascript'],
    pattern: "origin: '*'",
    metadata: {
      category: 'security',
      cwe: ['CWE-942']
    }
  }
];

// ============ Semgrep Integration Class ============

export class SemgrepIntegration {
  private config: SemgrepConfig;
  private customRules: SemgrepRule[] = [];
  
  constructor(config: Partial<SemgrepConfig> = {}) {
    this.config = { ...DEFAULT_SEMGREP_CONFIG, ...config };
    this.customRules = [...Guardrail_RULES];
  }
  
  /**
   * Check if Semgrep is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      execSync(`${this.config.binaryPath} --version`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Install Semgrep (requires pip)
   */
  async install(): Promise<boolean> {
    try {
      console.log('📦 Installing Semgrep...');
      execSync('pip install semgrep', { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error('Failed to install Semgrep:', error);
      return false;
    }
  }
  
  /**
   * Add custom rules
   */
  addRules(rules: SemgrepRule[]): void {
    this.customRules.push(...rules);
  }
  
  /**
   * Generate Semgrep rule file from custom rules
   */
  private generateRuleFile(): string {
    const ruleFile = path.join(process.cwd(), '.guardrail', 'semgrep-rules.yaml');
    
    const yamlContent = {
      rules: this.customRules.map(rule => ({
        id: rule.id,
        message: rule.message,
        severity: rule.severity,
        languages: rule.languages,
        ...(rule.pattern && { pattern: rule.pattern }),
        ...(rule.patterns && { patterns: rule.patterns }),
        ...(rule.fix && { fix: rule.fix }),
        ...(rule.metadata && { metadata: rule.metadata })
      }))
    };
    
    // Ensure directory exists
    const dir = path.dirname(ruleFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write YAML (simple serialization)
    const yaml = this.toYaml(yamlContent);
    fs.writeFileSync(ruleFile, yaml);
    
    return ruleFile;
  }
  
  /**
   * Simple YAML serializer
   */
  private toYaml(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent);
    let result = '';
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object') {
          result += `${spaces}-\n${this.toYaml(item, indent + 1)}`;
        } else {
          result += `${spaces}- ${item}\n`;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        
        if (typeof value === 'object' && value !== null) {
          result += `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
        } else {
          result += `${spaces}${key}: ${JSON.stringify(value)}\n`;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Run Semgrep scan
   */
  async scan(targetPath: string): Promise<SemgrepResult> {
    const startTime = Date.now();
    
    // Check if installed
    if (!(await this.isInstalled())) {
      console.warn('⚠️ Semgrep not installed. Running without SAST analysis.');
      return {
        success: false,
        findings: [],
        errors: ['Semgrep not installed'],
        stats: {
          filesScanned: 0,
          rulesRun: 0,
          findingsCount: 0,
          errorCount: 1,
          scanTime: 0
        }
      };
    }
    
    // Generate custom rule file
    const ruleFile = this.generateRuleFile();
    
    // Build command
    const excludeArgs = this.config.excludePaths
      .map(p => `--exclude "${p}"`)
      .join(' ');
    
    const ruleArgs = [
      `--config "${ruleFile}"`,
      ...this.config.rules.registryRulesets.map(r => `--config "${r}"`),
      ...this.config.rules.localRules.map(r => `--config "${r}"`)
    ].join(' ');
    
    const cmd = [
      this.config.binaryPath,
      '--json',
      `--timeout ${this.config.timeout}`,
      `--max-memory ${this.config.maxMemory}`,
      excludeArgs,
      ruleArgs,
      this.config.autofix ? '--autofix' : '',
      targetPath
    ].filter(Boolean).join(' ');
    
    try {
      console.log('🔍 Running Semgrep scan...');
      const output = execSync(cmd, { 
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const result = JSON.parse(output);
      const findings: SemgrepFinding[] = result.results || [];
      const errors = result.errors || [];
      
      return {
        success: true,
        findings,
        errors: errors.map((e: any) => e.message || String(e)),
        stats: {
          filesScanned: result.paths?.scanned?.length || 0,
          rulesRun: this.customRules.length + this.config.rules.registryRulesets.length,
          findingsCount: findings.length,
          errorCount: errors.length,
          scanTime: Date.now() - startTime
        }
      };
    } catch (error: any) {
      // Semgrep returns non-zero on findings
      if (error.stdout) {
        try {
          const result = JSON.parse(error.stdout);
          const findings: SemgrepFinding[] = result.results || [];
          const errors = result.errors || [];
          
          return {
            success: true,
            findings,
            errors: errors.map((e: any) => e.message || String(e)),
            stats: {
              filesScanned: result.paths?.scanned?.length || 0,
              rulesRun: this.customRules.length,
              findingsCount: findings.length,
              errorCount: errors.length,
              scanTime: Date.now() - startTime
            }
          };
        } catch {
          // Parse error
        }
      }
      
      return {
        success: false,
        findings: [],
        errors: [error.message || 'Semgrep scan failed'],
        stats: {
          filesScanned: 0,
          rulesRun: 0,
          findingsCount: 0,
          errorCount: 1,
          scanTime: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Convert Semgrep findings to unified format
   */
  normalizeFindings(findings: SemgrepFinding[]): UnifiedFinding[] {
    return findings.map((f, i) => ({
      id: `semgrep-${i}-${f.check_id}`,
      tool: 'semgrep' as const,
      ruleId: f.check_id,
      severity: this.mapSeverity(f.extra.severity),
      category: f.extra.metadata?.category || 'security',
      message: f.extra.message,
      file: f.path,
      line: f.start.line,
      column: f.start.col,
      endLine: f.end.line,
      endColumn: f.end.col,
      snippet: f.extra.lines,
      fix: f.extra.fix,
      metadata: {
        cwe: f.extra.metadata?.cwe,
        owasp: f.extra.metadata?.owasp,
        references: f.extra.metadata?.references
      }
    }));
  }
  
  /**
   * Map Semgrep severity to unified severity
   */
  private mapSeverity(severity: string): UnifiedFinding['severity'] {
    switch (severity.toUpperCase()) {
      case 'ERROR': return 'high';
      case 'WARNING': return 'medium';
      case 'INFO': return 'low';
      default: return 'info';
    }
  }
  
  /**
   * Generate report from scan results
   */
  generateReport(result: SemgrepResult): string {
    const findings = this.normalizeFindings(result.findings);
    
    let report = `# Semgrep Security Scan Report\n\n`;
    report += `**Scan Time:** ${new Date().toISOString()}\n`;
    report += `**Files Scanned:** ${result.stats.filesScanned}\n`;
    report += `**Rules Run:** ${result.stats.rulesRun}\n`;
    report += `**Findings:** ${result.stats.findingsCount}\n\n`;
    
    if (findings.length === 0) {
      report += `✅ No security issues found!\n`;
      return report;
    }
    
    // Group by severity
    const bySeverity = {
      critical: findings.filter(f => f.severity === 'critical'),
      high: findings.filter(f => f.severity === 'high'),
      medium: findings.filter(f => f.severity === 'medium'),
      low: findings.filter(f => f.severity === 'low'),
      info: findings.filter(f => f.severity === 'info')
    };
    
    for (const [severity, items] of Object.entries(bySeverity)) {
      if (items.length === 0) continue;
      
      report += `## ${severity.toUpperCase()} (${items.length})\n\n`;
      
      for (const finding of items) {
        report += `### ${finding.ruleId}\n\n`;
        report += `**File:** ${finding.file}:${finding.line}\n`;
        report += `**Message:** ${finding.message}\n`;
        
        if (finding.snippet) {
          report += `\n\`\`\`\n${finding.snippet}\n\`\`\`\n`;
        }
        
        if (finding.fix) {
          report += `\n**Suggested Fix:**\n\`\`\`\n${finding.fix}\n\`\`\`\n`;
        }
        
        if (finding.metadata.cwe?.length) {
          report += `\n**CWE:** ${finding.metadata.cwe.join(', ')}\n`;
        }
        
        report += '\n---\n\n';
      }
    }
    
    return report;
  }
}

// ============ Export Default Instance ============

export const semgrep = new SemgrepIntegration();
