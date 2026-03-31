import {
  ToxicityCategory,
  ToxicityScanResult,
} from '@guardrail/core';

/**
 * Toxicity Scanner — Output Guardrail
 *
 * Scans LLM responses for toxic content including hate speech,
 * harassment, violence, profanity, discrimination, and misinformation
 * before responses are shown to the user.
 */
export class ToxicityScanner {
  private thresholds: Map<ToxicityCategory, number> = new Map();
  private categoryDetectors: Map<ToxicityCategory, ToxicityDetector[]> = new Map();

  constructor(options?: { globalThreshold?: number }) {
    const defaultThreshold = options?.globalThreshold ?? 0.5;
    this.initializeDefaults(defaultThreshold);
  }

  /**
   * Scan output for toxic content
   */
  async scan(content: string): Promise<ToxicityScanResult> {
    const startTime = Date.now();
    const categories: ToxicityScanResult['categories'] = [];
    let maxScore = 0;

    for (const [category, detectors] of this.categoryDetectors.entries()) {
      const threshold = this.thresholds.get(category) ?? 0.5;
      const { score, evidence } = this.evaluateCategory(content, detectors);
      const flagged = score >= threshold;

      if (score > maxScore) maxScore = score;

      categories.push({
        category,
        score,
        flagged,
        evidence,
      });
    }

    const isToxic = categories.some((c) => c.flagged);
    const recommendation = this.getRecommendation(maxScore, isToxic);

    return {
      isToxic,
      overallScore: maxScore,
      categories,
      recommendation,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Set threshold for a specific category
   */
  setThreshold(category: ToxicityCategory, threshold: number): void {
    this.thresholds.set(category, Math.max(0, Math.min(1, threshold)));
  }

  /**
   * Add a custom detector for a category
   */
  addDetector(category: ToxicityCategory, detector: ToxicityDetector): void {
    const existing = this.categoryDetectors.get(category) || [];
    existing.push(detector);
    this.categoryDetectors.set(category, existing);
  }

  private evaluateCategory(
    content: string,
    detectors: ToxicityDetector[]
  ): { score: number; evidence: string[] } {
    const evidence: string[] = [];
    let maxScore = 0;
    const lowerContent = content.toLowerCase();

    for (const detector of detectors) {
      // Pattern matching
      if (detector.patterns) {
        for (const pattern of detector.patterns) {
          try {
            const regex = new RegExp(pattern, 'gi');
            const matches = content.match(regex);
            if (matches) {
              const patternScore = Math.min(1.0, matches.length * detector.weight);
              if (patternScore > maxScore) maxScore = patternScore;
              evidence.push(...matches.slice(0, 3).map((m) => `Pattern: "${m}"`));
            }
          } catch { /* skip invalid regex */ }
        }
      }

      // Keyword matching with context analysis
      if (detector.keywords) {
        let keywordHits = 0;
        for (const keyword of detector.keywords) {
          if (lowerContent.includes(keyword.toLowerCase())) {
            keywordHits++;
            evidence.push(`Keyword: "${keyword}"`);
          }
        }
        if (keywordHits > 0) {
          const keywordScore = Math.min(1.0, (keywordHits / detector.keywords.length) * detector.weight * 2);
          if (keywordScore > maxScore) maxScore = keywordScore;
        }
      }

      // Heuristic scoring
      if (detector.heuristic) {
        const heuristicResult = detector.heuristic(content);
        if (heuristicResult.score > maxScore) {
          maxScore = heuristicResult.score;
        }
        if (heuristicResult.evidence) {
          evidence.push(...heuristicResult.evidence);
        }
      }
    }

    return { score: Math.min(1.0, maxScore), evidence: [...new Set(evidence)] };
  }

  private getRecommendation(
    score: number,
    isToxic: boolean
  ): 'allow' | 'filter' | 'block' | 'review' {
    if (!isToxic) return 'allow';
    if (score >= 0.9) return 'block';
    if (score >= 0.7) return 'review';
    return 'filter';
  }

  private initializeDefaults(globalThreshold: number): void {
    const allCategories: ToxicityCategory[] = [
      'hate_speech', 'harassment', 'sexual_content', 'violence',
      'self_harm', 'profanity', 'discrimination', 'misinformation',
    ];
    for (const cat of allCategories) {
      this.thresholds.set(cat, globalThreshold);
    }

    // Hate speech
    this.categoryDetectors.set('hate_speech', [{
      weight: 0.9,
      patterns: [
        '(?:all|every|those|these)\\s+(?:\\w+\\s+)?(?:people|persons|immigrants|refugees)\\s+(?:are|should)\\s+(?:bad|evil|terrible|removed|eliminated|deported)',
        '(?:racial|ethnic)\\s+(?:slur|epithet|insult)',
      ],
      keywords: [
        'racial superiority', 'ethnic cleansing', 'race war',
        'white power', 'master race', 'subhuman',
      ],
    }]);

    // Harassment
    this.categoryDetectors.set('harassment', [{
      weight: 0.8,
      patterns: [
        'you\\s+(?:are|\\w+)\\s+(?:stupid|idiot|worthless|pathetic|disgusting|ugly)',
        'kill\\s+yourself',
        'nobody\\s+(?:likes|loves|cares about)\\s+you',
        'you\\s+should\\s+(?:die|kill yourself|not exist)',
        'you\\s+deserve\\s+(?:to die|pain|suffering|nothing)',
      ],
      keywords: [
        'kill yourself', 'go die', 'worthless piece',
        'waste of space', 'nobody loves you',
      ],
    }]);

    // Sexual content
    this.categoryDetectors.set('sexual_content', [{
      weight: 0.85,
      patterns: [
        '(?:explicit|graphic)\\s+(?:sexual|erotic|pornographic)',
        '(?:sexual|intimate)\\s+(?:acts?|behavior|conduct)\\s+(?:with|involving)\\s+(?:minor|child|underage)',
      ],
      keywords: [
        'child pornography', 'sexual exploitation', 'csam',
        'underage sexual', 'child sexual',
      ],
    }]);

    // Violence
    this.categoryDetectors.set('violence', [{
      weight: 0.85,
      patterns: [
        '(?:step.by.step|detailed|specific)\\s+(?:instructions?|guide|tutorial|how.to)\\s+(?:for|to|on)\\s+(?:killing|murder|assault|bombing|shooting)',
        '(?:how to|ways to)\\s+(?:kill|murder|assassinate|poison|torture)',
        '(?:build|make|construct|assemble)\\s+(?:a |an )?(?:bomb|explosive|weapon|gun)',
      ],
      keywords: [
        'mass shooting', 'bomb instructions', 'murder plan',
        'terrorist attack', 'assassination',
      ],
    }]);

    // Self-harm
    this.categoryDetectors.set('self_harm', [{
      weight: 0.9,
      patterns: [
        '(?:how to|ways to|methods? (?:of|for))\\s+(?:commit suicide|kill yourself|end (?:your|my) life|self.harm|cut yourself)',
        '(?:best|easiest|most effective|painless)\\s+(?:way|method)\\s+to\\s+(?:die|kill|end)',
      ],
      keywords: [
        'suicide method', 'self-harm instructions', 'end my life',
        'how to cut yourself', 'overdose instructions',
      ],
    }]);

    // Profanity
    this.categoryDetectors.set('profanity', [{
      weight: 0.4,
      heuristic: (content: string) => {
        const profanityPatterns = [
          /\bf+u+c+k+\b/gi, /\bs+h+i+t+\b/gi, /\ba+s+s+h+o+l+e+\b/gi,
          /\bb+i+t+c+h+\b/gi, /\bd+a+m+n+\b/gi, /\bh+e+l+l+\b/gi,
        ];
        let hits = 0;
        const evidence: string[] = [];
        for (const p of profanityPatterns) {
          const matches = content.match(p);
          if (matches) {
            hits += matches.length;
            evidence.push(`Profanity detected (${matches.length} instances)`);
          }
        }
        return {
          score: Math.min(1.0, hits * 0.15),
          evidence: hits > 0 ? evidence : undefined,
        };
      },
    }]);

    // Discrimination
    this.categoryDetectors.set('discrimination', [{
      weight: 0.8,
      patterns: [
        '(?:women|females|girls)\\s+(?:are|should)\\s+(?:inferior|subordinate|not allowed|incapable|unable)',
        '(?:men|males|boys)\\s+(?:are|should)\\s+(?:superior|dominant|in charge)',
        '(?:disabled|handicapped)\\s+(?:people|persons)\\s+(?:are|should)\\s+(?:worthless|burdens?|useless)',
        '(?:homosexual|gay|lesbian|transgender|trans)\\s+(?:people|persons)\\s+(?:are|should)\\s+(?:sick|diseased|wrong|sinful|abnormal)',
      ],
      keywords: [
        'gender inferiority', 'racial discrimination', 'ableism',
        'homophobia', 'transphobia', 'xenophobia',
      ],
    }]);

    // Misinformation
    this.categoryDetectors.set('misinformation', [{
      weight: 0.6,
      heuristic: (content: string) => {
        const misinfoPatterns = [
          /the earth is flat/gi,
          /vaccines? (?:cause|causes) autism/gi,
          /(?:covid|coronavirus) is (?:a hoax|fake|not real)/gi,
          /climate change is (?:a hoax|fake|not real|a lie)/gi,
          /(?:5g|5G) (?:causes|spreads|created) (?:covid|cancer|radiation)/gi,
          /(?:chemtrails|chem trails) are (?:real|spraying)/gi,
          /the (?:moon landing|holocaust) (?:was|were|is) (?:faked?|a hoax|staged|didn.t happen|never happened)/gi,
        ];

        let hits = 0;
        const evidence: string[] = [];
        for (const p of misinfoPatterns) {
          if (p.test(content)) {
            hits++;
            evidence.push(`Potential misinformation: ${p.source}`);
          }
        }

        return {
          score: Math.min(1.0, hits * 0.4),
          evidence: hits > 0 ? evidence : undefined,
        };
      },
    }]);
  }
}

interface ToxicityDetector {
  weight: number;
  patterns?: string[];
  keywords?: string[];
  heuristic?: (content: string) => { score: number; evidence?: string[] };
}

export const toxicityScanner = new ToxicityScanner();
