"use strict";
/**
 * Embedding Service
 *
 * Real embeddings for semantic code search using OpenAI, Cohere, or local models
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = void 0;
class EmbeddingService {
    embeddingsCache = new Map();
    defaultProvider = 'local';
    defaultModel = 'text-embedding-3-small'; // OpenAI
    apiKey;
    constructor() {
        // Try to get API key from environment
        // Use bracket notation to access index signature properties
        const env = process.env;
        this.apiKey = env['OPENAI_API_KEY'] || env['COHERE_API_KEY'];
        if (env['OPENAI_API_KEY']) {
            this.defaultProvider = 'openai';
        }
        else if (env['COHERE_API_KEY']) {
            this.defaultProvider = 'cohere';
        }
    }
    /**
     * Generate embedding for text
     */
    async generateEmbedding(text, options) {
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
        let embedding;
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
    async batchEmbed(texts, options) {
        const results = new Map();
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
            }
            catch {
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
    async generateOpenAIEmbedding(text, model, apiKey) {
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
            const data = await response.json();
            return data.data[0]?.embedding || this.generateLocalEmbedding(text);
        }
        catch (error) {
            console.warn(`OpenAI embedding failed: ${error}, falling back to local`);
            return this.generateLocalEmbedding(text);
        }
    }
    /**
     * Batch OpenAI embeddings
     */
    async batchOpenAIEmbeddings(texts, options) {
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
        const data = await response.json();
        return data.data.map((item) => item.embedding);
    }
    /**
     * Generate Cohere embedding
     */
    async generateCohereEmbedding(text, model, apiKey) {
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
            const data = await response.json();
            return data.embeddings[0] || this.generateLocalEmbedding(text);
        }
        catch (error) {
            console.warn(`Cohere embedding failed: ${error}, falling back to local`);
            return this.generateLocalEmbedding(text);
        }
    }
    /**
     * Generate local embedding (fallback)
     * Uses improved TF-IDF with better vector representation
     */
    generateLocalEmbedding(text) {
        // Improved local embedding with 384 dimensions (common embedding size)
        const words = text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
        const embedding = new Array(384).fill(0);
        const wordCounts = new Map();
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
    hashText(text) {
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
    clearCache() {
        this.embeddingsCache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.embeddingsCache.size,
            entries: this.embeddingsCache.size,
        };
    }
}
exports.embeddingService = new EmbeddingService();
