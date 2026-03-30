"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_CONFIG = exports.SEAT_PRICING = exports.FEATURES = exports.TIER_ORDER = exports.PURCHASABLE_TIERS = exports.TIERS = void 0;
exports.isValidTier = isValidTier;
exports.getTierConfig = getTierConfig;
exports.getAllTierConfigs = getAllTierConfigs;
exports.getPurchasableTierConfigs = getPurchasableTierConfigs;
exports.compareTiers = compareTiers;
exports.isTierHigher = isTierHigher;
exports.getMinimumTierForFeature = getMinimumTierForFeature;
exports.tierHasFeature = tierHasFeature;
exports.getEffectiveLimit = getEffectiveLimit;
exports.formatLimit = formatLimit;
exports.getStripePriceId = getStripePriceId;
exports.getTierFromStripePriceId = getTierFromStripePriceId;
exports.getPricingPageTiers = getPricingPageTiers;
exports.getRateLimitForTier = getRateLimitForTier;
exports.getRateLimiterTiers = getRateLimiterTiers;
exports.getSeatPricing = getSeatPricing;
exports.calculateEffectiveSeats = calculateEffectiveSeats;
exports.canAddMember = canAddMember;
exports.calculateSeatCost = calculateSeatCost;
exports.getStripeSeatPriceId = getStripeSeatPriceId;
exports.formatSeatInfo = formatSeatInfo;
exports.validateSeatReduction = validateSeatReduction;
// ============================================================================
// TIER ENUM
// ============================================================================
exports.TIERS = ['free', 'starter', 'pro', 'compliance', 'enterprise', 'unlimited'];
/** Tiers that can be purchased (excludes free and unlimited) */
exports.PURCHASABLE_TIERS = ['starter', 'pro', 'compliance', 'enterprise'];
/** Tier order for comparison (lower index = lower tier) */
exports.TIER_ORDER = ['free', 'starter', 'pro', 'compliance', 'enterprise', 'unlimited'];
// ============================================================================
// FEATURE FLAGS
// ============================================================================
exports.FEATURES = [
    'scan',
    'scan:full',
    'scan:security',
    'scan:compliance',
    'gate',
    'fix',
    'fix:auto',
    'ship',
    'reality',
    'reality:flows',
    'ai-agent',
    'ai-agent:goals',
    'autopilot',
    'context',
    'badge',
    'mcp',
    'compliance:soc2',
    'compliance:hipaa',
    'compliance:gdpr',
    'compliance:pci',
    'compliance:nist',
    'compliance:iso27001',
    'reports:html',
    'reports:pdf',
    'reports:sarif',
    'team:members',
    'team:admin',
    'api:access',
    'webhooks',
    'deploy-hooks',
];
exports.SEAT_PRICING = {
    free: {
        monthlyPricePerSeat: 0,
        annualPricePerSeat: 0,
        maxAdditionalSeats: 0,
        supportsAdditionalSeats: false,
    },
    starter: {
        monthlyPricePerSeat: 0,
        annualPricePerSeat: 0,
        maxAdditionalSeats: 0,
        supportsAdditionalSeats: false,
    },
    pro: {
        monthlyPricePerSeat: 25,
        annualPricePerSeat: 240, // 20% off: 25 * 12 * 0.8 = 240
        maxAdditionalSeats: 45, // Base 5 + max 45 = 50 total
        supportsAdditionalSeats: true,
    },
    compliance: {
        monthlyPricePerSeat: 35,
        annualPricePerSeat: 336, // 20% off: 35 * 12 * 0.8 = 336
        maxAdditionalSeats: 90, // Base 10 + max 90 = 100 total
        supportsAdditionalSeats: true,
    },
    enterprise: {
        monthlyPricePerSeat: 45,
        annualPricePerSeat: 432, // 20% off: 45 * 12 * 0.8 = 432
        maxAdditionalSeats: -1, // Unlimited
        supportsAdditionalSeats: true,
    },
    unlimited: {
        monthlyPricePerSeat: 0,
        annualPricePerSeat: 0,
        maxAdditionalSeats: -1,
        supportsAdditionalSeats: true,
    },
};
// ============================================================================
// CANONICAL TIER DEFINITIONS
// ============================================================================
exports.TIER_CONFIG = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        annualPrice: 0,
        description: 'Get started',
        features: [
            'scan',
            'gate',
            'ship',
            'context',
            'badge',
        ],
        limits: {
            scansPerMonth: 10,
            realityRunsPerMonth: 0,
            aiAgentRunsPerMonth: 0,
            projects: 1,
            teamMembers: 1,
            complianceFrameworks: 0,
        },
        rateLimit: {
            requestsPerMinute: 100,
            burstLimit: 150,
            windowMs: 60 * 1000,
        },
        upsell: {
            message: 'Upgrade to Starter for Reality Mode browser testing and 100 scans/month',
            nextTier: 'starter',
        },
    },
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 29,
        annualPrice: 278, // 20% off: 29 * 12 * 0.8 = 278.40 → 278
        description: 'For solo devs',
        features: [
            'scan',
            'scan:full',
            'gate',
            'fix',
            'ship',
            'reality',
            'context',
            'badge',
            'reports:html',
        ],
        limits: {
            scansPerMonth: 100,
            realityRunsPerMonth: 20,
            aiAgentRunsPerMonth: 0,
            projects: 3,
            teamMembers: 1,
            complianceFrameworks: 0,
        },
        rateLimit: {
            requestsPerMinute: 300,
            burstLimit: 450,
            windowMs: 60 * 1000,
        },
        upsell: {
            message: 'Upgrade to Pro for AI Agent testing, auto-fix, and Autopilot protection',
            nextTier: 'pro',
        },
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 99,
        annualPrice: 950, // 20% off: 99 * 12 * 0.8 = 950.40 → 950
        description: 'Full automation',
        features: [
            'scan',
            'scan:full',
            'scan:security',
            'gate',
            'fix',
            'fix:auto',
            'ship',
            'reality',
            'reality:flows',
            'ai-agent',
            'ai-agent:goals',
            'autopilot',
            'context',
            'badge',
            'mcp',
            'reports:html',
            'reports:sarif',
            'api:access',
            'webhooks',
        ],
        limits: {
            scansPerMonth: 500,
            realityRunsPerMonth: 100,
            aiAgentRunsPerMonth: 50,
            projects: 10,
            teamMembers: 5,
            complianceFrameworks: 0,
        },
        rateLimit: {
            requestsPerMinute: 1000,
            burstLimit: 1500,
            windowMs: 60 * 1000,
        },
        upsell: {
            message: 'Upgrade to Compliance tier for SOC2, HIPAA, GDPR frameworks',
            nextTier: 'compliance',
        },
    },
    compliance: {
        id: 'compliance',
        name: 'Compliance',
        price: 199,
        annualPrice: 1910, // 20% off: 199 * 12 * 0.8 = 1910.40 → 1910
        description: 'Enterprise ready',
        features: [
            'scan',
            'scan:full',
            'scan:security',
            'scan:compliance',
            'gate',
            'fix',
            'fix:auto',
            'ship',
            'reality',
            'reality:flows',
            'ai-agent',
            'ai-agent:goals',
            'autopilot',
            'context',
            'badge',
            'mcp',
            'compliance:soc2',
            'compliance:hipaa',
            'compliance:gdpr',
            'compliance:pci',
            'compliance:nist',
            'compliance:iso27001',
            'reports:html',
            'reports:pdf',
            'reports:sarif',
            'api:access',
            'webhooks',
            'deploy-hooks',
        ],
        limits: {
            scansPerMonth: 1000,
            realityRunsPerMonth: 200,
            aiAgentRunsPerMonth: 100,
            projects: 25,
            teamMembers: 10,
            complianceFrameworks: 6,
        },
        rateLimit: {
            requestsPerMinute: 2000,
            burstLimit: 3000,
            windowMs: 60 * 1000,
        },
        upsell: {
            message: 'Contact sales for Enterprise with unlimited usage and dedicated support',
            nextTier: 'enterprise',
        },
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499,
        annualPrice: 4790, // 20% off: 499 * 12 * 0.8 = 4790.40 → 4790
        description: 'Custom solutions',
        features: [
            'scan',
            'scan:full',
            'scan:security',
            'scan:compliance',
            'gate',
            'fix',
            'fix:auto',
            'ship',
            'reality',
            'reality:flows',
            'ai-agent',
            'ai-agent:goals',
            'autopilot',
            'context',
            'badge',
            'mcp',
            'compliance:soc2',
            'compliance:hipaa',
            'compliance:gdpr',
            'compliance:pci',
            'compliance:nist',
            'compliance:iso27001',
            'reports:html',
            'reports:pdf',
            'reports:sarif',
            'api:access',
            'webhooks',
            'deploy-hooks',
            'team:members',
            'team:admin',
        ],
        limits: {
            scansPerMonth: 5000,
            realityRunsPerMonth: 1000,
            aiAgentRunsPerMonth: 500,
            projects: 100,
            teamMembers: 50,
            complianceFrameworks: 6,
        },
        rateLimit: {
            requestsPerMinute: 10000,
            burstLimit: 15000,
            windowMs: 60 * 1000,
        },
        upsell: {
            message: 'You have our top tier! Contact support for custom requirements.',
            nextTier: 'unlimited',
        },
    },
    unlimited: {
        id: 'unlimited',
        name: 'Unlimited',
        price: 0,
        annualPrice: 0,
        description: 'Internal/Special',
        features: exports.FEATURES,
        limits: {
            scansPerMonth: -1, // Unlimited
            realityRunsPerMonth: -1,
            aiAgentRunsPerMonth: -1,
            projects: -1,
            teamMembers: -1,
            complianceFrameworks: 6,
        },
        rateLimit: {
            requestsPerMinute: 100000,
            burstLimit: 150000,
            windowMs: 60 * 1000,
        },
        upsell: {
            message: 'You have unlimited access!',
            nextTier: 'unlimited',
        },
    },
};
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Check if a tier string is valid
 */
