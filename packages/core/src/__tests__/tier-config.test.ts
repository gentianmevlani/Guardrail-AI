/**
 * Tier Configuration Drift Prevention Tests
 */

import {
  FEATURES,
  PURCHASABLE_TIERS,
  TIERS,
  TIER_CONFIG,
  TIER_ORDER,
  Tier,
  compareTiers,
  getMinimumTierForFeature,
  getPricingPageTiers,
  getRateLimiterTiers,
  getTierConfig,
  isTierHigher,
  isValidTier,
  tierHasFeature,
} from "../tier-config";

describe("Tier Configuration", () => {
  describe("Tier Enum Consistency", () => {
    it("should have exactly 4 tiers", () => {
      expect(TIERS).toHaveLength(4);
    });

    it("should include all required tiers", () => {
      const requiredTiers = ["free", "starter", "pro", "compliance"];
      for (const tier of requiredTiers) {
        expect(TIERS).toContain(tier);
      }
    });

    it("should have TIER_CONFIG for every tier in TIERS", () => {
      for (const tier of TIERS) {
        expect(TIER_CONFIG[tier]).toBeDefined();
        expect(TIER_CONFIG[tier].id).toBe(tier);
        expect(TIER_CONFIG[tier].name).toBeTruthy();
      }
    });

    it("should have TIER_ORDER match TIERS", () => {
      expect(TIER_ORDER).toHaveLength(TIERS.length);
      for (const tier of TIERS) {
        expect(TIER_ORDER).toContain(tier);
      }
    });

    it("should have purchasable tiers be a subset of all tiers", () => {
      for (const tier of PURCHASABLE_TIERS) {
        expect(TIERS).toContain(tier);
      }
    });

    it("should not include free in purchasable tiers", () => {
      expect(PURCHASABLE_TIERS).not.toContain("free");
    });
  });

  describe("Tier Configuration Completeness", () => {
    it("should have all required fields for each tier", () => {
      for (const tier of TIERS) {
        const config = TIER_CONFIG[tier];

        expect(config.id).toBe(tier);
        expect(typeof config.name).toBe("string");
        expect(typeof config.price).toBe("number");
        expect(typeof config.annualPrice).toBe("number");
        expect(typeof config.description).toBe("string");
        expect(Array.isArray(config.features)).toBe(true);

        expect(typeof config.limits.scansPerMonth).toBe("number");
        expect(typeof config.limits.realityRunsPerMonth).toBe("number");
        expect(typeof config.limits.aiAgentRunsPerMonth).toBe("number");
        expect(typeof config.limits.projects).toBe("number");
        expect(typeof config.limits.teamMembers).toBe("number");
        expect(typeof config.limits.complianceFrameworks).toBe("number");

        expect(typeof config.rateLimit.requestsPerMinute).toBe("number");
        expect(typeof config.rateLimit.burstLimit).toBe("number");
        expect(typeof config.rateLimit.windowMs).toBe("number");

        expect(typeof config.upsell.message).toBe("string");
        expect(TIERS).toContain(config.upsell.nextTier);
      }
    });

    it("should have features be valid Feature types", () => {
      for (const tier of TIERS) {
        const config = TIER_CONFIG[tier];
        for (const feature of config.features) {
          expect(FEATURES).toContain(feature);
        }
      }
    });

    it("should have increasing limits as tiers increase", () => {
      const orderedTiers: Tier[] = ["free", "starter", "pro", "compliance"];

      for (let i = 1; i < orderedTiers.length; i++) {
        const prevTierKey = orderedTiers[i - 1]!;
        const currTierKey = orderedTiers[i]!;
        const prevTier = TIER_CONFIG[prevTierKey];
        const currTier = TIER_CONFIG[currTierKey];

        if (prevTier.limits.scansPerMonth !== -1) {
          expect(currTier.limits.scansPerMonth).toBeGreaterThanOrEqual(
            prevTier.limits.scansPerMonth,
          );
        }
      }
    });

    it("should have increasing rate limits as tiers increase", () => {
      const orderedTiers: Tier[] = ["free", "starter", "pro", "compliance"];

      for (let i = 1; i < orderedTiers.length; i++) {
        const prevTierKey = orderedTiers[i - 1]!;
        const currTierKey = orderedTiers[i]!;
        const prevTier = TIER_CONFIG[prevTierKey];
        const currTier = TIER_CONFIG[currTierKey];

        expect(currTier.rateLimit.requestsPerMinute).toBeGreaterThanOrEqual(
          prevTier.rateLimit.requestsPerMinute,
        );
      }
    });
  });

  describe("Pricing Consistency", () => {
    it("should have free tier at $0", () => {
      expect(TIER_CONFIG.free.price).toBe(0);
      expect(TIER_CONFIG.free.annualPrice).toBe(0);
    });

    it("should have starter at $9.99/mo", () => {
      expect(TIER_CONFIG.starter.price).toBe(9.99);
    });

    it("should have pro at $29.99/mo", () => {
      expect(TIER_CONFIG.pro.price).toBe(29.99);
    });

    it("should have compliance at $59.99/mo", () => {
      expect(TIER_CONFIG.compliance.price).toBe(59.99);
    });

    it("should have annual pricing be approximately 20% off monthly*12", () => {
      const EXPECTED_DISCOUNT = 0.2;
      const TOLERANCE = 0.02;

      for (const tier of PURCHASABLE_TIERS) {
        const config = TIER_CONFIG[tier];
        if (config.price > 0) {
          const monthlyTotal = config.price * 12;
          const actualDiscount = (monthlyTotal - config.annualPrice) / monthlyTotal;

          expect(actualDiscount).toBeGreaterThanOrEqual(EXPECTED_DISCOUNT - TOLERANCE);
          expect(actualDiscount).toBeLessThanOrEqual(EXPECTED_DISCOUNT + TOLERANCE);
        }
      }
    });
  });

  describe("Helper Functions", () => {
    it("isValidTier should validate tier strings", () => {
      expect(isValidTier("free")).toBe(true);
      expect(isValidTier("starter")).toBe(true);
      expect(isValidTier("pro")).toBe(true);
      expect(isValidTier("compliance")).toBe(true);
      expect(isValidTier("enterprise")).toBe(false);
      expect(isValidTier("unlimited")).toBe(false);
      expect(isValidTier("invalid")).toBe(false);
    });

    it("getTierConfig should return correct config", () => {
      expect(getTierConfig("pro").name).toBe("Pro");
      expect(getTierConfig("compliance").name).toBe("Compliance");
    });

    it("compareTiers should correctly order tiers", () => {
      expect(compareTiers("free", "pro")).toBeLessThan(0);
      expect(compareTiers("pro", "free")).toBeGreaterThan(0);
      expect(compareTiers("pro", "pro")).toBe(0);
      expect(compareTiers("starter", "compliance")).toBeLessThan(0);
    });

    it("isTierHigher should correctly compare tiers", () => {
      expect(isTierHigher("pro", "free")).toBe(true);
      expect(isTierHigher("free", "pro")).toBe(false);
      expect(isTierHigher("compliance", "starter")).toBe(true);
    });

    it("getMinimumTierForFeature should find correct tier", () => {
      expect(getMinimumTierForFeature("scan")).toBe("free");
      expect(getMinimumTierForFeature("reality")).toBe("starter");
      expect(getMinimumTierForFeature("ai-agent")).toBe("pro");
      expect(getMinimumTierForFeature("compliance:soc2")).toBe("compliance");
    });

    it("tierHasFeature should check features correctly", () => {
      expect(tierHasFeature("free", "scan")).toBe(true);
      expect(tierHasFeature("free", "reality")).toBe(false);
      expect(tierHasFeature("starter", "reality")).toBe(true);
      expect(tierHasFeature("starter", "fix:auto")).toBe(false);
      expect(tierHasFeature("pro", "fix:auto")).toBe(true);
      expect(tierHasFeature("compliance", "compliance:soc2")).toBe(true);
    });
  });

  describe("Pricing Page Integration", () => {
    it("getPricingPageTiers should return 4 tiers for display", () => {
      const pricingTiers = getPricingPageTiers();
      expect(pricingTiers).toHaveLength(4);
    });

    it("getPricingPageTiers should include free, starter, pro, compliance", () => {
      const pricingTiers = getPricingPageTiers();
      const tierIds = pricingTiers.map((t) => t.id);

      expect(tierIds).toContain("free");
      expect(tierIds).toContain("starter");
      expect(tierIds).toContain("pro");
      expect(tierIds).toContain("compliance");
    });

    it("getPricingPageTiers should mark pro as popular", () => {
      const pricingTiers = getPricingPageTiers();
      const proTier = pricingTiers.find((t) => t.id === "pro");

      expect(proTier?.popular).toBe(true);
    });

    it("getPricingPageTiers prices should match TIER_CONFIG", () => {
      const pricingTiers = getPricingPageTiers();

      for (const tier of pricingTiers) {
        const config = TIER_CONFIG[tier.id as Tier];
        expect(tier.price).toBe(config.price);
        expect(tier.annual).toBe(config.annualPrice);
        expect(tier.name).toBe(config.name);
      }
    });
  });

  describe("Rate Limiter Integration", () => {
    it("getRateLimiterTiers should return config for all tiers", () => {
      const rateLimiterTiers = getRateLimiterTiers();

      for (const tier of TIERS) {
        expect(rateLimiterTiers[tier]).toBeDefined();
        expect(rateLimiterTiers[tier].name).toBe(TIER_CONFIG[tier].name);
        expect(rateLimiterTiers[tier].baseLimit).toBe(
          TIER_CONFIG[tier].rateLimit.requestsPerMinute,
        );
        expect(rateLimiterTiers[tier].burstLimit).toBe(
          TIER_CONFIG[tier].rateLimit.burstLimit,
        );
        expect(rateLimiterTiers[tier].windowMs).toBe(
          TIER_CONFIG[tier].rateLimit.windowMs,
        );
      }
    });
  });

  describe("No Legacy Tiers", () => {
    it('should not have "team" tier (replaced by compliance)', () => {
      expect(TIERS).not.toContain("team");
      expect(TIER_CONFIG).not.toHaveProperty("team");
    });

    it('should not have "enterprise" or "unlimited" tier', () => {
      expect(TIERS).not.toContain("enterprise");
      expect(TIERS).not.toContain("unlimited");
    });
  });
});
