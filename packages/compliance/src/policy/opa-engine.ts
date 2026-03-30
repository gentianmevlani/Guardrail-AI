/**
 * Policy as Code Engine (OPA/Rego Integration)
 * 
 * Enables custom security policies using Open Policy Agent and Rego language
 * Supports:
 * - Custom policy definitions
 * - Policy evaluation against code/config
 * - Policy bundles and versioning
 * - Decision logging and auditing
 */

export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  rego: string;
  category: 'security' | 'compliance' | 'quality' | 'access' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  tags: string[];
}

export interface PolicyInput {
  type: 'code' | 'config' | 'dependency' | 'request' | 'action';
  data: Record<string, unknown>;
  context?: {
    user?: string;
    project?: string;
    environment?: string;
  };
}

export interface PolicyDecision {
  policyId: string;
  allowed: boolean;
  violations: PolicyViolation[];
  warnings: string[];
  metadata: Record<string, unknown>;
  evaluatedAt: string;
  durationMs: number;
}

export interface PolicyViolation {
  rule: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  remediation?: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
}

export interface PolicyBundle {
  id: string;
  name: string;
  version: string;
  policies: Policy[];
  createdAt: string;
  updatedAt: string;
}

// Built-in policy templates
export const BUILTIN_POLICIES: Policy[] = [
  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'Prevents hardcoded secrets in source code',
    version: '1.0.0',
    category: 'security',
    severity: 'critical',
    enabled: true,
    tags: ['secrets', 'security', 'owasp'],
    rego: `
package guardrail.secrets

default allow = true
default violations = []

secret_patterns := [
  "api[_-]?key\\\\s*[=:]\\\\s*['\\\"][^'\\\"]{10,}",
  "password\\\\s*[=:]\\\\s*['\\\"][^'\\\"]{6,}",
  "secret\\\\s*[=:]\\\\s*['\\\"][^'\\\"]{10,}",
  "token\\\\s*[=:]\\\\s*['\\\"][^'\\\"]{10,}",
  "aws_access_key_id",
  "aws_secret_access_key"
]

violations[v] {
  pattern := secret_patterns[_]
  regex.match(pattern, lower(input.content))
  v := {
    "rule": "no-hardcoded-secrets",
    "message": sprintf("Potential secret detected matching pattern: %s", [pattern]),
    "severity": "critical"
  }
}

allow {
  count(violations) == 0
}
`,
  },
  {
    id: 'secure-dependencies',
    name: 'Secure Dependencies',
    description: 'Ensures dependencies meet security requirements',
    version: '1.0.0',
    category: 'security',
    severity: 'high',
    enabled: true,
    tags: ['dependencies', 'supply-chain'],
    rego: `
package guardrail.dependencies

default allow = true
default violations = []

blocked_packages := [
  "event-stream",
  "flatmap-stream",
  "ua-parser-js@0.7.29"
]

violations[v] {
  pkg := input.dependencies[_]
  blocked := blocked_packages[_]
  contains(sprintf("%s@%s", [pkg.name, pkg.version]), blocked)
  v := {
    "rule": "blocked-package",
    "message": sprintf("Blocked package detected: %s@%s", [pkg.name, pkg.version]),
    "severity": "critical"
  }
}

violations[v] {
  pkg := input.dependencies[_]
  pkg.vulnerabilities[_].severity == "critical"
  v := {
    "rule": "critical-vulnerability",
    "message": sprintf("Critical vulnerability in %s@%s", [pkg.name, pkg.version]),
    "severity": "critical"
  }
}

allow {
  count(violations) == 0
}
`,
  },
  {
    id: 'license-compliance',
    name: 'License Compliance',
    description: 'Ensures dependency licenses are compliant',
    version: '1.0.0',
    category: 'compliance',
    severity: 'high',
    enabled: true,
    tags: ['license', 'compliance', 'legal'],
    rego: `
package guardrail.licenses

default allow = true
default violations = []

copyleft_licenses := ["GPL-2.0", "GPL-3.0", "AGPL-3.0"]

violations[v] {
  input.project_license == "MIT"
  pkg := input.dependencies[_]
  copyleft := copyleft_licenses[_]
  pkg.license == copyleft
  v := {
    "rule": "copyleft-contamination",
    "message": sprintf("Copyleft license %s in %s incompatible with MIT project", [pkg.license, pkg.name]),
    "severity": "high"
  }
}

allow {
  count(violations) == 0
}
`,
  },
  {
    id: 'agent-permissions',
    name: 'AI Agent Permission Control',
    description: 'Controls what AI agents can do',
    version: '1.0.0',
    category: 'access',
    severity: 'high',
    enabled: true,
    tags: ['ai', 'agent', 'permissions'],
    rego: `
package guardrail.agent

default allow = false

dangerous_paths := ["/etc", "/root", "/var/log", "C:\\\\Windows\\\\System32"]
dangerous_commands := ["rm -rf", "del /f", "format", "shutdown", "reboot"]

allow {
  input.action.type == "read"
  not path_is_dangerous(input.action.path)
}

allow {
  input.action.type == "write"
  input.agent.permissions.write == true
  not path_is_dangerous(input.action.path)
}

path_is_dangerous(path) {
  dangerous := dangerous_paths[_]
  startswith(path, dangerous)
}

command_is_dangerous(cmd) {
  dangerous := dangerous_commands[_]
  contains(lower(cmd), dangerous)
}

violations[v] {
  input.action.type == "execute"
  command_is_dangerous(input.action.command)
  v := {
    "rule": "dangerous-command",
    "message": sprintf("Dangerous command blocked: %s", [input.action.command]),
    "severity": "critical"
  }
}
`,
  },
  {
    id: 'code-quality',
    name: 'Code Quality Standards',
    description: 'Enforces code quality standards',
    version: '1.0.0',
    category: 'quality',
    severity: 'medium',
    enabled: true,
    tags: ['quality', 'standards'],
    rego: `
package guardrail.quality

default allow = true
default violations = []

violations[v] {
  input.metrics.complexity > 20
  v := {
    "rule": "high-complexity",
    "message": sprintf("Cyclomatic complexity %d exceeds threshold 20", [input.metrics.complexity]),
    "severity": "medium"
  }
}

violations[v] {
  input.metrics.lines_of_code > 500
  v := {
    "rule": "large-file",
    "message": sprintf("File has %d lines, exceeds threshold 500", [input.metrics.lines_of_code]),
    "severity": "low"
  }
}

violations[v] {
  input.metrics.test_coverage < 60
  v := {
    "rule": "low-coverage",
    "message": sprintf("Test coverage %d%% below threshold 60%%", [input.metrics.test_coverage]),
    "severity": "medium"
  }
}

allow {
  count(violations) == 0
}
`,
  },
];

