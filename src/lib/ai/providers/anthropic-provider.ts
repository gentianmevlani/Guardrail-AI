/**
 * Enhanced Anthropic Claude Provider
 * 
 * Full integration with Anthropic Claude API including Claude 3 Opus, Sonnet, and Haiku
 */

import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';
  client: Anthropic;
  private metrics: ProviderMetrics = {
    requestCount: 0,
    successRate: 1,
    averageLatency: 0,
    errorCount: 0
  };

  models: string[] = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2'
  ];

  capabilities: LLMCapability[] = [
    { type: 'completion', supported: true },
    { type: 'function-calling', supported: true, details: 'Tool use capability' },
    { type: 'vision', supported: true, details: 'Multi-modal analysis' },
    { type: 'code', supported: true, details: 'Excellent at code analysis and generation' }
  ];

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env['ANTHROPIC_API_KEY']
    });
  }

  async complete(prompt: string, options: CompletionOptions = {}): Promise<LLMResponse> {
    const startTime = Date.now();
    this.metrics.requestCount++;

    try {
      const model = options.model || 'claude-3-sonnet-20240229';
      
      // Build the message content
      let messageContent = prompt;
      
      // Add context if provided
      if (options.context) {
        messageContent = `Context: ${options.context}\n\n${prompt}`;
      }

      const response = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 4000,
        temperature: options.temperature ?? 0.7,
        messages: [
          {
            role: 'user' as const,
            content: messageContent
          }
        ],
        system: options.system || 'You are a helpful AI assistant.',
        top_p: options.topP,
        stop_sequences: options.stop
      });

      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      const textContent = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      return {
        content: textContent,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        },
        metadata: {
          stopReason: response.stop_reason,
          stopSequence: response.stop_sequence,
          id: response.id
        },
        reasoning: response.usage.input_tokens > 1000 ? 'Complex reasoning applied' : undefined
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async *completeStream(prompt: string, options: CompletionOptions = {}): AsyncGenerator<string> {
    const model = options.model || 'claude-3-sonnet-20240229';
    
    let messageContent = prompt;
    if (options.context) {
      messageContent = `Context: ${options.context}\n\n${prompt}`;
    }

    const stream = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4000,
      temperature: options.temperature ?? 0.7,
      messages: [
        {
          role: 'user' as const,
          content: messageContent
        }
      ],
      system: options.system || 'You are a helpful AI assistant.',
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        yield chunk.text;
      }
    }
  }

  async embed(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    // Anthropic doesn't provide embeddings API
    // Use OpenAI or another provider for embeddings
    throw new Error('Anthropic does not provide embeddings. Use OpenAI or another provider.');
  }

  async analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResult> {
    const systemPrompt = this.getCodeAnalysisPrompt(request.analysisType);
    const prompt = this.formatCodeForAnalysis(request);

    const response = await this.complete(prompt, {
      system: systemPrompt,
      temperature: 0.3,
      maxTokens: 4000
    });

    return this.parseAnalysisResponse(response.content, request);
  }

  isAvailable(): boolean {
    return !!(this.client.apiKey);
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private getCodeAnalysisPrompt(analysisType: string): string {
    const basePrompt = `You are an expert code analyst with deep knowledge of software engineering best practices, security vulnerabilities, performance optimization, and architectural patterns.

Analyze the provided code and return a structured JSON response with the following format:
{
  "issues": [
    {
      "type": "error|warning|info",
      "category": "security|performance|maintainability|bug|style",
      "severity": "low|medium|high|critical",
      "message": "Clear description of the issue",
      "line": 123,
      "column": 45,
      "rule": "relevant-rule-name",
      "fix": {
        "type": "automatic|manual",
        "description": "How to fix this issue",
        "code": "example fixed code",
        "steps": ["step1", "step2"]
      }
    }
  ],
  "suggestions": [
    {
      "type": "optimization|refactor|pattern|security|best-practice",
      "title": "Brief suggestion title",
      "description": "Detailed explanation",
      "code": "example implementation",
      "reason": "Why this improves the code",
      "impact": "low|medium|high",
      "confidence": 0.95
    }
  ],
  "metrics": {
    "complexity": 10,
    "maintainability": 85,
    "linesOfCode": 100
  },
  "summary": "Concise summary of findings",
  "confidence": 0.9
}`;

    switch (analysisType) {
      case 'security':
        return basePrompt + '\n\nFocus intensely on: OWASP Top 10 vulnerabilities, injection attacks, authentication flaws, authorization issues, data exposure, cryptographic weaknesses, and security misconfigurations.';
      case 'performance':
        return basePrompt + '\n\nFocus on: Algorithmic complexity, inefficient loops, memory management, I/O operations, caching opportunities, database queries, async/await patterns, and resource utilization.';
      case 'quality':
        return basePrompt + '\n\nFocus on: Code readability, maintainability, SOLID principles, design patterns, code duplication, error handling, logging, and documentation.';
      case 'architecture':
        return basePrompt + '\n\nFocus on: Separation of concerns, modularity, coupling, cohesion, design patterns, architectural layers, dependency management, and scalability considerations.';
      default:
        return basePrompt;
    }
  }

  private formatCodeForAnalysis(request: CodeAnalysisRequest): string {
    let prompt = `Please analyze this ${request.language} code`;
    
    if (request.filePath) {
      prompt += ` from ${request.filePath}`;
    }
    
    prompt += `:\n\n\`\`\`${request.language}\n${request.code}\n\`\`\``;
    
    if (request.context) {
      prompt += `\n\nAdditional context: ${request.context}`;
    }
    
    prompt += '\n\nProvide your analysis in the specified JSON format. Be thorough and actionable.';
    
    return prompt;
  }

  private parseAnalysisResponse(content: string, request: CodeAnalysisRequest): CodeAnalysisResult {
    try {
      // Extract JSON from response (Claude might add explanatory text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as CodeAnalysisResult;
    } catch (error) {
      // Fallback parsing
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
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.requestCount - 1) + duration) / 
      this.metrics.requestCount;

    if (!success) {
      this.metrics.errorCount++;
      this.metrics.lastError = error;
    }
    
    this.metrics.successRate = 
      (this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount;
  }
}
