/**
 * AI Integration Hub
 * 
 * Central orchestrator for all AI capabilities including LLM providers,
 * code analysis, recommendations, and learning systems
 */

import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { smartCodeAnalyzer } from './smart-code-analyzer';
import { contextualRecommendationSystem } from './contextual-recommendation-system';
import { aiLearningSystem } from './learning-system';
import type {
  LLMProvider,
  CodeAnalysisRequest,
  CodeAnalysisResult,
  CompletionOptions,
  LLMResponse
} from './llm-provider-interface';

export interface AIHubConfig {
  providers: ProviderConfig[];
  enableCodeAnalysis: boolean;
  enableRecommendations: boolean;
  enableLearning: boolean;
  defaultProvider: string;
  fallbackProviders: string[];
  cacheEnabled: boolean;
  metricsEnabled: boolean;
}

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  models: ModelConfig[];
  priority: number;
  rateLimit?: RateLimit;
}

export interface ModelConfig {
  name: string;
  type: 'completion' | 'embedding' | 'code';
  maxTokens: number;
  costPerToken: number;
}

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface AIRequest {
  id: string;
  type: 'completion' | 'analysis' | 'recommendation' | 'embedding';
  provider?: string;
  model?: string;
  input: any;
  options?: any;
  userId?: string;
  projectId?: string;
  timestamp: Date;
}

export interface AIResponse {
  id: string;
  requestId: string;
  provider: string;
  model: string;
  result: any;
  usage: TokenUsage;
  latency: number;
  cached: boolean;
  confidence: number;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  cost: number;
}

export interface AIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  cacheHitRate: number;
  costUsage: CostUsage;
  providerMetrics: Record<string, ProviderMetrics>;
  userSatisfaction: number;
}

export interface CostUsage {
  total: number;
  byProvider: Record<string, number>;
  byUser: Record<string, number>;
  byProject: Record<string, number>;
}

export interface ProviderMetrics {
  requests: number;
  errors: number;
  averageLatency: number;
  lastUsed: Date;
  status: 'healthy' | 'degraded' | 'down';
}

class AIIntegrationHub {
  private config: AIHubConfig;
  private providers: Map<string, LLMProvider> = new Map();
  private requestQueue: AIRequest[] = [];
  private processing = false;
  private responseCache: Map<string, AIResponse> = new Map();
  private metrics: AIMetrics;
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor(config: Partial<AIHubConfig> = {}) {
    this.config = {
      providers: [
        {
          name: 'openai',
          enabled: true,
          models: [
            { name: 'gpt-4-turbo-preview', type: 'completion', maxTokens: 4096, costPerToken: 0.00003 },
            { name: 'text-embedding-3-small', type: 'embedding', maxTokens: 8192, costPerToken: 0.00000002 }
          ],
          priority: 1,
          rateLimit: { requestsPerMinute: 3500, tokensPerMinute: 90000 }
        },
        {
          name: 'anthropic',
          enabled: true,
          models: [
            { name: 'claude-3-sonnet-20240229', type: 'completion', maxTokens: 4096, costPerToken: 0.00003 }
          ],
          priority: 2,
          rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 40000 }
        }
      ],
      enableCodeAnalysis: true,
      enableRecommendations: true,
      enableLearning: true,
      defaultProvider: 'openai',
      fallbackProviders: ['anthropic'],
      cacheEnabled: true,
      metricsEnabled: true,
      ...config
    };

