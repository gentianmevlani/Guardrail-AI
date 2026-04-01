/**
 * Enhanced OpenAI Provider
 * 
 * Full integration with OpenAI API including GPT-4, embeddings, and function calling
 */

import OpenAI from 'openai';
import type {
  LLMProvider,
  CompletionOptions,
  EmbeddingOptions,
  LLMResponse,
  LLMCapability,
  ProviderMetrics,
  CodeAnalysisRequest,
  CodeAnalysisResult
} from '../llm-provider-interface';

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  client: OpenAI;
  private metrics: ProviderMetrics = {
    requestCount: 0,
    successRate: 1,
    averageLatency: 0,
    errorCount: 0
  };

  models: string[] = [
    'gpt-4-turbo-preview',
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    'text-embedding-3-large',
    'text-embedding-3-small',
    'text-embedding-ada-002'
  ];

  capabilities: LLMCapability[] = [
    { type: 'completion', supported: true },
    { type: 'embedding', supported: true },
    { type: 'function-calling', supported: true },
    { type: 'vision', supported: true, details: 'GPT-4 Vision' },
    { type: 'code', supported: true, details: 'Specialized in code analysis' }
  ];

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env['OPENAI_API_KEY'],
      organization: process.env['OPENAI_ORG_ID']
    });
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<LLMResponse> {
    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const model = options.model || 'gpt-4-turbo-preview';
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system message if provided
      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }

      // Add context if provided
      if (options.context) {
        messages.push({ role: 'system', content: `Context: ${options.context}` });
      }

      // Add user prompt
      messages.push({ role: 'user', content: prompt });

      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: false
      });

      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      return {
        content: response.choices[0]?.message?.content || '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        metadata: {
          finishReason: response.choices[0]?.finish_reason,
          created: response.created
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async *completeStream(prompt: string, options: CompletionOptions = {}): AsyncGenerator<string> {
    const model = options.model || 'gpt-4-turbo-preview';
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }

    messages.push({ role: 'user', content: prompt });

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async embed(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const model = options.model || process.env['OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-small';
      const dimensions = options.dimensions;

      const response = await this.client.embeddings.create({
        model,
        input: text,
        dimensions
      });

      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      return response.data[0]?.embedding || [];
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResult> {
    const systemPrompt = this.getCodeAnalysisPrompt(request.analysisType);
    const prompt = this.formatCodeForAnalysis(request);

    const response = await this.complete(prompt, {
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 4000
    });

    // Parse the structured response
    return this.parseAnalysisResponse(response.content, request);
  }

  isAvailable(): boolean {
    return !!(this.client.apiKey);
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private getCodeAnalysisPrompt(analysisType: string): string {
    const basePrompt = `You are an expert code analyst. Analyze the provided code and return a structured JSON response with the following format:
{
  "issues": [
    {
      "type": "error|warning|info",
      "category": "security|performance|maintainability|bug|style",
      "severity": "low|medium|high|critical",
      "message": "Description of the issue",
      "line": 123,
      "column": 45,
      "rule": "rule-name",
      "fix": {
        "type": "automatic|manual",
        "description": "How to fix",
        "code": "fixed code",
        "steps": ["step1", "step2"]
      }
    }
  ],
  "suggestions": [
    {
      "type": "optimization|refactor|pattern|security|best-practice",
      "title": "Short title",
      "description": "Detailed description",
      "code": "example code",
      "reason": "Why this helps",
      "impact": "low|medium|high",
      "confidence": 0.95
    }
  ],
  "metrics": {
    "complexity": 10,
    "maintainability": 85,
    "linesOfCode": 100
  },
  "summary": "Overall analysis summary",
  "confidence": 0.9
}`;

    switch (analysisType) {
      case 'security':
        return basePrompt + '\n\nFocus specifically on security vulnerabilities, injection risks, authentication issues, and data exposure.';
      case 'performance':
        return basePrompt + '\n\nFocus on performance bottlenecks, inefficient algorithms, memory leaks, and optimization opportunities.';
      case 'quality':
        return basePrompt + '\n\nFocus on code quality, maintainability, design patterns, and best practices.';
      case 'architecture':
        return basePrompt + '\n\nFocus on architectural patterns, separation of concerns, modularity, and design principles.';
      default:
        return basePrompt;
    }
  }

  private formatCodeForAnalysis(request: CodeAnalysisRequest): string {
    let prompt = `Analyze the following ${request.language} code`;
    
    if (request.filePath) {
      prompt += ` from file: ${request.filePath}`;
    }
    
    if (request.context) {
      prompt += `\n\nContext: ${request.context}`;
    }
    
    prompt += `\n\n\`\`\`${request.language}\n${request.code}\n\`\`\`\n\nProvide the analysis in the specified JSON format.`;
    
    return prompt;
  }

  private parseAnalysisResponse(content: string, request: CodeAnalysisRequest): CodeAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as CodeAnalysisResult;
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        suggestions: [],
        metrics: {
          complexity: 0,
          maintainability: 0,
          linesOfCode: request.code.split('\n').length
        },
        summary: content,
        confidence: 0.5
      };
    }
  }

  private updateMetrics(duration: number, success: boolean, error?: string): void {
    // Update average latency
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.requestCount - 1) + duration) / 
      this.metrics.requestCount;

    // Update success rate
    if (!success) {
      this.metrics.errorCount++;
      this.metrics.lastError = error;
    }
    
    this.metrics.successRate = 
      (this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount;
  }
}
