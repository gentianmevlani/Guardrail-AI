import Redis from 'ioredis';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  compress?: boolean;
}

interface QueryMetrics {
  query: string;
  executionTime: number;
  cacheHit: boolean;
  timestamp: Date;
  resultSize: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  averageResponseTime: number;
}

export class RedisCacheManager {
  private redis: Redis;
  private queryMetrics: QueryMetrics[] = [];
  private readonly METRICS_KEY = 'guardrail:query_metrics';
  private readonly STATS_KEY = 'guardrail:cache_stats';
  private readonly maxMetricsEntries = 10000;

  constructor(redisConfig?: Redis.RedisOptions) {
    this.redis = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      password: process.env['REDIS_PASSWORD'],
      db: parseInt(process.env['REDIS_DB'] || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      ...redisConfig,
    });

    this.redis.on('error', (error: Error) => {
      console.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
    await this.initializeCacheStats();
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  private generateCacheKey(query: string, params?: any): string {
    const hash = createHash('sha256');
    hash.update(query);
    if (params) {
      hash.update(JSON.stringify(params));
    }
    return `guardrail:cache:${hash.digest('hex')}`;
  }

  private async initializeCacheStats(): Promise<void> {
    const exists = await this.redis.exists(this.STATS_KEY);
    if (!exists) {
      await this.redis.hset(this.STATS_KEY, {
        hits: '0',
        misses: '0',
        totalQueries: '0',
        totalResponseTime: '0',
      });
    }
  }

  private async updateCacheStats(hit: boolean, responseTime: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    if (hit) {
      pipeline.hincrby(this.STATS_KEY, 'hits', 1);
    } else {
      pipeline.hincrby(this.STATS_KEY, 'misses', 1);
    }
    
    pipeline.hincrby(this.STATS_KEY, 'totalQueries', 1);
    pipeline.hincrbyfloat(this.STATS_KEY, 'totalResponseTime', responseTime);
    
    await pipeline.exec();
  }

  private async recordMetrics(
    query: string,
    executionTime: number,
    cacheHit: boolean,
    resultSize: number
  ): Promise<void> {
    const metric: QueryMetrics = {
      query: query.substring(0, 500),
      executionTime,
      cacheHit,
      timestamp: new Date(),
      resultSize,
    };

    this.queryMetrics.push(metric);
    
    if (this.queryMetrics.length > this.maxMetricsEntries) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsEntries / 2);
    }

    await this.redis.lpush(this.METRICS_KEY, JSON.stringify(metric));
    await this.redis.ltrim(this.METRICS_KEY, 0, this.maxMetricsEntries - 1);
  }

  async get<T>(query: string, params?: any): Promise<T | null> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(query, params);

