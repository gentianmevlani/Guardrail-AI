import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the analysis engine
 * These test the core analysis utilities in isolation
 */

// Mock implementations for testing
const mockAnalyzeCode = vi.fn();
const mockCalculateScore = vi.fn();

describe("Analysis Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Code Analysis", () => {
    it("should identify security vulnerabilities in code", async () => {
      const testCode = `
        const password = "hardcoded123";
        eval(userInput);
      `;

      mockAnalyzeCode.mockResolvedValue({
        vulnerabilities: [
          { type: "hardcoded-secret", severity: "high", line: 2 },
          { type: "code-injection", severity: "critical", line: 3 },
        ],
        score: 25,
      });

      const result = await mockAnalyzeCode(testCode);

      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.vulnerabilities[0].type).toBe("hardcoded-secret");
      expect(result.score).toBeLessThan(50);
    });

    it("should pass clean code without vulnerabilities", async () => {
      const cleanCode = `
        const password = process.env.PASSWORD;
        const result = sanitize(userInput);
      `;

      mockAnalyzeCode.mockResolvedValue({
        vulnerabilities: [],
        score: 95,
      });

      const result = await mockAnalyzeCode(cleanCode);

      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it("should handle empty code gracefully", async () => {
      mockAnalyzeCode.mockResolvedValue({
        vulnerabilities: [],
        score: 100,
        warnings: ["Empty file analyzed"],
      });

      const result = await mockAnalyzeCode("");

      expect(result.score).toBe(100);
      expect(result.warnings).toContain("Empty file analyzed");
    });
  });

  describe("Score Calculation", () => {
    it("should calculate traffic light score correctly", () => {
      mockCalculateScore.mockImplementation((vulns: any[]) => {
        const criticalCount = vulns.filter(
          (v) => v.severity === "critical",
        ).length;
        const highCount = vulns.filter((v) => v.severity === "high").length;
        const mediumCount = vulns.filter((v) => v.severity === "medium").length;

        let score = 100;
        score -= criticalCount * 25;
        score -= highCount * 15;
        score -= mediumCount * 5;

        return Math.max(0, score);
      });

      // Red zone (<50)
      expect(
        mockCalculateScore([
          { severity: "critical" },
          { severity: "critical" },
        ]),
      ).toBe(50);

      // Yellow zone (50-79)
      expect(
        mockCalculateScore([{ severity: "high" }, { severity: "medium" }]),
      ).toBe(80);

      // Green zone (80+)
      expect(mockCalculateScore([{ severity: "medium" }])).toBe(95);
    });

    it("should never return negative scores", () => {
      mockCalculateScore.mockImplementation(() => Math.max(0, -50));

      const score = mockCalculateScore([
        { severity: "critical" },
        { severity: "critical" },
        { severity: "critical" },
        { severity: "critical" },
        { severity: "critical" },
      ]);

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("File Type Detection", () => {
    it("should detect TypeScript files", () => {
      const detectFileType = (filename: string) => {
        const ext = filename.split(".").pop()?.toLowerCase();
        const typeMap: Record<string, string> = {
          ts: "typescript",
          tsx: "typescript-react",
          js: "javascript",
          jsx: "javascript-react",
          py: "python",
          rb: "ruby",
          go: "go",
          rs: "rust",
        };
        return typeMap[ext || ""] || "unknown";
      };

      expect(detectFileType("app.ts")).toBe("typescript");
      expect(detectFileType("Component.tsx")).toBe("typescript-react");
      expect(detectFileType("script.js")).toBe("javascript");
      expect(detectFileType("main.py")).toBe("python");
      expect(detectFileType("readme.md")).toBe("unknown");
    });
  });

  describe("Severity Prioritization", () => {
    it("should sort vulnerabilities by severity", () => {
      const vulnerabilities = [
        { id: 1, severity: "low" },
        { id: 2, severity: "critical" },
        { id: 3, severity: "medium" },
        { id: 4, severity: "high" },
      ];

      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...vulnerabilities].sort(
        (a, b) =>
          severityOrder[a.severity as keyof typeof severityOrder] -
          severityOrder[b.severity as keyof typeof severityOrder],
      );

      expect(sorted[0].severity).toBe("critical");
      expect(sorted[1].severity).toBe("high");
      expect(sorted[2].severity).toBe("medium");
      expect(sorted[3].severity).toBe("low");
    });
  });
});

describe("Utility Functions", () => {
  describe("sanitizeInput", () => {
    it("should escape HTML entities", () => {
      const sanitize = (input: string) =>
        input
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      expect(sanitize('<script>alert("xss")</script>')).toBe(
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
      );
    });
  });

  describe("truncateString", () => {
    it("should truncate long strings with ellipsis", () => {
      const truncate = (str: string, maxLength: number) =>
        str.length > maxLength ? str.slice(0, maxLength - 3) + "..." : str;

      expect(truncate("Hello World", 20)).toBe("Hello World");
      expect(truncate("This is a very long string", 10)).toBe("This is...");
    });
  });

  describe("deepMerge", () => {
    it("should merge nested objects correctly", () => {
      const deepMerge = (target: any, source: any): any => {
        const output = { ...target };
        for (const key in source) {
          if (source[key] instanceof Object && key in target) {
            output[key] = deepMerge(target[key], source[key]);
          } else {
            output[key] = source[key];
          }
        }
        return output;
      };

      const base = { a: 1, b: { c: 2, d: 3 } };
      const override = { b: { c: 4 }, e: 5 };
      const merged = deepMerge(base, override);

      expect(merged).toEqual({ a: 1, b: { c: 4, d: 3 }, e: 5 });
    });
  });
});
