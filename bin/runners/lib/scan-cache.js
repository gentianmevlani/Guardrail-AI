/**
 * Scan Cache - File-level caching for incremental scans
 * 
 * Caches scan results by file hash to avoid re-scanning unchanged files.
 * Dramatically improves performance for large codebases.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

// Cache configuration
const CACHE_VERSION = "1";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_MAX_ENTRIES = 10000;

/**
 * Get the cache directory path
 */
function getCacheDir() {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "guardrail",
      "cache"
    );
  }
  return path.join(home, ".cache", "guardrail", "scans");
}

/**
 * Get cache file path for a project
 */
function getCacheFilePath(projectPath) {
  const cacheDir = getCacheDir();
  const projectHash = crypto
    .createHash("sha256")
    .update(path.resolve(projectPath))
    .digest("hex")
    .slice(0, 16);
  return path.join(cacheDir, `scan-cache-${projectHash}.json`);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Compute file hash for cache key
 */
function computeFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

/**
 * Load cache from disk
 */
function loadCache(projectPath) {
  try {
    const cachePath = getCacheFilePath(projectPath);
    if (!fs.existsSync(cachePath)) {
      return { version: CACHE_VERSION, entries: {} };
    }
    
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    
    // Check version
    if (data.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, entries: {} };
    }
    
    // Prune old entries
    const now = Date.now();
    const entries = {};
    for (const [key, entry] of Object.entries(data.entries)) {
      if (now - entry.timestamp < CACHE_MAX_AGE_MS) {
        entries[key] = entry;
      }
    }
    
    return { version: CACHE_VERSION, entries };
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

/**
 * Save cache to disk with file locking to prevent race conditions
 * Uses atomic write pattern: write to temp file, then rename
 */
function saveCache(projectPath, cache) {
  try {
    ensureCacheDir();
    const cachePath = getCacheFilePath(projectPath);
    const tempPath = `${cachePath}.tmp.${Date.now()}`;
    
    // Limit cache size
    const entries = Object.entries(cache.entries);
    if (entries.length > CACHE_MAX_ENTRIES) {
      // Keep most recent entries
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      cache.entries = Object.fromEntries(entries.slice(0, CACHE_MAX_ENTRIES));
    }
    
    // Atomic write: write to temp file first, then rename
    // This prevents race conditions from concurrent cache writes
    fs.writeFileSync(tempPath, JSON.stringify(cache, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, cachePath);
    
    // Clean up any stale temp files older than 5 minutes
    try {
      const dir = path.dirname(cachePath);
      const files = fs.readdirSync(dir);
      const now = Date.now();
      for (const file of files) {
        if (file.startsWith(path.basename(cachePath) + '.tmp.')) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > 5 * 60 * 1000) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch {
      // Cleanup failure is not critical
    }
  } catch (err) {
    // Cache write failure is not critical - log but don't throw
    if (process.env.DEBUG || process.env.GUARDRAIL_DEBUG) {
      console.warn(`Cache save failed: ${err.message}`);
    }
  }
}

/**
 * ScanCache class for managing file-level scan caching
 */
class ScanCache {
  constructor(projectPath, options = {}) {
    this.projectPath = path.resolve(projectPath);
    this.enabled = options.useCache !== false;
    this.cache = this.enabled ? loadCache(this.projectPath) : { version: CACHE_VERSION, entries: {} };
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cached result for a file
   * @param {string} filePath - Absolute path to file
   * @returns {object|null} Cached findings or null if not cached
   */
  get(filePath) {
    if (!this.enabled) return null;
    
    const relativePath = path.relative(this.projectPath, filePath);
    const fileHash = computeFileHash(filePath);
    if (!fileHash) return null;
    
    const cacheKey = `${relativePath}:${fileHash}`;
    const entry = this.cache.entries[cacheKey];
    
    if (entry) {
      this.hits++;
      return entry.findings;
    }
    
    this.misses++;
    return null;
  }

  /**
   * Store findings for a file
   * @param {string} filePath - Absolute path to file
   * @param {Array} findings - Findings for this file
   */
  set(filePath, findings) {
    if (!this.enabled) return;
    
    const relativePath = path.relative(this.projectPath, filePath);
    const fileHash = computeFileHash(filePath);
    if (!fileHash) return;
    
    const cacheKey = `${relativePath}:${fileHash}`;
    this.cache.entries[cacheKey] = {
      findings,
      timestamp: Date.now(),
    };
  }

  /**
   * Save cache to disk
   */
  save() {
    if (this.enabled) {
      saveCache(this.projectPath, this.cache);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(1) + "%" : "N/A",
      entries: Object.keys(this.cache.entries).length,
    };
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.entries = {};
    this.save();
  }

  /**
   * Invalidate cache for specific files
   * @param {string[]} filePaths - Files to invalidate
   */
  invalidate(filePaths) {
    for (const filePath of filePaths) {
      const relativePath = path.relative(this.projectPath, filePath);
      // Remove all entries for this file (any hash)
      for (const key of Object.keys(this.cache.entries)) {
        if (key.startsWith(relativePath + ":")) {
          delete this.cache.entries[key];
        }
      }
    }
    this.save();
  }
}

/**
 * Clear all scan caches
 */
function clearAllCaches() {
  try {
    const cacheDir = getCacheDir();
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        if (file.startsWith("scan-cache-") && file.endsWith(".json")) {
          fs.unlinkSync(path.join(cacheDir, file));
        }
      }
    }
    return { success: true, message: "All scan caches cleared" };
  } catch (err) {
    return { success: false, message: `Failed to clear caches: ${err.message}` };
  }
}

/**
 * Get cache info for all projects
 */
function getCacheInfo() {
  try {
    const cacheDir = getCacheDir();
    if (!fs.existsSync(cacheDir)) {
      return { projects: [], totalSize: 0 };
    }
    
    const projects = [];
    let totalSize = 0;
    
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      if (file.startsWith("scan-cache-") && file.endsWith(".json")) {
        const filePath = path.join(cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          projects.push({
            file,
            entries: Object.keys(data.entries || {}).length,
            size: stats.size,
            modified: stats.mtime,
          });
        } catch {
          // Ignore corrupted cache files
        }
      }
    }
    
    return {
      projects,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
    };
  } catch {
    return { projects: [], totalSize: 0 };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

module.exports = {
  ScanCache,
  clearAllCaches,
  getCacheInfo,
  getCacheDir,
  computeFileHash,
};
