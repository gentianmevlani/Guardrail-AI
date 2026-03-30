/**
 * Enhanced Security Scanner
 * 
 * Comprehensive security vulnerability detection
 * Unique: Proactive security scanning with fix suggestions
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface SecurityVulnerability {
  type: 'injection' | 'xss' | 'csrf' | 'auth' | 'secret' | 'dependency' | 'crypto';
  severity: 'critical' | 'high' | 'medium' | 'low';
  cwe?: string; // Common Weakness Enumeration
  file: string;
  line: number;
  vulnerability: string;
  description: string;
  impact: string;
  fix: string;
  example: string;
  confidence: number;
}

export interface SecurityReport {
  vulnerabilities: SecurityVulnerability[];
  riskScore: number; // 0-100
  critical: number;
  high: number;
  recommendations: string[];
  compliance: {
    owasp: number; // 0-100
    cwe: number; // 0-100
  };
}

class EnhancedSecurityScanner {
  /**
   * Scan for security vulnerabilities
   */
  async scan(
    projectPath: string,
    options?: {
      focus?: 'all' | 'injection' | 'auth' | 'secrets';
      strict?: boolean;
    }
  ): Promise<SecurityReport> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      throw new Error('Knowledge base not found');
    }

    // Scan for SQL injection
    const sqlInjection = await this.scanSQLInjection(projectPath);
    vulnerabilities.push(...sqlInjection);

    // Scan for XSS
    const xss = await this.scanXSS(projectPath);
    vulnerabilities.push(...xss);

    // Scan for authentication issues
    const auth = await this.scanAuthentication(projectPath);
    vulnerabilities.push(...auth);

    // Scan for hardcoded secrets
    const secrets = await this.scanSecrets(projectPath);
    vulnerabilities.push(...secrets);

    // Scan for dependency vulnerabilities
    const deps = await this.scanDependencies(projectPath);
    vulnerabilities.push(...deps);

    // Scan for crypto issues
    const crypto = await this.scanCrypto(projectPath);
    vulnerabilities.push(...crypto);

    // Filter by focus
    let filtered = vulnerabilities;
    if (options?.focus && options.focus !== 'all') {
      filtered = vulnerabilities.filter(v => 
        options.focus === 'injection' && v.type === 'injection' ||
        options.focus === 'auth' && v.type === 'auth' ||
        options.focus === 'secrets' && v.type === 'secret'
      );
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(filtered);

    // Generate recommendations
    const recommendations = this.generateRecommendations(filtered);

    // Calculate compliance scores
    const compliance = this.calculateCompliance(filtered);

    return {
      vulnerabilities: filtered,
      riskScore,
      critical: filtered.filter(v => v.severity === 'critical').length,
      high: filtered.filter(v => v.severity === 'high').length,
      recommendations,
      compliance,
    };
  }

  /**
   * Scan for SQL injection
   */
  private async scanSQLInjection(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulns: SecurityVulnerability[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 100)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for string concatenation in queries
        const patterns = [
          {
            regex: /['"]\s*\+\s*[^'"]*['"]/g,
            type: 'String concatenation in SQL',
          },
          {
            regex: /query\s*\(\s*['"]\s*SELECT.*\+\s*/gi,
            type: 'Dynamic SQL with concatenation',
          },
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.regex.exec(content)) !== null) {
            const lineNum = this.findLineNumber(content, match.index);
            vulns.push({
              type: 'injection',
              severity: 'critical',
              cwe: 'CWE-89',
              file: path.relative(projectPath, file),
              line: lineNum,
              vulnerability: 'SQL Injection',
              description: pattern.type,
              impact: 'Attacker can execute arbitrary SQL queries',
              fix: 'Use parameterized queries or prepared statements',
              example: match[0],
              confidence: 0.9,
            });
          }
        }
      } catch {
        // Error reading file
      }
    }

    return vulns;
  }

  /**
   * Scan for XSS
   */
  private async scanXSS(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulns: SecurityVulnerability[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 100)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for dangerouslySetInnerHTML
        if (/dangerouslySetInnerHTML/.test(content)) {
          const lineNum = this.findLineNumber(content, /dangerouslySetInnerHTML/);
          vulns.push({
            type: 'xss',
            severity: 'high',
            cwe: 'CWE-79',
            file: path.relative(projectPath, file),
            line: lineNum,
            vulnerability: 'Cross-Site Scripting (XSS)',
            description: 'Using dangerouslySetInnerHTML without sanitization',
            impact: 'Attacker can inject malicious scripts',
            fix: 'Sanitize HTML or use safe rendering methods',
            example: 'dangerouslySetInnerHTML={{ __html: userInput }}',
            confidence: 0.8,
          });
        }

        // Check for innerHTML
        if (/\.innerHTML\s*=/.test(content)) {
          const lineNum = this.findLineNumber(content, /\.innerHTML\s*=/);
          vulns.push({
            type: 'xss',
            severity: 'high',
            cwe: 'CWE-79',
            file: path.relative(projectPath, file),
            line: lineNum,
            vulnerability: 'Cross-Site Scripting (XSS)',
            description: 'Direct innerHTML assignment',
            impact: 'Attacker can inject malicious scripts',
            fix: 'Use textContent or sanitize HTML',
            example: 'element.innerHTML = userInput',
            confidence: 0.85,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return vulns;
  }

  /**
   * Scan for authentication issues
   */
  private async scanAuthentication(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulns: SecurityVulnerability[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 100)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for weak password validation
        if (/password.*length\s*[<>=]\s*[0-5]/.test(content)) {
          const lineNum = this.findLineNumber(content, /password.*length/);
          vulns.push({
            type: 'auth',
            severity: 'medium',
            cwe: 'CWE-521',
            file: path.relative(projectPath, file),
            line: lineNum,
            vulnerability: 'Weak Password Policy',
            description: 'Password length requirement too short',
            impact: 'Weak passwords are easier to crack',
            fix: 'Require minimum 8-12 characters with complexity',
            example: 'password.length < 6',
            confidence: 0.7,
          });
        }

        // Check for missing rate limiting
        if (/login|auth|signin/i.test(content) && !/rateLimit|throttle/i.test(content)) {
          vulns.push({
            type: 'auth',
            severity: 'high',
            cwe: 'CWE-307',
            file: path.relative(projectPath, file),
            line: 1,
            vulnerability: 'Missing Rate Limiting',
            description: 'Authentication endpoint without rate limiting',
            impact: 'Vulnerable to brute force attacks',
            fix: 'Implement rate limiting on authentication endpoints',
            example: 'No rate limiting on login endpoint',
            confidence: 0.6,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return vulns;
  }

  /**
   * Scan for hardcoded secrets
   */
  private async scanSecrets(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulns: SecurityVulnerability[] = [];
    const files = await this.findCodeFiles(projectPath);

    const secretPatterns = [
      {
        regex: /(?:password|secret|api[_-]?key|token|private[_-]?key)\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
        type: 'Hardcoded Secret',
      },
      {
        regex: /(?:AWS_|GOOGLE_|STRIPE_)[A-Z_]*\s*[:=]\s*['"]([^'"]+)['"]/g,
        type: 'Hardcoded API Key',
      },
    ];

    for (const file of files.slice(0, 100)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        for (const pattern of secretPatterns) {
          let match;
          while ((match = pattern.regex.exec(content)) !== null) {
            const lineNum = this.findLineNumber(content, match.index);
            vulns.push({
              type: 'secret',
              severity: 'critical',
              cwe: 'CWE-798',
              file: path.relative(projectPath, file),
              line: lineNum,
              vulnerability: pattern.type,
              description: 'Secret value hardcoded in source code',
              impact: 'Secret exposed in codebase, can be leaked',
              fix: 'Use environment variables or secure secret management',
              example: match[0].substring(0, 50) + '...',
              confidence: 0.95,
            });
          }
        }
      } catch {
        // Error reading file
      }
    }

    return vulns;
  }

  /**
   * Scan for dependency vulnerabilities
   */
  private async scanDependencies(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulns: SecurityVulnerability[] = [];

    // Check package.json
    const pkgPath = path.join(projectPath, 'package.json');
    if (await this.pathExists(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Check for known vulnerable packages
        const vulnerablePackages = [
          'lodash@<4.17.12',
          'express@<4.17.1',
          'axios@<0.21.1',
        ];

        for (const [name, version] of Object.entries(deps)) {
          // Simplified check - in production use npm audit
          if (vulnerablePackages.some(v => v.includes(name))) {
            vulns.push({
              type: 'dependency',
              severity: 'high',
              cwe: 'CWE-1104',
              file: 'package.json',
              line: 1,
              vulnerability: 'Potentially Vulnerable Dependency',
              description: `Package ${name} may have known vulnerabilities`,
              impact: 'Security vulnerabilities in dependencies',
              fix: `Update ${name} to latest secure version`,
              example: `${name}: ${version}`,
              confidence: 0.6,
            });
          }
        }
      } catch {
        // Error reading package.json
      }
    }

    return vulns;
  }

  /**
   * Scan for crypto issues
   */
  private async scanCrypto(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulns: SecurityVulnerability[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files.slice(0, 100)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Check for weak crypto
        if (/MD5|SHA1/.test(content) && !/deprecated|legacy/i.test(content)) {
          const lineNum = this.findLineNumber(content, /MD5|SHA1/);
          vulns.push({
            type: 'crypto',
            severity: 'high',
            cwe: 'CWE-327',
            file: path.relative(projectPath, file),
            line: lineNum,
            vulnerability: 'Weak Cryptographic Algorithm',
            description: 'Using MD5 or SHA1 (deprecated)',
            impact: 'Vulnerable to collision attacks',
            fix: 'Use SHA-256 or stronger',
            example: 'MD5 or SHA1 hash',
            confidence: 0.9,
          });
        }
      } catch {
        // Error reading file
      }
    }

    return vulns;
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(vulns: SecurityVulnerability[]): number {
    let score = 0;
    for (const vuln of vulns) {
      const weight = vuln.severity === 'critical' ? 20 :
                   vuln.severity === 'high' ? 15 :
                   vuln.severity === 'medium' ? 10 : 5;
      score += weight * vuln.confidence;
    }
    return Math.min(100, score);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(vulns: SecurityVulnerability[]): string[] {
    const recommendations: string[] = [];

    const critical = vulns.filter(v => v.severity === 'critical');
    if (critical.length > 0) {
      recommendations.push(`🔴 ${critical.length} critical vulnerability(ies) - fix immediately`);
    }

    const byType = new Map<string, number>();
    for (const vuln of vulns) {
      byType.set(vuln.type, (byType.get(vuln.type) || 0) + 1);
    }

    for (const [type, count] of byType.entries()) {
      recommendations.push(`${count} ${type} vulnerability(ies) found`);
    }

    return recommendations;
  }

  /**
   * Calculate compliance scores
   */
  private calculateCompliance(vulns: SecurityVulnerability[]): SecurityReport['compliance'] {
    const total = vulns.length;
    const critical = vulns.filter(v => v.severity === 'critical').length;
    const high = vulns.filter(v => v.severity === 'high').length;

    // OWASP Top 10 compliance
    const owaspScore = Math.max(0, 100 - (critical * 20) - (high * 10) - (total * 2));

    // CWE compliance
    const cweScore = Math.max(0, 100 - (critical * 15) - (high * 8) - (total * 1.5));

    return {
      owasp: Math.min(100, owaspScore),
      cwe: Math.min(100, cweScore),
    };
  }

  // Helper methods
  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }

  private findLineNumber(code: string, index: number | RegExp): number {
    if (typeof index === 'number') {
      return code.substring(0, index).split('\n').length;
    }
    const match = code.match(index);
    if (match && match.index !== undefined) {
      return code.substring(0, match.index).split('\n').length;
    }
    return 1;
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

export const enhancedSecurityScanner = new EnhancedSecurityScanner();

