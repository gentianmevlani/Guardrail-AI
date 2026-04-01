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

// ============================================================================
// TIER ENUM
// ============================================================================

export const TIERS = ['free', 'starter', 'pro', 'compliance'] as const;
export type Tier = typeof TIERS[number];

/** Tiers that can be purchased (excludes free) */
export const PURCHASABLE_TIERS = ['starter', 'pro', 'compliance'] as const;
export type PurchasableTier = typeof PURCHASABLE_TIERS[number];

/** Tier order for comparison (lower index = lower tier) */
export const TIER_ORDER: Tier[] = ['free', 'starter', 'pro', 'compliance'];

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURES = [
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
] as const;

export type Feature = typeof FEATURES[number];

// ============================================================================
// TIER CONFIGURATION INTERFACE
// ============================================================================

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

// ============================================================================
// SEAT PRICING CONFIGURATION
// ============================================================================

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

export const SEAT_PRICING: Record<Tier, SeatPricing> = {
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
    monthlyPricePerSeat: 10,
    annualPricePerSeat: 96,
    maxAdditionalSeats: 45,
    supportsAdditionalSeats: true,
  },
  compliance: {
    monthlyPricePerSeat: 15,
    annualPricePerSeat: 144,
    maxAdditionalSeats: 90,
    supportsAdditionalSeats: true,
  },
};

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

// ============================================================================
// CANONICAL TIER DEFINITIONS
// ============================================================================

export const TIER_CONFIG: Record<Tier, TierConfig> = {
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
      message: 'Upgrade to Starter for full findings visibility and higher limits',
      nextTier: 'starter',
    },
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    annualPrice: 96,
    description: 'Full findings, no auto-fix',
    features: [
      'scan',
      'scan:full',
      'scan:security',
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
      message: 'Upgrade to Pro for auto-fix and full automation',
      nextTier: 'pro',
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29.99,
    annualPrice: 288,
    description: 'Auto-fix & automation',
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
      message: 'Upgrade to Compliance for SOC2, HIPAA, GDPR, and audit-ready reports',
      nextTier: 'compliance',
    },
  },

  compliance: {
    id: 'compliance',
    name: 'Compliance',
    price: 59.99,
    annualPrice: 576,
    description: 'Compliance & audit-ready',
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
      message: "You're on our top plan for self-serve Guardrail",
      nextTier: 'compliance',
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a tier string is valid
 */
export function isValidTier(tier: string): tier is Tier {
  return TIERS.includes(tier as Tier);
}

/**
 * Get tier config by tier name
 */
export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIG[tier];
}

/**
 * Get all tier configs as array (useful for iteration)
 */
export function getAllTierConfigs(): TierConfig[] {
  return TIER_ORDER.map(tier => TIER_CONFIG[tier]);
}

/**
 * Get purchasable tier configs (for pricing page)
 */
export function getPurchasableTierConfigs(): TierConfig[] {
  return PURCHASABLE_TIERS.map(tier => TIER_CONFIG[tier]);
}

/**
 * Compare two tiers (-1 if a < b, 0 if equal, 1 if a > b)
 */
export function compareTiers(a: Tier, b: Tier): number {
  const indexA = TIER_ORDER.indexOf(a);
  const indexB = TIER_ORDER.indexOf(b);
  return indexA - indexB;
}

/**
 * Check if tier A is higher than tier B
 */
export function isTierHigher(a: Tier, b: Tier): boolean {
  return compareTiers(a, b) > 0;
}

/**
 * Find the minimum tier that has a specific feature
 */
export function getMinimumTierForFeature(feature: Feature): Tier | null {
  for (const tier of TIER_ORDER) {
    if (TIER_CONFIG[tier].features.includes(feature)) {
      return tier;
    }
  }
  return null;
}

/**
 * Check if a tier has a specific feature
 */
export function tierHasFeature(tier: Tier, feature: Feature): boolean {
  const config = TIER_CONFIG[tier];
  return config.features.includes(feature);
}

