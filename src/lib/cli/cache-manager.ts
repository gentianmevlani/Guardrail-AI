/**
 * Cache Manager
 * 
 * Incremental caching for fast repeated scans.
 * Goal: make it feel instant on subsequent runs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheEntry {
  hash: string;
  timestamp: number;
  result: any;
  metadata: {
    filesScanned: number;
    findings: number;
    duration: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
}

export class CacheManager {
  private cacheDir: string;
  private stats = { hits: 0, misses: 0 };

  constructor(projectPath: string) {
    this.cacheDir = path.join(projectPath, '.guardrail', 'cache');
    this.ensureCacheDir();
  }

  /**
   * Compute hash of project state
   */
  async computeProjectHash(
    files: string[],
    config: Record<string, any> = {}
  ): Promise<string> {
    const hasher = crypto.createHash('sha256');
    
    // Hash file contents
    for (const file of files.sort()) {
      try {
        const stat = await fs.promises.stat(file);
        hasher.update(`${file}:${stat.mtimeMs}:${stat.size}`);
      } catch {
        // File doesn't exist or can't be read
      }
    }
    
    // Hash config
    hasher.update(JSON.stringify(config));
    
    return hasher.digest('hex').slice(0, 16);
  }

  /**
   * Get cached result if available
   */
  async get(key: string, currentHash: string): Promise<any | null> {
    const cacheFile = path.join(this.cacheDir, `${key}.json`);
    
    if (!fs.existsSync(cacheFile)) {
      this.stats.misses++;
      return null;
    }

    try {
      const content = await fs.promises.readFile(cacheFile, 'utf8');
      const entry: CacheEntry = JSON.parse(content);
      
      // Check if hash matches
      if (entry.hash !== currentHash) {
        this.stats.misses++;
        return null;
      }
      
      // Check if cache is too old (24 hours)
      const age = Date.now() - entry.timestamp;
      if (age > 24 * 60 * 60 * 1000) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return entry.result;
    } catch {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store result in cache
   */
  async set(
    key: string,
    hash: string,
    result: any,
    metadata: CacheEntry['metadata']
  ): Promise<void> {
    const cacheFile = path.join(this.cacheDir, `${key}.json`);
    
    const entry: CacheEntry = {
      hash,
      timestamp: Date.now(),
      result,
      metadata,
    };
    
    try {
      await fs.promises.writeFile(
        cacheFile,
        JSON.stringify(entry, null, 2)
      );
    } catch {
      // Cache write failed - continue without cache
    }
  }

  /**
   * Invalidate cache for a key
   */
  async invalidate(key: string): Promise<void> {
    const cacheFile = path.join(this.cacheDir, `${key}.json`);
    try {
      await fs.promises.unlink(cacheFile);
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.promises.unlink(path.join(this.cacheDir, file));
        }
      }
    } catch {
      // Cache dir doesn't exist
    }
    
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    // Calculate cache size
    let totalSize = 0;
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const stat = fs.statSync(path.join(this.cacheDir, file));
          totalSize += stat.size;
        }
      }
    } catch {
      // Can't read cache dir
    }
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalSize,
    };
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
}