function isValidTier(tier) {
    return exports.TIERS.includes(tier);
}
/**
 * Get tier config by tier name
 */
function getTierConfig(tier) {
    return exports.TIER_CONFIG[tier];
}
/**
 * Get all tier configs as array (useful for iteration)
 */
function getAllTierConfigs() {
    return exports.TIER_ORDER.map(tier => exports.TIER_CONFIG[tier]);
}
/**
 * Get purchasable tier configs (for pricing page)
 */
function getPurchasableTierConfigs() {
    return exports.PURCHASABLE_TIERS.map(tier => exports.TIER_CONFIG[tier]);
}
/**
 * Compare two tiers (-1 if a < b, 0 if equal, 1 if a > b)
 */
function compareTiers(a, b) {
    const indexA = exports.TIER_ORDER.indexOf(a);
    const indexB = exports.TIER_ORDER.indexOf(b);
    return indexA - indexB;
}
/**
 * Check if tier A is higher than tier B
 */
function isTierHigher(a, b) {
    return compareTiers(a, b) > 0;
}
/**
 * Find the minimum tier that has a specific feature
 */
function getMinimumTierForFeature(feature) {
    for (const tier of exports.TIER_ORDER) {
        if (exports.TIER_CONFIG[tier].features.includes(feature)) {
            return tier;
        }
    }
    return null;
}
/**
 * Check if a tier has a specific feature
 */
