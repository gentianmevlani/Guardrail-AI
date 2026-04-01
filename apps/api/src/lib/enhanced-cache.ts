/**
 * Enhanced Caching System with Redis
 * Provides comprehensive caching with TTL, invalidation, and monitoring
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import Redis from 'ioredis';
import { logger } from '../logger';
import { ExternalServiceError } from '../middleware/enhanced-error-handler';

// Cache configuration
export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    retryDelayOnFailover: number;
    maxRetriesPerRequest: number;
    lazyConnect: boolean;
  };
  ttl: {
    default: number; // 5 minutes
    short: number; // 1 minute
    medium: number; // 15 minutes
    long: number; // 1 hour
    extended: number; // 24 hours
  };
  compression: {
    enabled: boolean;
    threshold: number; // bytes
  };
  monitoring: {
    enabled: boolean;
    interval: number; // milliseconds
  };
}

// Cache statistics
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  memoryUsage: number;
  keyCount: number;
  avgResponseTime: number;
  lastReset: Date;
}

// Cache entry metadata
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: number;
  compressed: boolean;
}

// Default configuration
const defaultConfig: CacheConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'guardrail:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  },
  ttl: {
    default: 300, // 5 minutes
    short: 60, // 1 minute
    medium: 900, // 15 minutes
    long: 3600, // 1 hour
    extended: 86400, // 24 hours
  },
  compression: {
    enabled: true,
    threshold: 1024, // 1KB
  },
  monitoring: {
    enabled: true,
    interval: 30000, // 30 seconds
  },
};

// Cache service class
class CacheService {
  private redis: Redis;
  private config: CacheConfig;
  private stats: CacheStats;
  private monitoringTimer?: NodeJS.Timeout;
  private responseTimes: number[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    // Initialize Redis client
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      keyPrefix: this.config.redis.keyPrefix,
      maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
      lazyConnect: this.config.redis.lazyConnect,
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });

    // Initialize statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      memoryUsage: 0,
      keyCount: 0,
      avgResponseTime: 0,
      lastReset: new Date(),
    };

    this.setupEventListeners();
    
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.redis.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.redis.on('error', (error) => {
      logger.error({ error }, 'Redis client error');
      this.stats.errors++;
    });

    this.redis.on('close', () => {
      logger.warn('Redis client connection closed');
    });

    this.redis.on('reconnecting', (ms: number) => {
      logger.info({ reconnectIn: ms }, 'Redis client reconnecting');
    });
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      await this.updateStats();
    }, this.config.monitoring.interval);
  }

  private async updateStats(): Promise<void> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      // Parse memory usage from Redis INFO
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      this.stats.memoryUsage = memoryUsage;
      this.stats.keyCount = keyCount;
      this.stats.hitRate = this.stats.hits + this.stats.misses > 0 
        ? this.stats.hits / (this.stats.hits + this.stats.misses) 
        : 0;
      
      // Update average response time
      if (this.responseTimes.length > 0) {
        this.stats.avgResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
        // Keep only last 100 response times
        if (this.responseTimes.length > 100) {
          this.responseTimes = this.responseTimes.slice(-100);
        }
      }
      
    } catch (error) {
      logger.error({ error }, 'Failed to update cache stats');
    }
  }

  // Basic cache operations
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const value = await this.redis.get(key);
      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);
      
      if (value === null) {
        this.stats.misses++;
        logger.debug({ key, operation: 'miss' }, 'Cache miss');
        return null;
      }

      // Parse cache entry
      const entry: CacheEntry<T> = JSON.parse(value);
      
      // Check if expired
      if (Date.now() > entry.timestamp + entry.ttl * 1000) {
        await this.delete(key);
        this.stats.misses++;
        logger.debug({ key, operation: 'expired' }, 'Cache entry expired');
        return null;
      }

      this.stats.hits++;
      logger.debug({ key, operation: 'hit', responseTime }, 'Cache hit');
      
      return entry.data;
      
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache get error');
      throw new ExternalServiceError('Redis', `Failed to get cache key: ${key}`, error);
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    ttl: number = this.config.ttl.default
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
        version: 1,
        compressed: false,
      };

      let serializedValue = JSON.stringify(entry);
      
      // Apply compression if enabled and threshold is met
      if (this.config.compression.enabled && serializedValue.length > this.config.compression.threshold) {
        // Simple compression - in production, use proper compression library
        entry.compressed = true;
        serializedValue = JSON.stringify(entry);
      }

      await this.redis.setex(key, ttl, serializedValue);
      
      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);
      this.stats.sets++;
      
      logger.debug({ key, ttl, responseTime, operation: 'set' }, 'Cache set');
      
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache set error');
      throw new ExternalServiceError('Redis', `Failed to set cache key: ${key}`, error);
    }
  }

  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const result = await this.redis.del(key);
      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);
      
      if (result > 0) {
        this.stats.deletes++;
        logger.debug({ key, responseTime, operation: 'delete' }, 'Cache delete');
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache delete error');
      throw new ExternalServiceError('Redis', `Failed to delete cache key: ${key}`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache exists check error');
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache expire error');
      return false;
    }
  }

  // Advanced cache operations
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.config.ttl.default
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    
    return value;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.stats.deletes += result;
      
      logger.info({ pattern, deletedCount: result }, 'Cache pattern invalidation');
      
      return result;
      
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, pattern }, 'Cache pattern invalidation error');
      throw new ExternalServiceError('Redis', `Failed to invalidate cache pattern: ${pattern}`, error);
    }
  }

  // Atomic operations
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await this.redis.incrby(key, amount);
      logger.debug({ key, amount, result }, 'Cache increment');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache increment error');
      throw new ExternalServiceError('Redis', `Failed to increment cache key: ${key}`, error);
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const result = await this.redis.decrby(key, amount);
      logger.debug({ key, amount, result }, 'Cache decrement');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache decrement error');
      throw new ExternalServiceError('Redis', `Failed to decrement cache key: ${key}`, error);
    }
  }

  // List operations
  async listPush(key: string, ...values: string[]): Promise<number> {
    try {
      const result = await this.redis.lpush(key, ...values);
      logger.debug({ key, values: values.length, result }, 'Cache list push');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache list push error');
      throw new ExternalServiceError('Redis', `Failed to push to cache list: ${key}`, error);
    }
  }

  async listPop(key: string): Promise<string | null> {
    try {
      const result = await this.redis.rpop(key);
      logger.debug({ key, result: result ? 'success' : 'empty' }, 'Cache list pop');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache list pop error');
      throw new ExternalServiceError('Redis', `Failed to pop from cache list: ${key}`, error);
    }
  }

  // Set operations
  async setAdd(key: string, ...members: string[]): Promise<number> {
    try {
      const result = await this.redis.sadd(key, ...members);
      logger.debug({ key, members: members.length, result }, 'Cache set add');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache set add error');
      throw new ExternalServiceError('Redis', `Failed to add to cache set: ${key}`, error);
    }
  }

  async setRemove(key: string, ...members: string[]): Promise<number> {
    try {
      const result = await this.redis.srem(key, ...members);
      logger.debug({ key, members: members.length, result }, 'Cache set remove');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache set remove error');
      throw new ExternalServiceError('Redis', `Failed to remove from cache set: ${key}`, error);
    }
  }

  async setIsMember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(key, member);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache set membership check error');
      return false;
    }
  }

  // Hash operations
  async hashSet(key: string, field: string, value: string): Promise<number> {
    try {
      const result = await this.redis.hset(key, field, value);
      logger.debug({ key, field }, 'Cache hash set');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache hash set error');
      throw new ExternalServiceError('Redis', `Failed to set cache hash field: ${key}`, error);
    }
  }

  async hashGet(key: string, field: string): Promise<string | null> {
    try {
      const result = await this.redis.hget(key, field);
      logger.debug({ key, field, result: result ? 'found' : 'not_found' }, 'Cache hash get');
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache hash get error');
      throw new ExternalServiceError('Redis', `Failed to get cache hash field: ${key}`, error);
    }
  }

  async hashGetAll(key: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.redis.hgetall(key);
      logger.debug({ key, fieldCount: Object.keys(result).length }, 'Cache hash get all');
      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache hash get all error');
      throw new ExternalServiceError('Redis', `Failed to get all cache hash fields: ${key}`, error);
    }
  }

  // Cache warming
  async warmCache(entries: Array<{ key: string; fetcher: () => Promise<unknown>; ttl?: number }>): Promise<void> {
    logger.info({ entryCount: entries.length }, 'Starting cache warming');
    
    const promises = entries.map(async ({ key, fetcher, ttl }) => {
      try {
        const value = await fetcher();
        await this.set(key, value, ttl);
      } catch (error) {
        logger.error({ error, key }, 'Failed to warm cache entry');
      }
    });
    
    await Promise.allSettled(promises);
    logger.info('Cache warming completed');
  }

  // Cache utilities
  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      memoryUsage: 0,
      keyCount: 0,
      avgResponseTime: 0,
      lastReset: new Date(),
    };
    this.responseTimes = [];
  }

  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error({ error }, 'Cache flush error');
      throw new ExternalServiceError('Redis', 'Failed to flush cache', error);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Cache ping error');
      return false;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    try {
      await this.redis.quit();
      logger.info('Redis client disconnected');
    } catch (error) {
      logger.error({ error }, 'Redis disconnect error');
    }
  }
}

// Cache singleton
let cacheInstance: CacheService;

export function getCache(): CacheService {
  if (!cacheInstance) {
    cacheInstance = new CacheService();
  }
  return cacheInstance;
}

// Cache middleware factory
export function createCacheMiddleware(cache: CacheService) {
  return {
    // Response caching middleware
    cacheResponse: (keyGenerator: (request: FastifyRequest) => string, ttl: number = 300) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const cacheKey = keyGenerator(request);
        
        // Try to get from cache
        const cached = await cache.get(cacheKey);
        if (cached !== null) {
          reply.header('X-Cache', 'HIT');
          return reply.send(cached);
        }
        
        // Cache the response
        const originalSend = reply.send.bind(reply);
        reply.send = (payload) => {
          cache.set(cacheKey, payload, ttl);
          reply.header('X-Cache', 'MISS');
          return originalSend(payload);
        };
      };
    },

    // Cache invalidation middleware
    invalidateCache: (keyGenerator: (request: FastifyRequest) => string) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const cacheKey = keyGenerator(request);
        await cache.delete(cacheKey);
      };
    },
  };
}

// Export default cache
export const cache = getCache();

// Export for testing
export { CacheService };
