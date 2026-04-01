/**
 * Embedding Service
 *
 * Real embeddings for semantic code search using OpenAI, Cohere, or local models
 */
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
declare class EmbeddingService {
    private embeddingsCache;
    private defaultProvider;
    private defaultModel;
    private apiKey?;
    constructor();
    /**
     * Generate embedding for text
     */
    generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]>;
    /**
     * Batch generate embeddings
     */
    batchEmbed(texts: string[], options?: EmbeddingOptions): Promise<Map<string, number[]>>;
    /**
     * Generate OpenAI embedding
     */
    private generateOpenAIEmbedding;
    /**
     * Batch OpenAI embeddings
     */
    private batchOpenAIEmbeddings;
    /**
     * Generate Cohere embedding
     */
    private generateCohereEmbedding;
    /**
     * Generate local embedding (fallback)
     * Uses improved TF-IDF with better vector representation
     */
    private generateLocalEmbedding;
    /**
     * Hash text for cache key
     */
    private hashText;
    /**
     * Clear embeddings cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        entries: number;
    };
}
export declare const embeddingService: EmbeddingService;
export {};
//# sourceMappingURL=embedding-service.d.ts.map