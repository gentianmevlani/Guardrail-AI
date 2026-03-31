import {
  ContentPolicyRule,
  ContentPolicyResult,
  ContentPolicyViolation,
  ContentCategory,
} from '@guardrail/core';

/**
 * Content Policy Filter — Input Guardrail
 *
 * Filters and validates user input against configurable content policies.
 * Blocks prompt injections, jailbreaks, malicious queries, harmful content,
 * and policy violations before they reach the LLM.
 */
export class ContentPolicyFilter {
  private rules: Map<string, ContentPolicyRule> = new Map();
  private readonly defaultRules: ContentPolicyRule[];

  constructor() {
    this.defaultRules = this.buildDefaultRules();
    for (const rule of this.defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Evaluate input against all active content policies
   */
  async evaluate(content: string): Promise<ContentPolicyResult> {
    const startTime = Date.now();
    const violations: ContentPolicyViolation[] = [];
    const categories = new Set<ContentCategory>();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const ruleViolations = this.evaluateRule(rule, content);
      for (const v of ruleViolations) {
        violations.push(v);
        categories.add(v.category);
      }
    }

    const riskScore = this.calculateRiskScore(violations);
    const allowed = violations.filter(
      (v) => v.severity === 'critical' || v.severity === 'high'
    ).length === 0;

    let sanitizedContent: string | undefined;
    if (!allowed && violations.some((v) => v.recommendation === 'sanitize')) {
      sanitizedContent = this.sanitize(content, violations);
    }

    return {
      allowed,
      violations,
      sanitizedContent,
      riskScore,
      categories: Array.from(categories),
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Add a custom content policy rule
   */
  addRule(rule: ContentPolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a content policy rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all active rules
   */
  getActiveRules(): ContentPolicyRule[] {
    return Array.from(this.rules.values()).filter((r) => r.enabled);
  }

  private evaluateRule(
    rule: ContentPolicyRule,
    content: string
  ): ContentPolicyViolation[] {
    const violations: ContentPolicyViolation[] = [];
    const lowerContent = content.toLowerCase();

    // Pattern-based matching
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'gi');
          let match: RegExpExecArray | null;
          while ((match = regex.exec(content)) !== null) {
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              description: `Pattern match: ${rule.description}`,
              matchedContent: match[0],
              location: { start: match.index, end: match.index + match[0].length },
              recommendation: this.getRecommendation(rule.severity),
            });
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }

    // Keyword-based matching
    if (rule.keywords) {
      for (const keyword of rule.keywords) {
        const idx = lowerContent.indexOf(keyword.toLowerCase());
        if (idx !== -1) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            description: `Keyword match: ${rule.description}`,
            matchedContent: keyword,
            location: { start: idx, end: idx + keyword.length },
            recommendation: this.getRecommendation(rule.severity),
          });
        }
      }
    }

    // Custom check function
    if (rule.customCheck && rule.customCheck(content)) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        severity: rule.severity,
        description: rule.description,
        recommendation: this.getRecommendation(rule.severity),
      });
    }

    return violations;
  }

  private getRecommendation(
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): 'allow' | 'sanitize' | 'block' | 'review' {
    switch (severity) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'review';
      case 'low': return 'sanitize';
    }
  }

  private calculateRiskScore(violations: ContentPolicyViolation[]): number {
    if (violations.length === 0) return 0;

    const severityWeights = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.2 };
    let totalWeight = 0;
    for (const v of violations) {
      totalWeight += severityWeights[v.severity];
    }
    return Math.min(1.0, totalWeight / 3);
  }

  private sanitize(
    content: string,
    violations: ContentPolicyViolation[]
  ): string {
    let sanitized = content;
    // Sort violations by location (reverse) to avoid offset issues
    const located = violations
      .filter((v) => v.location && v.matchedContent)
      .sort((a, b) => (b.location!.start - a.location!.start));

    for (const v of located) {
      if (v.location && v.matchedContent) {
        sanitized =
          sanitized.slice(0, v.location.start) +
          '[REDACTED]' +
          sanitized.slice(v.location.end);
      }
    }

    return sanitized;
  }

  private buildDefaultRules(): ContentPolicyRule[] {
    return [
      {
        id: 'CPF-001',
        name: 'Prompt Injection — Role Override',
        description: 'Detects attempts to override system role or instructions',
        category: 'prompt_injection',
        enabled: true,
        severity: 'critical',
        patterns: [
          'ignore (?:all |any )?(?:previous|prior|above|earlier) (?:instructions|prompts|rules|directions)',
          'you are now (?:a |an )?(?:different|new|my)',
          'forget (?:all |any )?(?:previous|prior|your) (?:instructions|rules|context)',
          'disregard (?:all |any )?(?:previous|prior|system) (?:instructions|prompts)',
          'override (?:your |the )?(?:system|safety|content) (?:prompt|filter|policy)',
          'new (?:instruction|directive|role|persona):\\s',
          'act as (?:if |though )?you (?:are|were) (?:not |no longer )?(?:bound|restricted|limited)',
        ],
      },
      {
        id: 'CPF-002',
        name: 'Prompt Injection — Delimiter Abuse',
        description: 'Detects delimiter-based injection attacks',
        category: 'prompt_injection',
        enabled: true,
        severity: 'high',
        patterns: [
          '```\\s*system',
          '\\[INST\\]',
          '\\[/INST\\]',
          '<\\|im_start\\|>',
          '<\\|im_end\\|>',
          '<<SYS>>',
          '<</SYS>>',
          'SYSTEM:\\s',
          'Human:\\s.*\\nAssistant:',
        ],
      },
      {
        id: 'CPF-003',
        name: 'Jailbreak — DAN-style',
        description: 'Detects Do Anything Now and similar jailbreak patterns',
        category: 'jailbreak',
        enabled: true,
        severity: 'critical',
        patterns: [
          'do anything now',
          'DAN mode',
          'jailbreak(?:d|ing)?',
          'developer mode (?:enabled|activated|on)',
          'hypothetical(?:ly)?.*(?:no|without) (?:restrictions|limits|filters|rules)',
          'pretend (?:you |that )?(?:have no|don.t have|are free from) (?:restrictions|limits|rules|guidelines)',
          'in (?:a |an )?(?:unrestricted|unfiltered|uncensored) (?:mode|way|manner)',
        ],
      },
      {
        id: 'CPF-004',
        name: 'Jailbreak — Roleplay Escape',
        description: 'Detects roleplay-based bypass attempts',
        category: 'jailbreak',
        enabled: true,
        severity: 'high',
        patterns: [
          'roleplay as (?:a |an )?(?:evil|malicious|unrestricted|unethical)',
          'character (?:who|that) (?:has no|ignores|breaks) (?:rules|restrictions|limits)',
          'fictional (?:scenario|world|universe) where (?:there are no|all) (?:rules|laws|restrictions)',
          'imagine (?:you are|a world) (?:without|where there are no) (?:rules|restrictions|ethics)',
        ],
      },
      {
        id: 'CPF-005',
        name: 'Malicious Query — Harmful Intent',
        description: 'Detects queries seeking to cause harm',
        category: 'malicious_query',
        enabled: true,
        severity: 'critical',
        keywords: [
          'how to make a bomb',
          'how to hack into',
          'how to create malware',
          'how to synthesize drugs',
          'how to make poison',
          'how to pick a lock',
          'how to counterfeit',
          'how to launder money',
          'how to make weapons',
          'exploit vulnerability',
        ],
      },
      {
        id: 'CPF-006',
        name: 'Harmful Content — Violence & Threats',
        description: 'Detects violent or threatening language',
        category: 'harmful_content',
        enabled: true,
        severity: 'high',
        patterns: [
          '(?:i will|i.m going to|gonna) (?:kill|hurt|harm|attack|destroy)',
          'threat(?:en|ening)?.*(?:violence|harm|death)',
          '(?:bomb|shoot|stab|poison).*(?:school|church|mosque|synagogue|government|building)',
        ],
      },
      {
        id: 'CPF-007',
        name: 'Policy Violation — Data Exfiltration',
        description: 'Detects attempts to extract system data or training data',
        category: 'policy_violation',
        enabled: true,
        severity: 'high',
        patterns: [
          'reveal (?:your |the )?(?:system|initial|original|hidden) (?:prompt|instructions|message)',
          'show (?:me )?(?:your |the )?(?:system|hidden|internal) (?:prompt|instructions|configuration)',
          'what (?:are|were) (?:your |the )?(?:original|system|initial) (?:instructions|prompt|rules)',
          'repeat (?:your |the )?(?:system|initial) (?:prompt|instructions|message) (?:verbatim|word for word|exactly)',
          'output (?:your |the )?(?:training|system) (?:data|prompt|instructions)',
          'print (?:your |the )?(?:system|initial) (?:prompt|instructions)',
        ],
      },
      {
        id: 'CPF-008',
        name: 'Prompt Injection — Encoding Evasion',
        description: 'Detects base64/hex/unicode encoded injection attempts',
        category: 'prompt_injection',
        enabled: true,
        severity: 'high',
        customCheck: (content: string) => {
          // Detect base64-encoded suspicious content
          const b64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
          const matches = content.match(b64Pattern) || [];
          for (const match of matches) {
            try {
              const decoded = Buffer.from(match, 'base64').toString('utf-8');
              if (/ignore|system|prompt|instruction|override/i.test(decoded)) {
                return true;
              }
            } catch { /* not valid base64 */ }
          }

          // Detect hex-encoded suspicious content
          const hexPattern = /(?:0x|\\x)[0-9a-fA-F]{2}(?:\s*(?:0x|\\x)[0-9a-fA-F]{2}){5,}/g;
          if (hexPattern.test(content)) return true;

          // Detect unicode escape sequences
          const unicodePattern = /(?:\\u[0-9a-fA-F]{4}){5,}/g;
          if (unicodePattern.test(content)) return true;

          return false;
        },
      },
      {
        id: 'CPF-009',
        name: 'Off-Topic — Irrelevant Request',
        description: 'Detects requests clearly outside operational scope',
        category: 'off_topic',
        enabled: true,
        severity: 'low',
        patterns: [
          'write (?:me )?(?:a |an )?(?:essay|poem|story|song|novel|script) about',
          'what is (?:the meaning|your opinion) (?:of life|on politics|on religion)',
          'tell me (?:a |an )?(?:joke|story|fairy tale|riddle)',
        ],
      },
    ];
  }
}

export const contentPolicyFilter = new ContentPolicyFilter();
