import {
  PolicyComplianceRule,
  PolicyComplianceResult,
  PolicyCheckResult,
} from '@guardrail/core';

/**
 * Policy Compliance Checker — Output Guardrail
 *
 * Checks LLM outputs against configurable organizational policies.
 * Covers content policies, format requirements, scope restrictions,
 * attribution rules, and legal compliance.
 */
export class PolicyComplianceChecker {
  private rules: Map<string, PolicyComplianceRule> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Check output against all active compliance rules
   */
  async check(
    output: string,
    context?: Record<string, unknown>
  ): Promise<PolicyComplianceResult> {
    const results: PolicyComplianceResult['results'] = [];
    const blockedReasons: string[] = [];
    let totalScore = 0;
    let ruleCount = 0;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      ruleCount++;
      const result = rule.check(output, context);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        result,
      });

      totalScore += result.confidence;

      if (!result.compliant && (rule.severity === 'critical' || rule.severity === 'high')) {
        blockedReasons.push(`${rule.name}: ${result.violations.join('; ')}`);
      }
    }

    const overallScore = ruleCount > 0 ? totalScore / ruleCount : 1.0;
    const compliant = blockedReasons.length === 0;

    return {
      compliant,
      results,
      overallScore,
      blockedReasons,
    };
  }

  /**
   * Add a custom compliance rule
   */
  addRule(rule: PolicyComplianceRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a compliance rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = enabled;
  }

  /**
   * Get all rules
   */
  getRules(): PolicyComplianceRule[] {
    return Array.from(this.rules.values());
  }

  private registerDefaultRules(): void {
    // No medical/legal/financial advice without disclaimers
    this.addRule({
      id: 'POL-001',
      name: 'Professional Advice Disclaimer',
      description: 'Ensures professional advice includes appropriate disclaimers',
      type: 'legal',
      enabled: true,
      severity: 'high',
      check: (output: string): PolicyCheckResult => {
        const advicePatterns = [
          /(?:you should|I recommend|I advise|my recommendation is).*(?:medication|treatment|therapy|diagnosis|prescription)/gi,
          /(?:you should|I recommend|I advise).*(?:invest|buy stock|sell|portfolio|financial)/gi,
          /(?:you should|I recommend|I advise).*(?:sue|legal action|lawsuit|court|attorney|lawyer)/gi,
        ];

        const disclaimerPatterns = [
          /(?:not (?:a |an )?(?:medical|legal|financial) (?:advice|professional|advisor))/gi,
          /(?:consult (?:a |an |your )?(?:doctor|physician|lawyer|attorney|financial advisor|professional))/gi,
          /(?:this is (?:not|for informational purposes|general information))/gi,
          /(?:disclaimer|not professional advice|seek professional)/gi,
        ];

        const hasAdvice = advicePatterns.some((p) => p.test(output));
        const hasDisclaimer = disclaimerPatterns.some((p) => p.test(output));

        if (hasAdvice && !hasDisclaimer) {
          return {
            compliant: false,
            violations: ['Output contains professional advice without appropriate disclaimers'],
            suggestions: ['Add a disclaimer such as "This is not professional advice. Please consult a qualified professional."'],
            confidence: 0.85,
          };
        }

        return { compliant: true, violations: [], suggestions: [], confidence: 1.0 };
      },
    });

    // No copyrighted content reproduction
    this.addRule({
      id: 'POL-002',
      name: 'Copyright Protection',
      description: 'Detects potential reproduction of copyrighted material',
      type: 'legal',
      enabled: true,
      severity: 'high',
      check: (output: string): PolicyCheckResult => {
        const violations: string[] = [];
        const suggestions: string[] = [];

        // Check for verbatim song lyrics indicators
        if (/(?:lyrics|verse|chorus|song)[\s:]+["'][\s\S]{100,}["']/gi.test(output)) {
          violations.push('Potential reproduction of copyrighted song lyrics');
          suggestions.push('Paraphrase or summarize the content instead of reproducing verbatim');
        }

        // Check for book passages
        if (/(?:chapter|page|paragraph)\s+\d+[\s:]+["'][\s\S]{200,}["']/gi.test(output)) {
          violations.push('Potential reproduction of copyrighted book content');
          suggestions.push('Summarize the content and cite the source');
        }

        return {
          compliant: violations.length === 0,
          violations,
          suggestions,
          confidence: violations.length > 0 ? 0.7 : 1.0,
        };
      },
    });

    // Response length limits
    this.addRule({
      id: 'POL-003',
      name: 'Response Length Policy',
      description: 'Ensures responses stay within configured length limits',
      type: 'format',
      enabled: true,
      severity: 'medium',
      check: (output: string, context?: Record<string, unknown>): PolicyCheckResult => {
        const maxLength = (context?.['maxResponseLength'] as number) || 50_000;
        const maxLines = (context?.['maxResponseLines'] as number) || 1_000;
        const violations: string[] = [];

        if (output.length > maxLength) {
          violations.push(`Response exceeds maximum length (${output.length}/${maxLength} chars)`);
        }

        const lines = output.split('\n').length;
        if (lines > maxLines) {
          violations.push(`Response exceeds maximum lines (${lines}/${maxLines})`);
        }

        return {
          compliant: violations.length === 0,
          violations,
          suggestions: violations.length > 0 ? ['Truncate or summarize the response'] : [],
          confidence: 1.0,
        };
      },
    });

    // No impersonation
    this.addRule({
      id: 'POL-004',
      name: 'Impersonation Prevention',
      description: 'Prevents the model from impersonating real people or organizations',
      type: 'content',
      enabled: true,
      severity: 'high',
      check: (output: string): PolicyCheckResult => {
        const impersonationPatterns = [
          /(?:I am|this is)\s+(?:the\s+)?(?:CEO|president|founder|director)\s+(?:of|at)\s+\w+/gi,
          /(?:speaking|writing)\s+(?:on behalf of|as a representative of|as)\s+(?:Google|Apple|Microsoft|Amazon|Meta|OpenAI|Anthropic)/gi,
          /(?:as|I am)\s+(?:Dr\.|Doctor|Professor|Judge|Senator|President)\s+[A-Z][a-z]+/gi,
        ];

        const violations: string[] = [];
        for (const pattern of impersonationPatterns) {
          if (pattern.test(output)) {
            violations.push('Potential impersonation of a real person or organization detected');
            break;
          }
        }

        return {
          compliant: violations.length === 0,
          violations,
          suggestions: violations.length > 0
            ? ['Remove impersonation and clearly identify as an AI assistant']
            : [],
          confidence: violations.length > 0 ? 0.75 : 1.0,
        };
      },
    });

    // Attribution requirements
    this.addRule({
      id: 'POL-005',
      name: 'Source Attribution',
      description: 'Ensures factual claims include source attribution when possible',
      type: 'attribution',
      enabled: true,
      severity: 'low',
      check: (output: string, context?: Record<string, unknown>): PolicyCheckResult => {
        const requireAttribution = context?.['requireAttribution'] as boolean;
        if (!requireAttribution) {
          return { compliant: true, violations: [], suggestions: [], confidence: 1.0 };
        }

        // Check for factual claims without citations
        const factualPatterns = [
          /(?:studies show|research indicates|according to|data suggests|statistics show|experts say)/gi,
          /(?:in \d{4},|since \d{4}|a \d{4} study)/gi,
          /(?:\d+%|\d+ percent) of (?:people|users|companies|Americans|Europeans)/gi,
        ];

        const citationPatterns = [
          /\[(?:source|\d+|citation)\]/gi,
          /(?:Source:|Reference:|Citation:|According to\s+\w+(?:\s+\w+)?(?:,|\s+\())/gi,
          /\((?:\d{4}|\w+\s+et\s+al\.?)\)/gi,
        ];

        const hasClaims = factualPatterns.some((p) => p.test(output));
        const hasCitations = citationPatterns.some((p) => p.test(output));

        if (hasClaims && !hasCitations) {
          return {
            compliant: false,
            violations: ['Factual claims detected without source attribution'],
            suggestions: ['Add citations or sources for factual claims'],
            confidence: 0.7,
          };
        }

        return { compliant: true, violations: [], suggestions: [], confidence: 1.0 };
      },
    });

    // Scope restriction
    this.addRule({
      id: 'POL-006',
      name: 'Scope Restriction',
      description: 'Ensures responses stay within configured operational scope',
      type: 'scope',
      enabled: true,
      severity: 'medium',
      check: (output: string, context?: Record<string, unknown>): PolicyCheckResult => {
        const blockedTopicKeywords = context?.['blockedTopicKeywords'] as string[] | undefined;
        if (!blockedTopicKeywords || blockedTopicKeywords.length === 0) {
          return { compliant: true, violations: [], suggestions: [], confidence: 1.0 };
        }

        const violations: string[] = [];
        const lower = output.toLowerCase();
        for (const keyword of blockedTopicKeywords) {
          if (lower.includes(keyword.toLowerCase())) {
            violations.push(`Response contains blocked topic keyword: "${keyword}"`);
          }
        }

        return {
          compliant: violations.length === 0,
          violations,
          suggestions: violations.length > 0 ? ['Remove content related to blocked topics'] : [],
          confidence: 0.9,
        };
      },
    });
  }
}

export const policyComplianceChecker = new PolicyComplianceChecker();
