/**
 * ISO 27001 Compliance Framework
 * 
 * Information Security Management System (ISMS) controls
 * Based on ISO/IEC 27001:2022
 */

export interface ISO27001Control {
  id: string;
  clause: string;
  title: string;
  description: string;
  category: ISO27001Category;
  checks: ISO27001Check[];
}

export interface ISO27001Check {
  id: string;
  description: string;
  automated: boolean;
  checkFunction?: (context: ComplianceContext) => Promise<CheckResult>;
}

export interface CheckResult {
  passed: boolean;
  findings: string[];
  evidence: string[];
  recommendations: string[];
}

export interface ComplianceContext {
  projectPath: string;
  codebase: any;
  config: any;
}

export type ISO27001Category = 
  | 'organizational'
  | 'people'
  | 'physical'
  | 'technological';

export const ISO27001_CONTROLS: ISO27001Control[] = [
  // A.5 - Organizational Controls
  {
    id: 'A.5.1',
    clause: 'A.5.1',
    title: 'Policies for information security',
    description: 'Information security policy and topic-specific policies shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties, and reviewed at planned intervals and if significant changes occur.',
    category: 'organizational',
    checks: [
      {
        id: 'A.5.1.1',
        description: 'Security policy documentation exists',
        automated: true,
        checkFunction: async (ctx) => {
          const policyFiles = ['SECURITY.md', 'security-policy.md', 'docs/security.md'];
          const found = policyFiles.some(f => ctx.codebase?.files?.includes(f));
          return {
            passed: found,
            findings: found ? [] : ['No security policy document found'],
            evidence: found ? ['Security policy document exists'] : [],
            recommendations: found ? [] : ['Create a SECURITY.md file documenting security policies'],
          };
        },
      },
    ],
  },
  {
    id: 'A.5.7',
    clause: 'A.5.7',
    title: 'Threat intelligence',
    description: 'Information relating to information security threats shall be collected and analysed to produce threat intelligence.',
    category: 'organizational',
    checks: [
      {
        id: 'A.5.7.1',
        description: 'Vulnerability scanning is configured',
        automated: true,
        checkFunction: async (ctx) => {
          const hasVulnScanning = ctx.config?.security?.vulnerabilityScanning !== false;
          return {
            passed: hasVulnScanning,
            findings: hasVulnScanning ? [] : ['Vulnerability scanning not configured'],
            evidence: hasVulnScanning ? ['Vulnerability scanning enabled'] : [],
            recommendations: hasVulnScanning ? [] : ['Enable automated vulnerability scanning'],
          };
        },
      },
    ],
  },
  {
    id: 'A.5.15',
    clause: 'A.5.15',
    title: 'Access control',
    description: 'Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.',
    category: 'organizational',
    checks: [
      {
        id: 'A.5.15.1',
        description: 'Authentication is implemented',
        automated: true,
        checkFunction: async (ctx) => {
          const authPatterns = ['authenticate', 'login', 'jwt', 'session', 'oauth'];
          const hasAuth = authPatterns.some(p => 
            ctx.codebase?.content?.toLowerCase().includes(p)
          );
          return {
            passed: hasAuth,
            findings: hasAuth ? [] : ['No authentication implementation detected'],
            evidence: hasAuth ? ['Authentication patterns found in codebase'] : [],
            recommendations: hasAuth ? [] : ['Implement user authentication'],
          };
        },
      },
    ],
  },

  // A.8 - Technological Controls
  {
    id: 'A.8.3',
    clause: 'A.8.3',
    title: 'Information access restriction',
    description: 'Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.3.1',
        description: 'Role-based access control implemented',
        automated: true,
        checkFunction: async (ctx) => {
          const rbacPatterns = ['role', 'permission', 'authorize', 'acl', 'rbac'];
          const hasRBAC = rbacPatterns.some(p => 
            ctx.codebase?.content?.toLowerCase().includes(p)
          );
          return {
            passed: hasRBAC,
            findings: hasRBAC ? [] : ['No RBAC implementation detected'],
            evidence: hasRBAC ? ['RBAC patterns found'] : [],
            recommendations: hasRBAC ? [] : ['Implement role-based access control'],
          };
        },
      },
    ],
  },
  {
    id: 'A.8.4',
    clause: 'A.8.4',
    title: 'Access to source code',
    description: 'Read and write access to source code, development tools and software libraries shall be appropriately managed.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.4.1',
        description: 'Branch protection is configured',
        automated: true,
        checkFunction: async (ctx) => {
          const hasBranchProtection = ctx.config?.git?.branchProtection !== false;
          return {
            passed: hasBranchProtection,
            findings: hasBranchProtection ? [] : ['Branch protection not configured'],
            evidence: hasBranchProtection ? ['Branch protection enabled'] : [],
            recommendations: hasBranchProtection ? [] : ['Enable branch protection on main branches'],
          };
        },
      },
    ],
  },
  {
    id: 'A.8.9',
    clause: 'A.8.9',
    title: 'Configuration management',
    description: 'Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.9.1',
        description: 'Environment configuration is documented',
        automated: true,
        checkFunction: async (ctx) => {
          const configFiles = ['.env.example', 'config/README.md', 'docs/configuration.md'];
          const hasConfig = configFiles.some(f => ctx.codebase?.files?.includes(f));
          return {
            passed: hasConfig,
            findings: hasConfig ? [] : ['Configuration documentation missing'],
            evidence: hasConfig ? ['Configuration documentation exists'] : [],
            recommendations: hasConfig ? [] : ['Create .env.example and configuration documentation'],
          };
        },
      },
    ],
  },
  {
    id: 'A.8.12',
    clause: 'A.8.12',
    title: 'Data leakage prevention',
    description: 'Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.12.1',
        description: 'No hardcoded secrets in codebase',
        automated: true,
        checkFunction: async (ctx) => {
          const secretPatterns = [
            /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
            /password\s*=\s*['"][^'"]+['"]/i,
            /secret\s*=\s*['"][^'"]+['"]/i,
          ];
          const hasSecrets = secretPatterns.some(p => p.test(ctx.codebase?.content || ''));
          return {
            passed: !hasSecrets,
            findings: hasSecrets ? ['Potential hardcoded secrets detected'] : [],
            evidence: !hasSecrets ? ['No hardcoded secrets found'] : [],
            recommendations: hasSecrets ? ['Remove hardcoded secrets and use environment variables'] : [],
          };
        },
      },
    ],
  },
  {
    id: 'A.8.24',
    clause: 'A.8.24',
    title: 'Use of cryptography',
    description: 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.24.1',
        description: 'Secure cryptographic algorithms used',
        automated: true,
        checkFunction: async (ctx) => {
          const weakAlgorithms = ['md5', 'sha1', 'des', 'rc4'];
          const usesWeak = weakAlgorithms.some(a => 
            ctx.codebase?.content?.toLowerCase().includes(a)
          );
          return {
            passed: !usesWeak,
            findings: usesWeak ? ['Weak cryptographic algorithms detected'] : [],
            evidence: !usesWeak ? ['No weak algorithms found'] : [],
            recommendations: usesWeak ? ['Replace MD5/SHA1 with SHA-256 or stronger'] : [],
          };
        },
      },
    ],
  },
  {
    id: 'A.8.25',
    clause: 'A.8.25',
    title: 'Secure development life cycle',
    description: 'Rules for the secure development of software and systems shall be established and applied.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.25.1',
        description: 'Security testing is automated',
        automated: true,
        checkFunction: async (ctx) => {
          const ciFiles = ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile'];
          const hasCI = ciFiles.some(f => ctx.codebase?.files?.includes(f));
          return {
            passed: hasCI,
            findings: hasCI ? [] : ['No CI/CD security testing detected'],
            evidence: hasCI ? ['CI/CD configuration found'] : [],
            recommendations: hasCI ? [] : ['Set up automated security testing in CI/CD'],
          };
        },
      },
    ],
  },
  {
    id: 'A.8.28',
    clause: 'A.8.28',
    title: 'Secure coding',
    description: 'Secure coding principles shall be applied to software development.',
    category: 'technological',
    checks: [
      {
        id: 'A.8.28.1',
        description: 'Input validation is implemented',
        automated: true,
        checkFunction: async (ctx) => {
          const validationPatterns = ['validate', 'sanitize', 'escape', 'zod', 'yup', 'joi'];
          const hasValidation = validationPatterns.some(p => 
            ctx.codebase?.content?.toLowerCase().includes(p)
          );
          return {
            passed: hasValidation,
            findings: hasValidation ? [] : ['No input validation detected'],
            evidence: hasValidation ? ['Input validation patterns found'] : [],
            recommendations: hasValidation ? [] : ['Implement input validation using Zod, Yup, or similar'],
          };
        },
      },
    ],
  },
];

