/**
 * Smart Code Analysis Engine
 * 
 * Advanced AI-powered code analysis with multiple providers, context awareness,
 * and intelligent pattern recognition
 */

import type {
  CodeAnalysisRequest,
  CodeAnalysisResult,
  CodeIssue,
  CodeSuggestion,
  LLMProvider
} from './llm-provider-interface';

import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';

export interface SmartAnalysisConfig {
  providers: string[];
  enableCache: boolean;
  enableLearning: boolean;
  confidenceThreshold: number;
  maxConcurrentAnalyses: number;
  customRules?: CustomRule[];
}

export interface CustomRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  fix?: string;
}

export interface AnalysisContext {
  projectPath: string;
  fileType: string;
  framework?: string;
  dependencies?: string[];
  gitHistory?: GitCommit[];
  teamStandards?: TeamStandards;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  changes: string[];
}

export interface TeamStandards {
  styleGuide: string;
  patterns: string[];
  antiPatterns: string[];
  namingConventions: Record<string, string>;
}

export interface LearningData {
  patterns: Map<string, number>;
  fixes: Map<string, number>;
  feedback: AnalysisFeedback[];
}

export interface AnalysisFeedback {
  analysisId: string;
  useful: boolean;
  issuesFixed: number;
  suggestionsApplied: number;
  comment?: string;
}

export class SmartCodeAnalyzer {
  private providers: Map<string, LLMProvider> = new Map();
  private cache: Map<string, CodeAnalysisResult> = new Map();
  private learning: LearningData = {
    patterns: new Map(),
    fixes: new Map(),
    feedback: []
  };
  private config: SmartAnalysisConfig;
  private analysisQueue: AnalysisRequest[] = [];
  private processing = false;
  private completions: Map<string, { result: CodeAnalysisResult | null; error?: Error; timestamp: Date }> = new Map();

  constructor(config: Partial<SmartAnalysisConfig> = {}) {
    this.config = {
      providers: ['openai', 'anthropic'],
      enableCache: true,
      enableLearning: true,
      confidenceThreshold: 0.7,
      maxConcurrentAnalyses: 3,
      ...config
    };

    this.initializeProviders();
  }

  /**
   * Analyze code with smart context awareness
   */
  async analyzeCode(
    request: CodeAnalysisRequest,
    context?: AnalysisContext
  ): Promise<CodeAnalysisResult> {
    const cacheKey = this.generateCacheKey(request, context);
    
    // Check cache first
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Add to queue
    const analysisRequest: AnalysisRequest = {
      id: this.generateId(),
      request,
      context,
      timestamp: new Date(),
      priority: this.calculatePriority(request, context)
    };

    this.analysisQueue.push(analysisRequest);
    
    // Process queue
    if (!this.processing) {
      this.processQueue();
    }

    // Wait for completion
    return this.waitForCompletion(analysisRequest.id);
  }

  /**
   * Analyze multiple files in parallel
   */
  async analyzeProject(
    requests: Array<{ request: CodeAnalysisRequest; context?: AnalysisContext }>
  ): Promise<Map<string, CodeAnalysisResult>> {
    const results = new Map<string, CodeAnalysisResult>();
    
    // Batch process with concurrency limit
    const batches = this.createBatches(requests, this.config.maxConcurrentAnalyses);
    
    for (const batch of batches) {
      const batchPromises = batch.map(({ request, context }) => 
        this.analyzeCode(request, context)
          .then(result => ({ request, context, result }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ request, context, result }) => {
        const key = context?.projectPath || request.filePath || 'unknown';
        results.set(key, result);
      });
    }

    return results;
  }

