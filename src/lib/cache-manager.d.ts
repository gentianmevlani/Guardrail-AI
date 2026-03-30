/**
 * Cache Manager
 *
 * Persistent caching for codebase knowledge and performance optimizations
 */
import { CodebaseKnowledge } from './codebase-knowledge';
export interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    version: string;
    metadata?: Record<string, any>;
}
export interface CacheOptions {
    ttl?: number;
    version?: string;
    metadata?: Record<string, any>;
}
declare class CacheManager {
    private memoryCache;
    private cacheDir;
    private defaultTTL;
    constructor(cacheDir?: string);
    /**
     * Get cached knowledge base
     */
    getCachedKnowledge(projectPath: string): Promise<CodebaseKnowledge | null>;
    /**
     * Cache knowledge base
     */
    cacheKnowledge(projectPath: string, knowledge: CodebaseKnowledge, options?: CacheOptions): Promise<void>;
    /**
     * Update knowledge base incrementally
     */
    updateKnowledgeIncremental(projectPath: string, changedFiles: string[], updater: (knowledge: CodebaseKnowledge) => Promise<CodebaseKnowledge>): Promise<CodebaseKnowledge>;
    /**
     * Invalidate cache
     */
    invalidateCache(projectPath: string, pattern?: string): Promise<void>;
    /**
     * Clear all cache
     */
    clearAllCache(): Promise<void>;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        memoryEntries: number;
        memorySize: number;
        diskSize: number;
    };
    /**
     * Clean expired entries
     */
    cleanup(): Promise<number>;
    private getKnowledgeCacheKey;
    private hashPath;
    private ensureCacheDir;
    /**
     * Save cache to disk with atomic write pattern to prevent race conditions
     * Uses temp file + rename for atomic operation
     */
    private saveToDisk;
    private getFromDisk;
    private deleteFromDisk;
}
export declare const cacheManager: CacheManager;
export {};
//# sourceMappingURL=cache-manager.d.ts.map