function tierHasFeature(tier, feature) {
    const config = exports.TIER_CONFIG[tier];
    // Unlimited tier has all features
    if (tier === 'unlimited')
        return true;
    return config.features.includes(feature);
}
/**
 * Get limit value, handling -1 as Infinity
 */
function getEffectiveLimit(limit) {
    return limit === -1 ? Infinity : limit;
}
/**
 * Format limit for display
 */
function formatLimit(limit) {
    return limit === -1 ? 'Unlimited' : limit.toLocaleString();
}
/**
 * Get Stripe price ID for a tier (from environment)
 */
function getStripePriceId(tier, interval) {
    const envKey = interval === 'year'
        ? `STRIPE_PRICE_${tier.toUpperCase()}_ANNUAL`
        : `STRIPE_PRICE_${tier.toUpperCase()}_MONTHLY`;
    return process.env[envKey] || process.env[`STRIPE_PRICE_ID_${tier.toUpperCase()}`];
}
/**
 * Map Stripe price ID back to tier
 */
function getTierFromStripePriceId(priceId) {
    for (const tier of exports.PURCHASABLE_TIERS) {
        const monthlyId = getStripePriceId(tier, 'month');
        const annualId = getStripePriceId(tier, 'year');
        if (priceId === monthlyId || priceId === annualId) {
            return tier;
        }
    }
    return 'free';
}
// ============================================================================
// PRICING PAGE HELPERS
// ============================================================================
/**
 * Get pricing tiers formatted for landing page display
 */
