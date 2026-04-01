/**
 * Runtime assertions and tests for run detail mapper
 * Catches schema drift and validates data transformations
 */

import {
  mapFilesWithStats,
  mapFindingsWithConfidence,
  mapFindingsToFixPacks,
  validateRunDetailSchema,
  type FindingWithConfidence,
} from "../run-detail-mapper";
import type { RunDetail, RunDetailFinding } from "@/lib/api";

describe("run-detail-mapper", () => {
  const mockFinding: RunDetailFinding = {
    id: "test-1",
    severity: "high",
    rule: "secret-detected",
    message: "Potential secret detected",
    file: "src/config.ts",
    line: 42,
    fixable: true,
  };

  const mockRun: RunDetail = {
    id: "run-123",
    timestamp: new Date().toISOString(),
    repo: "test/repo",
    branch: "main",
    commit: "abc123",
    trigger: "ci",
    profile: "standard",
    verdict: "NO_SHIP",
    duration: 120,
    tools: ["security", "reality"],
    author: "test@example.com",
    policyHash: "pol_abc123",
    findings: [mockFinding],
    artifacts: [],
    gates: [],
    mockproofTraces: [],
    airlockResults: [],
  };

  describe("validateRunDetailSchema", () => {
    it("should validate a complete run detail", () => {
      const result = validateRunDetailSchema(mockRun);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing required fields", () => {
      const invalidRun = { ...mockRun };
      delete (invalidRun as any).id;
      const result = validateRunDetailSchema(invalidRun as RunDetail);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect invalid findings structure", () => {
      const invalidRun = { ...mockRun, findings: null as any };
      const result = validateRunDetailSchema(invalidRun);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("array"))).toBe(true);
    });

    it("should detect missing finding fields", () => {
      const invalidRun = {
        ...mockRun,
        findings: [{ id: "test" }] as any,
      };
      const result = validateRunDetailSchema(invalidRun);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle null run gracefully", () => {
      const result = validateRunDetailSchema(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Run detail is null");
    });
  });

  describe("mapFindingsWithConfidence", () => {
    it("should add confidence to findings", () => {
      const findings = [mockFinding];
      const result = mapFindingsWithConfidence(findings);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("confidence");
      expect(result[0]).toHaveProperty("confidenceSource", "derived");
      expect(result[0].confidence).toBeGreaterThanOrEqual(0);
      expect(result[0].confidence).toBeLessThanOrEqual(1);
    });

    it("should derive higher confidence for critical findings", () => {
      const criticalFinding = { ...mockFinding, severity: "critical" as const };
      const result = mapFindingsWithConfidence([criticalFinding]);
      expect(result[0].confidence).toBeGreaterThan(0.8);
    });

    it("should handle empty findings array", () => {
      const result = mapFindingsWithConfidence([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("mapFilesWithStats", () => {
    it("should group findings by file", () => {
      const findings: RunDetailFinding[] = [
        { ...mockFinding, file: "src/file1.ts" },
        { ...mockFinding, file: "src/file1.ts", id: "test-2" },
        { ...mockFinding, file: "src/file2.ts", id: "test-3" },
      ];
      const result = mapFilesWithStats(findings);
      expect(result).toHaveLength(2);
      expect(result.find((f) => f.path === "src/file1.ts")?.findingsCount).toBe(2);
      expect(result.find((f) => f.path === "src/file2.ts")?.findingsCount).toBe(1);
    });

    it("should calculate file scores correctly", () => {
      const findings: RunDetailFinding[] = [
        { ...mockFinding, severity: "critical" as const },
        { ...mockFinding, severity: "high" as const, id: "test-2" },
      ];
      const result = mapFilesWithStats(findings);
      expect(result[0].score).toBeLessThan(100);
      expect(result[0].criticalCount).toBe(1);
      expect(result[0].highCount).toBe(1);
    });

    it("should handle empty findings", () => {
      const result = mapFilesWithStats([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("mapFindingsToFixPacks", () => {
    it("should group findings by rule and severity", () => {
      const findings: FindingWithConfidence[] = [
        { ...mockFinding, confidence: 0.9, confidenceSource: "derived" },
        { ...mockFinding, id: "test-2", confidence: 0.85, confidenceSource: "derived" },
        {
          ...mockFinding,
          id: "test-3",
          rule: "console-log",
          confidence: 0.7,
          confidenceSource: "derived",
        },
      ];
      const result = mapFindingsToFixPacks(findings);
      expect(result).toHaveLength(2);
      expect(result.find((p) => p.rule === "secret-detected")?.findings).toHaveLength(2);
      expect(result.find((p) => p.rule === "console-log")?.findings).toHaveLength(1);
    });

    it("should calculate average confidence for packs", () => {
      const findings: FindingWithConfidence[] = [
        { ...mockFinding, confidence: 0.8, confidenceSource: "derived" },
        { ...mockFinding, id: "test-2", confidence: 0.9, confidenceSource: "derived" },
      ];
      const result = mapFindingsToFixPacks(findings);
      expect(result[0].confidence).toBe(0.85);
    });

    it("should handle empty findings", () => {
      const result = mapFindingsToFixPacks([]);
      expect(result).toHaveLength(0);
    });
  });
});

/**
 * Runtime assertion function that can be called in production
 * Logs warnings but doesn't throw to avoid breaking the UI
 */
export function assertRunDetailSchema(run: RunDetail | null): void {
  const validation = validateRunDetailSchema(run);
  if (!validation.valid) {
    console.warn(
      "[Schema Assertion] Run detail schema validation failed:",
      validation.errors,
    );
    // In development, you might want to throw or show a toast
    if (process.env.NODE_ENV === "development") {
      console.error("Schema validation errors:", validation.errors);
    }
  }
}
