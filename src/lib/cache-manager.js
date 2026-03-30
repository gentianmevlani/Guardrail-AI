"use strict";
/**
 * Cache Manager
 *
 * Persistent caching for codebase knowledge and performance optimizations
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
exports.cacheManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CacheManager {
    memoryCache = new Map();
    cacheDir;
    defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
    constructor(cacheDir = '.guardrail-cache') {
        this.cacheDir = cacheDir;
        this.ensureCacheDir();
    }
    /**
     * Get cached knowledge base
     */
    async getCachedKnowledge(projectPath) {
        const cacheKey = this.getKnowledgeCacheKey(projectPath);
        // Check memory cache first
        const memoryEntry = this.memoryCache.get(cacheKey);
        if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
            return memoryEntry.value;
        }
        // Check disk cache
        const diskEntry = await this.getFromDisk(cacheKey);
        if (diskEntry && Date.now() < diskEntry.expiresAt) {
            // Load into memory
            this.memoryCache.set(cacheKey, diskEntry);
            return diskEntry.value;
        }
        return null;
    }
    /**
     * Cache knowledge base
     */
    async cacheKnowledge(projectPath, knowledge, options) {
        const cacheKey = this.getKnowledgeCacheKey(projectPath);
        const entry = {
            value: knowledge,
            expiresAt: Date.now() + (options?.ttl || this.defaultTTL),
            version: options?.version || '1.0.0',
            metadata: {
                ...options?.metadata,
                cachedAt: new Date().toISOString(),
                projectPath,
            },
        };
        // Cache in memory
        this.memoryCache.set(cacheKey, entry);
        // Cache to disk
        await this.saveToDisk(cacheKey, entry);
    }
    /**
     * Update knowledge base incrementally
     */
    async updateKnowledgeIncremental(projectPath, changedFiles, updater) {
        // Get existing knowledge
        let knowledge = await this.getCachedKnowledge(projectPath);
        if (!knowledge) {
            throw new Error('Knowledge base not found. Run build-knowledge first.');
        }
        // Update only changed files
        knowledge = await updater(knowledge);
        knowledge.lastUpdated = new Date().toISOString();
        // Cache updated knowledge
        await this.cacheKnowledge(projectPath, knowledge);
        return knowledge;
    }
    /**
     * Invalidate cache
     */
    async invalidateCache(projectPath, pattern) {
        if (pattern) {
            // Invalidate specific pattern
            const cacheKey = this.getKnowledgeCacheKey(projectPath);
            this.memoryCache.delete(cacheKey);
            await this.deleteFromDisk(cacheKey);
        }
        else {
            // Invalidate all for project
            const cacheKey = this.getKnowledgeCacheKey(projectPath);
            this.memoryCache.delete(cacheKey);
            await this.deleteFromDisk(cacheKey);
        }
    }
    /**
     * Clear all cache
     */
    async clearAllCache() {
        this.memoryCache.clear();
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            for (const file of files) {
                await fs.promises.unlink(path.join(this.cacheDir, file));
            }
        }
        catch {
            // Cache dir doesn't exist or is empty
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        let memorySize = 0;
        for (const entry of this.memoryCache.values()) {
            memorySize += JSON.stringify(entry).length;
        }
        return {
            memoryEntries: this.memoryCache.size,
            memorySize,
            diskSize: 0, // Would need to calculate from disk
        };
    }
    /**
     * Clean expired entries
     */
    async cleanup() {
        const now = Date.now();
        let cleaned = 0;
        // Clean memory cache
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }
        // Clean disk cache
        try {
            const files = await fs.promises.readdir(this.cacheDir);
            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const entry = await this.getFromDisk(file);
                if (entry && now > entry.expiresAt) {
                    await fs.promises.unlink(filePath);
                    cleaned++;
                }
            }
        }
        catch {
            // Cache dir doesn't exist
        }
        return cleaned;
    }
    getKnowledgeCacheKey(projectPath) {
        return `knowledge-${this.hashPath(projectPath)}`;
    }
    hashPath(p) {
        // Simple hash for cache key
        let hash = 0;
        for (let i = 0; i < p.length; i++) {
            const char = p.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    async ensureCacheDir() {
        try {
            await fs.promises.mkdir(this.cacheDir, { recursive: true });
        }
        catch {
            // Directory already exists or can't create
        }
    }
    /**
     * Save cache to disk with atomic write pattern to prevent race conditions
     * Uses temp file + rename for atomic operation
     */
    async saveToDisk(key, entry) {
        try {
            const filePath = path.join(this.cacheDir, `${key}.json`);
            const tempPath = `${filePath}.tmp.${Date.now()}`;
            // Atomic write: write to temp file first, then rename
            // This prevents race conditions from concurrent cache writes
            await fs.promises.writeFile(tempPath, JSON.stringify(entry, null, 2), { mode: 0o600 });
            await fs.promises.rename(tempPath, filePath);
            // Clean up any stale temp files older than 5 minutes
            try {
                const files = await fs.promises.readdir(this.cacheDir);
                const now = Date.now();
                for (const file of files) {
                    if (file.startsWith(`${key}.json.tmp.`)) {
                        const tempFilePath = path.join(this.cacheDir, file);
                        const stats = await fs.promises.stat(tempFilePath);
                        if (now - stats.mtimeMs > 5 * 60 * 1000) {
                            await fs.promises.unlink(tempFilePath);
                        }
                    }
                }
            }
            catch {
                // Cleanup failure is not critical
            }
        }
        catch (error) {
            // Failed to save to disk, but memory cache still works
            console.warn(`Failed to save cache to disk: ${error}`);
        }
    }
    async getFromDisk(key) {
        try {
            const filePath = path.join(this.cacheDir, `${key}.json`);
            const content = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async deleteFromDisk(key) {
        try {
            const filePath = path.join(this.cacheDir, `${key}.json`);
            await fs.promises.unlink(filePath);
        }
        catch {
            // File doesn't exist
        }
    }
}
exports.cacheManager = new CacheManager();
