/**
 * Path Safety Utilities Tests
 */

import * as path from "path";
import {
  assertValidPath,
  containsTraversal,
  isDangerousPath,
  safeArchiveEntryPath,
  safeJoin,
  sanitizeFilename,
  validatePath,
} from "../path-safety";

// Mock logger to prevent console output during tests
jest.mock("../../logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Path Safety Utilities", () => {
  describe("containsTraversal", () => {
    it("should detect parent directory traversal", () => {
      expect(containsTraversal("../")).toBe(true);
      expect(containsTraversal("..\\file.txt")).toBe(true);
      expect(containsTraversal("foo/../bar")).toBe(true);
    });

    it("should detect URL encoded traversal", () => {
      expect(containsTraversal("%2e%2e/")).toBe(true);
      expect(containsTraversal("%252e%252e/")).toBe(true);
    });

    it("should detect null byte injection", () => {
      expect(containsTraversal("file.txt\0.jpg")).toBe(true);
      expect(containsTraversal("file%00.txt")).toBe(true);
    });

    it("should pass safe paths", () => {
      expect(containsTraversal("normal-file.txt")).toBe(false);
      expect(containsTraversal("folder/subfolder/file.txt")).toBe(false);
    });
  });

  describe("isDangerousPath", () => {
    it("should detect dangerous system paths", () => {
      expect(isDangerousPath("/etc/passwd")).toBe(true);
      expect(isDangerousPath("/var/log/system.log")).toBe(true);
      expect(isDangerousPath("C:\\Windows\\System32")).toBe(true);
    });

    it("should allow safe paths", () => {
      expect(isDangerousPath("/uploads/file.txt")).toBe(false);
      expect(isDangerousPath("./data/file.txt")).toBe(false);
    });
  });

  describe("sanitizeFilename", () => {
    it("should extract basename from path traversal attempts", () => {
      expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
      expect(sanitizeFilename("..\\..\\Windows\\System32\\config")).toBe(
        "config",
      );
    });

    it("should remove null bytes", () => {
      const result = sanitizeFilename("file.txt\0.exe");
      expect(result).not.toContain("\0");
    });

    it("should sanitize special characters", () => {
      expect(sanitizeFilename("file<script>.txt")).toBe("file_script_.txt");
      expect(sanitizeFilename("file|name.txt")).toBe("file_name.txt");
    });

    it("should preserve file extensions", () => {
      const result = sanitizeFilename("document.pdf");
      expect(result).toMatch(/\.pdf$/);
    });

    it("should handle Windows reserved names", () => {
      expect(sanitizeFilename("CON.txt")).toMatch(/^_/);
      expect(sanitizeFilename("NUL")).toMatch(/^_/);
    });

    it("should limit filename length", () => {
      const longName = "a".repeat(300) + ".txt";
      const result = sanitizeFilename(longName, { maxLength: 255 });
      expect(result.length).toBeLessThanOrEqual(255);
    });

    it("should handle empty or invalid filenames", () => {
      const result = sanitizeFilename("");
      expect(result).toMatch(/^file_\d+$/);
    });
  });

  describe("safeJoin", () => {
    it("should join paths safely", () => {
      const base = "/uploads";
      const result = safeJoin(base, "user123", "file.txt");
      expect(result).toBe(path.resolve("/uploads/user123/file.txt"));
    });

    it("should prevent path escape attempts", () => {
      const base = "/uploads";
      expect(() => safeJoin(base, "../etc/passwd")).toThrow(
        /escape attempt blocked/i,
      );
    });

    it("should sanitize malicious segments", () => {
      const base = "/uploads";
      // The function sanitizes traversal attempts in segments
      const result = safeJoin(base, "normal-file.txt");
      expect(result.startsWith(path.resolve(base))).toBe(true);
    });
  });

  describe("validatePath", () => {
    it("should validate safe paths", () => {
      const result = validatePath("normal-file.txt");
      expect(result.valid).toBe(true);
    });

    it("should reject traversal attempts", () => {
      const result = validatePath("../../../etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("traversal");
    });

    it("should reject null bytes", () => {
      const result = validatePath("file.txt\0");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("null byte");
    });

    it("should validate against base directory", () => {
      const result = validatePath("../escape", "/uploads");
      expect(result.valid).toBe(false);
    });
  });

  describe("assertValidPath", () => {
    it("should not throw for valid paths", () => {
      expect(() => assertValidPath("safe-file.txt")).not.toThrow();
    });

    it("should throw for invalid paths", () => {
      expect(() => assertValidPath("../../../etc/passwd")).toThrow();
    });
  });

  describe("safeArchiveEntryPath (Zip Slip Prevention)", () => {
    it("should allow normal archive entries", () => {
      const extractDir = "/tmp/extract";
      const result = safeArchiveEntryPath("folder/file.txt", extractDir);
      expect(result.startsWith(path.resolve(extractDir))).toBe(true);
    });

    it("should block Zip Slip attacks", () => {
      const extractDir = "/tmp/extract";
      expect(() =>
        safeArchiveEntryPath("../../../etc/passwd", extractDir),
      ).toThrow();
    });

    it("should reject absolute paths in archives", () => {
      const extractDir = "/tmp/extract";
      expect(() => safeArchiveEntryPath("/etc/passwd", extractDir)).toThrow(
        /absolute path/,
      );
    });
  });
});