/** Full finding rows (paths, messages) — all paid tiers; Free shows counts only. */
export function tierShowsFullIssueDetails(tier: string | undefined | null): boolean {
  return (tier ?? 'free').toLowerCase() !== 'free';
}

<<<<<<< HEAD
/** Auto-fix / fix:auto — Pro tier and Compliance-equivalent (incl. enterprise/unlimited slugs). Starter: no auto-fix. */
export function tierSupportsAutoFix(tier: string | undefined | null): boolean {
  const t = (tier ?? 'free').toLowerCase();
  return (
    t === 'pro' ||
    t === 'team' ||
    t === 'compliance' ||
    t === 'enterprise' ||
    t === 'unlimited'
  );
}

/**
 * Human-readable label for a subscription/plan slug from API, Stripe, or CLI.
 * Canonical {@link Tier} ids still drive entitlements; this is display-only
 * (e.g. enterprise and unlimited contracts → "Enterprise").
 */
export function formatPlanSlugForDisplay(raw: string | undefined | null): string {
  const p = (raw ?? 'free').toLowerCase().trim();
  if (!p || p === 'free') return 'Free';
  if (p.includes('enterprise') || p === 'unlimited') return 'Enterprise';
  if (p.includes('compliance')) return 'Compliance';
  if (p.includes('starter')) return 'Starter';
  if (p.includes('pro') || p.includes('team')) return 'Pro';
  return 'Free';
=======
/** Auto-fix / fix:auto — Pro and Compliance only. */
export function tierSupportsAutoFix(tier: string | undefined | null): boolean {
  const t = (tier ?? 'free').toLowerCase();
  return t === 'pro' || t === 'compliance';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
}

/**
 * Get limit value, handling -1 as Infinity
 */
export function getEffectiveLimit(limit: number): number {
  return limit === -1 ? Infinity : limit;
}

/**
 * Format limit for display
 */
export function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toLocaleString();
}

/**
 * Get Stripe price ID for a tier (from environment)
 */
export function getStripePriceId(tier: PurchasableTier, interval: 'month' | 'year'): string | undefined {
  const envKey = interval === 'year'
    ? `STRIPE_PRICE_ID_${tier.toUpperCase()}_ANNUAL`
    : `STRIPE_PRICE_ID_${tier.toUpperCase()}_MONTHLY`;

  return process.env[envKey] || process.env[`STRIPE_PRICE_ID_${tier.toUpperCase()}`];
}

/**
 * Map Stripe price ID back to tier
 */
