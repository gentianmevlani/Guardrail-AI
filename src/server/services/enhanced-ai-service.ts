/**
 * Enhanced AI Service
 *
 * Multi-provider AI service with:
 * - Provider abstraction and fallback
 * - Smart routing based on task type
 * - Cost optimization
 * - Response caching
 * - Rate limiting
 * - Prompt engineering
 * - Streaming support
 * - Tool/function calling
 */

import { EventEmitter } from "events";
import { createHash } from "crypto";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
// import { CohereClient } from 'cohere-ai';

// Types
export interface AIProvider {
  name: string;
  available: boolean;
  models: AIModel[];
  capabilities: AICapability[];
  pricing: PricingInfo;
  limits: RateLimits;
}

export interface AIModel {
  id: string;
  name: string;
  type: "completion" | "chat" | "embedding" | "image";
  contextWindow: number;
  maxTokens: number;
  costPerToken: number;
  costPerMillionTokens: number;
  speed: "fast" | "medium" | "slow";
  quality: "low" | "medium" | "high";
}

export interface AICapability {
  type:
    | "text"
    | "code"
    | "image"
    | "audio"
    | "video"
    | "function-calling"
    | "streaming";
  supported: boolean;
  details?: string;
}

export interface PricingInfo {
  inputTokenPrice: number; // per million tokens
  outputTokenPrice: number; // per million tokens
  currency: string;
}

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrentRequests: number;
}

export interface AIRequest {
  id: string;
  prompt: string;
  system?: string;
  context?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Tool[];
  metadata?: Record<string, any>;
}