    try {
      const cached = await this.redis.get(cacheKey);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      if (cached) {
        const parsed = JSON.parse(cached);
        await this.updateCacheStats(true, responseTime);
        await this.recordMetrics(query, responseTime, true, parsed.data ? JSON.stringify(parsed.data).length : 0);
        return parsed.data;
      }

      await this.updateCacheStats(false, responseTime);
      await this.recordMetrics(query, responseTime, false, 0);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(
    query: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(query);
    const { ttl = 3600, tags = [], priority = 'medium', compress = false } = options;

    try {
      const payload = {
        data,
        tags,
        priority,
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(payload);
      
      const pipeline = this.redis.pipeline();
      pipeline.set(cacheKey, serialized);

      if (ttl > 0) {
        pipeline.expire(cacheKey, ttl);
      }

      if (tags.length > 0) {
        for (const tag of tags) {
          pipeline.sadd(`guardrail:tags:${tag}`, cacheKey);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const keys = await this.redis.smembers(`guardrail:tags:${tag}`);
        if (keys.length > 0) {
          pipeline.del(...keys);
        }
        pipeline.del(`guardrail:tags:${tag}`);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Pattern invalidation error:', error);
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const stats = await this.redis.hgetall(this.STATS_KEY);
      const hits = parseInt(stats.hits || '0');
      const misses = parseInt(stats.misses || '0');
      const totalQueries = hits + misses;
      const totalResponseTime = parseFloat(stats.totalResponseTime || '0');

      return {
        hits,
        misses,
        hitRate: totalQueries > 0 ? (hits / totalQueries) * 100 : 0,
        totalQueries,
        averageResponseTime: totalQueries > 0 ? totalResponseTime / totalQueries : 0,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalQueries: 0,
        averageResponseTime: 0,
      };
    }
  }

  async getSlowQueries(threshold: number = 1000): Promise<QueryMetrics[]> {
    try {
      const metrics = await this.redis.lrange(this.METRICS_KEY, 0, -1);
      const parsed = metrics.map((m: string) => JSON.parse(m));
      
      return parsed
        .filter((m: QueryMetrics) => m.executionTime > threshold)
        .sort((a: QueryMetrics, b: QueryMetrics) => b.executionTime - a.executionTime)
        .slice(0, 100);
    } catch (error) {
      console.error('Error getting slow queries:', error);
      return [];
    }
  }

  async optimizeCache(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      
      if (stats.hitRate < 50) {
        console.log('Low cache hit rate detected, adjusting TTL strategies...');
        
        const keys = await this.redis.keys('guardrail:cache:*');
        const pipeline = this.redis.pipeline();
        
        for (const key of keys.slice(0, 100)) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) {
            pipeline.expire(key, 3600);
          }
        }
        
        await pipeline.exec();
      }

      const memory = await this.redis.info('memory');
      const usedMemory = parseInt(memory.match(/used_memory:(\d+)/)?.[1] || '0');
      const maxMemory = parseInt(memory.match(/maxmemory:(\d+)/)?.[1] || '0');
      
      if (maxMemory > 0 && (usedMemory / maxMemory) > 0.8) {
        console.log('High memory usage, cleaning low priority cache entries...');
        await this.cleanupLowPriority();
      }
    } catch (error) {
      console.error('Error optimizing cache:', error);
    }
  }

  private async cleanupLowPriority(): Promise<void> {
    try {
      const keys = await this.redis.keys('guardrail:cache:*');
      const pipeline = this.redis.pipeline();
      
      for (const key of keys) {
        const value = await this.redis.get(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed.priority === 'low') {
            pipeline.del(key);
          }
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Error cleaning up low priority cache:', error);
    }
  }

  async warmupCache(queries: Array<{ query: string; data: any; params?: any }>): Promise<void> {
    console.log(`Warming up cache with ${queries.length} queries...`);
    
    const pipeline = this.redis.pipeline();
    
    for (const { query, data, params } of queries) {
      const cacheKey = this.generateCacheKey(query, params);
      const payload = {
        data,
        tags: ['warmup'],
        priority: 'high',
        timestamp: new Date().toISOString(),
      };
      
      pipeline.set(cacheKey, JSON.stringify(payload));
      pipeline.expire(cacheKey, 7200);
    }
    
    await pipeline.exec();
    console.log('Cache warmup completed');
  }

  createQueryOptimizer() {
    return {
      analyzeQueryPerformance: async () => {
        const metrics = await this.getSlowQueries(500);
        const patterns: { [key: string]: number } = {};
        
        metrics.forEach(metric => {
          const pattern = metric.query.substring(0, 100);
          patterns[pattern] = (patterns[pattern] || 0) + 1;
        });
        
        return {
          slowQueries: metrics,
          commonPatterns: Object.entries(patterns)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10),
        };
      },
      
      suggestOptimizations: async () => {
        const stats = await this.getCacheStats();
        const suggestions: string[] = [];
        
        if (stats.hitRate < 60) {
          suggestions.push('Consider increasing cache TTL for frequently accessed data');
        }
        
        if (stats.averageResponseTime > 100) {
          suggestions.push('Optimize serialized data size or enable compression');
        }
        
        const slowQueries = await this.getSlowQueries();
        if (slowQueries.length > 10) {
          suggestions.push('Review and optimize slow query patterns');
        }
        
        return suggestions;
      },
    };
  }
}

export const redisCache = new RedisCacheManager();