    this.metrics = this.initializeMetrics();
    this.initializeProviders();
    this.initializeRateLimiters();
  }

  /**
   * Generate completion using LLM
   */
  async complete(
    prompt: string,
    options: CompletionOptions & { provider?: string } = {}
  ): Promise<LLMResponse> {
    const request: AIRequest = {
      id: this.generateRequestId(),
      type: 'completion',
      provider: options.provider || this.config.defaultProvider,
      model: options.model,
      input: prompt,
      options,
      timestamp: new Date()
    };

    const response = await this.processRequest(request);
    return response.result as LLMResponse;
  }

  /**
   * Analyze code with AI
   */
  async analyzeCode(
    request: CodeAnalysisRequest,
    options: { provider?: string; userId?: string; projectId?: string } = {}
  ): Promise<CodeAnalysisResult> {
    if (!this.config.enableCodeAnalysis) {
      throw new Error('Code analysis is disabled');
    }

    const aiRequest: AIRequest = {
      id: this.generateRequestId(),
      type: 'analysis',
      provider: options.provider || this.selectBestProviderForAnalysis(request),
      input: request,
      userId: options.userId,
      projectId: options.projectId,
      timestamp: new Date()
    };

    const response = await this.processRequest(aiRequest);
    
    // Track feedback if learning is enabled
    if (this.config.enableLearning && options.userId) {
      this.trackForLearning(response.result, options.userId, options.projectId);
    }

    return response.result as CodeAnalysisResult;
  }

  /**
   * Get contextual recommendations
   */
  async getRecommendations(
    code: string,
    context: any,
    options: { userId?: string; projectId?: string } = {}
  ): Promise<any[]> {
    if (!this.config.enableRecommendations) {
      return [];
    }

    const request = {
      code,
      context,
      preferences: options.userId ? this.getUserPreferences(options.userId) : undefined
    };

    const recommendations = await contextualRecommendationSystem.getRecommendations(request);
    
    // Log for learning
    if (this.config.enableLearning && options.userId) {
      this.logRecommendationsForLearning(recommendations, options.userId);
    }

    return recommendations;
  }

  /**
   * Generate embeddings for text
   */
  async embed(
    text: string,
    options: { provider?: string; model?: string } = {}
  ): Promise<number[]> {
    const request: AIRequest = {
      id: this.generateRequestId(),
      type: 'embedding',
      provider: options.provider || this.config.defaultProvider,
      model: options.model,
      input: text,
      timestamp: new Date()
    };

    const response = await this.processRequest(request);
    return response.result as number[];
  }

  /**
   * Stream completion
   */
  async *completeStream(
    prompt: string,
    options: CompletionOptions & { provider?: string } = {}
  ): AsyncGenerator<string> {
    const provider = this.getProvider(options.provider || this.config.defaultProvider);
    
    if (!provider) {
      throw new Error(`Provider not available: ${options.provider}`);
    }

    yield* provider.completeStream(prompt, options);
  }

  /**
   * Process multiple requests in parallel
   */
  async batchProcess(requests: AIRequest[]): Promise<AIResponse[]> {
    const batches = this.createBatches(requests, 10); // Process 10 at a time
    const results: AIResponse[] = [];

    for (const batch of batches) {
      const batchPromises = batch.map(req => this.processRequest(req));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get AI system metrics
   */
  getMetrics(): AIMetrics {
    if (!this.config.metricsEnabled) {
      throw new Error('Metrics are disabled');
    }

    return {
      ...this.metrics,
      providerMetrics: this.getProviderMetrics(),
      cacheHitRate: this.calculateCacheHitRate(),
      userSatisfaction: this.calculateUserSatisfaction()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AIHubConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Reinitialize providers if needed
    if (updates.providers) {
      this.initializeProviders();
    }
  }

  /**
   * Add feedback for learning
   */
  addFeedback(feedback: any): void {
    if (!this.config.enableLearning) {
      return;
    }

    aiLearningSystem.processFeedback(feedback);
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        health[name] = provider.isAvailable();
      } catch {
        health[name] = false;
      }
    }

    return health;
  }

  private async processRequest(request: AIRequest): Promise<AIResponse> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedResponse(request);
      if (cached) {
        this.metrics.totalRequests++;
        return cached;
      }
    }

    // Add to queue
    this.requestQueue.push(request);
    
    // Process queue
    if (!this.processing) {
      this.processQueue();
    }

    // Wait for completion
    return this.waitForResponse(request.id);
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.requestQueue.length > 0) {
      const batch = this.requestQueue.splice(0, 5); // Process 5 at a time
      
      await Promise.all(
        batch.map(req => this.processSingleRequest(req))
      );
    }

    this.processing = false;
  }

  private async processSingleRequest(request: AIRequest): Promise<void> {
    const startTime = Date.now();

    try {
      // Check rate limits
      if (!await this.checkRateLimit(request.provider || this.config.defaultProvider)) {
        // Requeue with delay
        setTimeout(() => this.requestQueue.push(request), 1000);
        return;
      }

      // Get provider
      const provider = this.getProvider(request.provider || this.config.defaultProvider);
      if (!provider) {
        throw new Error(`Provider not available: ${request.provider}`);
      }

      // Process request based on type
      let result: any;
      switch (request.type) {
        case 'completion':
          result = await provider.complete(request.input, request.options);
          break;
        case 'analysis':
          result = await provider.analyzeCode(request.input);
          break;
        case 'embedding':
          result = await provider.embed(request.input, request.options);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      const latency = Date.now() - startTime;
      
      // Create response
      const response: AIResponse = {
        id: this.generateResponseId(),
        requestId: request.id,
        provider: request.provider || this.config.defaultProvider,
        model: request.options?.model || 'default',
        result,
        usage: this.extractUsage(result),
        latency,
        cached: false,
        confidence: result.confidence || 0.8
      };

      // Cache response
      if (this.config.cacheEnabled) {
        this.cacheResponse(request, response);
      }

      // Update metrics
      this.updateMetrics(response);
      
      // Store response
      this.storeResponse(request.id, response);

    } catch (error) {
      // Try fallback providers
      if (request.provider && this.config.fallbackProviders.length > 0) {
        for (const fallback of this.config.fallbackProviders) {
          try {
            request.provider = fallback;
            return this.processSingleRequest(request);
          } catch {
            continue;
          }
        }
      }

      // Store error response
      const errorResponse: AIResponse = {
        id: this.generateResponseId(),
        requestId: request.id,
        provider: request.provider || 'unknown',
        model: 'unknown',
        result: null,
        usage: { prompt: 0, completion: 0, total: 0, cost: 0 },
        latency: Date.now() - startTime,
        cached: false,
        confidence: 0
      };

      this.storeResponse(request.id, errorResponse);
      this.metrics.failedRequests++;
    }
  }

  private initializeProviders(): void {
    this.providers.clear();

    for (const providerConfig of this.config.providers) {
      if (!providerConfig.enabled) continue;

      switch (providerConfig.name) {
        case 'openai':
          this.providers.set('openai', new OpenAIProvider(providerConfig.apiKey));
          break;
        case 'anthropic':
          this.providers.set('anthropic', new AnthropicProvider(providerConfig.apiKey));
          break;
        // Add more providers as needed
      }
    }
  }

  private initializeRateLimiters(): void {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.rateLimit) {
        this.rateLimiters.set(
          providerConfig.name,
          new RateLimiter(providerConfig.rateLimit)
        );
      }
    }
  }

  private getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  private selectBestProviderForAnalysis(request: CodeAnalysisRequest): string {
    // Select provider based on analysis type
    if (request.analysisType === 'security') {
      return 'anthropic'; // Claude is better at security analysis
    }
    return this.config.defaultProvider;
  }

  private async checkRateLimit(provider: string): Promise<boolean> {
    const limiter = this.rateLimiters.get(provider);
    if (!limiter) return true;
    
    return limiter.checkLimit();
  }

  private getCachedResponse(request: AIRequest): AIResponse | undefined {
    const key = this.generateCacheKey(request);
    return this.responseCache.get(key);
  }

  private cacheResponse(request: AIRequest, response: AIResponse): void {
    const key = this.generateCacheKey(request);
    this.responseCache.set(key, response);
    
    // Cleanup old cache entries
    if (this.responseCache.size > 1000) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].latency - b[1].latency);
      this.responseCache.clear();
      entries.slice(500).forEach(([k, v]) => this.responseCache.set(k, v));
    }
  }

  private generateCacheKey(request: AIRequest): string {
    return `${request.type}_${request.provider}_${JSON.stringify(request.input).substring(0, 100)}`;
  }

  private extractUsage(result: any): TokenUsage {
    if (result.usage) {
      return {
        prompt: result.usage.promptTokens || 0,
        completion: result.usage.completionTokens || 0,
        total: result.usage.totalTokens || 0,
        cost: this.calculateCost(result.usage)
      };
    }
    
    return { prompt: 0, completion: 0, total: 0, cost: 0 };
  }

  private calculateCost(usage: any): number {
    // Simple cost calculation - would be more sophisticated
    return (usage.totalTokens || 0) * 0.00001;
  }

  private updateMetrics(response: AIResponse): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    
    // Update average latency
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + response.latency) / 
      this.metrics.totalRequests;
    
    // Update cost usage
    this.metrics.costUsage.total += response.usage.cost;
  }

  private getProviderMetrics(): Record<string, ProviderMetrics> {
    const metrics: Record<string, ProviderMetrics> = {};
    
    for (const [name, provider] of this.providers) {
      const providerMetrics = provider.getMetrics();
      metrics[name] = {
        requests: providerMetrics.requestCount,
        errors: providerMetrics.errorCount,
        averageLatency: providerMetrics.averageLatency,
        lastUsed: new Date(),
        status: providerMetrics.successRate > 0.9 ? 'healthy' : 
                providerMetrics.successRate > 0.7 ? 'degraded' : 'down'
      };
    }
    
    return metrics;
  }

  private calculateCacheHitRate(): number {
    // Calculate cache hit rate
    return 0.7; // Placeholder
  }

  private calculateUserSatisfaction(): number {
    // Calculate user satisfaction from feedback
    return 0.85; // Placeholder
  }

  private getUserPreferences(userId: string): any {
    // Get user preferences from learning system
    return {};
  }

  private trackForLearning(result: any, userId: string, projectId?: string): void {
    // Track results for learning
  }

  private logRecommendationsForLearning(recommendations: any[], userId: string): void {
    // Log recommendations for learning
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateResponseId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async waitForResponse(requestId: string): Promise<AIResponse> {
    // Implementation would wait for response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: 'mock',
          requestId,
          provider: 'openai',
          model: 'gpt-4',
          result: {},
          usage: { prompt: 0, completion: 0, total: 0, cost: 0 },
          latency: 1000,
          cached: false,
          confidence: 0.8
        });
      }, 100);
    });
  }

  private storeResponse(requestId: string, response: AIResponse): void {
    // Store response for retrieval
  }

  private initializeMetrics(): AIMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      costUsage: {
        total: 0,
        byProvider: {},
        byUser: {},
        byProject: {}
      },
      providerMetrics: {},
      userSatisfaction: 0
    };
  }
}

class RateLimiter {
  private requests: number[] = [];
  private tokens: number[] = [];
  
  constructor(private config: RateLimit) {}
  
  checkLimit(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    this.requests = this.requests.filter(t => t > oneMinuteAgo);
    this.tokens = this.tokens.filter(t => t > oneMinuteAgo);
    
    // Check limits
    return this.requests.length < this.config.requestsPerMinute &&
           this.tokens.reduce((a, b) => a + b, 0) < this.config.tokensPerMinute;
  }
  
  recordRequest(tokens: number): void {
    this.requests.push(Date.now());
    this.tokens.push(tokens);
  }
}

// Export singleton instance
export const aiHub = new AIIntegrationHub();

// Also export the class for testing/custom instances
export { AIIntegrationHub };
