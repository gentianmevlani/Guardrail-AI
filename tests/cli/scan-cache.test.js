/**
 * Tests for scan cache functionality
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  ScanCache,
  clearAllCaches,
  getCacheInfo,
  computeFileHash,
} = require("../../bin/runners/lib/scan-cache");

describe("Scan Cache", () => {
  let testDir;
  let testFile;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardrail-cache-test-"));
    testFile = path.join(testDir, "test.js");
    fs.writeFileSync(testFile, "const x = 1;");
  });

  afterEach(() => {
    // Cleanup test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("computeFileHash", () => {
    it("should compute consistent hash for same content", () => {
      const hash1 = computeFileHash(testFile);
      const hash2 = computeFileHash(testFile);
      expect(hash1).toBe(hash2);
    });

    it("should compute different hash for different content", () => {
      const hash1 = computeFileHash(testFile);
      fs.writeFileSync(testFile, "const x = 2;");
      const hash2 = computeFileHash(testFile);
      expect(hash1).not.toBe(hash2);
    });

    it("should return null for non-existent file", () => {
      expect(computeFileHash("/non/existent/file.js")).toBeNull();
    });
  });

  describe("ScanCache", () => {
    it("should create cache instance", () => {
      const cache = new ScanCache(testDir);
      expect(cache).toBeInstanceOf(ScanCache);
    });

    it("should return null for uncached files", () => {
      const cache = new ScanCache(testDir);
      expect(cache.get(testFile)).toBeNull();
    });

    it("should cache and retrieve findings", () => {
      const cache = new ScanCache(testDir);
      const findings = [{ type: "test", message: "Test finding" }];
      
      cache.set(testFile, findings);
      const cached = cache.get(testFile);
      
      expect(cached).toEqual(findings);
    });

    it("should invalidate cache when file changes", () => {
      const cache = new ScanCache(testDir);
      const findings = [{ type: "test", message: "Test finding" }];
      
      cache.set(testFile, findings);
      expect(cache.get(testFile)).toEqual(findings);
      
      // Change file content
      fs.writeFileSync(testFile, "const x = 999;");
      
      // Cache miss because hash changed
      expect(cache.get(testFile)).toBeNull();
    });

    it("should track hits and misses", () => {
      const cache = new ScanCache(testDir);
      const findings = [{ type: "test" }];
      
      cache.get(testFile); // miss
      cache.set(testFile, findings);
      cache.get(testFile); // hit
      cache.get(testFile); // hit
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it("should calculate hit rate", () => {
      const cache = new ScanCache(testDir);
      const findings = [{ type: "test" }];
      
      cache.set(testFile, findings);
      cache.get(testFile); // hit
      cache.get(testFile); // hit
      cache.get(path.join(testDir, "nonexistent.js")); // miss
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe("66.7%");
    });

    it("should be disabled when useCache is false", () => {
      const cache = new ScanCache(testDir, { useCache: false });
      const findings = [{ type: "test" }];
      
      cache.set(testFile, findings);
      expect(cache.get(testFile)).toBeNull();
    });

    it("should clear all entries", () => {
      const cache = new ScanCache(testDir);
      const findings = [{ type: "test" }];
      
      cache.set(testFile, findings);
      expect(cache.get(testFile)).toEqual(findings);
      
      cache.clear();
      expect(cache.get(testFile)).toBeNull();
    });

    it("should invalidate specific files", () => {
      const cache = new ScanCache(testDir);
      const testFile2 = path.join(testDir, "test2.js");
      fs.writeFileSync(testFile2, "const y = 2;");
      
      cache.set(testFile, [{ type: "finding1" }]);
      cache.set(testFile2, [{ type: "finding2" }]);
      
      cache.invalidate([testFile]);
      
      expect(cache.get(testFile)).toBeNull();
      expect(cache.get(testFile2)).toEqual([{ type: "finding2" }]);
    });
  });

  describe("clearAllCaches", () => {
    it("should return success", () => {
      const result = clearAllCaches();
      expect(result.success).toBe(true);
    });
  });

  describe("getCacheInfo", () => {
    it("should return cache info object", () => {
      const info = getCacheInfo();
      expect(info).toHaveProperty("projects");
      expect(info).toHaveProperty("totalSize");
      expect(Array.isArray(info.projects)).toBe(true);
    });
  });
});