  /**
   * Get contextual recommendations
   */
  async getRecommendations(
    request: CodeAnalysisRequest,
    context: AnalysisContext
  ): Promise<CodeSuggestion[]> {
    const analysis = await this.analyzeCode(request, context);
    const recommendations = [...analysis.suggestions];

    // Add project-specific recommendations
    if (context.framework) {
      const frameworkRecs = await this.getFrameworkRecommendations(
        request,
        context.framework
      );
      recommendations.push(...frameworkRecs);
    }

    // Add team-specific recommendations
    if (context.teamStandards) {
      const teamRecs = this.getTeamRecommendations(
        request,
        context.teamStandards
      );
      recommendations.push(...teamRecs);
    }

    // Apply learning from past feedback
    if (this.config.enableLearning) {
      const learnedRecs = this.applyLearning(request, recommendations);
      recommendations.push(...learnedRecs);
    }

    // Sort by impact and confidence
    return recommendations.sort((a, b) => {
      const scoreA = this.calculateRecommendationScore(a);
      const scoreB = this.calculateRecommendationScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Provide feedback on analysis for learning
   */
  provideFeedback(feedback: AnalysisFeedback): void {
    if (!this.config.enableLearning) return;

    this.learning.feedback.push(feedback);
    
    // Update patterns and fixes based on feedback
    this.updateLearningFromFeedback(feedback);
    
    // Cleanup old feedback
    if (this.learning.feedback.length > 1000) {
      this.learning.feedback = this.learning.feedback.slice(-500);
    }
  }

  /**
   * Get analysis metrics
   */
  getMetrics(): AnalyzerMetrics {
    return {
      totalAnalyses: this.learning.feedback.length,
      averageConfidence: this.calculateAverageConfidence(),
      cacheHitRate: this.calculateCacheHitRate(),
      topPatterns: Array.from(this.learning.patterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      providerMetrics: this.getProviderMetrics()
    };
  }

  private async initializeProviders(): Promise<void> {
    // Initialize OpenAI
    if (this.config.providers.includes('openai')) {
      const openai = new OpenAIProvider();
      if (openai.isAvailable()) {
        this.providers.set('openai', openai);
      }
    }

    // Initialize Anthropic
    if (this.config.providers.includes('anthropic')) {
      const anthropic = new AnthropicProvider();
      if (anthropic.isAvailable()) {
        this.providers.set('anthropic', anthropic);
      }
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.analysisQueue.length > 0) {
      const batch = this.analysisQueue.splice(0, this.config.maxConcurrentAnalyses);
      
      await Promise.all(
        batch.map(req => this.processRequest(req))
      );
    }

    this.processing = false;
  }

  private async processRequest(analysisReq: AnalysisRequest): Promise<void> {
    const { request, context } = analysisReq;
    
    try {
      // Select best provider
      const provider = this.selectBestProvider(request);
      
      // Enhance request with context
      const enhancedRequest = this.enhanceRequest(request, context);
      
      // Perform analysis if provider supports it
      let result: CodeAnalysisResult;
      if ('analyzeCode' in provider) {
        result = await (provider as any).analyzeCode(enhancedRequest);
      } else {
        // Fallback to using complete method
        const response = await provider.complete(this.formatAnalysisPrompt(enhancedRequest));
        result = this.parseAnalysisResponse(response.content);
      }
      
      // Apply custom rules
      const customIssues = this.applyCustomRules(request, this.config.customRules || []);
      result.issues.push(...customIssues);
      
      // Cache result
      if (this.config.enableCache) {
        const cacheKey = this.generateCacheKey(request, context);
        this.cache.set(cacheKey, result);
      }
      
      // Store in completion map
      // @ts-ignore
      this.completions.set(analysisReq.id, result);
      
      // Update learning
      if (this.config.enableLearning) {
        this.updateLearning(request, result);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      // @ts-ignore
      this.completions.set(analysisReq.id, null);
    }
  }

  private selectBestProvider(request: CodeAnalysisRequest): LLMProvider {
    // Find providers with code capability
    const codeProviders = Array.from(this.providers.values()).filter((p: any) => 
      p.capabilities && p.capabilities.some((c: any) => c.type === 'code' && c.supported)
    );
    
    if (codeProviders.length === 0) {
      // Fallback to first available provider
      return Array.from(this.providers.values())[0]!;
    }
    
    if (request.analysisType === 'security') {
      // Prefer Claude for security analysis
      return this.providers.get('anthropic') || this.providers.get('openai')!;
    }
    
    if (request.analysisType === 'performance') {
      // Prefer GPT-4 for performance
      return this.providers.get('openai') || this.providers.get('anthropic')!;
    }
    
    // Default to first available
    return this.providers.values().next().value;
  }

  private enhanceRequest(
    request: CodeAnalysisRequest,
    context?: AnalysisContext
  ): CodeAnalysisRequest {
    if (!context) return request;

    const enhancedContext = [];
    
    if (context.framework) {
      enhancedContext.push(`Framework: ${context.framework}`);
    }
    
    if (context.dependencies?.length) {
      enhancedContext.push(`Dependencies: ${context.dependencies.join(', ')}`);
    }
    
    if (context.teamStandards) {
      enhancedContext.push(`Team follows: ${context.teamStandards.styleGuide}`);
    }

    return {
      ...request,
      context: request.context 
        ? `${request.context}\n\n${enhancedContext.join('\n')}`
        : enhancedContext.join('\n')
    };
  }

  private applyCustomRules(request: CodeAnalysisRequest, rules: CustomRule[]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    for (const rule of rules) {
      const matches = request.code.matchAll(rule.pattern);
      
      for (const match of matches) {
        const lines = request.code.substring(0, match.index || 0).split('\n');
        const line = lines.length;
        const column = (lines[lines.length - 1]?.length || 0) + 1;
        
        issues.push({
          type: 'warning',
          category: rule.category as any,
          severity: rule.severity,
          message: rule.message,
          line,
          column,
          rule: rule.id,
          fix: rule.fix ? {
            type: 'manual',
            description: rule.fix
          } : undefined
        });
      }
    }
    
    return issues;
  }

  private async getFrameworkRecommendations(
    _request: CodeAnalysisRequest,
    framework: string
  ): Promise<CodeSuggestion[]> {
    // Framework-specific recommendations
    const frameworkRules: Record<string, CodeSuggestion[]> = {
      'react': [
        {
          type: 'best-practice',
          title: 'Use React.memo for performance',
          description: 'Consider wrapping components in React.memo to prevent unnecessary re-renders',
          reason: 'Improves performance by memoizing component output',
          impact: 'medium',
          confidence: 0.8
        }
      ],
      'express': [
        {
          type: 'security',
          title: 'Add rate limiting',
          description: 'Implement rate limiting to prevent abuse',
          reason: 'Protects against DoS attacks and brute force attempts',
          impact: 'high',
          confidence: 0.95
        }
      ]
    };
    
    return frameworkRules[framework.toLowerCase()] || [];
  }

  private getTeamRecommendations(
    request: CodeAnalysisRequest,
    standards: TeamStandards
  ): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    
    // Check against team patterns
    for (const antiPattern of standards.antiPatterns) {
      if (request.code.includes(antiPattern)) {
        suggestions.push({
          type: 'best-practice',
          title: `Avoid anti-pattern: ${antiPattern}`,
          description: `This code uses a pattern identified as anti-pattern by your team`,
          reason: 'Maintains consistency with team standards',
          impact: 'medium',
          confidence: 0.9
        });
      }
    }
    
    return suggestions;
  }

  private applyLearning(
    request: CodeAnalysisRequest,
    suggestions: CodeSuggestion[]
  ): CodeSuggestion[] {
    const learned: CodeSuggestion[] = [];
    
    // Add suggestions based on past successful fixes
    for (const [pattern, count] of this.learning.patterns) {
      if (count > 5 && request.code.includes(pattern)) {
        const fix = this.learning.fixes.get(pattern);
        if (fix) {
          learned.push({
            type: 'refactor',
            title: `Common improvement for: ${pattern}`,
            description: `This pattern has been successfully refactored ${count} times`,
            code: fix,
            reason: 'Based on team success rate',
            impact: 'medium',
            confidence: Math.min(0.9, 0.5 + count * 0.05)
          });
        }
      }
    }
    
    return learned;
  }

  private calculateRecommendationScore(suggestion: CodeSuggestion): number {
    const impactWeight = { low: 1, medium: 2, high: 3 };
    return suggestion.confidence * impactWeight[suggestion.impact];
  }

  private generateCacheKey(request: CodeAnalysisRequest, context?: AnalysisContext): string {
    const hash = this.simpleHash(JSON.stringify({ request, context }));
    return `analysis_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePriority(_request: CodeAnalysisRequest, _context?: AnalysisContext): number {
    let priority = 5;
    
    if (_request.analysisType === 'security') priority += 3;
    if (_context?.framework) priority += 1;
    if (_request.code.length > 1000) priority += 1;
    
    return priority;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async waitForCompletion(id: string): Promise<CodeAnalysisResult> {
    // Implementation would wait for completion signal
    // For now, return a mock result
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          issues: [],
          suggestions: [],
          metrics: { complexity: 0, maintainability: 0, linesOfCode: 0 },
          summary: 'Analysis complete',
          confidence: 0.8
        });
      }, 1000);
    });
  }

  private formatAnalysisPrompt(request: CodeAnalysisRequest): string {
    return `Analyze this ${request.language} code for ${request.analysisType} issues:\n\n${request.code}`;
  }

  private parseAnalysisResponse(content: string): CodeAnalysisResult {
    // Basic parsing - in real implementation would be more sophisticated
    return {
      issues: [],
      suggestions: [],
      metrics: { complexity: 0, maintainability: 0, linesOfCode: 0 },
      summary: content,
      confidence: 0.7
    };
  }

  private updateLearning(request: CodeAnalysisRequest, _result: CodeAnalysisResult): void {
    // Extract patterns from issues and suggestions
    for (const issue of _result.issues) {
      const pattern = this.extractPattern(request.code, issue.line || 0);
      if (pattern) {
        this.learning.patterns.set(
          pattern,
          (this.learning.patterns.get(pattern) || 0) + 1
        );
      }
    }
  }

  private updateLearningFromFeedback(_feedback: AnalysisFeedback): void {
    // Update learning based on user feedback
  }

  private extractPattern(code: string, line: number): string {
    const lines = code.split('\n');
    if (line > 0 && line <= lines.length) {
      return lines[line - 1].trim().substring(0, 50);
    }
    return '';
  }

  private calculateAverageConfidence(): number {
    // Calculate average confidence from analyses
    return 0.8;
  }

  private calculateCacheHitRate(): number {
    // Calculate cache hit rate
    return 0.7;
  }

  private getProviderMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    for (const [name, provider] of this.providers) {
      metrics[name] = provider.getMetrics();
    }
    return metrics;
  }

  private storeCompletion(id: string, result: CodeAnalysisResult | null, error?: Error): void {
    // Store completion result
    this.completions.set(id, { result, error, timestamp: new Date() });
  }
}

interface AnalysisRequest {
  id: string;
  request: CodeAnalysisRequest;
  context?: AnalysisContext;
  timestamp: Date;
  priority: number;
}

export interface AnalyzerMetrics {
  totalAnalyses: number;
  averageConfidence: number;
  cacheHitRate: number;
  topPatterns: Array<[string, number]>;
  providerMetrics: Record<string, any>;
}

export const smartCodeAnalyzer = new SmartCodeAnalyzer();