function getPricingPageTiers() {
    return [
        {
            id: 'free',
            name: exports.TIER_CONFIG.free.name,
            price: exports.TIER_CONFIG.free.price,
            annual: exports.TIER_CONFIG.free.annualPrice,
            description: exports.TIER_CONFIG.free.description,
            popular: false,
            features: [
                'Static code analysis',
                'AI code validation',
                'Ship badge generator',
                `${formatLimit(exports.TIER_CONFIG.free.limits.scansPerMonth)} scans/month`,
            ],
        },
        {
            id: 'starter',
            name: exports.TIER_CONFIG.starter.name,
            price: exports.TIER_CONFIG.starter.price,
            annual: exports.TIER_CONFIG.starter.annualPrice,
            description: exports.TIER_CONFIG.starter.description,
            popular: false,
            features: [
                'Everything in Free, plus:',
                'Reality Mode browser testing',
                'CI/CD deploy blocking',
                'Mock detection',
                `${formatLimit(exports.TIER_CONFIG.starter.limits.scansPerMonth)} scans, ${formatLimit(exports.TIER_CONFIG.starter.limits.realityRunsPerMonth)} Reality runs`,
            ],
        },
        {
            id: 'pro',
            name: exports.TIER_CONFIG.pro.name,
            price: exports.TIER_CONFIG.pro.price,
            annual: exports.TIER_CONFIG.pro.annualPrice,
            description: exports.TIER_CONFIG.pro.description,
            popular: true,
            features: [
                'Everything in Starter, plus:',
                'AI Agent autonomous testing',
                'Auto-fix with generated prompts',
                'Autopilot continuous protection',
                'MCP plugin for your IDE',
                `${formatLimit(exports.TIER_CONFIG.pro.limits.realityRunsPerMonth)} Reality, ${formatLimit(exports.TIER_CONFIG.pro.limits.aiAgentRunsPerMonth)} AI Agent runs`,
            ],
        },
        {
            id: 'compliance',
            name: exports.TIER_CONFIG.compliance.name,
            price: exports.TIER_CONFIG.compliance.price,
            annual: exports.TIER_CONFIG.compliance.annualPrice,
            description: exports.TIER_CONFIG.compliance.description,
            popular: false,
            features: [
                'Everything in Pro, plus:',
                'SOC2, HIPAA, GDPR, PCI-DSS',
                'NIST and ISO 27001 frameworks',
                'Audit-ready PDF reports',
                `${formatLimit(exports.TIER_CONFIG.compliance.limits.realityRunsPerMonth)} Reality, ${formatLimit(exports.TIER_CONFIG.compliance.limits.aiAgentRunsPerMonth)} AI Agent runs`,
            ],
        },
    ];
}
// ============================================================================
// RATE LIMIT HELPERS
// ============================================================================
/**
 * Get rate limit config for a tier (for rate-limiter middleware)
 */
function getRateLimitForTier(tier) {
    return exports.TIER_CONFIG[tier].rateLimit;
}
/**
 * Get user tiers formatted for rate limiter
 */
function getRateLimiterTiers() {
    const result = {};
    for (const tier of exports.TIERS) {
        const config = exports.TIER_CONFIG[tier];
        result[tier] = {
            name: config.name,
            baseLimit: config.rateLimit.requestsPerMinute,
            burstLimit: config.rateLimit.burstLimit,
            windowMs: config.rateLimit.windowMs,
        };
    }
    return result;
}
// ============================================================================
// SEAT MANAGEMENT HELPERS
// ============================================================================
/**
 * Get seat pricing for a tier
 */
function getSeatPricing(tier) {
    return exports.SEAT_PRICING[tier];
}
/**
 * Calculate effective team seats (base + purchased extras)
 */
