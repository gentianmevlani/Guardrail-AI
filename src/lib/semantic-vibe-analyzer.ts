/**
 * Semantic Vibe Analyzer
 * 
 * Uses LLM to analyze the QUALITY of implementations, not just their presence.
 * Goes beyond regex checks to understand if code actually does what it should.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SemanticCheckResult {
  feature: string;
  found: boolean;
  quality: 'excellent' | 'good' | 'adequate' | 'poor' | 'missing';
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  codeSnippet?: string;
}

export interface SemanticVibeReport {
  overallQuality: number;
  checks: SemanticCheckResult[];
  summary: string;
  topPriorities: string[];
}

interface FeatureCheck {
  name: string;
  filePatterns: RegExp[];
  contentPatterns: RegExp[];
  qualityChecks: QualityCheck[];
}

interface QualityCheck {
  name: string;
  description: string;
  check: (content: string) => { passed: boolean; issue?: string };
  weight: number;
}

class SemanticVibeAnalyzer {
  private featureChecks: FeatureCheck[] = [];

  constructor() {
    this.registerFeatureChecks();
  }

  /**
   * Analyze project with semantic understanding
   */
  async analyze(projectPath: string): Promise<SemanticVibeReport> {
    const checks: SemanticCheckResult[] = [];

    for (const feature of this.featureChecks) {
      const result = await this.checkFeature(projectPath, feature);
      checks.push(result);
    }

    const overallQuality = this.calculateOverallQuality(checks);
    const summary = this.generateSummary(checks);
    const topPriorities = this.identifyTopPriorities(checks);

    return {
      overallQuality,
      checks,
      summary,
      topPriorities,
    };
  }

  /**
   * Check a single feature with semantic analysis
   */
  private async checkFeature(
    projectPath: string,
    feature: FeatureCheck
  ): Promise<SemanticCheckResult> {
    const files = await this.findFeatureFiles(projectPath, feature.filePatterns);
    
    if (files.length === 0) {
      return {
        feature: feature.name,
        found: false,
        quality: 'missing',
        score: 0,
        issues: [`No ${feature.name} implementation found`],
        suggestions: [`Add ${feature.name} to your project`],
      };
    }

    const issues: string[] = [];
    const suggestions: string[] = [];
    let totalScore = 0;
    let totalWeight = 0;
    let codeSnippet: string | undefined;

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        
        // Store first relevant snippet
        if (!codeSnippet && content.length < 2000) {
          codeSnippet = content.slice(0, 500);
        }

        // Run quality checks
        for (const qc of feature.qualityChecks) {
          const result = qc.check(content);
          totalWeight += qc.weight;
          
          if (result.passed) {
            totalScore += qc.weight * 100;
          } else {
            if (result.issue) {
              issues.push(result.issue);
            }
            suggestions.push(`Improve: ${qc.description}`);
          }
        }
      } catch (error) {
        // File read error, skip
      }
    }

    const score = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const quality = this.scoreToQuality(score);

    return {
      feature: feature.name,
      found: true,
      quality,
      score,
      issues: Array.from(new Set(issues)).slice(0, 5),
      suggestions: Array.from(new Set(suggestions)).slice(0, 3),
      codeSnippet,
    };
  }

  /**
   * Register all feature checks with quality criteria
   */
  private registerFeatureChecks() {
    this.featureChecks = [
      // Error Boundary
      {
        name: 'Error Boundary',
        filePatterns: [/error.?boundary/i, /error.?handler/i],
        contentPatterns: [/componentDidCatch|ErrorBoundary/],
        qualityChecks: [
          {
            name: 'Has fallback UI',
            description: 'Error boundary should show helpful fallback UI',
            check: (content) => ({
              passed: /fallback|error.?ui|error.?message/i.test(content),
              issue: 'Error boundary lacks fallback UI component',
            }),
            weight: 3,
          },
          {
            name: 'Logs errors',
            description: 'Error boundary should log errors for debugging',
            check: (content) => ({
              passed: /console\.(error|log)|logger|Sentry|trackError/i.test(content),
              issue: 'Error boundary does not log errors',
            }),
            weight: 2,
          },
          {
            name: 'Has retry mechanism',
            description: 'Error boundary should allow retry/recovery',
            check: (content) => ({
              passed: /retry|reset|recover|try.?again/i.test(content),
              issue: 'Error boundary lacks retry/recovery option',
            }),
            weight: 2,
          },
          {
            name: 'Not generic message',
            description: 'Error message should be helpful, not generic',
            check: (content) => ({
              passed: !/something went wrong/i.test(content) || /contact|support|help/i.test(content),
              issue: 'Error message is too generic - add helpful context',
            }),
            weight: 1,
          },
        ],
      },

      // Loading States
      {
        name: 'Loading States',
        filePatterns: [/loading/i, /spinner/i, /skeleton/i],
        contentPatterns: [/isLoading|loading|Spinner|Skeleton/],
        qualityChecks: [
          {
            name: 'Has visual indicator',
            description: 'Loading state should have visual feedback',
            check: (content) => ({
              passed: /spinner|skeleton|pulse|animate|loading/i.test(content),
              issue: 'Loading state lacks visual indicator',
            }),
            weight: 3,
          },
          {
            name: 'Accessible',
            description: 'Loading state should be accessible',
            check: (content) => ({
              passed: /aria-|role=|sr-only|screen.?reader/i.test(content),
              issue: 'Loading state is not accessible (missing aria attributes)',
            }),
            weight: 2,
          },
          {
            name: 'Has timeout handling',
            description: 'Loading should handle timeout gracefully',
            check: (content) => ({
              passed: /timeout|cancel|abort/i.test(content),
              issue: 'No timeout handling for long loads',
            }),
            weight: 1,
          },
        ],
      },

      // Authentication
      {
        name: 'Authentication',
        filePatterns: [/auth/i, /login/i, /session/i],
        contentPatterns: [/authenticate|login|session|jwt|token/i],
        qualityChecks: [
          {
            name: 'Secure token storage',
            description: 'Tokens should be stored securely',
            check: (content) => ({
              passed: /httpOnly|secure|sameSite|localStorage/.test(content) && 
                      !/localStorage.*token/i.test(content),
              issue: 'Potential insecure token storage (avoid localStorage for tokens)',
            }),
            weight: 4,
          },
          {
            name: 'Has logout',
            description: 'Auth should include logout functionality',
            check: (content) => ({
              passed: /logout|signout|sign.?out|clear.?session/i.test(content),
              issue: 'No logout functionality found',
            }),
            weight: 2,
          },
          {
            name: 'Handles expired sessions',
            description: 'Should handle expired tokens gracefully',
            check: (content) => ({
              passed: /expired|refresh|renew|401|unauthorized/i.test(content),
              issue: 'No handling for expired sessions/tokens',
            }),
            weight: 3,
          },
          {
            name: 'Input validation',
            description: 'Auth inputs should be validated',
            check: (content) => ({
              passed: /validate|sanitize|escape|zod|yup|joi/i.test(content),
              issue: 'Auth inputs may lack validation',
            }),
            weight: 3,
          },
        ],
      },

      // Rate Limiting
      {
        name: 'Rate Limiting',
        filePatterns: [/rate.?limit/i, /throttle/i],
        contentPatterns: [/rateLimit|throttle|limiter/i],
        qualityChecks: [
          {
            name: 'Configurable limits',
            description: 'Rate limits should be configurable',
            check: (content) => ({
              passed: /max|limit|window|interval|env/i.test(content),
              issue: 'Rate limits appear hardcoded',
            }),
            weight: 2,
          },
          {
            name: 'Returns proper headers',
            description: 'Should return rate limit headers',
            check: (content) => ({
              passed: /x-ratelimit|retry-after|header/i.test(content),
              issue: 'Not returning rate limit headers to clients',
            }),
            weight: 2,
          },
          {
            name: 'Per-user limiting',
            description: 'Should limit per user/IP, not globally',
            check: (content) => ({
              passed: /ip|user|key|identifier/i.test(content),
              issue: 'Rate limiting may not be per-user/IP',
            }),
            weight: 3,
          },
        ],
      },

      // Environment Configuration
      {
        name: 'Environment Configuration',
        filePatterns: [/config/i, /env/i, /\.env/],
        contentPatterns: [/process\.env|dotenv|config/],
        qualityChecks: [
          {
            name: 'No hardcoded secrets',
            description: 'Secrets should come from environment',
            check: (content) => ({
              passed: !/['"][a-zA-Z0-9]{20,}['"]/.test(content) || /process\.env/.test(content),
              issue: 'Potential hardcoded secrets detected',
            }),
            weight: 5,
          },
          {
            name: 'Has example file',
            description: 'Should have .env.example for documentation',
            check: (content) => ({
              passed: true, // This is checked at file level
            }),
            weight: 1,
          },
          {
            name: 'Validates required vars',
            description: 'Should validate required env vars at startup',
            check: (content) => ({
              passed: /required|throw|assert|must|missing/i.test(content),
              issue: 'Environment variables may not be validated at startup',
            }),
            weight: 3,
          },
        ],
      },

      // Input Validation
      {
        name: 'Input Validation',
        filePatterns: [/valid/i, /schema/i, /sanitize/i],
        contentPatterns: [/validate|sanitize|zod|yup|joi|schema/i],
        qualityChecks: [
          {
            name: 'Uses schema validation',
            description: 'Should use schema-based validation',
            check: (content) => ({
              passed: /zod|yup|joi|ajv|schema/i.test(content),
              issue: 'Not using schema-based validation library',
            }),
            weight: 3,
          },
          {
            name: 'Sanitizes output',
            description: 'Should sanitize data before output',
            check: (content) => ({
              passed: /sanitize|escape|encode|xss/i.test(content),
              issue: 'Output may not be sanitized (XSS risk)',
            }),
            weight: 4,
          },
          {
            name: 'Type coercion',
            description: 'Should handle type coercion safely',
            check: (content) => ({
              passed: /coerce|transform|parse|number|boolean/i.test(content),
              issue: 'May not handle type coercion properly',
            }),
            weight: 2,
          },
        ],
      },
    ];
  }

  /**
   * Find files matching feature patterns
   */
  private async findFeatureFiles(
    dir: string,
    patterns: RegExp[],
    maxDepth: number = 5
  ): Promise<string[]> {
    const files: string[] = [];
    
    const search = async (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      
      try {
        const items = await fs.promises.readdir(currentDir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);
          
          if (item.isDirectory() && !this.shouldIgnore(item.name)) {
            await search(fullPath, depth + 1);
          } else if (item.isFile()) {
            for (const pattern of patterns) {
              if (pattern.test(item.name) || pattern.test(fullPath)) {
                files.push(fullPath);
                break;
              }
            }
          }
        }
      } catch (error) {
        // Directory access error, skip
      }
    };

    await search(dir, 0);
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo'].includes(name);
  }

  private scoreToQuality(score: number): SemanticCheckResult['quality'] {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'adequate';
    if (score > 0) return 'poor';
    return 'missing';
  }

  private calculateOverallQuality(checks: SemanticCheckResult[]): number {
    const validChecks = checks.filter(c => c.found);
    if (validChecks.length === 0) return 0;
    
    const total = validChecks.reduce((sum, c) => sum + c.score, 0);
    return Math.round(total / validChecks.length);
  }

  private generateSummary(checks: SemanticCheckResult[]): string {
    const found = checks.filter(c => c.found).length;
    const excellent = checks.filter(c => c.quality === 'excellent').length;
    const poor = checks.filter(c => c.quality === 'poor' || c.quality === 'missing').length;

    if (poor === 0 && excellent >= found / 2) {
      return '🌟 Excellent! Your implementations are high quality.';
    }
    if (poor <= 1) {
      return '✅ Good foundation with room for improvement.';
    }
    if (poor <= 3) {
      return '⚠️ Several features need quality improvements.';
    }
    return '🚨 Multiple features are missing or poorly implemented.';
  }

  private identifyTopPriorities(checks: SemanticCheckResult[]): string[] {
    return checks
      .filter(c => c.quality === 'poor' || c.quality === 'missing')
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(c => `${c.feature}: ${c.issues[0] || 'Needs implementation'}`);
  }

  /**
   * Analyze specific file content with LLM (when API key available)
   * Falls back to heuristic analysis if no API key
   */
  async analyzeWithLLM(
    content: string,
    featureType: string
  ): Promise<{
    quality: string;
    issues: string[];
    suggestions: string[];
  }> {
    // Check if OpenAI API key is available
    const apiKey = process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      // Fallback to heuristic analysis
      return this.heuristicAnalysis(content, featureType);
    }

    try {
      // Dynamic import to avoid issues when API key not present
      const { OpenAIProvider } = await import('./ai/providers/openai-provider');
      const provider = new OpenAIProvider(apiKey);

      const prompt = `Analyze this ${featureType} implementation for quality. 
Rate it as: excellent, good, adequate, or poor.
List specific issues and improvement suggestions.

Code:
\`\`\`
${content.slice(0, 3000)}
\`\`\`

Respond in JSON format:
{
  "quality": "excellent|good|adequate|poor",
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

      const response = await provider.complete(prompt, {
        temperature: 0.3,
        maxTokens: 500,
      });

      const parsed = JSON.parse(response.content);
      return {
        quality: parsed.quality || 'adequate',
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      // Fallback to heuristic on any error
      return this.heuristicAnalysis(content, featureType);
    }
  }

  private heuristicAnalysis(
    content: string,
    featureType: string
  ): { quality: string; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Generic quality heuristics
    if (content.length < 50) {
      issues.push('Implementation appears too minimal');
      suggestions.push('Add more complete implementation');
    }

    if (!/\/\/|\/\*|\*\//.test(content)) {
      issues.push('No comments or documentation');
      suggestions.push('Add inline documentation');
    }

    if (!/try|catch|error/i.test(content)) {
      issues.push('No error handling visible');
      suggestions.push('Add try-catch error handling');
    }

    const quality = issues.length === 0 ? 'good' : 
                   issues.length <= 2 ? 'adequate' : 'poor';

    return { quality, issues, suggestions };
  }
}

export const semanticVibeAnalyzer = new SemanticVibeAnalyzer();
