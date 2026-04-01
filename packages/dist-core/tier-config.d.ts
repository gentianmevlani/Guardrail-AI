/**
 * Canonical Tier Configuration
 *
 * SINGLE SOURCE OF TRUTH for all tier definitions across:
 * - Backend entitlements
 * - Rate limiting
 * - Stripe billing mapping
 * - Landing page pricing
 * - CLI entitlements
 *
 * DO NOT define tier configurations anywhere else in the codebase.
 */
export declare const TIERS: readonly ["free", "starter", "pro", "compliance", "enterprise", "unlimited"];
export type Tier = typeof TIERS[number];
/** Tiers that can be purchased (excludes free and unlimited) */
export declare const PURCHASABLE_TIERS: readonly ["starter", "pro", "compliance", "enterprise"];
export type PurchasableTier = typeof PURCHASABLE_TIERS[number];
/** Tier order for comparison (lower index = lower tier) */
export declare const TIER_ORDER: Tier[];
export declare const FEATURES: readonly ["scan", "scan:full", "scan:security", "scan:compliance", "gate", "fix", "fix:auto", "ship", "reality", "reality:flows", "ai-agent", "ai-agent:goals", "autopilot", "context", "badge", "mcp", "compliance:soc2", "compliance:hipaa", "compliance:gdpr", "compliance:pci", "compliance:nist", "compliance:iso27001", "reports:html", "reports:pdf", "reports:sarif", "team:members", "team:admin", "api:access", "webhooks", "deploy-hooks"];
export type Feature = typeof FEATURES[number];
export interface TierLimits {
    /** Scans per month (-1 = unlimited) */
    scansPerMonth: number;
    /** Reality Mode runs per month */
    realityRunsPerMonth: number;
    /** AI Agent runs per month */
    aiAgentRunsPerMonth: number;
    /** Number of projects */
    projects: number;
    /** Base team members included in tier */
    teamMembers: number;
    /** Compliance frameworks available */
    complianceFrameworks: number;
}
export interface SeatPricing {
    /** Price per additional seat per month */
    monthlyPricePerSeat: number;
    /** Price per additional seat per year */
    annualPricePerSeat: number;
    /** Maximum additional seats allowed (-1 = unlimited) */
    maxAdditionalSeats: number;
    /** Whether this tier supports additional seats */
    supportsAdditionalSeats: boolean;
}
export declare const SEAT_PRICING: Record<Tier, SeatPricing>;
export interface RateLimitConfig {
    /** Requests per minute */
    requestsPerMinute: number;
    /** Burst limit (max requests in short window) */
    burstLimit: number;
    /** Rate limit window in milliseconds */
    windowMs: number;
}
export interface TierConfig {
    /** Tier identifier */
    id: Tier;
    /** Display name */
    name: string;
    /** Monthly price in USD */
    price: number;
    /** Annual price in USD (typically ~2 months free) */
    annualPrice: number;
    /** Short description for pricing page */
    description: string;
    /** Features included in this tier */
    features: Feature[];
    /** Usage limits */
    limits: TierLimits;
    /** API rate limiting configuration */
    rateLimit: RateLimitConfig;
    /** Upsell configuration */
    upsell: {
        message: string;
        nextTier: Tier;
    };
    /** Stripe price IDs (set via environment variables) */
    stripe?: {
        monthlyPriceId?: string;
        annualPriceId?: string;
        /** Stripe price ID for additional seats (metered or per-unit) */
        seatPriceId?: string;
        seatAnnualPriceId?: string;
    };
}
export declare const TIER_CONFIG: Record<Tier, TierConfig>;
/**
 * Check if a tier string is valid
 */
export declare function isValidTier(tier: string): tier is Tier;
/**
 * Get tier config by tier name
 */
export declare function getTierConfig(tier: Tier): TierConfig;
/**
 * Get all tier configs as array (useful for iteration)
 */
export declare function getAllTierConfigs(): TierConfig[];
/**
 * Get purchasable tier configs (for pricing page)
 */
export declare function getPurchasableTierConfigs(): TierConfig[];
/**
 * Compare two tiers (-1 if a < b, 0 if equal, 1 if a > b)
 */
export declare function compareTiers(a: Tier, b: Tier): number;
/**
 * Check if tier A is higher than tier B
 */
export declare function isTierHigher(a: Tier, b: Tier): boolean;
/**
 * Find the minimum tier that has a specific feature
 */
export declare function getMinimumTierForFeature(feature: Feature): Tier | null;
/**
 * Check if a tier has a specific feature
 */
export declare function tierHasFeature(tier: Tier, feature: Feature): boolean;
/**
 * Get limit value, handling -1 as Infinity
 */
export declare function getEffectiveLimit(limit: number): number;
/**
 * Format limit for display
 */
export declare function formatLimit(limit: number): string;
/**
 * Get Stripe price ID for a tier (from environment)
 */
export declare function getStripePriceId(tier: PurchasableTier, interval: 'month' | 'year'): string | undefined;
/**
 * Map Stripe price ID back to tier
 */
export declare function getTierFromStripePriceId(priceId: string): Tier;
/**
 * Get pricing tiers formatted for landing page display
 */
export declare function getPricingPageTiers(): Array<{
    id: Tier;
    name: string;
    price: number;
    annual: number;
    description: string;
    popular: boolean;
    features: string[];
}>;
/**
 * Get rate limit config for a tier (for rate-limiter middleware)
 */
export declare function getRateLimitForTier(tier: Tier): RateLimitConfig;
/**
 * Get user tiers formatted for rate limiter
 */
export declare function getRateLimiterTiers(): Record<Tier, {
    name: string;
    baseLimit: number;
    burstLimit: number;
    windowMs: number;
}>;
/**
 * Get seat pricing for a tier
 */
export declare function getSeatPricing(tier: Tier): SeatPricing;
/**
 * Calculate effective team seats (base + purchased extras)
 */
export declare function calculateEffectiveSeats(tier: Tier, purchasedExtraSeats: number): number;
/**
 * Check if a member can be added given current seats and effective limit
 */
export declare function canAddMember(tier: Tier, currentMemberCount: number, purchasedExtraSeats: number): {
    allowed: boolean;
    reason?: string;
    effectiveSeats: number;
};
/**
 * Calculate cost for additional seats
 */
export declare function calculateSeatCost(tier: Tier, additionalSeats: number, billingInterval: 'month' | 'year'): {
    total: number;
    perSeat: number;
    supported: boolean;
};
/**
 * Get Stripe seat price ID for a tier
 */
export declare function getStripeSeatPriceId(tier: Tier, interval: 'month' | 'year'): string | undefined;
/**
 * Format seat info for display
 */
export declare function formatSeatInfo(tier: Tier): string;
/**
 * Validate seat reduction (graceful handling)
 * Returns info about whether reduction is safe or requires admin action
 */
export declare function validateSeatReduction(currentMemberCount: number, _currentEffectiveSeats: number, // Kept for API compatibility, may be used for logging
newEffectiveSeats: number): {
    safe: boolean;
    requiresAction: boolean;
    excessMembers: number;
    message: string;
};
//# sourceMappingURL=tier-config.d.ts.map