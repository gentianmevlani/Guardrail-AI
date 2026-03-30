/**
 * Finding Explainer
 * 
 * Generates detailed explanations for findings with evidence, traces, and fix suggestions.
 * Powers the "Evidence Drawer" UI with structured data for each tab.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  STRIPE_PK_TEST_PREFIX,
  STRIPE_TEST_PREFIX,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';
import { Finding } from './state-manager';
import { policyManager } from './policy-manager';

export interface FindingExplanation {
  finding: Finding;
  why: {
    ruleId: string;
    ruleName: string;
    description: string;
    triggerCondition: string;
    severity: string;
    category: string;
  };
  evidence: {
    type: string;
    summary: string;
    details: string[];
    request?: {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
    };
    response?: {
      status: number;
      headers?: Record<string, string>;
      body?: string;
    };
    matchedPattern?: string;
    matchedValue?: string;
  };
  trace: {
    type: 'import' | 'stack' | 'network' | 'config';
    steps: {
      file: string;
      line: number;
      content: string;
      isRoot?: boolean;
    }[];
    rootCause?: {
      file: string;
      line: number;
      description: string;
    };
  };
  fix: {
    suggestion: string;
    autoFixable: boolean;
    steps: string[];
    codeChange?: {
      file: string;
      line: number;
      before: string;
      after: string;
    };
    relatedFiles: {
      file: string;
      line: number;
      reason: string;
    }[];
  };
  policy: {
    currentSeverity: string;
    canAllowlist: boolean;
    canDowngrade: boolean;
    canIgnore: boolean;
    allowlistOptions: {
      type: 'domain' | 'package' | 'path';
      value: string;
      preview: string;
    }[];
  };
}

const RULE_DEFINITIONS: Record<string, {
  name: string;
  description: string;
  category: string;
  triggerCondition: string;
  fixSuggestion: string;
}> = {
  'fake-api-domain': {
    name: 'Fake API Domain',
    description: 'Request to a mock/staging/localhost API domain detected in production code',
    category: 'Network',
    triggerCondition: 'URL matches known fake domain patterns (localhost, jsonplaceholder, mockapi, etc.)',
    fixSuggestion: 'Replace the fake API URL with your production API endpoint',
  },
  'demo-response-data': {
    name: 'Demo Response Data',
    description: 'Response contains demo/placeholder data that should not appear in production',
    category: 'Data',
    triggerCondition: 'Response body contains patterns like demo IDs, test keys, or placeholder content',
    fixSuggestion: 'Ensure your API returns real data, not demo/placeholder values',
  },
  'simulated-billing': {
    name: 'Simulated Billing',
    description: 'Billing/payment response appears to be simulated or using test mode',
    category: 'Billing',
    triggerCondition: 'Billing endpoint response contains test/demo/simulate patterns',
    fixSuggestion: 'Switch to production billing mode and use live API keys',
  },
  'test-api-keys': {
    name: 'Test API Keys',
    description: 'Test/demo API keys detected in request or response',
    category: 'Security',
    triggerCondition:
      'Content contains Stripe test-mode key patterns, demo_api_key, or similar',
    fixSuggestion: 'Replace test API keys with production keys (store in environment variables)',
  },
  'mock-import': {
    name: 'Mock Import',
    description: 'Production code imports from mock/test modules',
    category: 'Imports',
    triggerCondition: 'Import statement references a mock, fake, or test module',
    fixSuggestion: 'Remove mock imports and use real implementations',
  },
  'banned-pattern': {
    name: 'Banned Pattern',
    description: 'Code contains a banned pattern that should not appear in production',
    category: 'Code',
    triggerCondition: 'Code matches a pattern defined in the banned patterns list',
    fixSuggestion: 'Remove or replace the banned pattern with production-safe code',
  },
  'silent-fallback': {
    name: 'Silent Fallback Success',
    description: 'Code silently returns success on error (catch returns default)',
    category: 'Error Handling',
    triggerCondition: 'Catch block returns success or default data instead of propagating error',
    fixSuggestion: 'Handle errors properly and propagate failures to the UI',
  },
  'localhost-url': {
    name: 'Localhost URL',
    description: 'Hardcoded localhost URL in production code',
    category: 'Configuration',
    triggerCondition: 'Code contains localhost:PORT pattern',
    fixSuggestion: 'Use environment variables for API URLs',
  },
};

class FindingExplainer {
  async explain(finding: Finding): Promise<FindingExplanation> {
    const ruleDef = RULE_DEFINITIONS[finding.ruleId] || {
      name: finding.title,
      description: finding.description,
      category: 'Unknown',
      triggerCondition: 'Pattern matched in code or network traffic',
      fixSuggestion: 'Review and fix the detected issue',
    };

    return {
      finding,
      why: {
        ruleId: finding.ruleId,
        ruleName: ruleDef.name,
        description: ruleDef.description,
        triggerCondition: ruleDef.triggerCondition,
        severity: finding.severity,
        category: ruleDef.category,
      },
      evidence: this.buildEvidence(finding),
      trace: await this.buildTrace(finding),
      fix: this.buildFix(finding, ruleDef),
      policy: await this.buildPolicyOptions(finding),
    };
  }

  private buildEvidence(finding: Finding): FindingExplanation['evidence'] {
    const evidence: FindingExplanation['evidence'] = {
      type: finding.evidence.type,
      summary: finding.evidence.content,
      details: [],
    };

    if (finding.evidence.request) {
      evidence.request = finding.evidence.request;
      evidence.details.push(`Request: ${finding.evidence.request.method} ${finding.evidence.request.url}`);
    }

    if (finding.evidence.response) {
      evidence.response = finding.evidence.response;
      evidence.details.push(`Response: ${finding.evidence.response.status}`);
      if (finding.evidence.response.body) {
        evidence.details.push(`Body preview: ${finding.evidence.response.body.substring(0, 200)}...`);
      }
    }

    if (finding.evidence.trace) {
      evidence.details.push(`Trace: ${finding.evidence.trace.join(' -> ')}`);
    }

    // Extract matched patterns
    const content = finding.evidence.content;
    const patterns = [
      { regex: /localhost:\d+/i, name: 'localhost URL' },
      { regex: new RegExp(`${STRIPE_TEST_PREFIX}\\w+`, 'i'), name: 'Stripe test key' },
      { regex: new RegExp(`${STRIPE_PK_TEST_PREFIX}\\w+`, 'i'), name: 'Stripe test public key' },
      { regex: /demo_\w+/i, name: 'Demo identifier' },
      { regex: /jsonplaceholder\.typicode\.com/i, name: 'JSONPlaceholder API' },
      { regex: /lorem\s+ipsum/i, name: 'Lorem ipsum placeholder' },
    ];

    for (const { regex, name } of patterns) {
      const match = content.match(regex);
      if (match) {
        evidence.matchedPattern = name;
        evidence.matchedValue = match[0];
        break;
      }
    }

    return evidence;
  }

  private async buildTrace(finding: Finding): Promise<FindingExplanation['trace']> {
    const trace: FindingExplanation['trace'] = {
      type: finding.evidence.type === 'import' ? 'import' : 
            finding.evidence.type === 'network' ? 'network' : 
            finding.evidence.type === 'config' ? 'config' : 'stack',
      steps: [],
    };

    // Add the finding location as the first step
    trace.steps.push({
      file: finding.file,
      line: finding.line,
      content: finding.evidence.content.substring(0, 100),
      isRoot: true,
    });

    // Add trace steps from evidence
    if (finding.evidence.trace) {
      for (const step of finding.evidence.trace) {
        const match = step.match(/^(.+):(\d+)/);
        if (match) {
          trace.steps.push({
            file: match[1],
            line: parseInt(match[2], 10),
            content: step,
          });
        }
      }
    }

    // Set root cause
    if (trace.steps.length > 0) {
      const rootStep = trace.steps.find(s => s.isRoot) || trace.steps[trace.steps.length - 1];
      trace.rootCause = {
        file: rootStep.file,
        line: rootStep.line,
        description: `Issue originates at ${rootStep.file}:${rootStep.line}`,
      };
    }

    return trace;
  }

  private buildFix(finding: Finding, ruleDef: typeof RULE_DEFINITIONS[string]): FindingExplanation['fix'] {
    const fix: FindingExplanation['fix'] = {
      suggestion: finding.fix?.suggestion || ruleDef.fixSuggestion,
      autoFixable: finding.fix?.autoFixable || false,
      steps: [],
      relatedFiles: [],
    };

    // Generate fix steps based on rule type
    switch (finding.ruleId) {
      case 'fake-api-domain':
      case 'localhost-url':
        fix.steps = [
          'Create or update .env file with production API URL',
          `Replace hardcoded URL with environment variable`,
          'Ensure environment variable is set in production',
        ];
        fix.codeChange = {
          file: finding.file,
          line: finding.line,
          before: finding.evidence.content,
          after: 'process.env.API_URL or import.meta.env.VITE_API_URL',
        };
        break;

      case 'test-api-keys':
        fix.steps = [
          'Remove hardcoded API keys from source code',
          'Add API keys to .env file (not committed to git)',
          'Use environment variables in code',
          'Ensure .env is in .gitignore',
        ];
        break;

      case 'mock-import':
        fix.steps = [
          'Identify the real implementation module',
          'Update import to use real module',
          'Remove mock module if no longer needed',
        ];
        break;

      case 'demo-response-data':
        fix.steps = [
          'Verify API endpoint is returning production data',
          'Check if demo mode is accidentally enabled',
          'Review API response for placeholder values',
        ];
        break;

      default:
        fix.steps = [
          `Review the code at ${finding.file}:${finding.line}`,
          'Understand why this pattern was flagged',
          'Apply the appropriate fix',
          'Re-run ship check to verify',
        ];
    }

    // Add related files
    fix.relatedFiles.push({
      file: finding.file,
      line: finding.line,
      reason: 'Primary location of issue',
    });

    return fix;
  }

  private async buildPolicyOptions(finding: Finding): Promise<FindingExplanation['policy']> {
    const config = policyManager.getConfig();
    const currentSeverity = config.rules[finding.ruleId]?.severity || 'error';

    const policy: FindingExplanation['policy'] = {
      currentSeverity,
      canAllowlist: true,
      canDowngrade: currentSeverity !== 'off',
      canIgnore: true,
      allowlistOptions: [],
    };

    // Generate allowlist options based on finding type
    if (finding.evidence.request?.url) {
      const url = new URL(finding.evidence.request.url);
      policy.allowlistOptions.push({
        type: 'domain',
        value: url.hostname,
        preview: `allowlist.domains += "${url.hostname}"`,
      });
    }

    // Path-based allowlist
    policy.allowlistOptions.push({
      type: 'path',
      value: finding.file,
      preview: `allowlist.paths += "${finding.file}"`,
    });

    // Directory-based allowlist
    const dir = path.dirname(finding.file);
    if (dir !== '.') {
      policy.allowlistOptions.push({
        type: 'path',
        value: `${dir}/*`,
        preview: `allowlist.paths += "${dir}/*"`,
      });
    }

    return policy;
  }

  formatExplanation(explanation: FindingExplanation): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(`Finding: ${explanation.why.ruleName}`);
    lines.push('='.repeat(50));
    lines.push('');
    
    // Why section
    lines.push('WHY');
    lines.push('-'.repeat(30));
    lines.push(`Rule: ${explanation.why.ruleId}`);
    lines.push(`Category: ${explanation.why.category}`);
    lines.push(`Severity: ${explanation.why.severity.toUpperCase()}`);
    lines.push('');
    lines.push(explanation.why.description);
    lines.push('');
    lines.push(`Trigger: ${explanation.why.triggerCondition}`);
    lines.push('');
    
    // Evidence section
    lines.push('EVIDENCE');
    lines.push('-'.repeat(30));
    lines.push(`Type: ${explanation.evidence.type}`);
    lines.push(explanation.evidence.summary);
    if (explanation.evidence.matchedPattern) {
      lines.push(`Matched: ${explanation.evidence.matchedPattern} = "${explanation.evidence.matchedValue}"`);
    }
    lines.push('');
    
    // Trace section
    lines.push('TRACE');
    lines.push('-'.repeat(30));
    for (const step of explanation.trace.steps) {
      const marker = step.isRoot ? '>> ' : '   ';
      lines.push(`${marker}${step.file}:${step.line}`);
    }
    if (explanation.trace.rootCause) {
      lines.push('');
      lines.push(`Root cause: ${explanation.trace.rootCause.description}`);
    }
    lines.push('');
    
    // Fix section
    lines.push('FIX');
    lines.push('-'.repeat(30));
    lines.push(explanation.fix.suggestion);
    lines.push('');
    lines.push('Steps:');
    for (let i = 0; i < explanation.fix.steps.length; i++) {
      lines.push(`  ${i + 1}. ${explanation.fix.steps[i]}`);
    }
    if (explanation.fix.codeChange) {
      lines.push('');
      lines.push('Suggested change:');
      lines.push(`  Before: ${explanation.fix.codeChange.before}`);
      lines.push(`  After:  ${explanation.fix.codeChange.after}`);
    }
    lines.push('');
    
    // Policy section
    lines.push('POLICY');
    lines.push('-'.repeat(30));
    lines.push(`Current severity: ${explanation.policy.currentSeverity}`);
    if (explanation.policy.allowlistOptions.length > 0) {
      lines.push('');
      lines.push('Allowlist options:');
      for (const opt of explanation.policy.allowlistOptions) {
        lines.push(`  - ${opt.type}: ${opt.preview}`);
      }
    }
    
    return lines.join('\n');
  }
}

export const findingExplainer = new FindingExplainer();
