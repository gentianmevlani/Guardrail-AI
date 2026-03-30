/**
 * Security Scanner
 * 
 * Detects security vulnerabilities beyond code quality
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion: string;
  cwe?: string; // Common Weakness Enumeration
}

export interface SecurityReport {
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: SecurityIssue[];
  score: number; // 0-100
}

class SecurityScanner {
  /**
   * Scan project for security issues
   */
  async scanProject(projectPath: string): Promise<SecurityReport> {
    const issues: SecurityIssue[] = [];

    // Check for hardcoded secrets
    await this.checkHardcodedSecrets(projectPath, issues);

    // Check for SQL injection vulnerabilities
    await this.checkSQLInjection(projectPath, issues);

    // Check for XSS vulnerabilities
    await this.checkXSS(projectPath, issues);

    // Check for insecure dependencies
    await this.checkInsecureDependencies(projectPath, issues);

    // Check for missing security headers
    await this.checkSecurityHeaders(projectPath, issues);

    // Check for weak authentication
    await this.checkWeakAuthentication(projectPath, issues);

    // Check for insecure file operations
    await this.checkInsecureFileOperations(projectPath, issues);

    // Check for exposed sensitive data
    await this.checkExposedSensitiveData(projectPath, issues);

    // Calculate score
    const score = this.calculateScore(issues);

    return {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      issues,
      score,
    };
  }

  /**
   * Check for hardcoded secrets
   */
  private async checkHardcodedSecrets(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    const secretPatterns = [
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]+)['"]/i, name: 'API Key' },
      { pattern: /(?:password|pwd|pass)\s*[:=]\s*['"]([^'"]+)['"]/i, name: 'Password' },
      { pattern: /(?:secret|secret[_-]?key)\s*[:=]\s*['"]([^'"]+)['"]/i, name: 'Secret' },
      { pattern: /(?:token|access[_-]?token)\s*[:=]\s*['"]([^'"]+)['"]/i, name: 'Token' },
      { pattern: /(?:private[_-]?key|privatekey)\s*[:=]\s*['"]([^'"]+)['"]/i, name: 'Private Key' },
      { pattern: /(?:aws[_-]?access[_-]?key|aws[_-]?secret)/i, name: 'AWS Credentials' },
      { pattern: /(?:mongodb[_-]?uri|database[_-]?url)\s*[:=]\s*['"]([^'"]+)['"]/i, name: 'Database URI' },
    ];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const { pattern, name } of secretPatterns) {
            if (pattern.test(lines[i])) {
              // Check if it's in a comment or test file
              if (lines[i].trim().startsWith('//') || 
                  lines[i].trim().startsWith('/*') ||
                  file.includes('.test.') ||
                  file.includes('.spec.')) {
                continue;
              }

              issues.push({
                id: `hardcoded-secret-${issues.length}`,
                severity: 'critical',
                title: `Hardcoded ${name} Detected`,
                description: `A ${name.toLowerCase()} is hardcoded in the source code. This is a critical security risk.`,
                file: path.relative(projectPath, file),
                line: i + 1,
                suggestion: `Move the ${name.toLowerCase()} to environment variables or a secrets manager.`,
                cwe: 'CWE-798',
              });
            }
          }
        }
      } catch {
        // Error reading file
      }
    }
  }

  /**
   * Check for SQL injection vulnerabilities
   */
  private async checkSQLInjection(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    const sqlPatterns = [
      /query\s*\(\s*['"`].*\${\s*\w+\s*}.*['"`]/,
      /execute\s*\(\s*['"`].*\${\s*\w+\s*}.*['"`]/,
      /\.query\s*\(\s*[^)]*\+/,
    ];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of sqlPatterns) {
            if (pattern.test(lines[i])) {
              issues.push({
                id: `sql-injection-${issues.length}`,
                severity: 'high',
                title: 'Potential SQL Injection Vulnerability',
                description: 'SQL query appears to use string concatenation with user input, which could lead to SQL injection.',
                file: path.relative(projectPath, file),
                line: i + 1,
                suggestion: 'Use parameterized queries or prepared statements instead of string concatenation.',
                cwe: 'CWE-89',
              });
            }
          }
        }
      } catch {
        // Error reading file
      }
    }
  }

  /**
   * Check for XSS vulnerabilities
   */
  private async checkXSS(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    const xssPatterns = [
      /dangerouslySetInnerHTML\s*=\s*\{\s*\w+\s*\}/,
      /innerHTML\s*=\s*\w+/,
      /eval\s*\(/,
    ];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of xssPatterns) {
            if (pattern.test(lines[i])) {
              issues.push({
                id: `xss-${issues.length}`,
                severity: 'high',
                title: 'Potential XSS Vulnerability',
                description: 'Code uses dangerous methods that could lead to cross-site scripting attacks.',
                file: path.relative(projectPath, file),
                line: i + 1,
                suggestion: 'Sanitize user input and avoid using dangerouslySetInnerHTML, innerHTML, or eval.',
                cwe: 'CWE-79',
              });
            }
          }
        }
      } catch {
        // Error reading file
      }
    }
  }

  /**
   * Check for insecure dependencies
   */
  private async checkInsecureDependencies(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const packageJson = path.join(projectPath, 'package.json');
    if (!await this.pathExists(packageJson)) {
      return;
    }

    try {
      const content = await fs.promises.readFile(packageJson, 'utf8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for known vulnerable packages (simplified - in production use npm audit)
      const vulnerablePackages = [
        'express', // Check version
        'lodash', // Check version
      ];

      for (const pkgName of Object.keys(deps)) {
        if (vulnerablePackages.includes(pkgName)) {
          issues.push({
            id: `insecure-dependency-${issues.length}`,
            severity: 'medium',
            title: `Potentially Insecure Dependency: ${pkgName}`,
            description: `Package ${pkgName} may have known vulnerabilities. Run 'npm audit' to check.`,
            file: 'package.json',
            suggestion: 'Run npm audit and update to secure versions.',
            cwe: 'CWE-1104',
          });
        }
      }
    } catch {
      // Error reading package.json
    }
  }

  /**
   * Check for missing security headers
   */
  private async checkSecurityHeaders(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    let hasSecurityHeaders = false;

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes('helmet') || 
            content.includes('security-headers') ||
            content.includes('Content-Security-Policy')) {
          hasSecurityHeaders = true;
          break;
        }
      } catch {
        // Error reading file
      }
    }

    if (!hasSecurityHeaders) {
      issues.push({
        id: 'missing-security-headers',
        severity: 'medium',
        title: 'Missing Security Headers',
        description: 'No security headers middleware detected. This could leave the application vulnerable.',
        suggestion: 'Add security headers middleware (e.g., helmet for Express) to set CSP, HSTS, and other security headers.',
        cwe: 'CWE-693',
      });
    }
  }

  /**
   * Check for weak authentication
   */
  private async checkWeakAuthentication(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    const weakAuthPatterns = [
      /password\s*==\s*['"]/,
      /password\s*===\s*['"]/,
      /if\s*\(\s*password\s*==/,
    ];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of weakAuthPatterns) {
            if (pattern.test(lines[i])) {
              issues.push({
                id: `weak-auth-${issues.length}`,
                severity: 'high',
                title: 'Weak Authentication Detected',
                description: 'Password comparison appears to be done insecurely.',
                file: path.relative(projectPath, file),
                line: i + 1,
                suggestion: 'Use secure password hashing (bcrypt, argon2) and constant-time comparison.',
                cwe: 'CWE-287',
              });
            }
          }
        }
      } catch {
        // Error reading file
      }
    }
  }

  /**
   * Check for insecure file operations
   */
  private async checkInsecureFileOperations(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    const insecurePatterns = [
      /readFileSync\s*\(\s*req\.(?:params|query|body)\./,
      /writeFileSync\s*\(\s*req\.(?:params|query|body)\./,
      /\.\.\/\.\.\/\.\.\//, // Path traversal
    ];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of insecurePatterns) {
            if (pattern.test(lines[i])) {
              issues.push({
                id: `insecure-file-${issues.length}`,
                severity: 'high',
                title: 'Insecure File Operation',
                description: 'File operation uses user input without proper validation, which could lead to path traversal attacks.',
                file: path.relative(projectPath, file),
                line: i + 1,
                suggestion: 'Validate and sanitize file paths. Use path.resolve() and check that paths stay within allowed directories.',
                cwe: 'CWE-22',
              });
            }
          }
        }
      } catch {
        // Error reading file
      }
    }
  }

  /**
   * Check for exposed sensitive data
   */
  private async checkExposedSensitiveData(
    projectPath: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const files = await this.findCodeFiles(projectPath);
    const sensitivePatterns = [
      /console\.(log|error|warn)\s*\(\s*.*(?:password|secret|token|key)/i,
      /console\.(log|error|warn)\s*\(\s*.*req\.(?:body|query|params)/,
    ];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          for (const pattern of sensitivePatterns) {
            if (pattern.test(lines[i])) {
              issues.push({
                id: `exposed-data-${issues.length}`,
                severity: 'medium',
                title: 'Sensitive Data in Logs',
                description: 'Sensitive data (passwords, secrets, tokens) may be logged to console.',
                file: path.relative(projectPath, file),
                line: i + 1,
                suggestion: 'Remove sensitive data from logs. Use a proper logger that can redact sensitive fields.',
                cwe: 'CWE-532',
              });
            }
          }
        }
      } catch {
        // Error reading file
      }
    }
  }

  /**
   * Calculate security score
   */
  private calculateScore(issues: SecurityIssue[]): number {
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 10;
          break;
        case 'high':
          score -= 5;
          break;
        case 'medium':
          score -= 2;
          break;
        case 'low':
          score -= 1;
          break;
      }
    }
    return Math.max(0, score);
  }

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

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const securityScanner = new SecurityScanner();