/**
 * Policy Engine for evaluating Rego policies
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private decisionLog: PolicyDecision[] = [];

  constructor() {
    // Load built-in policies
    for (const policy of BUILTIN_POLICIES) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Register a custom policy
   */
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): boolean {
    return this.policies.delete(policyId);
  }

  /**
   * Get all registered policies
   */
  getPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific policy
   */
  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Evaluate input against all enabled policies
   */
  async evaluate(input: PolicyInput): Promise<PolicyDecision[]> {
    const decisions: PolicyDecision[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      const decision = await this.evaluatePolicy(policy, input);
      decisions.push(decision);
      this.decisionLog.push(decision);
    }

    return decisions;
  }

  /**
   * Evaluate input against a specific policy
   */
  async evaluatePolicy(policy: Policy, input: PolicyInput): Promise<PolicyDecision> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, this would use an OPA client or WASM module
      // For now, we use a simplified JavaScript-based evaluation
      const result = await this.evaluateRego(policy.rego, input);
      
      const violations: PolicyViolation[] = (result.violations || []).map((v: any) => ({
        rule: v.rule || policy.id,
        message: v.message || 'Policy violation',
        severity: v.severity || policy.severity,
        remediation: v.remediation,
        location: v.location,
      }));

      return {
        policyId: policy.id,
        allowed: result.allow !== false && violations.length === 0,
        violations,
        warnings: result.warnings || [],
        metadata: { policyVersion: policy.version },
        evaluatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        policyId: policy.id,
        allowed: false,
        violations: [{
          rule: 'policy-error',
          message: `Policy evaluation failed: ${error}`,
          severity: 'high',
        }],
        warnings: [],
        metadata: { error: String(error) },
        evaluatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Simplified Rego evaluation (placeholder for OPA integration)
   * In production, this would use @open-policy-agent/opa-wasm or call OPA server
   */
  private async evaluateRego(
    _rego: string, 
    input: PolicyInput
  ): Promise<{ allow: boolean; violations: any[]; warnings: string[] }> {
    const violations: any[] = [];
    const warnings: string[] = [];
    let allow = true;

    const data = input.data as any;

    // Basic pattern matching for demonstration
    // Real implementation would parse and evaluate Rego

    // Check for secrets in content
    if (data.content) {
      const secretPatterns = [
        /api[_-]?key\s*[=:]\s*['"][^'"]{10,}/i,
        /password\s*[=:]\s*['"][^'"]{6,}/i,
        /secret\s*[=:]\s*['"][^'"]{10,}/i,
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(data.content)) {
          violations.push({
            rule: 'no-hardcoded-secrets',
            message: 'Potential hardcoded secret detected',
            severity: 'critical',
          });
          allow = false;
        }
      }
    }

    // Check for dangerous dependencies
    if (data.dependencies) {
      const blocked = ['event-stream', 'flatmap-stream'];
      for (const dep of data.dependencies) {
        if (blocked.includes(dep.name)) {
          violations.push({
            rule: 'blocked-package',
            message: `Blocked package: ${dep.name}`,
            severity: 'critical',
          });
          allow = false;
        }
      }
    }

    return { allow, violations, warnings };
  }

  /**
   * Get decision log
   */
  getDecisionLog(): PolicyDecision[] {
    return [...this.decisionLog];
  }

  /**
   * Clear decision log
   */
  clearDecisionLog(): void {
    this.decisionLog = [];
  }

  /**
   * Export policies as a bundle
   */
  exportBundle(name: string): PolicyBundle {
    return {
      id: `bundle-${Date.now()}`,
      name,
      version: '1.0.0',
      policies: this.getPolicies(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Import policies from a bundle
   */
  importBundle(bundle: PolicyBundle): void {
    for (const policy of bundle.policies) {
      this.registerPolicy(policy);
    }
  }

  /**
   * Validate Rego syntax (placeholder)
   */
  validateRego(rego: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic syntax checks
    if (!rego.includes('package ')) {
      errors.push('Missing package declaration');
    }

    if (!rego.includes('default ') && !rego.includes('allow') && !rego.includes('deny')) {
      errors.push('Policy should define allow or deny rules');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton
export const policyEngine = new PolicyEngine();
