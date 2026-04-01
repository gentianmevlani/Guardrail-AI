/**
 * Cache Service
 * 
 * Provides Redis-based caching for scan results, findings, and other frequently accessed data.
 * Reduces database load and improves API response times.
 */

import { createClient } from 'redis';
import { logger } from '../logger';

/** redis package typings omit command methods on the default client alias in some versions */
type RedisCommandClient = {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  info(section?: string): Promise<string>;
  quit(): Promise<void>;
  on(event: string, cb: (err?: Error) => void): void;
};

export class CacheService {
  private client: RedisCommandClient | null = null;
  private enabled: boolean;
  private initialized = false;

  constructor() {
    this.enabled = process.env.ENABLE_FINDING_CACHE !== 'false';
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.enabled) {
      logger.info('Cache service disabled via ENABLE_FINDING_CACHE');
      this.initialized = true;
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('Redis URL not configured, caching disabled');
      this.enabled = false;
      this.initialized = true;
      return;
    }

    try {
      this.client = createClient({ url: redisUrl }) as unknown as RedisCommandClient;
      
      this.client.on('error', (err) => {
        logger.error({ error: err }, 'Redis client error');
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      await this.client.connect();
      this.initialized = true;
      logger.info('Cache service initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize cache service');
      this.enabled = false;
      this.initialized = true;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error({ error, key }, 'Cache get failed');
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
    } catch (error) {
      logger.error({ error, key }, 'Cache set failed');
    }
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Cache delete failed');
    }
  }

  /**
   * Invalidate all keys matching a pattern
   */
  async invalidate(pattern: string): Promise<number> {
    if (!this.enabled || !this.client) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await this.client.del(...keys);
      logger.debug({ pattern, deleted }, 'Cache invalidated');
      return deleted;
    } catch (error) {
      logger.error({ error, pattern }, 'Cache invalidation failed');
      return 0;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetcher();

    // Store in cache
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Check if cache is enabled and connected
   */
  isAvailable(): boolean {
    return this.enabled && this.client !== null && this.initialized;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    connected: boolean;
    keyCount?: number;
  }> {
    if (!this.enabled || !this.client) {
      return { enabled: false, connected: false };
    }

    try {
      const info = await this.client.info('keyspace');
      // Parse keyspace info to get key count (simplified)
      const keyCount = info.match(/keys=(\d+)/)?.[1] 
        ? parseInt(info.match(/keys=(\d+)/)![1], 10) 
        : undefined;

      return {
        enabled: true,
        connected: true,
        keyCount,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get cache stats');
      return {
        enabled: true,
        connected: false,
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Cache service closed');
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
