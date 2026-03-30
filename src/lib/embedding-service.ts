/**
 * Embedding Service
 * 
 * Real embeddings for semantic code search using OpenAI, Cohere, or local models
 */

// Note: fs, path, and cacheManager imports removed as they were unused
// import * as fs from 'fs';
// import * as path from 'path';
// import { cacheManager } from './cache-manager';

export interface EmbeddingOptions {
  provider?: 'openai' | 'cohere' | 'local';
  model?: string;
  apiKey?: string;
  cache?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  cached: boolean;
}

class EmbeddingService {
  private embeddingsCache: Map<string, EmbeddingResult> = new Map();
  private defaultProvider: 'openai' | 'cohere' | 'local' = 'local';
  private defaultModel = 'text-embedding-3-small'; // OpenAI
  private apiKey?: string;

  constructor() {
    // Try to get API key from environment
    // Use bracket notation to access index signature properties
    const env = process.env as Record<string, string | undefined>;
    this.apiKey = env['OPENAI_API_KEY'] || env['COHERE_API_KEY'];
    if (env['OPENAI_API_KEY']) {
      this.defaultProvider = 'openai';
    } else if (env['COHERE_API_KEY']) {
      this.defaultProvider = 'cohere';
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(
    text: string,
    options?: EmbeddingOptions
  ): Promise<number[]> {
    const provider = options?.provider || this.defaultProvider;
    const model = options?.model || this.defaultModel;
    const cacheKey = `${provider}:${model}:${this.hashText(text)}`;

    // Check cache
    if (options?.cache !== false) {
      const cached = this.embeddingsCache.get(cacheKey);
      if (cached) {
        return cached.embedding;
      }
    }

    let embedding: number[];

    switch (provider) {
      case 'openai':
        embedding = await this.generateOpenAIEmbedding(text, model, options?.apiKey);
        break;
      case 'cohere':
        embedding = await this.generateCohereEmbedding(text, model, options?.apiKey);
        break;
      case 'local':
      default:
        embedding = this.generateLocalEmbedding(text);
        break;
    }

    // Cache result
    if (options?.cache !== false) {
      this.embeddingsCache.set(cacheKey, {
        embedding,
        model,
        cached: false,
      });
    }

    return embedding;
  }

  /**
   * Batch generate embeddings
   */
  async batchEmbed(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();

    // For OpenAI/Cohere, use batch API if available
    if (options?.provider === 'openai' && this.apiKey) {
      try {
        const batchResults = await this.batchOpenAIEmbeddings(texts, options);
        texts.forEach((text, i) => {
          const embedding = batchResults[i];
          if (embedding) {
            results.set(text, embedding);
          }
        });
        return results;
      } catch {
        // Fall back to individual calls
      }
    }

    // Individual calls
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text, options);
      results.set(text, embedding);
    }

    return results;
  }

  /**
   * Generate OpenAI embedding
   */
  private async generateOpenAIEmbedding(
    text: string,
    model: string,
    apiKey?: string
  ): Promise<number[]> {
    const key = apiKey || this.apiKey;
    if (!key) {
      console.warn('OpenAI API key not found, falling back to local embeddings');
      return this.generateLocalEmbedding(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: Array<{ embedding: number[] }> };
      return data.data[0]?.embedding || this.generateLocalEmbedding(text);
    } catch (error) {
      console.warn(`OpenAI embedding failed: ${error}, falling back to local`);
      return this.generateLocalEmbedding(text);
    }
  }

  /**
   * Batch OpenAI embeddings
   */
  private async batchOpenAIEmbeddings(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    const key = options?.apiKey || this.apiKey;
    if (!key) {
      throw new Error('OpenAI API key required');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

      const data = await response.json() as { data: Array<{ embedding: number[] }> };
      return data.data.map((item) => item.embedding);
  }

  /**
   * Generate Cohere embedding
   */
  private async generateCohereEmbedding(
    text: string,
    model: string,
    apiKey?: string
  ): Promise<number[]> {
    const key = apiKey || this.apiKey;
    if (!key) {
      console.warn('Cohere API key not found, falling back to local embeddings');
      return this.generateLocalEmbedding(text);
    }

    try {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || 'embed-english-v3.0',
          texts: [text],
          input_type: 'search_document',
        }),
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.statusText}`);
      }

      const data = await response.json() as { embeddings: number[][] };
      return data.embeddings[0] || this.generateLocalEmbedding(text);
    } catch (error) {
      console.warn(`Cohere embedding failed: ${error}, falling back to local`);
      return this.generateLocalEmbedding(text);
    }
  }

  /**
   * Generate local embedding (fallback)
   * Uses improved TF-IDF with better vector representation
   */
  private generateLocalEmbedding(text: string): number[] {
    // Improved local embedding with 384 dimensions (common embedding size)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const embedding = new Array(384).fill(0);
    const wordCounts = new Map<string, number>();

    // Count word frequencies
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    // Create embedding using hash-based distribution
    wordCounts.forEach((count, word) => {
      const hash = this.hashText(word);
      const hashNum = typeof hash === 'number' ? hash : parseInt(hash, 36) || 0;
      const indices = [
        hashNum % 384,
        (hashNum * 2) % 384,
        (hashNum * 3) % 384,
      ];
      indices.forEach(idx => {
        embedding[idx] += count / (words.length || 1);
      });
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Hash text for cache key
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear embeddings cache
   */
  clearCache(): void {
    this.embeddingsCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.embeddingsCache.size,
      entries: this.embeddingsCache.size,
    };
  }
}

export const embeddingService = new EmbeddingService();