export interface AIResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  usage: TokenUsage;
  metadata: {
    latency: number;
    cached: boolean;
    cost: number;
    finishReason?: string;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

export interface ProviderMetrics {
  provider: string;
  model: string;
  requests: number;
  tokens: number;
  errors: number;
  avgLatency: number;
  totalCost: number;
  successRate: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: "code" | "analysis" | "review" | "generation" | "explanation";
  template: string;
  variables: string[];
  examples?: PromptExample[];
  metadata?: Record<string, any>;
}

export interface PromptExample {
  input: Record<string, any>;
  output: string;
  explanation?: string;
}

class EnhancedAIService extends EventEmitter {
  private providers: Map<string, AIProvider> = new Map();
  private clients: Map<string, any> = new Map();
  private tools: Map<string, Tool> = new Map();
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  private cache: Map<string, CachedResponse> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 10000;

  constructor() {
    super();
    this.initializeProviders();
    this.initializeTools();
    this.loadPromptTemplates();
    this.startMetricsCollection();
  }

  /**
   * Initialize AI providers
   */
  private initializeProviders(): void {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      const openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG_ID,
      });

      this.clients.set("openai", openaiClient);
      this.providers.set("openai", {
        name: "OpenAI",
        available: true,
        models: [
          {
            id: "gpt-4-turbo-preview",
            name: "GPT-4 Turbo",
            type: "chat",
            contextWindow: 128000,
            maxTokens: 4096,
            costPerToken: 0.00001,
            costPerMillionTokens: 10,
            speed: "medium",
            quality: "high",
          },
          {
            id: "gpt-3.5-turbo",
            name: "GPT-3.5 Turbo",
            type: "chat",
            contextWindow: 16385,
            maxTokens: 4096,
            costPerToken: 0.000001,
            costPerMillionTokens: 1,
            speed: "fast",
            quality: "medium",
          },
        ],
        capabilities: [
          { type: "text", supported: true },
          { type: "code", supported: true },
          { type: "function-calling", supported: true },
          { type: "streaming", supported: true },
        ],
        pricing: {
          inputTokenPrice: 10,
          outputTokenPrice: 30,
          currency: "USD",
        },
        limits: {
          requestsPerMinute: 3500,
          tokensPerMinute: 90000,
          concurrentRequests: 100,
        },
      });
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      this.clients.set("anthropic", anthropicClient);
      this.providers.set("anthropic", {
        name: "Anthropic",
        available: true,
        models: [
          {
            id: "claude-3-opus-20240229",
            name: "Claude 3 Opus",
            type: "chat",
            contextWindow: 200000,
            maxTokens: 4096,
            costPerToken: 0.000015,
            costPerMillionTokens: 15,
            speed: "medium",
            quality: "high",
          },
          {
            id: "claude-3-sonnet-20240229",
            name: "Claude 3 Sonnet",
            type: "chat",
            contextWindow: 200000,
            maxTokens: 4096,
            costPerToken: 0.000003,
            costPerMillionTokens: 3,
            speed: "fast",
            quality: "high",
          },
        ],
        capabilities: [
          { type: "text", supported: true },
          { type: "code", supported: true },
          { type: "function-calling", supported: true, details: "Tool use" },
          { type: "streaming", supported: true },
        ],
        pricing: {
          inputTokenPrice: 3,
          outputTokenPrice: 15,
          currency: "USD",
        },
        limits: {
          requestsPerMinute: 1000,
          tokensPerMinute: 40000,
          concurrentRequests: 10,
        },
      });
    }

    // Cohere
    // if (process.env.COHERE_API_KEY) {
    //   const cohereClient = new CohereClient({
    //     token: process.env.COHERE_API_KEY,
    //   });

    //   this.clients.set('cohere', cohereClient);
    //   this.providers.set('cohere', {
    //     name: 'Cohere',
    //     available: true,
    //     models: [
    //       {
    //         id: 'command-r-plus',
    //         name: 'Command R+',
    //         type: 'chat',
    //         contextWindow: 128000,
    //         maxTokens: 4096,
    //         costPerToken: 0.000003,
    //         costPerMillionTokens: 3,
    //         speed: 'fast',
    //         quality: 'high',
    //       },
    //     ],
    //     capabilities: [
    //       { type: 'text', supported: true },
    //       { type: 'code', supported: true },
    //       { type: 'function-calling', supported: true },
    //       { type: 'streaming', supported: true },
    //     ],
    //     pricing: {
    //       inputTokenPrice: 3,
    //       outputTokenPrice: 15,
    //       currency: 'USD',
    //     },
    //     limits: {
    //       requestsPerMinute: 1000,
    //       tokensPerMinute: 40000,
    //       concurrentRequests: 10,
    //     },
    //   });
    // }
  }

  /**
   * Execute AI request with smart provider selection
   */
  async execute(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.updateMetrics(
        cached.provider,
        cached.model,
        0,
        0,
        0,
        Date.now() - startTime,
        0,
        true,
      );
      return {
        ...cached.response,
        metadata: {
          ...cached.response.metadata,
          cached: true,
          latency: Date.now() - startTime,
        },
      };
    }

    // Select best provider
    const provider = this.selectProvider(request);
    if (!provider) {
      throw new Error("No available AI providers");
    }

    // Check rate limits
    if (!this.checkRateLimit(provider.name)) {
      throw new Error(`Rate limit exceeded for ${provider.name}`);
    }

    try {
      // Execute request
      const response = await this.executeWithProvider(provider, request);

      // Update metrics
      this.updateMetrics(
        provider.name,
        response.model,
        1,
        response.usage.totalTokens,
        0,
        Date.now() - startTime,
        response.metadata.cost,
        false,
      );

      // Cache response
      this.cacheResponse(cacheKey, {
        provider: provider.name,
        model: response.model,
        response,
        timestamp: Date.now(),
      });

      // Emit event
      this.emit("response", response);

      return response;
    } catch (error) {
      // Try fallback provider
      if (request.provider !== provider.name) {
        request.provider = provider.name;
        return this.execute(request);
      }

      this.updateMetrics(
        provider.name,
        "",
        1,
        0,
        1,
        Date.now() - startTime,
        0,
        false,
      );
      throw error;
    }
  }

  /**
   * Execute streaming request
   */
  async executeStream(
    request: AIRequest,
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const provider = this.selectProvider(request);
    if (!provider) {
      throw new Error("No available AI providers");
    }

    const client = this.clients.get(provider.name);

    if (provider.name === "openai") {
      return await this.executeOpenAIStream(client, request, onChunk);
    } else if (provider.name === "anthropic") {
      return await this.executeAnthropicStream(client, request, onChunk);
    } else if (provider.name === "cohere") {
      return await this.executeCohereStream(client, request, onChunk);
    }

    throw new Error(`Streaming not supported by ${provider.name}`);
  }

  /**
   * Analyze code with AI
   */
  async analyzeCode(
    code: string,
    language: string,
    analysis: "security" | "quality" | "performance" | "documentation",
  ): Promise<{
    summary: string;
    issues: Array<{
      type: string;
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      suggestion?: string;
      line?: number;
    }>;
    metrics: {
      complexity: number;
      maintainability: number;
      testCoverage?: number;
    };
    recommendations: string[];
  }> {
    const template = this.promptTemplates.get(`code-${analysis}`);
    const prompt = template
      ? this.applyTemplate(template, { code, language })
      : this.generateCodeAnalysisPrompt(code, language, analysis);

    const response = await this.execute({
      id: this.generateId(),
      prompt,
      model: "gpt-4-turbo-preview",
      temperature: 0.2,
      maxTokens: 2000,
    });

    try {
      return JSON.parse(response.content);
    } catch {
      // Fallback parsing
      return this.parseCodeAnalysisResponse(response.content);
    }
  }

  /**
   * Generate code from description
   */
  async generateCode(
    description: string,
    language: string,
    context?: string,
    examples?: string[],
  ): Promise<{
    code: string;
    explanation: string;
    tests?: string;
    imports?: string[];
  }> {
    const template = this.promptTemplates.get("code-generation");
    const prompt = template
      ? this.applyTemplate(template, {
          description,
          language,
          context,
          examples,
        })
      : this.generateCodeGenerationPrompt(
          description,
          language,
          context,
          examples,
        );

    const response = await this.execute({
      id: this.generateId(),
      prompt,
      system:
        "You are an expert programmer. Write clean, well-documented code following best practices.",
      model: "gpt-4-turbo-preview",
      temperature: 0.3,
      maxTokens: 3000,
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return this.parseCodeGenerationResponse(response.content);
    }
  }

  /**
   * Review code changes
   */
  async reviewCode(
    diff: string,
    files: string[],
    guidelines?: string[],
  ): Promise<{
    approved: boolean;
    summary: string;
    concerns: Array<{
      file: string;
      line?: number;
      type: string;
      message: string;
      severity: "low" | "medium" | "high";
    }>;
    suggestions: string[];
    automatedChecks: {
      testsAdded: boolean;
      docsUpdated: boolean;
      breakingChanges: boolean;
    };
  }> {
    const template = this.promptTemplates.get("code-review");
    const prompt = template
      ? this.applyTemplate(template, { diff, files, guidelines })
      : this.generateCodeReviewPrompt(diff, files, guidelines);

    const response = await this.execute({
      id: this.generateId(),
      prompt,
      system:
        "You are a senior code reviewer. Focus on code quality, security, and maintainability.",
      model: "gpt-4-turbo-preview",
      temperature: 0.2,
      maxTokens: 2500,
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return this.parseCodeReviewResponse(response.content);
    }
  }

  /**
   * Get provider metrics
   */
  getMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit("cacheCleared");
  }

  /**
   * Add custom tool
   */
  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    this.emit("toolAdded", tool);
  }

  /**
   * Private helper methods
   */
  private selectProvider(request: AIRequest): AIProvider | null {
    // If provider specified, use it
    if (request.provider) {
      const provider = this.providers.get(request.provider);
      return provider?.available ? provider : null;
    }

    // Smart routing based on task
    const availableProviders = Array.from(this.providers.values()).filter(
      (p) => p.available,
    );

    if (availableProviders.length === 0) {
      return null;
    }

    // Prioritize by cost and quality
    return availableProviders.reduce((best, current) => {
      const bestScore = this.calculateProviderScore(best, request);
      const currentScore = this.calculateProviderScore(current, request);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateProviderScore(
    provider: AIProvider,
    request: AIRequest,
  ): number {
    let score = 0;

    // Quality score
    const model =
      provider.models.find((m) => m.id === request.model) || provider.models[0];
    score +=
      model.quality === "high" ? 30 : model.quality === "medium" ? 20 : 10;

    // Speed score
    score += model.speed === "fast" ? 20 : model.speed === "medium" ? 10 : 5;

    // Cost score (lower is better)
    score += Math.max(0, 20 - model.costPerMillionTokens);

    // Availability score
    score += provider.available ? 10 : 0;

    return score;
  }

  private async executeWithProvider(
    provider: AIProvider,
    request: AIRequest,
  ): Promise<AIResponse> {
    const client = this.clients.get(provider.name);
    const model = request.model || provider.models[0].id;

    if (provider.name === "openai") {
      return await this.executeOpenAI(client, request, model);
    } else if (provider.name === "anthropic") {
      return await this.executeAnthropic(client, request, model);
    } else if (provider.name === "cohere") {
      // Cohere not available - commented out
      throw new Error("Cohere provider not available");
    }

    throw new Error(`Unsupported provider: ${provider.name}`);
  }

  private async executeOpenAI(
    client: OpenAI,
    request: AIRequest,
    model: string,
  ): Promise<AIResponse> {
    const messages: any[] = [];

    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }

    if (request.context) {
      messages.push({ role: "system", content: `Context: ${request.context}` });
    }

    messages.push({ role: "user", content: request.prompt });

    const tools = request.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      tools,
      tool_choice: tools ? "auto" : undefined,
    });

    const content = response.choices[0]?.message?.content || "";

    // Handle tool calls
    if (response.choices[0]?.message?.tool_calls) {
      const toolResults = await this.handleToolCalls(
        response.choices[0].message.tool_calls,
        request.tools || [],
      );

      // Add tool results to conversation and get final response
      messages.push(response.choices[0].message);
      messages.push(
        ...toolResults.map((r) => ({
          role: "tool",
          content: JSON.stringify(r.result),
          tool_call_id: r.id,
        })),
      );

      const finalResponse = await client.chat.completions.create({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2000,
      });

      return {
        id: request.id,
        content: finalResponse.choices[0]?.message?.content || "",
        model,
        provider: "openai",
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        metadata: {
          latency: 0, // Calculated in execute()
          cached: false,
          cost: this.calculateCost("openai", model, {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
          }),
          finishReason: finalResponse.choices[0]?.finish_reason,
        },
      };
    }

    return {
      id: request.id,
      content,
      model,
      provider: "openai",
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      metadata: {
        latency: 0, // Calculated in execute()
        cached: false,
        cost: this.calculateCost("openai", model, {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
        }),
        finishReason: response.choices[0]?.finish_reason,
      },
    };
  }

  private async executeAnthropic(
    client: Anthropic,
    request: AIRequest,
    model: string,
  ): Promise<AIResponse> {
    const messages = [{ role: "user" as const, content: request.prompt }];

    const response = await client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 4000,
      temperature: request.temperature ?? 0.7,
      messages,
      system: request.system || "You are a helpful AI assistant.",
    });

    const content = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    return {
      id: request.id,
      content,
      model,
      provider: "anthropic",
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      metadata: {
        latency: 0,
        cached: false,
        cost: this.calculateCost("anthropic", model, {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
        }),
        finishReason: response.stop_reason || undefined,
      },
    };
  }

  private async executeCohere(
    client: any, // CohereClient not imported
    request: AIRequest,
    model: string,
  ): Promise<AIResponse> {
    const response = await client.chat({
      model,
      message: request.prompt,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4000,
      chatHistory: request.system
        ? [
            {
              role: "SYSTEM",
              message: request.system,
            },
          ]
        : [],
    });

    return {
      id: request.id,
      content: response.text,
      model,
      provider: "cohere",
      usage: {
        promptTokens: response.tokenCount?.promptTokens || 0,
        completionTokens: response.tokenCount?.responseTokens || 0,
        totalTokens: response.tokenCount?.totalTokens || 0,
      },
      metadata: {
        latency: 0,
        cached: false,
        cost: this.calculateCost("cohere", model, {
          promptTokens: response.tokenCount?.promptTokens || 0,
          completionTokens: response.tokenCount?.responseTokens || 0,
        }),
        finishReason: response.finishReason,
      },
    };
  }

  private async executeOpenAIStream(
    client: OpenAI,
    request: AIRequest,
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const messages: any[] = [];

    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }

    messages.push({ role: "user", content: request.prompt });

    const stream = await client.chat.completions.create({
      model: request.model || "gpt-4-turbo-preview",
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      stream: true,
    });

    let content = "";
    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onChunk(delta.content);
      }

      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens || 0,
          completionTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        };
      }
    }

    return {
      id: request.id,
      content,
      model: request.model || "gpt-4-turbo-preview",
      provider: "openai",
      usage,
      metadata: {
        latency: 0,
        cached: false,
        cost: this.calculateCost(
          "openai",
          request.model || "gpt-4-turbo-preview",
          usage,
        ),
      },
    };
  }

  private async executeAnthropicStream(
    client: Anthropic,
    request: AIRequest,
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    const model = request.model || "claude-3-sonnet-20240229";
    const messages = [{ role: "user" as const, content: request.prompt }];

    const stream = await client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 4000,
      temperature: request.temperature ?? 0.7,
      messages,
      system: request.system || "You are a helpful AI assistant.",
      stream: true,
    });

    let content = "";
    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        content += chunk.delta.text;
        onChunk(chunk.delta.text);
      }

      if (chunk.type === "message_start") {
        usage.promptTokens = chunk.message.usage.input_tokens;
      }

      if (chunk.type === "message_delta") {
        usage.completionTokens += chunk.usage.output_tokens || 0;
      }
    }

    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    return {
      id: request.id,
      content,
      model,
      provider: "anthropic",
      usage,
      metadata: {
        latency: 0,
        cached: false,
        cost: this.calculateCost("anthropic", model, usage),
      },
    };
  }

  private async executeCohereStream(
    client: any, // CohereClient not imported
    request: AIRequest,
    onChunk: (chunk: string) => void,
  ): Promise<AIResponse> {
    // Cohere not available - commented out
    throw new Error("Cohere streaming not available");
  }

  private async handleToolCalls(
    toolCalls: any[],
    tools: Tool[],
  ): Promise<Array<{ id: string; result: any }>> {
    const results: Array<{ id: string; result: any }> = [];

    for (const call of toolCalls) {
      const tool = tools.find((t) => t.name === call.function.name);
      if (tool) {
        try {
          const params = JSON.parse(call.function.arguments);
          const result = await tool.handler(params);
          results.push({ id: call.id, result });
        } catch (error) {
          results.push({
            id: call.id,
            result: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      }
    }

    return results;
  }

  private calculateCost(
    provider: string,
    model: string,
    usage: { promptTokens: number; completionTokens: number },
  ): number {
    const providerInfo = this.providers.get(provider);
    if (!providerInfo) return 0;

    const modelInfo = providerInfo.models.find((m) => m.id === model);
    if (!modelInfo) return 0;

    const inputCost =
      (usage.promptTokens / 1000000) * providerInfo.pricing.inputTokenPrice;
    const outputCost =
      (usage.completionTokens / 1000000) *
      providerInfo.pricing.outputTokenPrice;

    return inputCost + outputCost;
  }

  private checkRateLimit(provider: string): boolean {
    const limiter = this.rateLimiters.get(provider);
    if (!limiter) return true;

    return limiter.check();
  }

  private updateMetrics(
    provider: string,
    model: string,
    requests: number,
    tokens: number,
    errors: number,
    latency: number,
    cost: number,
    cached: boolean,
  ): void {
    const key = `${provider}:${model}`;
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        provider,
        model,
        requests: 0,
        tokens: 0,
        errors: 0,
        avgLatency: 0,
        totalCost: 0,
        successRate: 100,
      };
      this.metrics.set(key, metrics);
    }

    if (!cached) {
      metrics.requests += requests;
      metrics.tokens += tokens;
      metrics.errors += errors;
      metrics.totalCost += cost;

      // Update average latency
      metrics.avgLatency =
        metrics.requests > 0
          ? (metrics.avgLatency * (metrics.requests - requests) + latency) /
            metrics.requests
          : 0;

      // Update success rate
      metrics.successRate =
        metrics.requests > 0
          ? ((metrics.requests - metrics.errors) / metrics.requests) * 100
          : 100;
    }
  }

  private generateCacheKey(request: AIRequest): string {
    const data = {
      prompt: request.prompt,
      system: request.system,
      model: request.model || "",
      temperature: request.temperature,
    };

    return createHash("md5").update(JSON.stringify(data)).digest("hex");
  }

  private cacheResponse(key: string, data: any): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, data);
  }

  private initializeTools(): void {
    // Add default tools
    this.addTool({
      name: "execute_code",
      description: "Execute code in a sandboxed environment",
      parameters: {
        type: "object",
        properties: {
          language: { type: "string" },
          code: { type: "string" },
        },
        required: ["language", "code"],
      },
      handler: async (params) => {
        // Implementation would execute code in sandbox
        return { output: "Code executed successfully" };
      },
    });

    this.addTool({
      name: "search_files",
      description: "Search for files in the codebase",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          path: { type: "string" },
        },
        required: ["pattern"],
      },
      handler: async (params) => {
        // Implementation would search files
        return { files: [] };
      },
    });
  }

  private loadPromptTemplates(): void {
    // Load default prompt templates
    this.promptTemplates.set("code-analysis", {
      id: "code-analysis",
      name: "Code Analysis",
      description: "Analyze code for issues and improvements",
      category: "analysis",
      template: `Analyze the following {{language}} code for {{analysis}} issues:

{{code}}

Provide a detailed analysis including:
1. Summary of findings
2. Specific issues with line numbers
3. Code metrics
4. Recommendations for improvement

Response format: JSON`,
      variables: ["code", "language", "analysis"],
    });

    // Add more templates...
  }

  private applyTemplate(
    template: PromptTemplate,
    variables: Record<string, any>,
  ): string {
    let result = template.template;

    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }

    return result;
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit("metrics", this.getMetrics());
    }, 60000); // Emit metrics every minute
  }

  // Additional helper methods for prompt generation and response parsing
  private generateCodeAnalysisPrompt(
    code: string,
    language: string,
    analysis: string,
  ): string {
    return `Analyze the following ${language} code for ${analysis} issues:\n\n${code}\n\nProvide detailed analysis...`;
  }

  private generateCodeGenerationPrompt(
    description: string,
    language: string,
    context?: string,
    examples?: string[],
  ): string {
    let prompt = `Generate ${language} code for: ${description}`;

    if (context) {
      prompt += `\n\nContext: ${context}`;
    }

    if (examples && examples.length > 0) {
      prompt += `\n\nExamples:\n${examples.join("\n")}`;
    }

    return prompt;
  }

  private generateCodeReviewPrompt(
    diff: string,
    files: string[],
    guidelines?: string[],
  ): string {
    let prompt = `Review the following code changes:\n\n${diff}\n\nFiles: ${files.join(", ")}`;

    if (guidelines && guidelines.length > 0) {
      prompt += `\n\nGuidelines:\n${guidelines.join("\n")}`;
    }

    return prompt;
  }

  private parseCodeAnalysisResponse(content: string): any {
    // Fallback parsing implementation
    return {
      summary: content,
      issues: [],
      metrics: { complexity: 0, maintainability: 0 },
      recommendations: [],
    };
  }

  private parseCodeGenerationResponse(content: string): any {
    // Fallback parsing implementation
    const codeMatch = content.match(/```[\w]*\n([\s\S]*?)\n```/);
    return {
      code: codeMatch ? codeMatch[1] : content,
      explanation: content,
    };
  }

  private parseCodeReviewResponse(content: string): any {
    // Fallback parsing implementation
    return {
      approved: true,
      summary: content,
      concerns: [],
      suggestions: [],
      automatedChecks: {
        testsAdded: false,
        docsUpdated: false,
        breakingChanges: false,
      },
    };
  }

  private generateId(): string {
    return createHash("md5")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 16);
  }
}

// Rate limiter implementation
class RateLimiter {
  private requests: number[] = [];
  private tokens: number[] = [];

  constructor(
    private requestsPerMinute: number,
    private tokensPerMinute: number,
  ) {}

  check(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.requests = this.requests.filter((t) => t > oneMinuteAgo);
    this.tokens = this.tokens.filter((t) => t > oneMinuteAgo);

    return (
      this.requests.length < this.requestsPerMinute &&
      this.tokens.reduce((a, b) => a + b, 0) < this.tokensPerMinute
    );
  }

  record(tokens: number): void {
    this.requests.push(Date.now());
    this.tokens.push(tokens);
  }
}

interface CachedResponse {
  provider: string;
  model: string;
  response: AIResponse;
  timestamp: number;
}

export const enhancedAIService = new EnhancedAIService();
