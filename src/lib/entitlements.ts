/**
 * Entitlements System - Local stub implementation
 * 
 * This provides basic entitlement functionality for the CLI.
 * For full functionality, use the @guardrail/core package.
 */

export type Tier = 'free' | 'starter' | 'pro' | 'enterprise';
export type Feature = string;

export interface TierConfig {
  name: string;
  limits: Record<string, number>;
  features: string[];
}

export interface UsageRecord {
  feature: string;
  count: number;
  timestamp: Date;
}

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
}

export interface SeatPricing {
  pricePerSeat: number;
  includedSeats: number;
}

export interface OrganizationSeats {
  total: number;
  used: number;
  available: number;
}

export interface SeatCheck {
  canAdd: boolean;
  reason?: string;
}

export const SEAT_PRICING: Record<Tier, SeatPricing> = {
  free: { pricePerSeat: 0, includedSeats: 1 },
  starter: { pricePerSeat: 10, includedSeats: 5 },
  pro: { pricePerSeat: 15, includedSeats: 10 },
  enterprise: { pricePerSeat: 20, includedSeats: 50 },
};

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free: { name: 'Free', limits: { scans: 10, projects: 1 }, features: ['basic_scan'] },
  starter: { name: 'Starter', limits: { scans: 100, projects: 5 }, features: ['basic_scan', 'reports'] },
  pro: { name: 'Pro', limits: { scans: 1000, projects: 25 }, features: ['basic_scan', 'reports', 'api'] },
  enterprise: { name: 'Enterprise', limits: { scans: -1, projects: -1 }, features: ['all'] },
};

export function checkFeature(tier: Tier, feature: Feature): EntitlementCheck {
  const config = TIER_CONFIG[tier];
  if (config.features.includes('all') || config.features.includes(feature)) {
    return { allowed: true };
  }
  return { allowed: false, reason: `Feature ${feature} not available in ${tier} tier` };
}

export function checkLimit(tier: Tier, limit: string, current: number): EntitlementCheck {
  const config = TIER_CONFIG[tier];
  const max = config.limits[limit] ?? 0;
  if (max === -1 || current < max) {
    return { allowed: true };
  }
  return { allowed: false, reason: `Limit ${limit} exceeded (${current}/${max})` };
}

export function enforceFeature(tier: Tier, feature: Feature): void {
  const check = checkFeature(tier, feature);
  if (!check.allowed) throw new Error(check.reason);
}

export function enforceLimit(tier: Tier, limit: string, current: number): void {
  const check = checkLimit(tier, limit, current);
  if (!check.allowed) throw new Error(check.reason);
}

export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIG[tier];
}

export function isValidTier(tier: string): tier is Tier {
  return ['free', 'starter', 'pro', 'enterprise'].includes(tier);
}

export function getCurrentTier(): Tier {
  return (process.env.GUARDRAIL_TIER as Tier) || 'free';
}

export function getMinimumTierForFeature(feature: Feature): Tier {
  for (const tier of ['free', 'starter', 'pro', 'enterprise'] as Tier[]) {
    if (checkFeature(tier, feature).allowed) return tier;
  }
  return 'enterprise';
}

export function trackUsage(_feature: string, _count: number = 1): void {
  // Stub - tracking would be done via API
}

export function getUsageSummary(): Record<string, number> {
  return {};
}

export function calculateEffectiveSeats(tier: Tier, additionalSeats: number): number {
  return SEAT_PRICING[tier].includedSeats + additionalSeats;
}

export function canAddMember(tier: Tier, currentSeats: number): SeatCheck {
  const maxSeats = SEAT_PRICING[tier].includedSeats;
  if (currentSeats < maxSeats) {
    return { canAdd: true };
  }
  return { canAdd: false, reason: 'Seat limit reached' };
}

export function getOrganizationSeats(tier: Tier, usedSeats: number): OrganizationSeats {
  const total = SEAT_PRICING[tier].includedSeats;
  return { total, used: usedSeats, available: Math.max(0, total - usedSeats) };
}

export function formatSeatInfo(seats: OrganizationSeats): string {
  return `${seats.used}/${seats.total} seats used`;
}

export function validateSeatReduction(currentSeats: number, newSeats: number): SeatCheck {
  if (newSeats >= currentSeats) return { canAdd: true };
  return { canAdd: false, reason: 'Cannot reduce seats below current usage' };
}

export function checkSeatLimit(tier: Tier, currentSeats: number): EntitlementCheck {
  const maxSeats = SEAT_PRICING[tier].includedSeats;
  if (currentSeats <= maxSeats) return { allowed: true };
  return { allowed: false, reason: `Seat limit exceeded (${currentSeats}/${maxSeats})` };
}

export class EntitlementsManager {
  private tier: Tier;
  
  constructor(tier: Tier = 'free') {
    this.tier = tier;
  }
  
  checkFeature(feature: Feature): EntitlementCheck {
    return checkFeature(this.tier, feature);
  }
  
  checkLimit(limit: string, current: number): EntitlementCheck {
    return checkLimit(this.tier, limit, current);
  }
}

export const entitlements = new EntitlementsManager(getCurrentTier());

