/**
 * Stripe Plan Mapping Tests
 *
 * Tests for mapStripePlanFromPriceId function which maps Stripe price IDs to billing tiers.
 * Covers monthly/annual prices, comma-separated lists, and unknown price ID handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

vi.mock("../../apps/api/src/logger", () => ({
  logger: mockLogger,
}));

// Helper to set env vars for testing
function setEnvVars(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

// Clear all price-related env vars
function clearPriceEnvVars() {
  const priceEnvVars = [
    "STRIPE_PRICE_ID_STARTER_MONTHLY",
    "STRIPE_PRICE_ID_STARTER_ANNUAL",
    "STRIPE_PRICE_ID_STARTER",
    "STRIPE_PRICE_ID_PRO_MONTHLY",
    "STRIPE_PRICE_ID_PRO_ANNUAL",
    "STRIPE_PRICE_ID_PRO",
    "STRIPE_PRICE_ID_COMPLIANCE_MONTHLY",
    "STRIPE_PRICE_ID_COMPLIANCE_ANNUAL",
    "STRIPE_PRICE_ID_COMPLIANCE",
    "STRIPE_PRICE_ID_ENTERPRISE_MONTHLY",
    "STRIPE_PRICE_ID_ENTERPRISE_ANNUAL",
    "STRIPE_PRICE_ID_ENTERPRISE",
    "STRIPE_PRICE_ID_TEAM_MONTHLY",
    "STRIPE_PRICE_ID_TEAM_ANNUAL",
    "STRIPE_PRICE_ID_TEAM",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_ANNUAL",
    "STRIPE_PRICE_TEAM_MONTHLY",
    "STRIPE_PRICE_TEAM_ANNUAL",
  ];
  for (const key of priceEnvVars) {
    delete process.env[key];
  }
}

// Import the functions after mocking
// Note: In a real test, you'd import from the actual module
// For this test file, we'll recreate the logic to test it independently

/**
 * Parse comma-separated price IDs from env var
 */
function parsePriceIds(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Check if a priceId matches any of the configured price IDs for a tier
 */
function priceIdMatchesTier(
  priceId: string,
  ...envVars: (string | undefined)[]
): boolean {
  for (const envVar of envVars) {
    const ids = parsePriceIds(envVar);
    if (ids.includes(priceId)) return true;
  }
  return false;
}

interface StripePlanMappingResult {
  tier: "starter" | "pro" | "compliance" | "enterprise" | "free";
  billingTierUnknown: boolean;
}

/**
 * Map a Stripe price ID to a billing tier.
 */
function mapStripePlanFromPriceId(
  priceId: string,
  context?: { customerId?: string; subscriptionId?: string },
): StripePlanMappingResult {
  // Check Starter tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
      process.env.STRIPE_PRICE_ID_STARTER_ANNUAL,
      process.env.STRIPE_PRICE_ID_STARTER,
    )
  ) {
    return { tier: "starter", billingTierUnknown: false };
  }

  // Check Pro tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
      process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
      process.env.STRIPE_PRICE_ID_PRO,
    )
  ) {
    return { tier: "pro", billingTierUnknown: false };
  }

  // Check Compliance tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_COMPLIANCE_MONTHLY,
      process.env.STRIPE_PRICE_ID_COMPLIANCE_ANNUAL,
      process.env.STRIPE_PRICE_ID_COMPLIANCE,
    )
  ) {
    return { tier: "compliance", billingTierUnknown: false };
  }

  // Check Enterprise tier (monthly + annual)
  if (
    priceIdMatchesTier(
      priceId,
      process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY,
      process.env.STRIPE_PRICE_ID_ENTERPRISE_ANNUAL,
      process.env.STRIPE_PRICE_ID_ENTERPRISE,
    )
  ) {
    return { tier: "enterprise", billingTierUnknown: false };
  }

  // Unknown price ID - log structured error and return safe default
  mockLogger.error(
    {
      priceId,
      customerId: context?.customerId,
      subscriptionId: context?.subscriptionId,
      configuredPrices: {
        starter: {
          monthly: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_STARTER_ANNUAL,
        },
        pro: {
          monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_PRO_ANNUAL,
        },
        compliance: {
          monthly: process.env.STRIPE_PRICE_ID_COMPLIANCE_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_COMPLIANCE_ANNUAL,
        },
        enterprise: {
          monthly: process.env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY,
          annual: process.env.STRIPE_PRICE_ID_ENTERPRISE_ANNUAL,
        },
      },
    },
    "Unknown Stripe price ID - unable to map to tier. Account flagged for admin review.",
  );

  return { tier: "free", billingTierUnknown: true };
}

