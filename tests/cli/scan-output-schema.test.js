/**
 * Tests for scan output schema and validation
 */

const {
  SCHEMA_VERSION,
  CONFIDENCE_LEVELS,
  isBlocker,
  getConfidenceScore,
  calculateVerdict,
  calculateScore,
  dedupeFindings,
  sortFindings,
  createScanResult,
  validateScanResult,
} = require("../../bin/runners/lib/scan-output-schema");

describe("Scan Output Schema", () => {
  describe("SCHEMA_VERSION", () => {
    it("should be a valid semver string", () => {
      expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("isBlocker", () => {
    it("should block critical findings with high confidence", () => {
      expect(isBlocker({ severity: "critical", confidence: 90 })).toBe(true);
      expect(isBlocker({ severity: "critical", confidence: 75 })).toBe(true);
    });

    it("should not block critical findings with low confidence", () => {
      expect(isBlocker({ severity: "critical", confidence: 50 })).toBe(false);
    });

    it("should block high findings with very high confidence", () => {
      expect(isBlocker({ severity: "high", confidence: 90 })).toBe(true);
      expect(isBlocker({ severity: "high", confidence: 85 })).toBe(true);
    });

    it("should not block high findings with medium confidence", () => {
      expect(isBlocker({ severity: "high", confidence: 70 })).toBe(false);
    });

    it("should always block secret-type findings", () => {
      expect(isBlocker({ type: "secret", severity: "medium", confidence: 50 })).toBe(true);
      expect(isBlocker({ type: "api_key", severity: "low", confidence: 30 })).toBe(true);
    });
  });

  describe("getConfidenceScore", () => {
    it("should return known confidence for known types", () => {
      expect(getConfidenceScore("AWS_KEY")).toBe(CONFIDENCE_LEVELS.AWS_KEY);
      expect(getConfidenceScore("PRIVATE_KEY")).toBe(CONFIDENCE_LEVELS.PRIVATE_KEY);
    });

    it("should return default 50 for unknown types", () => {
      expect(getConfidenceScore("unknown_type")).toBe(50);
    });

    it("should reduce confidence for test files", () => {
      const baseScore = getConfidenceScore("MOCK_DATA");
      const testFileScore = getConfidenceScore("MOCK_DATA", { isTestFile: true });
      expect(testFileScore).toBeLessThan(baseScore);
    });

    it("should increase confidence for source files", () => {
      const baseScore = getConfidenceScore("GENERIC_API_KEY");
      const sourceFileScore = getConfidenceScore("GENERIC_API_KEY", { isSourceFile: true });
      expect(sourceFileScore).toBeGreaterThan(baseScore);
    });
  });

  describe("calculateVerdict", () => {
    it("should return pass for no findings", () => {
      expect(calculateVerdict([])).toBe("pass");
    });

    it("should return fail for any blockers", () => {
      expect(calculateVerdict([{ blocksShip: true, severity: "high", confidence: 90 }])).toBe("fail");
    });

    it("should return fail for critical findings", () => {
      // Hardened threshold: critical findings block only if confidence > 80%
      // High-confidence critical findings always block, even if blocksShip is false
      expect(calculateVerdict([{ severity: "critical", confidence: 81 }])).toBe("fail");
      // 80% confidence should NOT block (threshold is > 80%, not >= 80%)
      expect(calculateVerdict([{ severity: "critical", confidence: 80 }])).toBe("warn");
    });

    it("should return warn for high findings", () => {
      expect(calculateVerdict([{ severity: "high", confidence: 60, blocksShip: false }])).toBe("warn");
    });

    it("should return warn for medium findings", () => {
      expect(calculateVerdict([{ severity: "medium", confidence: 70, blocksShip: false }])).toBe("warn");
    });

    it("should return pass for only low findings", () => {
      expect(calculateVerdict([{ severity: "low", confidence: 50, blocksShip: false }])).toBe("pass");
    });
  });

  describe("calculateScore", () => {
    it("should return 100 for no findings", () => {
      expect(calculateScore([])).toBe(100);
    });

    it("should reduce score for critical findings", () => {
      const score = calculateScore([{ severity: "critical", confidence: 100 }]);
      expect(score).toBeLessThan(80);
    });

    it("should reduce score less for low-confidence findings", () => {
      const highConfScore = calculateScore([{ severity: "high", confidence: 100 }]);
      const lowConfScore = calculateScore([{ severity: "high", confidence: 50 }]);
      expect(lowConfScore).toBeGreaterThan(highConfScore);
    });

    it("should never go below 0", () => {
      const manyFindings = Array(100).fill({ severity: "critical", confidence: 100 });
      expect(calculateScore(manyFindings)).toBe(0);
    });
  });

  describe("dedupeFindings", () => {
    it("should remove duplicate findings", () => {
      const findings = [
        { type: "secret", file: "a.js", line: 10, message: "Found secret", severity: "high" },
        { type: "secret", file: "a.js", line: 10, message: "Found secret", severity: "high" },
      ];
      expect(dedupeFindings(findings)).toHaveLength(1);
    });

    it("should keep higher severity when deduping", () => {
      const findings = [
        { type: "secret", file: "a.js", line: 10, message: "Found secret", severity: "medium", confidence: 70 },
        { type: "secret", file: "a.js", line: 10, message: "Found secret", severity: "critical", confidence: 90 },
      ];
      const deduped = dedupeFindings(findings);
      expect(deduped[0].severity).toBe("critical");
    });

    it("should keep findings on different lines", () => {
      const findings = [
        { type: "secret", file: "a.js", line: 10, message: "Found secret", severity: "high" },
        { type: "secret", file: "a.js", line: 20, message: "Found secret", severity: "high" },
      ];
      expect(dedupeFindings(findings)).toHaveLength(2);
    });
  });

  describe("sortFindings", () => {
    it("should put blockers first", () => {
      const findings = [
        { blocksShip: false, severity: "critical", confidence: 100 },
        { blocksShip: true, severity: "low", confidence: 50 },
      ];
      const sorted = sortFindings(findings);
      expect(sorted[0].blocksShip).toBe(true);
    });

    it("should sort by severity within blockers", () => {
      const findings = [
        { blocksShip: true, severity: "high", confidence: 90 },
        { blocksShip: true, severity: "critical", confidence: 90 },
      ];
      const sorted = sortFindings(findings);
      expect(sorted[0].severity).toBe("critical");
    });

    it("should sort by confidence within same severity", () => {
      const findings = [
        { blocksShip: false, severity: "high", confidence: 70 },
        { blocksShip: false, severity: "high", confidence: 95 },
      ];
      const sorted = sortFindings(findings);
      expect(sorted[0].confidence).toBe(95);
    });
  });

  describe("createScanResult", () => {
    it("should create valid scan result with no findings", () => {
      const result = createScanResult({ findings: [] });
      expect(result.success).toBe(true);
      expect(result.verdict).toBe("pass");
      expect(result.score).toBe(100);
      expect(result.summary.total).toBe(0);
    });

    it("should include schema version", () => {
      const result = createScanResult({ findings: [] });
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it("should calculate correct summary", () => {
      const result = createScanResult({
        findings: [
          { severity: "critical", type: "secret" },
          { severity: "high", type: "stub" },
          { severity: "medium", type: "todo" },
          { severity: "low", type: "style" },
        ],
      });
      expect(result.summary.critical).toBe(1);
      expect(result.summary.high).toBe(1);
      expect(result.summary.medium).toBe(1);
      expect(result.summary.low).toBe(1);
      expect(result.summary.total).toBe(4);
    });

    it("should handle errors", () => {
      const result = createScanResult({
        findings: [],
        error: { message: "Test error", code: "TEST_ERROR" },
      });
      expect(result.success).toBe(false);
      expect(result.verdict).toBe("fail");
      expect(result.error.message).toBe("Test error");
    });
  });

  describe("validateScanResult", () => {
    it("should validate correct scan result", () => {
      const result = createScanResult({ findings: [] });
      const validation = validateScanResult(result);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should catch missing schemaVersion", () => {
      const validation = validateScanResult({ success: true });
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Missing schemaVersion");
    });

    it("should catch invalid verdict", () => {
      const validation = validateScanResult({
        schemaVersion: "1.0.0",
        success: true,
        verdict: "invalid",
        score: 100,
        summary: { total: 0 },
        findings: [],
        metadata: { scanId: "test", timestamp: new Date().toISOString() },
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("verdict"))).toBe(true);
    });

    it("should catch invalid score", () => {
      const validation = validateScanResult({
        schemaVersion: "1.0.0",
        success: true,
        verdict: "pass",
        score: 150,
        summary: { total: 0 },
        findings: [],
        metadata: { scanId: "test", timestamp: new Date().toISOString() },
      });
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("score"))).toBe(true);
    });
  });
});
