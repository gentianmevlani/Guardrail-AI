/**
 * Entitlements System - SINGLE SOURCE OF TRUTH
 *
 * This module is the canonical entitlements implementation for Guardrail.
 * It handles feature access, usage limits, tier enforcement, and seat management.
 *
 * IMPORTANT: This TypeScript file is compiled to dist/entitlements.js
 * DO NOT create separate entitlements.js files elsewhere in the codebase.
 * All consumers (API, CLI, etc.) should import from @guardrail/core.
 */
import { Feature, SEAT_PRICING, SeatPricing, TIER_CONFIG, Tier, TierConfig, calculateEffectiveSeats, canAddMember, formatSeatInfo, getMinimumTierForFeature, getTierConfig, isValidTier, validateSeatReduction } from './tier-config';
export type { Feature, SeatPricing, Tier, TierConfig };
export { SEAT_PRICING, TIER_CONFIG, calculateEffectiveSeats, canAddMember, formatSeatInfo, getMinimumTierForFeature, getTierConfig, isValidTier, validateSeatReduction };
export interface UsageRecord {
    tier: Tier;
    userId?: string;
    email?: string;
    periodStart: string;
    periodEnd: string;
    usage: {
        scans: number;
        realityRuns: number;
        aiAgentRuns: number;
        gateRuns: number;
        fixRuns: number;
    };
    lastUpdated: string;
    lastServerSync?: string;
    pendingSync?: boolean;
}
export interface EntitlementCheck {
    allowed: boolean;
    reason?: string;
    usage?: number;
    limit?: number;
    upgradePrompt?: string;
    source?: 'server' | 'cache' | 'local' | 'offline';
}
export interface SeatCheck {
    allowed: boolean;
    reason?: string;
    effectiveSeats: number;
    baseSeats: number;
    purchasedSeats: number;
    currentMembers: number;
}
export interface OrganizationSeats {
    tier: Tier;
    baseSeats: number;
    purchasedExtraSeats: number;
    effectiveSeats: number;
    currentMembers: number;
    seatPricing: SeatPricing;
}
export declare class EntitlementsManager {
    private configDir;
    private usageFile;
    private licenseFile;
    constructor();
    /**
     * Get current tier from license file or environment
     */
    getCurrentTier(): Promise<Tier>;
    /**
     * Validate API key against server and return tier
     *
     * SECURITY: Tier is determined server-side only.
     * The API key string contains NO tier information.
     */
    private validateApiKeyWithServer;
    /**
     * Check if a feature is available for the current tier
     */
    checkFeature(feature: Feature): Promise<EntitlementCheck>;
    /**
     * Check usage limits
     */
    checkLimit(limitType: 'scans' | 'realityRuns' | 'aiAgentRuns'): Promise<EntitlementCheck>;
    /**
     * Track usage
     */
    trackUsage(type: 'scans' | 'realityRuns' | 'aiAgentRuns' | 'gateRuns' | 'fixRuns', count?: number): Promise<void>;
    /**
     * Enforce feature access (throws if not allowed)
     */
    enforceFeature(feature: Feature): Promise<void>;
    /**
     * Enforce usage limits (throws if exceeded)
     */
    enforceLimit(limitType: 'scans' | 'realityRuns' | 'aiAgentRuns'): Promise<void>;
    /**
     * Check if a member can be added to an organization
     */
    checkSeatLimit(tier: Tier, currentMemberCount: number, purchasedExtraSeats?: number): SeatCheck;
    /**
     * Get organization seat information
     */
    getOrganizationSeats(tier: Tier, purchasedExtraSeats: number, currentMembers: number): OrganizationSeats;
    /**
     * Validate seat reduction before processing
     */
    validateSeatReduction(currentMemberCount: number, currentPurchasedSeats: number, newPurchasedSeats: number, tier: Tier): {
        safe: boolean;
        requiresAction: boolean;
        excessMembers: number;
        message: string;
    };
    /**
     * Get usage for current billing period
     */
    getUsage(): Promise<UsageRecord>;
    /**
     * Get tier configuration
     */
    getTierConfig(tier: Tier): TierConfig;
    /**
     * Get all tier configurations
     */
    getAllTiers(): Record<Tier, TierConfig>;
    /**
     * Get usage summary for display
     */
    getUsageSummary(): Promise<string>;
    /**
     * Format upgrade prompt for CLI output
     */
    formatUpgradePrompt(currentTier: Tier, requiredTier: Tier | null, feature: Feature): string;
    /**
     * Format limit exceeded prompt
     */
    formatLimitUpgradePrompt(currentTier: Tier, limitType: string, current: number, limit: number): string;
    private isNewBillingPeriod;
    private createNewUsageRecord;
    private ensureConfigDir;
    private saveUsage;
    private readLicense;
    private progressBar;
}
export declare const entitlements: EntitlementsManager;
export declare const checkFeature: (feature: Feature) => Promise<EntitlementCheck>;
export declare const checkLimit: (limitType: "scans" | "realityRuns" | "aiAgentRuns") => Promise<EntitlementCheck>;
export declare const enforceFeature: (feature: Feature) => Promise<void>;
export declare const enforceLimit: (limitType: "scans" | "realityRuns" | "aiAgentRuns") => Promise<void>;
export declare const trackUsage: (type: "scans" | "realityRuns" | "aiAgentRuns" | "gateRuns" | "fixRuns", count?: number) => Promise<void>;
export declare const getCurrentTier: () => Promise<"free" | "starter" | "pro" | "compliance" | "enterprise" | "unlimited">;
export declare const getUsageSummary: () => Promise<string>;
export declare const checkSeatLimit: (tier: Tier, currentMemberCount: number, purchasedExtraSeats?: number) => SeatCheck;
export declare const getOrganizationSeats: (tier: Tier, purchasedExtraSeats: number, currentMembers: number) => OrganizationSeats;
//# sourceMappingURL=entitlements.d.ts.map