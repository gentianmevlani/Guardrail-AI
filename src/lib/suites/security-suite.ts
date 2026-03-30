/**
 * Security Suite
 *
 * Unified security intelligence combining:
 * - Threat Detection (real-time threat analysis)
 * - Zero Trust Engine (access control verification)
 * - Secrets Scanner (credential detection)
 * - PII Detection (personal data protection)
 * - Incident Response (automated response)
 * - Vulnerability Assessment (CVE checking)
 *
 * Provides enterprise-grade security scanning for any codebase.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";
import {
  stripeSkLiveRegex24,
  stripeSkTestRegex24,
} from "guardrail-security/secrets/stripe-placeholder-prefix";

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityScanResult {
  projectPath: string;
  timestamp: string;
  duration: number;

  // Overall scores
  scores: {
    overall: number;
    secrets: number;
    vulnerabilities: number;
    compliance: number;
    threats: number;
  };

  // Findings by category
  secrets: SecretFinding[];
  vulnerabilities: VulnerabilityFinding[];
  piiExposures: PIIFinding[];
  threats: ThreatFinding[];
  accessIssues: AccessIssueFinding[];

  // Summary
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  // Recommendations
  recommendations: SecurityRecommendation[];

  // Compliance status
  compliance: {
    soc2: ComplianceStatus;
    hipaa: ComplianceStatus;
    gdpr: ComplianceStatus;
    pci: ComplianceStatus;
  };
}

export interface SecretFinding {
  id: string;
  type:
    | "api_key"
    | "password"
    | "token"
    | "certificate"
    | "private_key"
    | "connection_string"
    | "oauth_secret";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  column?: number;
  snippet: string;
  description: string;
  recommendation: string;
  isVerified: boolean;
  entropy: number;
}

export interface VulnerabilityFinding {
  id: string;
  cve?: string;
  cwe?: string;
  severity: "critical" | "high" | "medium" | "low";
  package?: string;
  version?: string;
  file: string;
  line?: number;
  title: string;
  description: string;
  fixVersion?: string;
  references: string[];
}

export interface PIIFinding {
  id: string;
  type:
    | "email"
    | "phone"
    | "ssn"
    | "credit_card"
    | "address"
    | "name"
    | "ip_address"
    | "health_data";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  snippet: string;
  description: string;
  recommendation: string;
  isEncrypted: boolean;
}

export interface ThreatFinding {
  id: string;
  type:
    | "sql_injection"
    | "xss"
    | "csrf"
    | "path_traversal"
    | "command_injection"
    | "xxe"
    | "ssrf"
    | "deserialization";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  snippet: string;
  description: string;
  attackVector: string;
  mitigation: string;
  confidence: number;
}

export interface AccessIssueFinding {
  id: string;
  type:
    | "missing_auth"
    | "weak_auth"
    | "broken_access"
    | "privilege_escalation"
    | "insecure_direct_reference";
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line?: number;
  endpoint?: string;
  description: string;
  recommendation: string;
}

export interface SecurityRecommendation {
  priority: number;
  category: "secrets" | "vulnerabilities" | "pii" | "threats" | "access";
  action: string;
  reason: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
}

export interface ComplianceStatus {
  compliant: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface SecurityConfig {
  enableSecrets: boolean;
  enableVulnerabilities: boolean;
  enablePII: boolean;
  enableThreats: boolean;
  enableAccess: boolean;
  strictMode: boolean;
  customPatterns?: RegExp[];
  allowlist?: string[];
}

// ============================================================================
// SECRET PATTERNS
// ============================================================================

const SECRET_PATTERNS: Array<{
  name: string;
  type: SecretFinding["type"];
  pattern: RegExp;
  severity: SecretFinding["severity"];
}> = [
  // API Keys
  {
    name: "AWS Access Key",
    type: "api_key",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
  },
  {
    name: "AWS Secret Key",
    type: "api_key",
    pattern: /[A-Za-z0-9/+=]{40}(?=.*aws)/gi,
    severity: "critical",
  },
  {
    name: "Google API Key",
    type: "api_key",
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: "high",
  },
  {
    name: "GitHub Token",
    type: "token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: "critical",
  },
  {
    name: "Stripe Key",
    type: "api_key",
    pattern: stripeSkLiveRegex24(),
    severity: "critical",
  },
  {
    name: "Stripe Test Key",
    type: "api_key",
    pattern: stripeSkTestRegex24(),
    severity: "medium",
  },
  {
    name: "Slack Token",
    type: "token",
    pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g,
    severity: "high",
  },
  {
    name: "Twilio Key",
    type: "api_key",
    pattern: /SK[0-9a-fA-F]{32}/g,
    severity: "high",
  },
  {
    name: "SendGrid Key",
    type: "api_key",
    pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
    severity: "high",
  },

  // Passwords
  {
    name: "Password in Code",
    type: "password",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "critical",
  },
  {
    name: "Database Password",
    type: "password",
    pattern:
      /(?:db_pass|database_password|mysql_pwd)\s*[:=]\s*['"][^'"]+['"]/gi,
    severity: "critical",
  },

  // Tokens
  {
    name: "JWT Token",
    type: "token",
    pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
    severity: "high",
  },
  {
    name: "Bearer Token",
    type: "token",
    pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
    severity: "high",
  },

  // Private Keys
  {
    name: "RSA Private Key",
    type: "private_key",
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    name: "SSH Private Key",
    type: "private_key",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    name: "PGP Private Key",
    type: "private_key",
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: "critical",
  },

  // Connection Strings
  {
    name: "Database URL",
    type: "connection_string",
    pattern: /(?:mysql|postgres|mongodb|redis):\/\/[^\s'"]+/gi,
    severity: "high",
  },
  {
    name: "Connection String",
    type: "connection_string",
    pattern: /Server=.+;Database=.+;User Id=.+;Password=.+/gi,
    severity: "critical",
  },

  // OAuth
  {
    name: "OAuth Secret",
    type: "oauth_secret",
    pattern: /(?:client_secret|oauth_secret)\s*[:=]\s*['"][^'"]{20,}['"]/gi,
    severity: "critical",
  },
];

// ============================================================================
// PII PATTERNS
// ============================================================================

const PII_PATTERNS: Array<{
  name: string;
  type: PIIFinding["type"];
  pattern: RegExp;
  severity: PIIFinding["severity"];
}> = [
  {
    name: "Email Address",
    type: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: "medium",
  },
  {
    name: "Phone Number",
    type: "phone",
    pattern: /(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    severity: "medium",
  },
  {
    name: "SSN",
    type: "ssn",
    pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g,
    severity: "critical",
  },
  {
    name: "Credit Card",
    type: "credit_card",
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    severity: "critical",
  },
  {
    name: "IP Address",
    type: "ip_address",
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: "low",
  },
];

// ============================================================================
// THREAT PATTERNS
// ============================================================================

const THREAT_PATTERNS: Array<{
  name: string;
  type: ThreatFinding["type"];
  pattern: RegExp;
  severity: ThreatFinding["severity"];
  mitigation: string;
}> = [
  {
    name: "SQL Injection",
    type: "sql_injection",
    pattern:
      /(?:execute|query|raw)\s*\(\s*['"`][^'"`]*\$\{|(?:execute|query)\s*\(\s*[^,]+\s*\+/gi,
    severity: "critical",
    mitigation: "Use parameterized queries or prepared statements",
  },
  {
    name: "XSS via innerHTML",
    type: "xss",
    pattern: /\.innerHTML\s*=|dangerouslySetInnerHTML/g,
    severity: "high",
    mitigation: "Use textContent or sanitize HTML before rendering",
  },
  {
    name: "Command Injection",
    type: "command_injection",
    pattern:
      /(?:exec|spawn|execSync)\s*\([^)]*\$\{|(?:exec|spawn)\s*\([^)]*\+/gi,
    severity: "critical",
    mitigation: "Validate and sanitize all inputs, use parameterized commands",
  },
  {
    name: "Path Traversal",
    type: "path_traversal",
    pattern:
      /(?:readFile|writeFile|createReadStream)\s*\([^)]*\$\{|\.\.\/|\.\.%2[fF]/g,
    severity: "high",
    mitigation: "Validate file paths and use path.resolve with whitelist",
  },
  {
    name: "SSRF",
    type: "ssrf",
    pattern:
      /(?:fetch|axios|request)\s*\(\s*(?:req\.(?:body|query|params)|[^)]*\$\{)/gi,
    severity: "high",
    mitigation: "Validate and whitelist URLs, block internal networks",
  },
  {
    name: "Eval Usage",
    type: "command_injection",
    pattern: /\beval\s*\(/g,
    severity: "critical",
    mitigation: "Never use eval with user input, use safe alternatives",
  },
  {
    name: "Insecure Deserialization",
    type: "deserialization",
    pattern: /JSON\.parse\s*\(\s*(?:req\.body|Buffer|data)/gi,
    severity: "medium",
    mitigation: "Validate and sanitize data before deserialization",
  },
];

// ============================================================================
// SECURITY SUITE
// ============================================================================

class SecuritySuite {
  private defaultConfig: SecurityConfig = {
    enableSecrets: true,
    enableVulnerabilities: true,
    enablePII: true,
    enableThreats: true,
    enableAccess: true,
    strictMode: false,
  };

  /**
   * Run comprehensive security scan
   */
  async scan(
    projectPath: string,
    config: Partial<SecurityConfig> = {},
  ): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const cfg = { ...this.defaultConfig, ...config };

    console.log(`🔒 Security Suite scanning: ${projectPath}`);

    // Get all source files
    const files = await this.getSourceFiles(projectPath);
    console.log(`📁 Scanning ${files.length} files`);

    // Run all scans in parallel
    const [secrets, vulnerabilities, piiExposures, threats, accessIssues] =
      await Promise.all([
        cfg.enableSecrets
          ? this.scanSecrets(files, projectPath, cfg.allowlist)
          : [],
        cfg.enableVulnerabilities ? this.scanVulnerabilities(projectPath) : [],
        cfg.enablePII ? this.scanPII(files, projectPath) : [],
        cfg.enableThreats ? this.scanThreats(files, projectPath) : [],
        cfg.enableAccess ? this.scanAccessControl(files, projectPath) : [],
      ]);

    // Calculate scores
    const scores = this.calculateScores(
      secrets,
      vulnerabilities,
      piiExposures,
      threats,
      accessIssues,
    );

    // Generate summary
    const allFindings = [
      ...secrets,
      ...vulnerabilities,
      ...piiExposures,
      ...threats,
      ...accessIssues,
    ];
    const summary = {
      totalFindings: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "critical").length,
      high: allFindings.filter((f) => f.severity === "high").length,
      medium: allFindings.filter((f) => f.severity === "medium").length,
      low: allFindings.filter((f) => f.severity === "low").length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      secrets,
      vulnerabilities,
      piiExposures,
      threats,
      accessIssues,
    );

    // Check compliance
    const compliance = this.checkCompliance(
      secrets,
      piiExposures,
      accessIssues,
      vulnerabilities,
    );

    const duration = Date.now() - startTime;

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      duration,
      scores,
      secrets,
      vulnerabilities,
      piiExposures,
      threats,
      accessIssues,
      summary,
      recommendations,
      compliance,
    };
  }

  /**
   * Quick secrets scan only
   */
  async scanSecretsOnly(projectPath: string): Promise<SecretFinding[]> {
    const files = await this.getSourceFiles(projectPath);
    return this.scanSecrets(files, projectPath);
  }

  /**
   * Quick threat scan only
   */
  async scanThreatsOnly(projectPath: string): Promise<ThreatFinding[]> {
    const files = await this.getSourceFiles(projectPath);
    return this.scanThreats(files, projectPath);
  }

  // ============================================================================
  // PRIVATE SCANNING METHODS
  // ============================================================================

  private async scanSecrets(
    files: string[],
    projectPath: string,
    allowlist?: string[],
  ): Promise<SecretFinding[]> {
    const findings: SecretFinding[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        const relativePath = path.relative(projectPath, file);

        for (const secretPattern of SECRET_PATTERNS) {
          let match;
          secretPattern.pattern.lastIndex = 0;

          while ((match = secretPattern.pattern.exec(content)) !== null) {
            const lineNumber = content
              .substring(0, match.index)
              .split("\n").length;
            const snippet = this.sanitizeSnippet(lines[lineNumber - 1] || "");

            // Skip if in allowlist
            if (allowlist?.some((a) => match![0].includes(a))) continue;

            // Skip if clearly a placeholder
            if (this.isPlaceholder(match[0])) continue;

            findings.push({
              id: `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: secretPattern.type,
              severity: secretPattern.severity,
              file: relativePath,
              line: lineNumber,
              snippet,
              description: `${secretPattern.name} detected`,
              recommendation: `Remove ${secretPattern.name} and use environment variables or secret management`,
              isVerified: this.verifySecret(match[0], secretPattern.type),
              entropy: this.calculateEntropy(match[0]),
            });
          }
        }
      } catch (error) {
        console.warn(`Error scanning ${file}:`, error);
      }
    }

    return findings;
  }

  private async scanVulnerabilities(
    projectPath: string,
  ): Promise<VulnerabilityFinding[]> {
    const findings: VulnerabilityFinding[] = [];

    // Check npm audit
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      await fs.access(packageJsonPath);

      try {
        const result = execSync("npm audit --json", {
          cwd: projectPath,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        });

        const audit = JSON.parse(result);
        if (audit.vulnerabilities) {
          for (const [name, vuln] of Object.entries(
            audit.vulnerabilities,
          ) as any[]) {
            findings.push({
              id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              severity: vuln.severity || "medium",
              package: name,
              version: vuln.version,
              file: "package.json",
              title: `Vulnerability in ${name}`,
              description: vuln.via?.[0]?.title || "Dependency vulnerability",
              fixVersion: vuln.fixAvailable?.version,
              references:
                vuln.via?.map((v: any) => v.url).filter(Boolean) || [],
            });
          }
        }
      } catch (auditError: any) {
        // npm audit exits with non-zero when vulnerabilities found
        if (auditError.stdout) {
          try {
            const audit = JSON.parse(auditError.stdout);
            if (audit.vulnerabilities) {
              for (const [name, vuln] of Object.entries(
                audit.vulnerabilities,
              ) as any[]) {
                findings.push({
                  id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  severity: vuln.severity || "medium",
                  package: name,
                  version: vuln.range,
                  file: "package.json",
                  title: `Vulnerability in ${name}`,
                  description:
                    vuln.via?.[0]?.title ||
                    vuln.via?.[0] ||
                    "Dependency vulnerability",
                  fixVersion:
                    vuln.fixAvailable?.version || vuln.fixAvailable?.name,
                  references: [],
                });
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch {
      // No package.json
    }

    return findings;
  }

  private async scanPII(
    files: string[],
    projectPath: string,
  ): Promise<PIIFinding[]> {
    const findings: PIIFinding[] = [];

    // Only scan specific file types for PII
    const piiFiles = files.filter(
      (f) =>
        f.endsWith(".json") ||
        f.endsWith(".csv") ||
        f.endsWith(".sql") ||
        f.includes("seed") ||
        f.includes("fixture") ||
        f.includes("mock"),
    );

    for (const file of piiFiles) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        const relativePath = path.relative(projectPath, file);

        for (const piiPattern of PII_PATTERNS) {
          let match;
          piiPattern.pattern.lastIndex = 0;

          while ((match = piiPattern.pattern.exec(content)) !== null) {
            const lineNumber = content
              .substring(0, match.index)
              .split("\n").length;
            const snippet = this.sanitizeSnippet(lines[lineNumber - 1] || "");

            // Skip obvious test data
            if (this.isTestData(match[0], piiPattern.type)) continue;

            findings.push({
              id: `pii-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: piiPattern.type,
              severity: piiPattern.severity,
              file: relativePath,
              line: lineNumber,
              snippet,
              description: `${piiPattern.name} detected in code`,
              recommendation: `Remove or encrypt ${piiPattern.name}. Use anonymized test data.`,
              isEncrypted: false,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return findings;
  }

  private async scanThreats(
    files: string[],
    projectPath: string,
  ): Promise<ThreatFinding[]> {
    const findings: ThreatFinding[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        const relativePath = path.relative(projectPath, file);

        for (const threatPattern of THREAT_PATTERNS) {
          let match;
          threatPattern.pattern.lastIndex = 0;

          while ((match = threatPattern.pattern.exec(content)) !== null) {
            const lineNumber = content
              .substring(0, match.index)
              .split("\n").length;
            const snippet = this.sanitizeSnippet(lines[lineNumber - 1] || "");

            findings.push({
              id: `threat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: threatPattern.type,
              severity: threatPattern.severity,
              file: relativePath,
              line: lineNumber,
              snippet,
              description: `Potential ${threatPattern.name} vulnerability`,
              attackVector: `Attacker could exploit ${threatPattern.name} to compromise the application`,
              mitigation: threatPattern.mitigation,
              confidence: 0.7,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return findings;
  }

  private async scanAccessControl(
    files: string[],
    projectPath: string,
  ): Promise<AccessIssueFinding[]> {
    const findings: AccessIssueFinding[] = [];

    // Look for route definitions without auth
    const routeFiles = files.filter(
      (f) =>
        f.includes("route") ||
        f.includes("controller") ||
        f.includes("api") ||
        f.includes("endpoint"),
    );

    for (const file of routeFiles) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const relativePath = path.relative(projectPath, file);

        // Check for routes without authentication middleware
        const routePattern =
          /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
        const authPattern =
          /(?:authenticate|auth|requireAuth|isAuthenticated|verifyToken|checkAuth)/i;

        let match;
        while ((match = routePattern.exec(content)) !== null) {
          const lineNumber = content
            .substring(0, match.index)
            .split("\n").length;
          const endpoint = match[2];

          // Get the full route definition (next 5 lines)
          const lines = content.split("\n");
          const routeBlock = lines
            .slice(lineNumber - 1, lineNumber + 5)
            .join("\n");

          // Check if auth middleware is present
          if (!authPattern.test(routeBlock)) {
            // Skip public routes
            if (this.isPublicRoute(endpoint)) continue;

            findings.push({
              id: `access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "missing_auth",
              severity: "high",
              file: relativePath,
              line: lineNumber,
              endpoint,
              description: `Route ${endpoint} may be missing authentication`,
              recommendation:
                "Add authentication middleware to protect this endpoint",
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return findings;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private calculateScores(
    secrets: SecretFinding[],
    vulnerabilities: VulnerabilityFinding[],
    pii: PIIFinding[],
    threats: ThreatFinding[],
    access: AccessIssueFinding[],
  ) {
    const calculateScore = (findings: Array<{ severity: string }>) => {
      if (findings.length === 0) return 100;
      const penalties = findings.reduce((sum, f) => {
        return (
          sum +
          (f.severity === "critical"
            ? 25
            : f.severity === "high"
              ? 15
              : f.severity === "medium"
                ? 10
                : 5)
        );
      }, 0);
      return Math.max(0, 100 - penalties);
    };

    return {
      overall: Math.round(
        (calculateScore(secrets) +
          calculateScore(vulnerabilities) +
          calculateScore(threats) +
          calculateScore(access)) /
          4,
      ),
      secrets: calculateScore(secrets),
      vulnerabilities: calculateScore(vulnerabilities),
      compliance: calculateScore([...pii, ...access]),
      threats: calculateScore(threats),
    };
  }

  private generateRecommendations(
    secrets: SecretFinding[],
    vulnerabilities: VulnerabilityFinding[],
    pii: PIIFinding[],
    threats: ThreatFinding[],
    access: AccessIssueFinding[],
  ): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];

    if (secrets.filter((s) => s.severity === "critical").length > 0) {
      recommendations.push({
        priority: 1,
        category: "secrets",
        action: "Immediately rotate all exposed credentials",
        reason: "Critical secrets exposed in code",
        effort: "low",
        impact: "high",
      });
    }

    if (vulnerabilities.filter((v) => v.severity === "critical").length > 0) {
      recommendations.push({
        priority: 2,
        category: "vulnerabilities",
        action: "Update dependencies with critical vulnerabilities",
        reason: "Critical CVEs in dependencies",
        effort: "medium",
        impact: "high",
      });
    }

    if (threats.length > 0) {
      recommendations.push({
        priority: 3,
        category: "threats",
        action: "Review and fix injection vulnerabilities",
        reason: "Potential injection attacks detected",
        effort: "high",
        impact: "high",
      });
    }

    if (access.length > 0) {
      recommendations.push({
        priority: 4,
        category: "access",
        action: "Add authentication to unprotected endpoints",
        reason: "Routes without authentication detected",
        effort: "medium",
        impact: "high",
      });
    }

    if (pii.length > 0) {
      recommendations.push({
        priority: 5,
        category: "pii",
        action: "Remove or encrypt PII in codebase",
        reason: "Personal data exposed in code/data files",
        effort: "medium",
        impact: "medium",
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private checkCompliance(
    secrets: SecretFinding[],
    pii: PIIFinding[],
    access: AccessIssueFinding[],
    vulnerabilities: VulnerabilityFinding[],
  ) {
    const hasSecrets = secrets.length > 0;
    const hasPII = pii.length > 0;
    const hasAccessIssues = access.length > 0;
    const hasCriticalVulns =
      vulnerabilities.filter((v) => v.severity === "critical").length > 0;

    return {
      soc2: {
        compliant: !hasSecrets && !hasAccessIssues,
        score: hasSecrets || hasAccessIssues ? 60 : 100,
        issues: [
          ...(hasSecrets ? ["Secrets in code violate SOC2 requirements"] : []),
          ...(hasAccessIssues
            ? ["Access control issues violate SOC2 requirements"]
            : []),
        ],
        recommendations: [
          ...(hasSecrets ? ["Implement secret management solution"] : []),
          ...(hasAccessIssues ? ["Implement role-based access control"] : []),
        ],
      },
      hipaa: {
        compliant: !hasPII,
        score: hasPII ? 40 : 100,
        issues: hasPII ? ["PHI/PII in codebase violates HIPAA"] : [],
        recommendations: hasPII ? ["Remove or encrypt all PHI/PII"] : [],
      },
      gdpr: {
        compliant: !hasPII,
        score: hasPII ? 50 : 100,
        issues: hasPII ? ["Personal data in code violates GDPR"] : [],
        recommendations: hasPII ? ["Implement data anonymization"] : [],
      },
      pci: {
        compliant: !pii.some((p) => p.type === "credit_card"),
        score: pii.some((p) => p.type === "credit_card") ? 0 : 100,
        issues: pii.some((p) => p.type === "credit_card")
          ? ["Credit card data in code violates PCI-DSS"]
          : [],
        recommendations: pii.some((p) => p.type === "credit_card")
          ? ["Never store credit card data in code"]
          : [],
      },
    };
  }

  private sanitizeSnippet(line: string): string {
    // Mask potential secrets in snippets
    return line
      .replace(/(['"])[A-Za-z0-9+/=_-]{20,}(['"])/g, "$1[REDACTED]$2")
      .substring(0, 100);
  }

  private isPlaceholder(value: string): boolean {
    const placeholders = [
      "your-",
      "xxx",
      "example",
      "placeholder",
      "replace",
      "changeme",
      "todo",
      "fixme",
      "secret",
      "test",
    ];
    return placeholders.some((p) => value.toLowerCase().includes(p));
  }

  private verifySecret(value: string, type: SecretFinding["type"]): boolean {
    // Basic verification - high entropy usually means real secret
    const entropy = this.calculateEntropy(value);
    return entropy > 3.5;
  }

  private calculateEntropy(str: string): number {
    const freq = new Map<string, number>();
    for (const char of str) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of freq.values()) {
      const p = count / str.length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private isTestData(value: string, type: PIIFinding["type"]): boolean {
    if (type === "email") {
      return value.includes("example.com") || value.includes("test.com");
    }
    if (type === "phone") {
      return value.startsWith("555") || value.includes("000-0000");
    }
    return false;
  }

  private isPublicRoute(endpoint: string): boolean {
    const publicPaths = [
      "/health",
      "/ping",
      "/status",
      "/public",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/api/auth",
      "/oauth",
      "/webhook",
    ];
    return publicPaths.some((p) => endpoint.includes(p));
  }

  private async getSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".env"];
    const excludedDirs = [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
    ];
    const files: string[] = [];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !excludedDirs.includes(entry.name)) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            if (
              extensions.some((ext) => entry.name.endsWith(ext)) ||
              entry.name.startsWith(".env")
            ) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    await walk(projectPath);
    return files;
  }
}

export const securitySuite = new SecuritySuite();
export default securitySuite;
