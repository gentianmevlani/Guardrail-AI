/**
 * Phase 1.1: File Scanner & Parsing Strategy
 * 
 * Scans project files for route-related code using TypeScript Compiler API.
 * Supports TS/TSX/JS/JSX uniformly with allowJs: true.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PackageInfo, FileCache, ExtractedLink, PlaceholderMatch } from '../types';
import { LinkExtractor } from './link-extractor';

interface ScanOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  concurrency?: number;
}

interface ScanResult {
  files: Map<string, FileCache>;
  totalFiles: number;
  skippedFiles: number;
  errors: string[];
  duration: number;
}

const DEFAULT_INCLUDE_PATTERNS = [
  '**/*.tsx',
  '**/*.ts',
  '**/*.jsx',
  '**/*.js',
];

const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/coverage/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/test/**',
  '**/tests/**',
  '**/*.d.ts',
  '**/*.config.*',
  '**/vite.config.*',
  '**/next.config.*',
  '**/tailwind.config.*',
  '**/postcss.config.*',
  '**/jest.config.*',
  '**/playwright.config.*',
];

const DEFAULT_MAX_FILE_SIZE = 500 * 1024; // 500KB

interface DirectoryTree {
  files: string[];
  subdirs: string[];
  mtime: number;
  cachedAt: number;
}