export function getTierFromStripePriceId(priceId: string): Tier {
  for (const tier of PURCHASABLE_TIERS) {
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
export function getPricingPageTiers(): Array<{
  id: Tier;
  name: string;
  price: number;
  annual: number;
  description: string;
  popular: boolean;
  features: string[];
}> {
  return [
    {
      id: 'free',
      name: TIER_CONFIG.free.name,
      price: TIER_CONFIG.free.price,
      annual: TIER_CONFIG.free.annualPrice,
      description: TIER_CONFIG.free.description,
      popular: false,
      features: [
        'Static code analysis',
        'AI code validation',
        'Ship badge generator',
        `${formatLimit(TIER_CONFIG.free.limits.scansPerMonth)} scans/month`,
      ],
    },
    {
      id: 'starter',
      name: TIER_CONFIG.starter.name,
      price: TIER_CONFIG.starter.price,
      annual: TIER_CONFIG.starter.annualPrice,
      description: TIER_CONFIG.starter.description,
      popular: false,
      features: [
        'Everything in Free, plus:',
        'Reality Mode browser testing',
        'CI/CD deploy blocking',
        'Mock detection',
        `${formatLimit(TIER_CONFIG.starter.limits.scansPerMonth)} scans, ${formatLimit(TIER_CONFIG.starter.limits.realityRunsPerMonth)} Reality runs`,
      ],
    },
    {
      id: 'pro',
      name: TIER_CONFIG.pro.name,
      price: TIER_CONFIG.pro.price,
      annual: TIER_CONFIG.pro.annualPrice,
      description: TIER_CONFIG.pro.description,
      popular: true,
      features: [
        'Everything in Starter, plus:',
        'AI Agent autonomous testing',
        'Auto-fix with generated prompts',
        'Autopilot continuous protection',
        'MCP plugin for your IDE',
        `${formatLimit(TIER_CONFIG.pro.limits.realityRunsPerMonth)} Reality, ${formatLimit(TIER_CONFIG.pro.limits.aiAgentRunsPerMonth)} AI Agent runs`,
      ],
    },
    {
      id: 'compliance',
      name: TIER_CONFIG.compliance.name,
      price: TIER_CONFIG.compliance.price,
      annual: TIER_CONFIG.compliance.annualPrice,
      description: TIER_CONFIG.compliance.description,
      popular: false,
      features: [
        'Everything in Pro, plus:',
        'SOC2, HIPAA, GDPR, PCI-DSS',
        'NIST and ISO 27001 frameworks',
        'Audit-ready PDF reports',
        `${formatLimit(TIER_CONFIG.compliance.limits.realityRunsPerMonth)} Reality, ${formatLimit(TIER_CONFIG.compliance.limits.aiAgentRunsPerMonth)} AI Agent runs`,
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
export function getRateLimitForTier(tier: Tier): RateLimitConfig {
  return TIER_CONFIG[tier].rateLimit;
}

/**
 * Get user tiers formatted for rate limiter
 */
export function getRateLimiterTiers(): Record<Tier, {
  name: string;
  baseLimit: number;
  burstLimit: number;
  windowMs: number;
}> {
  const result: Record<string, any> = {};
  for (const tier of TIERS) {
    const config = TIER_CONFIG[tier];
    result[tier] = {
      name: config.name,
      baseLimit: config.rateLimit.requestsPerMinute,
      burstLimit: config.rateLimit.burstLimit,
      windowMs: config.rateLimit.windowMs,
    };
  }
  return result as Record<Tier, any>;
}

// ============================================================================
// SEAT MANAGEMENT HELPERS
// ============================================================================

/**
 * Get seat pricing for a tier
 */
export function getSeatPricing(tier: Tier): SeatPricing {
  return SEAT_PRICING[tier];
}

/**
 * Calculate effective team seats (base + purchased extras)
 */
export function calculateEffectiveSeats(tier: Tier, purchasedExtraSeats: number): number {
  const baseSeats = TIER_CONFIG[tier].limits.teamMembers;
  const seatConfig = SEAT_PRICING[tier];
  
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
export function canAddMember(
  tier: Tier,
  currentMemberCount: number,
  purchasedExtraSeats: number
): { allowed: boolean; reason?: string; effectiveSeats: number } {
  const effectiveSeats = calculateEffectiveSeats(tier, purchasedExtraSeats);
  
  if (effectiveSeats === Infinity) {
    return { allowed: true, effectiveSeats };
  }
  
  if (currentMemberCount >= effectiveSeats) {
    const seatConfig = SEAT_PRICING[tier];
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
export function calculateSeatCost(
  tier: Tier,
  additionalSeats: number,
  billingInterval: 'month' | 'year'
): { total: number; perSeat: number; supported: boolean } {
  const seatConfig = SEAT_PRICING[tier];
  
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
export function getStripeSeatPriceId(tier: Tier, interval: 'month' | 'year'): string | undefined {
  const envKey = interval === 'year'
    ? `STRIPE_SEAT_PRICE_${tier.toUpperCase()}_ANNUAL`
    : `STRIPE_SEAT_PRICE_${tier.toUpperCase()}_MONTHLY`;
  
  return process.env[envKey];
}

/**
 * Format seat info for display
 */
export function formatSeatInfo(tier: Tier): string {
  const config = TIER_CONFIG[tier];
  const seatConfig = SEAT_PRICING[tier];
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
export function validateSeatReduction(
  currentMemberCount: number,
  _currentEffectiveSeats: number, // Kept for API compatibility, may be used for logging
  newEffectiveSeats: number
): {
  safe: boolean;
  requiresAction: boolean;
  excessMembers: number;
  message: string;
} {
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
