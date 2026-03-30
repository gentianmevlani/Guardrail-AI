/**
 * Cache Manager
 * 
 * Persistent caching for codebase knowledge and performance optimizations
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodebaseKnowledge } from './codebase-knowledge';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  version: string;
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string; // Cache version for invalidation
  metadata?: Record<string, any>;
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDir: string;
  private defaultTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(cacheDir: string = '.guardrail-cache') {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
  }

  /**
   * Get cached knowledge base
   */
  async getCachedKnowledge(projectPath: string): Promise<CodebaseKnowledge | null> {
    const cacheKey = this.getKnowledgeCacheKey(projectPath);
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
      return memoryEntry.value as CodebaseKnowledge;
    }

    // Check disk cache
    const diskEntry = await this.getFromDisk(cacheKey);
    if (diskEntry && Date.now() < diskEntry.expiresAt) {
      // Load into memory
      this.memoryCache.set(cacheKey, diskEntry);
      return diskEntry.value as CodebaseKnowledge;
    }

    return null;
  }

  /**
   * Cache knowledge base
   */
  async cacheKnowledge(
    projectPath: string,
    knowledge: CodebaseKnowledge,
    options?: CacheOptions
  ): Promise<void> {
    const cacheKey = this.getKnowledgeCacheKey(projectPath);
    const entry: CacheEntry<CodebaseKnowledge> = {
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
  async updateKnowledgeIncremental(
    projectPath: string,
    changedFiles: string[],
    updater: (knowledge: CodebaseKnowledge) => Promise<CodebaseKnowledge>
  ): Promise<CodebaseKnowledge> {
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
  async invalidateCache(projectPath: string, pattern?: string): Promise<void> {
    if (pattern) {
      // Invalidate specific pattern
      const cacheKey = this.getKnowledgeCacheKey(projectPath);
      this.memoryCache.delete(cacheKey);
      await this.deleteFromDisk(cacheKey);
    } else {
      // Invalidate all for project
      const cacheKey = this.getKnowledgeCacheKey(projectPath);
      this.memoryCache.delete(cacheKey);
      await this.deleteFromDisk(cacheKey);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(this.cacheDir, file));
      }
    } catch {
      // Cache dir doesn't exist or is empty
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryEntries: number;
    memorySize: number;
    diskSize: number;
  } {
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
  async cleanup(): Promise<number> {
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
    } catch {
      // Cache dir doesn't exist
    }

    return cleaned;
  }

  private getKnowledgeCacheKey(projectPath: string): string {
    return `knowledge-${this.hashPath(projectPath)}`;
  }

  private hashPath(p: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < p.length; i++) {
      const char = p.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
    } catch {
      // Directory already exists or can't create
    }
  }

  /**
   * Save cache to disk with atomic write pattern to prevent race conditions
   * Uses temp file + rename for atomic operation
   */
  private async saveToDisk(key: string, entry: CacheEntry<unknown>): Promise<void> {
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
      } catch {
        // Cleanup failure is not critical
      }
    } catch (error) {
      // Failed to save to disk, but memory cache still works
      console.warn(`Failed to save cache to disk: ${error}`);
    }
  }

  private async getFromDisk(key: string): Promise<CacheEntry<unknown> | null> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async deleteFromDisk(key: string): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.promises.unlink(filePath);
    } catch {
      // File doesn't exist
    }
  }
}

export const cacheManager = new CacheManager();

