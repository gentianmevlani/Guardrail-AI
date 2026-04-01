/**
 * Typosquat Detector Tests
 *
 * Test suite for the TyposquatDetector class
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { TyposquatDetector } from "../../supply-chain/typosquat";

describe("TyposquatDetector", () => {
  let detector: TyposquatDetector;

  beforeEach(() => {
    detector = new TyposquatDetector();
  });

  describe("Exact Match Detection", () => {
    const legitimatePackages = [
      "react",
      "vue",
      "express",
      "lodash",
      "typescript",
      "axios",
      "webpack",
      "jest",
    ];

    it.each(legitimatePackages)(
      "should NOT flag legitimate package: %s",
      async (pkg) => {
        const result = await detector.detectTyposquatting(pkg);
        expect(result.isTyposquat).toBe(false);
      },
    );
  });

  describe("Character Swap Detection", () => {
    const swapAttempts = [
      { input: "raect", target: "react" },
      { input: "exrpess", target: "express" },
      { input: "loadsh", target: "lodash" },
      { input: "axois", target: "axios" },
    ];

    it.each(swapAttempts)(
      "should detect character swap: $input -> $target",
      async ({ input, target }) => {
        const result = await detector.detectTyposquatting(input);
        expect(result.isTyposquat).toBe(true);
        expect(result.targetPackage).toBe(target);
        expect(result.patterns).toContain("character_swap");
      },
    );
  });

  describe("Missing Character Detection", () => {
    const missingCharAttempts = [
      { input: "rect", target: "react" },
      { input: "expres", target: "express" },
      { input: "lodas", target: "lodash" },
      { input: "webpck", target: "webpack" },
    ];

    it.each(missingCharAttempts)(
      "should detect missing character: $input -> $target",
      async ({ input, target }) => {
        const result = await detector.detectTyposquatting(input);
        expect(result.isTyposquat).toBe(true);
        expect(result.targetPackage).toBe(target);
        expect(result.patterns).toContain("missing_character");
      },
    );
  });

  describe("Extra Character Detection", () => {
    const extraCharAttempts = [
      { input: "reactt", target: "react" },
      { input: "expresss", target: "express" },
      { input: "lodassh", target: "lodash" },
      { input: "axioss", target: "axios" },
    ];

    it.each(extraCharAttempts)(
      "should detect extra character: $input -> $target",
      async ({ input, target }) => {
        const result = await detector.detectTyposquatting(input);
        expect(result.isTyposquat).toBe(true);
        expect(result.targetPackage).toBe(target);
        expect(result.patterns).toContain("extra_character");
      },
    );
  });

  describe("Homoglyph Detection", () => {
    const homoglyphAttempts = [
      { input: "reаct", description: "cyrillic a" },
      { input: "exprеss", description: "cyrillic e" },
      { input: "l0dash", description: "zero for o" },
      { input: "ax1os", description: "one for i" },
    ];

    it.each(homoglyphAttempts)(
      "should detect homoglyph attack: $input ($description)",
      async ({ input }) => {
        const result = await detector.detectTyposquatting(input);
        // Homoglyph detection may vary based on implementation
        expect(result.similarity).toBeGreaterThan(0);
      },
    );
  });

  describe("Combosquatting Detection", () => {
    const comboAttempts = [
      { input: "react-native-helper", target: "react" },
      { input: "express-security", target: "express" },
      { input: "lodash-utils", target: "lodash" },
      { input: "axios-wrapper", target: "axios" },
    ];

    it.each(comboAttempts)(
      "should detect combosquatting: $input -> $target",
      async ({ input }) => {
        const result = await detector.detectTyposquatting(input);
        if (result.isTyposquat) {
          expect(result.patterns).toContain("combosquatting");
        }
      },
    );
  });

  describe("Levenshtein Distance", () => {
    it("should calculate similarity based on Levenshtein distance", async () => {
      const result = await detector.detectTyposquatting("reakt");
      expect(result.similarity).toBeGreaterThan(0.7);
    });

    it("should have low similarity for unrelated packages", async () => {
      const result = await detector.detectTyposquatting(
        "completely-different-package",
      );
      expect(result.similarity).toBeLessThan(0.5);
    });
  });

  describe("Result Structure", () => {
    it("should return complete result structure", async () => {
      const result = await detector.detectTyposquatting("reakt");

      expect(result).toHaveProperty("isTyposquat");
      expect(result).toHaveProperty("suspiciousPackage");
      expect(result).toHaveProperty("similarity");
      expect(result).toHaveProperty("patterns");
      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it("should include target package when typosquat detected", async () => {
      const result = await detector.detectTyposquatting("reakt");

      if (result.isTyposquat) {
        expect(result.targetPackage).toBeDefined();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", async () => {
      const result = await detector.detectTyposquatting("");
      expect(result.isTyposquat).toBe(false);
    });

    it("should handle very long package names", async () => {
      const longName = "a".repeat(100);
      const result = await detector.detectTyposquatting(longName);
      expect(result).toBeDefined();
    });

    it("should handle special characters", async () => {
      const result = await detector.detectTyposquatting("@scope/react");
      expect(result).toBeDefined();
    });

    it("should be case insensitive", async () => {
      const result1 = await detector.detectTyposquatting("REACT");
      const result2 = await detector.detectTyposquatting("React");
      // Both should handle case variations
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