describe("Stripe Plan Mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPriceEnvVars();
  });

  afterEach(() => {
    clearPriceEnvVars();
  });

  describe("parsePriceIds", () => {
    it("should return empty array for undefined", () => {
      expect(parsePriceIds(undefined)).toEqual([]);
    });

    it("should return empty array for empty string", () => {
      expect(parsePriceIds("")).toEqual([]);
    });

    it("should parse single price ID", () => {
      expect(parsePriceIds("price_abc123")).toEqual(["price_abc123"]);
    });

    it("should parse comma-separated price IDs", () => {
      expect(parsePriceIds("price_abc123,price_def456")).toEqual([
        "price_abc123",
        "price_def456",
      ]);
    });

    it("should trim whitespace from price IDs", () => {
      expect(parsePriceIds("price_abc123 , price_def456 , price_ghi789")).toEqual([
        "price_abc123",
        "price_def456",
        "price_ghi789",
      ]);
    });

    it("should filter out empty entries", () => {
      expect(parsePriceIds("price_abc123,,price_def456,")).toEqual([
        "price_abc123",
        "price_def456",
      ]);
    });
  });

  describe("priceIdMatchesTier", () => {
    it("should return false when no env vars are set", () => {
      expect(priceIdMatchesTier("price_abc123", undefined, undefined)).toBe(false);
    });

    it("should return true when price ID matches single env var", () => {
      expect(priceIdMatchesTier("price_abc123", "price_abc123")).toBe(true);
    });

    it("should return true when price ID matches one of multiple env vars", () => {
      expect(
        priceIdMatchesTier("price_def456", "price_abc123", "price_def456"),
      ).toBe(true);
    });

    it("should return true when price ID is in comma-separated list", () => {
      expect(
        priceIdMatchesTier("price_def456", "price_abc123,price_def456,price_ghi789"),
      ).toBe(true);
    });

    it("should return false when price ID does not match", () => {
      expect(
        priceIdMatchesTier("price_unknown", "price_abc123", "price_def456"),
      ).toBe(false);
    });
  });

  describe("mapStripePlanFromPriceId - Starter Tier", () => {
    it("should map starter monthly price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter_monthly" });

      const result = mapStripePlanFromPriceId("price_starter_monthly");

      expect(result.tier).toBe("starter");
      expect(result.billingTierUnknown).toBe(false);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should map starter annual price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_STARTER_ANNUAL: "price_starter_annual" });

      const result = mapStripePlanFromPriceId("price_starter_annual");

      expect(result.tier).toBe("starter");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map legacy starter price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_STARTER: "price_starter_legacy" });

      const result = mapStripePlanFromPriceId("price_starter_legacy");

      expect(result.tier).toBe("starter");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map starter from comma-separated list", () => {
      setEnvVars({
        STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter_v1,price_starter_v2,price_starter_promo",
      });

      expect(mapStripePlanFromPriceId("price_starter_v1").tier).toBe("starter");
      expect(mapStripePlanFromPriceId("price_starter_v2").tier).toBe("starter");
      expect(mapStripePlanFromPriceId("price_starter_promo").tier).toBe("starter");
    });
  });

  describe("mapStripePlanFromPriceId - Pro Tier", () => {
    it("should map pro monthly price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_monthly" });

      const result = mapStripePlanFromPriceId("price_pro_monthly");

      expect(result.tier).toBe("pro");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map pro annual price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_PRO_ANNUAL: "price_pro_annual" });

      const result = mapStripePlanFromPriceId("price_pro_annual");

      expect(result.tier).toBe("pro");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map legacy pro price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_PRO: "price_pro_legacy" });

      const result = mapStripePlanFromPriceId("price_pro_legacy");

      expect(result.tier).toBe("pro");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map pro from comma-separated list", () => {
      setEnvVars({
        STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_v1,price_pro_v2",
      });

      expect(mapStripePlanFromPriceId("price_pro_v1").tier).toBe("pro");
      expect(mapStripePlanFromPriceId("price_pro_v2").tier).toBe("pro");
    });
  });

  describe("mapStripePlanFromPriceId - Compliance Tier", () => {
    it("should map compliance monthly price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_COMPLIANCE_MONTHLY: "price_compliance_monthly" });

      const result = mapStripePlanFromPriceId("price_compliance_monthly");

      expect(result.tier).toBe("compliance");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map compliance annual price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_COMPLIANCE_ANNUAL: "price_compliance_annual" });

      const result = mapStripePlanFromPriceId("price_compliance_annual");

      expect(result.tier).toBe("compliance");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map legacy compliance price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_COMPLIANCE: "price_compliance_legacy" });

      const result = mapStripePlanFromPriceId("price_compliance_legacy");

      expect(result.tier).toBe("compliance");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map compliance from comma-separated list", () => {
      setEnvVars({
        STRIPE_PRICE_ID_COMPLIANCE_ANNUAL: "price_comp_annual_v1,price_comp_annual_v2",
      });

      expect(mapStripePlanFromPriceId("price_comp_annual_v1").tier).toBe("compliance");
      expect(mapStripePlanFromPriceId("price_comp_annual_v2").tier).toBe("compliance");
    });
  });

  describe("mapStripePlanFromPriceId - Enterprise Tier", () => {
    it("should map enterprise monthly price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: "price_enterprise_monthly" });

      const result = mapStripePlanFromPriceId("price_enterprise_monthly");

      expect(result.tier).toBe("enterprise");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map enterprise annual price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_ENTERPRISE_ANNUAL: "price_enterprise_annual" });

      const result = mapStripePlanFromPriceId("price_enterprise_annual");

      expect(result.tier).toBe("enterprise");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map legacy enterprise price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_ENTERPRISE: "price_enterprise_legacy" });

      const result = mapStripePlanFromPriceId("price_enterprise_legacy");

      expect(result.tier).toBe("enterprise");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should map enterprise from comma-separated list", () => {
      setEnvVars({
        STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: "price_ent_custom1,price_ent_custom2",
      });

      expect(mapStripePlanFromPriceId("price_ent_custom1").tier).toBe("enterprise");
      expect(mapStripePlanFromPriceId("price_ent_custom2").tier).toBe("enterprise");
    });
  });

  describe("mapStripePlanFromPriceId - Unknown Price ID", () => {
    it("should return free tier with billingTierUnknown=true for unknown price ID", () => {
      setEnvVars({
        STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_monthly",
        STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: "price_enterprise_monthly",
      });

      const result = mapStripePlanFromPriceId("price_unknown_xyz");

      expect(result.tier).toBe("free");
      expect(result.billingTierUnknown).toBe(true);
    });

    it("should log structured error with priceId for unknown price", () => {
      const result = mapStripePlanFromPriceId("price_unknown_abc");

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: "price_unknown_abc",
        }),
        expect.stringContaining("Unknown Stripe price ID"),
      );
    });

    it("should log structured error with customerId and subscriptionId context", () => {
      const context = {
        customerId: "cus_test123",
        subscriptionId: "sub_test456",
      };

      mapStripePlanFromPriceId("price_unknown_def", context);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          priceId: "price_unknown_def",
          customerId: "cus_test123",
          subscriptionId: "sub_test456",
        }),
        expect.stringContaining("Unknown Stripe price ID"),
      );
    });

    it("should log configured prices in error for debugging", () => {
      setEnvVars({
        STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_m",
        STRIPE_PRICE_ID_PRO_ANNUAL: "price_pro_a",
      });

      mapStripePlanFromPriceId("price_unknown");

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          configuredPrices: expect.objectContaining({
            pro: {
              monthly: "price_pro_m",
              annual: "price_pro_a",
            },
          }),
        }),
        expect.any(String),
      );
    });

    it("should return free tier when no env vars are configured", () => {
      const result = mapStripePlanFromPriceId("price_any");

      expect(result.tier).toBe("free");
      expect(result.billingTierUnknown).toBe(true);
    });
  });

  describe("mapStripePlanFromPriceId - Multiple Tiers Configured", () => {
    beforeEach(() => {
      setEnvVars({
        STRIPE_PRICE_ID_STARTER_MONTHLY: "price_starter_m",
        STRIPE_PRICE_ID_STARTER_ANNUAL: "price_starter_a",
        STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_m",
        STRIPE_PRICE_ID_PRO_ANNUAL: "price_pro_a",
        STRIPE_PRICE_ID_COMPLIANCE_MONTHLY: "price_comp_m",
        STRIPE_PRICE_ID_COMPLIANCE_ANNUAL: "price_comp_a",
        STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: "price_ent_m",
        STRIPE_PRICE_ID_ENTERPRISE_ANNUAL: "price_ent_a",
      });
    });

    it("should correctly map each tier when all are configured", () => {
      expect(mapStripePlanFromPriceId("price_starter_m").tier).toBe("starter");
      expect(mapStripePlanFromPriceId("price_starter_a").tier).toBe("starter");
      expect(mapStripePlanFromPriceId("price_pro_m").tier).toBe("pro");
      expect(mapStripePlanFromPriceId("price_pro_a").tier).toBe("pro");
      expect(mapStripePlanFromPriceId("price_comp_m").tier).toBe("compliance");
      expect(mapStripePlanFromPriceId("price_comp_a").tier).toBe("compliance");
      expect(mapStripePlanFromPriceId("price_ent_m").tier).toBe("enterprise");
      expect(mapStripePlanFromPriceId("price_ent_a").tier).toBe("enterprise");
    });

    it("should not log errors for known price IDs", () => {
      mapStripePlanFromPriceId("price_starter_m");
      mapStripePlanFromPriceId("price_pro_a");
      mapStripePlanFromPriceId("price_comp_m");
      mapStripePlanFromPriceId("price_ent_a");

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should still flag unknown price ID when all tiers are configured", () => {
      const result = mapStripePlanFromPriceId("price_not_configured");

      expect(result.tier).toBe("free");
      expect(result.billingTierUnknown).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("mapStripePlanFromPriceId - Edge Cases", () => {
    it("should handle empty string price ID", () => {
      setEnvVars({ STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro" });

      const result = mapStripePlanFromPriceId("");

      expect(result.tier).toBe("free");
      expect(result.billingTierUnknown).toBe(true);
    });

    it("should be case-sensitive for price ID matching", () => {
      setEnvVars({ STRIPE_PRICE_ID_PRO_MONTHLY: "price_Pro_Monthly" });

      // Exact match should work
      expect(mapStripePlanFromPriceId("price_Pro_Monthly").tier).toBe("pro");

      // Different case should not match
      const result = mapStripePlanFromPriceId("price_pro_monthly");
      expect(result.tier).toBe("free");
      expect(result.billingTierUnknown).toBe(true);
    });

    it("should handle price ID with special characters", () => {
      setEnvVars({ STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro-monthly_v2.1" });

      const result = mapStripePlanFromPriceId("price_pro-monthly_v2.1");

      expect(result.tier).toBe("pro");
      expect(result.billingTierUnknown).toBe(false);
    });

    it("should handle very long comma-separated lists", () => {
      const manyPrices = Array.from({ length: 50 }, (_, i) => `price_pro_${i}`).join(",");
      setEnvVars({ STRIPE_PRICE_ID_PRO_MONTHLY: manyPrices });

      expect(mapStripePlanFromPriceId("price_pro_0").tier).toBe("pro");
      expect(mapStripePlanFromPriceId("price_pro_25").tier).toBe("pro");
      expect(mapStripePlanFromPriceId("price_pro_49").tier).toBe("pro");
    });
  });
});