/**
 * ISO 27001 Compliance Checker
 */
export class ISO27001Checker {
  /**
   * Run all ISO 27001 compliance checks
   */
  async checkCompliance(context: ComplianceContext): Promise<ISO27001Report> {
    const results: ControlResult[] = [];
    let passedControls = 0;
    let failedControls = 0;

    for (const control of ISO27001_CONTROLS) {
      const controlResults: CheckResult[] = [];
      let controlPassed = true;

      for (const check of control.checks) {
        if (check.automated && check.checkFunction) {
          try {
            const result = await check.checkFunction(context);
            controlResults.push(result);
            if (!result.passed) {
              controlPassed = false;
            }
          } catch (error) {
            controlResults.push({
              passed: false,
              findings: [`Check failed: ${error}`],
              evidence: [],
              recommendations: ['Review and fix the check implementation'],
            });
            controlPassed = false;
          }
        }
      }

      if (controlPassed) {
        passedControls++;
      } else {
        failedControls++;
      }

      results.push({
        control,
        passed: controlPassed,
        checkResults: controlResults,
      });
    }

    const score = Math.round((passedControls / (passedControls + failedControls)) * 100);

    return {
      framework: 'ISO 27001:2022',
      timestamp: new Date().toISOString(),
      score,
      passedControls,
      failedControls,
      totalControls: passedControls + failedControls,
      results,
      recommendations: this.generateRecommendations(results),
    };
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(results: ControlResult[]): string[] {
    const recommendations: string[] = [];
    
    for (const result of results) {
      if (!result.passed) {
        for (const checkResult of result.checkResults) {
          recommendations.push(...checkResult.recommendations);
        }
      }
    }

    return [...new Set(recommendations)];
  }
}

export interface ControlResult {
  control: ISO27001Control;
  passed: boolean;
  checkResults: CheckResult[];
}

export interface ISO27001Report {
  framework: string;
  timestamp: string;
  score: number;
  passedControls: number;
  failedControls: number;
  totalControls: number;
  results: ControlResult[];
  recommendations: string[];
}

// Export singleton
export const iso27001Checker = new ISO27001Checker();
