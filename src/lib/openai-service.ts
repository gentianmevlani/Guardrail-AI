/**
 * OpenAI Service
 * 
 * Handles OpenAI API calls for embeddings and code analysis
 */

import OpenAI from 'openai';

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface CodeAnalysisOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class OpenAIService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
      });
    }
  }

  /**
   * Generate embedding for code
   */
  async generateEmbedding(
    code: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    const dimensions = options.dimensions || 1536;

    const response = await this.client.embeddings.create({
      model,
      input: code,
      dimensions,
    });

    return response.data[0].embedding;
  }

  /**
   * Batch generate embeddings
   */
  async batchEmbeddings(
    codes: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    const dimensions = options.dimensions || 1536;

    const response = await this.client.embeddings.create({
      model,
      input: codes,
      dimensions,
    });

    return response.data.map(item => item.embedding);
  }

  /**
   * Analyze code with GPT
   */
  async analyzeCode(
    code: string,
    prompt: string,
    options: CodeAnalysisOptions = {}
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    const temperature = options.temperature || 0.3;
    const maxTokens = options.maxTokens || 2000;

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a code analysis assistant. Analyze code and provide insights.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}

export const openaiService = new OpenAIService();