export class FileScanner {
  private extractor: LinkExtractor;
  private cacheDir: string;
  private cache: Map<string, FileCache> = new Map();
  private directoryTreeCache: Map<string, DirectoryTree> = new Map();
  private cacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    treeHits: 0,
    treeMisses: 0,
  };
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly TREE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for directory structure

  constructor(
    private packageInfo: PackageInfo,
    private options: ScanOptions = {}
  ) {
    this.extractor = new LinkExtractor(packageInfo.tsconfigPath || undefined);
    this.cacheDir = path.join(packageInfo.rootDir, '.guardrail', 'cache', 'files');
    this.loadCache();
  }

  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    const files = new Map<string, FileCache>();
    const errors: string[] = [];
    let skippedFiles = 0;

    const sourceFiles = await this.findSourceFiles();

    for (const filePath of sourceFiles) {
      try {
        const cached = this.getCachedResult(filePath);
        if (cached) {
          files.set(filePath, cached);
          continue;
        }

        const stat = await fs.promises.stat(filePath);
        const maxSize = this.options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
        
        if (stat.size > maxSize) {
          skippedFiles++;
          continue;
        }

        const stat = await fs.promises.stat(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const contentHash = this.computeHash(content);

        const result = this.extractor.extractFromFile(filePath, content);

        const fileCache: FileCache = {
          path: filePath,
          contentHash,
          extractedLinks: result.links,
          placeholders: result.placeholders,
          lastParsed: new Date().toISOString(),
          mtime: stat.mtime.toISOString(), // Store modification time for fast invalidation
        };

        files.set(filePath, fileCache);
        this.cache.set(filePath, fileCache);
      } catch (error) {
        errors.push(`Failed to scan ${filePath}: ${error}`);
        skippedFiles++;
      }
    }

    this.saveCache();

    return {
      files,
      totalFiles: sourceFiles.length,
      skippedFiles,
      errors,
      duration: Date.now() - startTime,
    };
  }

  async scanFile(filePath: string, forceRefresh = false): Promise<FileCache | null> {
    try {
      if (!forceRefresh) {
        const cached = this.getCachedResult(filePath);
        if (cached) {
          return cached;
        }
      }

      const stat = await fs.promises.stat(filePath);
      const content = await fs.promises.readFile(filePath, 'utf8');
      const contentHash = this.computeHash(content);
      const result = this.extractor.extractFromFile(filePath, content);

      const fileCache: FileCache = {
        path: filePath,
        contentHash,
        extractedLinks: result.links,
        placeholders: result.placeholders,
        lastParsed: new Date().toISOString(),
        mtime: stat.mtime.toISOString(), // Store modification time for fast invalidation
      };

      this.cache.set(filePath, fileCache);
      return fileCache;
    } catch {
      return null;
    }
  }

  private async findSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    const includePatterns = this.options.includePatterns ?? DEFAULT_INCLUDE_PATTERNS;
    const excludePatterns = this.options.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;

    const scanDir = this.packageInfo.srcDir || this.packageInfo.rootDir;

    await this.walkDirectory(scanDir, files, excludePatterns);

    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
    });
  }

  private async walkDirectory(
    dir: string,
    files: string[],
    excludePatterns: string[]
  ): Promise<void> {
    try {
      // Check directory tree cache first
      const cachedTree = this.getCachedDirectoryTree(dir);
      if (cachedTree) {
        // Use cached directory structure
        for (const file of cachedTree.files) {
          const relativePath = path.relative(this.packageInfo.rootDir, file);
          if (!this.shouldExclude(relativePath, excludePatterns)) {
            files.push(file);
          }
        }
        
        // Recursively process subdirectories
        for (const subdir of cachedTree.subdirs) {
          const relativePath = path.relative(this.packageInfo.rootDir, subdir);
          if (!this.shouldExclude(relativePath, excludePatterns)) {
            await this.walkDirectory(subdir, files, excludePatterns);
          }
        }
        
        this.cacheStats.treeHits++;
        return;
      }

      // Cache miss - read directory
      this.cacheStats.treeMisses++;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      const dirFiles: string[] = [];
      const subdirs: string[] = [];
      const stat = await fs.promises.stat(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.packageInfo.rootDir, fullPath);

        if (this.shouldExclude(relativePath, excludePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          subdirs.push(fullPath);
          await this.walkDirectory(fullPath, files, excludePatterns);
        } else if (entry.isFile()) {
          dirFiles.push(fullPath);
          files.push(fullPath);
        }
      }

      // Cache directory tree structure
      this.directoryTreeCache.set(dir, {
        files: dirFiles,
        subdirs,
        mtime: stat.mtimeMs,
        cachedAt: Date.now(),
      });
    } catch {
      // Directory not accessible
    }
  }

  /**
   * Get cached directory tree if valid
   */
  private getCachedDirectoryTree(dir: string): DirectoryTree | null {
    const cached = this.directoryTreeCache.get(dir);
    if (!cached) return null;

    // Check cache expiration
    const now = Date.now();
    if (now - cached.cachedAt > this.TREE_CACHE_TTL_MS) {
      this.directoryTreeCache.delete(dir);
      return null;
    }

    // Verify directory hasn't changed (check mtime)
    try {
      const stat = fs.statSync(dir);
      if (stat.mtimeMs !== cached.mtime) {
        // Directory modified - invalidate cache
        this.directoryTreeCache.delete(dir);
        return null;
      }
    } catch {
      // Directory not accessible - remove from cache
      this.directoryTreeCache.delete(dir);
      return null;
    }

    return cached;
  }

  private shouldExclude(relativePath: string, patterns: string[]): boolean {
    const normalizedPath = relativePath.replace(/\\/g, '/');

    for (const pattern of patterns) {
      if (this.matchesGlob(normalizedPath, pattern)) {
        return true;
      }
    }

    return false;
  }

  private matchesGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/{{GLOBSTAR}}/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  private getCachedResult(filePath: string): FileCache | null {
    const cached = this.cache.get(filePath);
    if (!cached) {
      this.cacheStats.misses++;
      return null;
    }

    try {
      // Check file modification time first (faster than reading content)
      const stat = fs.statSync(filePath);
      const cachedMtime = cached.mtime ? new Date(cached.mtime).getTime() : 0;
      const currentMtime = stat.mtimeMs;
      
      // If mtime changed, file was modified - invalidate cache
      if (cachedMtime !== currentMtime) {
        this.cache.delete(filePath);
        this.cacheStats.invalidations++;
        this.cacheStats.misses++;
        return null;
      }

      // Check cache expiration (TTL)
      const lastParsed = new Date(cached.lastParsed).getTime();
      const now = Date.now();
      if (now - lastParsed > this.CACHE_TTL_MS) {
        this.cache.delete(filePath);
        this.cacheStats.invalidations++;
        this.cacheStats.misses++;
        return null;
      }

      // Verify content hash for extra safety
      const content = fs.readFileSync(filePath, 'utf8');
      const currentHash = this.computeHash(content);

      if (cached.contentHash === currentHash) {
        this.cacheStats.hits++;
        return cached;
      } else {
        // Hash mismatch - file changed
        this.cache.delete(filePath);
        this.cacheStats.invalidations++;
        this.cacheStats.misses++;
        return null;
      }
    } catch {
      // File not accessible - remove from cache
      this.cache.delete(filePath);
      this.cacheStats.misses++;
      return null;
    }
  }

  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private loadCache(): void {
    try {
      const cacheFile = path.join(this.cacheDir, 'file-cache.json');
      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        this.cache = new Map(Object.entries(data));
      }
    } catch {
      // Cache invalid
    }
  }

  private saveCache(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const cacheFile = path.join(this.cacheDir, 'file-cache.json');
      const data: Record<string, FileCache> = {};
      
      this.cache.forEach((value, key) => {
        data[key] = value;
      });

      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    } catch {
      // Failed to save cache
    }
  }

  getAllLinks(): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    this.cache.forEach(fileCache => {
      links.push(...fileCache.extractedLinks);
    });
    return links;
  }

  getAllPlaceholders(): PlaceholderMatch[] {
    const placeholders: PlaceholderMatch[] = [];
    this.cache.forEach(fileCache => {
      placeholders.push(...fileCache.placeholders);
    });
    return placeholders;
  }

  getHighConfidenceLinks(): ExtractedLink[] {
    return this.getAllLinks().filter(link => link.confidence === 'high');
  }

  getDynamicLinks(): ExtractedLink[] {
    return this.getAllLinks().filter(link => link.isDynamic);
  }

  getGuardedLinks(): ExtractedLink[] {
    return this.getAllLinks().filter(link => link.guards.length > 0);
  }

  getUIPlaceholders(): PlaceholderMatch[] {
    return this.getAllPlaceholders().filter(p => p.type === 'ui-visible');
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0, invalidations: 0 };
    try {
      const cacheFile = path.join(this.cacheDir, 'file-cache.json');
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    } catch {
      // Failed to clear cache
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
    const treeTotal = this.cacheStats.treeHits + this.cacheStats.treeMisses;
    const treeHitRate = treeTotal > 0 ? (this.cacheStats.treeHits / treeTotal) * 100 : 0;
    return {
      ...this.cacheStats,
      total,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size,
      treeHitRate: Math.round(treeHitRate * 100) / 100,
      treeCacheSize: this.directoryTreeCache.size,
    };
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(filePath: string): void {
    if (this.cache.delete(filePath)) {
      this.cacheStats.invalidations++;
    }
    // Also invalidate parent directory tree cache
    const dir = path.dirname(filePath);
    this.directoryTreeCache.delete(dir);
  }

  /**
   * Invalidate expired cache entries
   */
  invalidateExpired(): number {
    const now = Date.now();
    let invalidated = 0;
    
    for (const [filePath, cached] of this.cache.entries()) {
      const lastParsed = new Date(cached.lastParsed).getTime();
      if (now - lastParsed > this.CACHE_TTL_MS) {
        this.cache.delete(filePath);
        invalidated++;
      }
    }
    
    this.cacheStats.invalidations += invalidated;
    return invalidated;
  }
}

export function createFileScanner(
  packageInfo: PackageInfo,
  options?: ScanOptions
): FileScanner {
  return new FileScanner(packageInfo, options);
}

export async function scanPackage(
  packageInfo: PackageInfo,
  options?: ScanOptions
): Promise<ScanResult> {
  const scanner = new FileScanner(packageInfo, options);
  return scanner.scan();
}