function calculateEffectiveSeats(tier, purchasedExtraSeats) {
    const baseSeats = exports.TIER_CONFIG[tier].limits.teamMembers;
    const seatConfig = exports.SEAT_PRICING[tier];
    // If tier doesn't support additional seats, return base only
    if (!seatConfig.supportsAdditionalSeats) {
        return baseSeats === -1 ? Infinity : baseSeats;
    }
    // Handle unlimited base seats
    if (baseSeats === -1) {
        return Infinity;
    }
    // Cap purchased seats at max allowed (if not unlimited)
    let effectiveExtras = purchasedExtraSeats;
    if (seatConfig.maxAdditionalSeats !== -1) {
        effectiveExtras = Math.min(purchasedExtraSeats, seatConfig.maxAdditionalSeats);
    }
    return baseSeats + effectiveExtras;
}
/**
 * Check if a member can be added given current seats and effective limit
 */
function canAddMember(tier, currentMemberCount, purchasedExtraSeats) {
    const effectiveSeats = calculateEffectiveSeats(tier, purchasedExtraSeats);
    if (effectiveSeats === Infinity) {
        return { allowed: true, effectiveSeats };
    }
    if (currentMemberCount >= effectiveSeats) {
        const seatConfig = exports.SEAT_PRICING[tier];
        const canPurchaseMore = seatConfig.supportsAdditionalSeats &&
            (seatConfig.maxAdditionalSeats === -1 || purchasedExtraSeats < seatConfig.maxAdditionalSeats);
        return {
            allowed: false,
            reason: canPurchaseMore
                ? `Seat limit reached (${currentMemberCount}/${effectiveSeats}). Purchase additional seats at $${seatConfig.monthlyPricePerSeat}/seat/month.`
                : `Seat limit reached (${currentMemberCount}/${effectiveSeats}). Upgrade to a higher tier for more seats.`,
            effectiveSeats,
        };
    }
    return { allowed: true, effectiveSeats };
}
/**
 * Calculate cost for additional seats
 */
function calculateSeatCost(tier, additionalSeats, billingInterval) {
    const seatConfig = exports.SEAT_PRICING[tier];
    if (!seatConfig.supportsAdditionalSeats) {
        return { total: 0, perSeat: 0, supported: false };
    }
    const perSeat = billingInterval === 'year'
        ? seatConfig.annualPricePerSeat
        : seatConfig.monthlyPricePerSeat;
    return {
        total: perSeat * additionalSeats,
        perSeat,
        supported: true,
    };
}
/**
 * Get Stripe seat price ID for a tier
 */
function getStripeSeatPriceId(tier, interval) {
    const envKey = interval === 'year'
        ? `STRIPE_SEAT_PRICE_${tier.toUpperCase()}_ANNUAL`
        : `STRIPE_SEAT_PRICE_${tier.toUpperCase()}_MONTHLY`;
    return process.env[envKey];
}
/**
 * Format seat info for display
 */
function formatSeatInfo(tier) {
    const config = exports.TIER_CONFIG[tier];
    const seatConfig = exports.SEAT_PRICING[tier];
    const baseSeats = config.limits.teamMembers;
    if (baseSeats === -1) {
        return 'Unlimited team members';
    }
    if (!seatConfig.supportsAdditionalSeats) {
        return `${baseSeats} team member${baseSeats !== 1 ? 's' : ''}`;
    }
    return `${baseSeats} seats included, +$${seatConfig.monthlyPricePerSeat}/seat/mo`;
}
/**
 * Validate seat reduction (graceful handling)
 * Returns info about whether reduction is safe or requires admin action
 */
function validateSeatReduction(currentMemberCount, _currentEffectiveSeats, // Kept for API compatibility, may be used for logging
newEffectiveSeats) {
    if (newEffectiveSeats >= currentMemberCount) {
        return {
            safe: true,
            requiresAction: false,
            excessMembers: 0,
            message: 'Seat reduction is safe.',
        };
    }
    const excessMembers = currentMemberCount - newEffectiveSeats;
    return {
        safe: false,
        requiresAction: true,
        excessMembers,
        message: `Cannot reduce seats: ${excessMembers} member(s) would exceed the new limit. Remove members before reducing seats.`,
    };
}
