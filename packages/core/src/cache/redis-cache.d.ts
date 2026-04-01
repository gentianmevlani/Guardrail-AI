/**
 * Redis Caching Layer
 *
 * Production-ready caching implementation with:
 * - Connection pooling
 * - Automatic serialization/deserialization
 * - TTL management
 * - Cache invalidation patterns
 * - Metrics tracking
 */
export interface RedisCacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableMetrics?: boolean;
}
export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  tags?: string[];
}
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  avgLatency: number;
}
export declare class RedisCache {
  private client;
  private config;
  private stats;
  private latencies;
  private connected;
  private memoryFallback;
  constructor(config?: Partial<RedisCacheConfig>);
  /**
   * Connect to Redis
   */
  connect(): Promise<void>;
  /**
   * Disconnect from Redis
   */
  disconnect(): Promise<void>;
  /**
   * Get prefixed key
   */
  private getKey;
  /**
   * Get value from cache
   */
  get<T>(key: string): Promise<T | null>;
  /**
   * Set value in cache
   */
  set<T>(
    key: string,
    value: T,
    ttl?: number,
    tags?: string[],
  ): Promise<boolean>;
  /**
   * Delete value from cache
   */
  delete(key: string): Promise<boolean>;
  /**
   * Delete multiple keys by pattern
   */
  deletePattern(pattern: string): Promise<number>;
  /**
   * Invalidate cache by tag
   */
  invalidateByTag(tag: string): Promise<number>;
  /**
   * Add key to tag set
   */
  private addKeyToTag;
  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;
  /**
   * Get remaining TTL
   */
  getTTL(key: string): Promise<number>;
  /**
   * Get or set (cache-aside pattern)
   */
  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    tags?: string[],
  ): Promise<T>;
  /**
   * Flush all cache
   */
  flush(): Promise<boolean>;
  /**
   * Health check
   */
  ping(): Promise<boolean>;
  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
  /**
   * Reset statistics
   */
  resetStats(): void;
  /**
   * Record latency for metrics
   */
  private recordLatency;
  /**
   * Update hit rate
   */
  private updateHitRate;
  /**
   * Check if connected to Redis
   */
  isConnected(): boolean;
}
export declare const CacheKeys: {
  scanResult: (projectId: string, scanType: string) => string;
  knowledgeBase: (projectPath: string) => string;
  embedding: (contentHash: string) => string;
  vulnerability: (packageName: string, version: string) => string;
  license: (packageName: string) => string;
  compliance: (projectId: string, framework: string) => string;
  session: (sessionId: string) => string;
  rateLimit: (identifier: string, action: string) => string;
};
export declare const CacheTTL: {
  SHORT: number;
  MEDIUM: number;
  LONG: number;
  WEEK: number;
  SCAN_RESULT: number;
  KNOWLEDGE: number;
  EMBEDDING: number;
  VULNERABILITY: number;
  LICENSE: number;
  SESSION: number;
};
export declare const cache: RedisCache;
//# sourceMappingURL=redis-cache.d.ts.map
