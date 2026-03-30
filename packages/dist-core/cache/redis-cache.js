"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cache = exports.CacheTTL = exports.CacheKeys = exports.RedisCache = void 0;
class RedisCache {
    client = null;
    config;
    stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        hitRate: 0,
        avgLatency: 0,
    };
    latencies = [];
    connected = false;
    memoryFallback = new Map();
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env["REDIS_HOST"] || "localhost",
            port: config.port || parseInt(process.env["REDIS_PORT"] || "6379"),
            password: config.password || process.env["REDIS_PASSWORD"],
            db: config.db || 0,
            keyPrefix: config.keyPrefix || "Guardrail:",
            defaultTTL: config.defaultTTL || 3600, // 1 hour
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            enableMetrics: config.enableMetrics ?? true,
        };
    }
    /**
     * Connect to Redis
     */
    async connect() {
        try {
            // Dynamic import to avoid errors if redis is not installed
            // @ts-ignore
            const { createClient } = await Promise.resolve().then(() => __importStar(require("redis")));
            this.client = createClient({
                socket: {
                    host: this.config.host,
                    port: this.config.port,
                },
                password: this.config.password,
                database: this.config.db,
            });
            await this.client.connect();
            this.connected = true;
            console.log("Redis cache connected");
        }
        catch (error) {
            console.warn("Redis connection failed, using in-memory fallback:", error);
            this.connected = false;
        }
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        if (this.client && this.connected) {
            await this.client.quit();
            this.connected = false;
        }
    }
    /**
     * Get prefixed key
     */
    getKey(key) {
        return `${this.config.keyPrefix}${key}`;
    }
    /**
     * Get value from cache
     */
    async get(key) {
        const startTime = Date.now();
        const prefixedKey = this.getKey(key);
        try {
            let data = null;
            if (this.connected && this.client) {
                data = await this.client.get(prefixedKey);
            }
            else {
                const entry = this.memoryFallback.get(prefixedKey);
                if (entry && entry.expiresAt > Date.now()) {
                    data = entry.value;
                }
                else if (entry) {
                    this.memoryFallback.delete(prefixedKey);
                }
            }
            this.recordLatency(Date.now() - startTime);
            if (data) {
                this.stats.hits++;
                this.updateHitRate();
                const entry = JSON.parse(data);
                return entry.value;
            }
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }
        catch (error) {
            this.stats.errors++;
            console.error("Cache get error:", error);
            return null;
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl, tags) {
        const startTime = Date.now();
        const prefixedKey = this.getKey(key);
        const expiresIn = ttl || this.config.defaultTTL || 3600;
        try {
            const entry = {
                value,
                createdAt: Date.now(),
                expiresAt: Date.now() + expiresIn * 1000,
                tags,
            };
            const serialized = JSON.stringify(entry);
            if (this.connected && this.client) {
                await this.client.set(prefixedKey, serialized, { EX: expiresIn });
            }
            else {
                this.memoryFallback.set(prefixedKey, {
                    value: serialized,
                    expiresAt: Date.now() + expiresIn * 1000,
                });
            }
            // Store tag mappings for invalidation
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    await this.addKeyToTag(tag, prefixedKey);
                }
            }
            this.stats.sets++;
            this.recordLatency(Date.now() - startTime);
            return true;
        }
        catch (error) {
            this.stats.errors++;
            console.error("Cache set error:", error);
            return false;
        }
    }
    /**
     * Delete value from cache
     */
    async delete(key) {
        const prefixedKey = this.getKey(key);
        try {
            if (this.connected && this.client) {
                await this.client.del(prefixedKey);
            }
            else {
                this.memoryFallback.delete(prefixedKey);
            }
            this.stats.deletes++;
            return true;
        }
        catch (error) {
            this.stats.errors++;
            console.error("Cache delete error:", error);
            return false;
        }
    }
    /**
     * Delete multiple keys by pattern
     */
    async deletePattern(pattern) {
        const prefixedPattern = this.getKey(pattern);
        try {
            if (this.connected && this.client) {
                const keys = await this.client.keys(prefixedPattern);
                if (keys.length > 0) {
                    await this.client.del(keys);
                    this.stats.deletes += keys.length;
                    return keys.length;
                }
            }
            else {
                const regex = new RegExp(prefixedPattern.replace(/\*/g, ".*"));
                let count = 0;
                for (const key of this.memoryFallback.keys()) {
                    if (regex.test(key)) {
                        this.memoryFallback.delete(key);
                        count++;
                    }
                }
                this.stats.deletes += count;
                return count;
            }
            return 0;
        }
        catch (error) {
            this.stats.errors++;
            console.error("Cache deletePattern error:", error);
            return 0;
        }
    }
    /**
     * Invalidate cache by tag
     */
    async invalidateByTag(tag) {
        const tagKey = this.getKey(`tag:${tag}`);
        try {
            if (this.connected && this.client) {
                const keysData = await this.client.get(tagKey);
                if (keysData) {
                    const keys = JSON.parse(keysData);
                    if (keys.length > 0) {
                        await this.client.del(keys);
                        await this.client.del(tagKey);
                        this.stats.deletes += keys.length;
                        return keys.length;
                    }
                }
            }
            return 0;
        }
        catch (error) {
            this.stats.errors++;
            console.error("Cache invalidateByTag error:", error);
            return 0;
        }
    }
    /**
     * Add key to tag set
     */
    async addKeyToTag(tag, key) {
        const tagKey = this.getKey(`tag:${tag}`);
        try {
            if (this.connected && this.client) {
                const existing = await this.client.get(tagKey);
                const keys = existing ? JSON.parse(existing) : [];
                if (!keys.includes(key)) {
                    keys.push(key);
                    await this.client.set(tagKey, JSON.stringify(keys), { EX: 86400 }); // 24 hour TTL for tags
                }
            }
        }
        catch (error) {
            console.error("Cache addKeyToTag error:", error);
        }
    }
    /**
     * Check if key exists
     */
    async exists(key) {
        const prefixedKey = this.getKey(key);
        try {
            if (this.connected && this.client) {
                const result = await this.client.exists(prefixedKey);
                return result === 1;
            }
            else {
                const entry = this.memoryFallback.get(prefixedKey);
                return entry !== undefined && entry.expiresAt > Date.now();
            }
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get remaining TTL
     */
    async getTTL(key) {
        const prefixedKey = this.getKey(key);
        try {
            if (this.connected && this.client) {
                return await this.client.ttl(prefixedKey);
            }
            else {
                const entry = this.memoryFallback.get(prefixedKey);
                if (entry) {
                    return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
                }
                return -2;
            }
        }
        catch (error) {
            return -1;
        }
    }
    /**
     * Get or set (cache-aside pattern)
     */
    async getOrSet(key, factory, ttl, tags) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await factory();
        await this.set(key, value, ttl, tags);
        return value;
    }
    /**
     * Flush all cache
     */
    async flush() {
        try {
            if (this.connected && this.client) {
                await this.client.flushdb();
            }
            else {
                this.memoryFallback.clear();
            }
            return true;
        }
        catch (error) {
            this.stats.errors++;
            return false;
        }
    }
    /**
     * Health check
     */
    async ping() {
        try {
            if (this.connected && this.client) {
                const result = await this.client.ping();
                return result === "PONG";
            }
            return true; // Memory fallback always available
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            hitRate: 0,
            avgLatency: 0,
        };
        this.latencies = [];
    }
    /**
     * Record latency for metrics
     */
    recordLatency(ms) {
        if (!this.config.enableMetrics)
            return;
        this.latencies.push(ms);
        if (this.latencies.length > 1000) {
            this.latencies.shift();
        }
        this.stats.avgLatency =
            this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    }
    /**
     * Update hit rate
     */
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
    /**
     * Check if connected to Redis
     */
    isConnected() {
        return this.connected;
    }
}
exports.RedisCache = RedisCache;
// Cache key generators for common use cases
exports.CacheKeys = {
    // Scan results
    scanResult: (projectId, scanType) => `scan:${projectId}:${scanType}`,
    // Knowledge base
    knowledgeBase: (projectPath) => `knowledge:${Buffer.from(projectPath).toString("base64").slice(0, 32)}`,
    // Embeddings
    embedding: (contentHash) => `embedding:${contentHash}`,
    // Vulnerability data
    vulnerability: (packageName, version) => `vuln:${packageName}:${version}`,
    // License data
    license: (packageName) => `license:${packageName}`,
    // Compliance assessment
    compliance: (projectId, framework) => `compliance:${projectId}:${framework}`,
    // User session
    session: (sessionId) => `session:${sessionId}`,
    // Rate limiting
    rateLimit: (identifier, action) => `ratelimit:${identifier}:${action}`,
};
// Cache TTL presets (in seconds)
exports.CacheTTL = {
    SHORT: 300, // 5 minutes
    MEDIUM: 3600, // 1 hour
    LONG: 86400, // 24 hours
    WEEK: 604800, // 7 days
    SCAN_RESULT: 1800, // 30 minutes
    KNOWLEDGE: 3600, // 1 hour
    EMBEDDING: 604800, // 7 days
    VULNERABILITY: 21600, // 6 hours
    LICENSE: 604800, // 7 days
    SESSION: 86400, // 24 hours
};
// Export singleton
exports.cache = new RedisCache();
