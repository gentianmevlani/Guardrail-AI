/**
 * Entitlements System - SINGLE SOURCE OF TRUTH
 * 
 * This module is the canonical entitlements implementation for guardrail.
 * It handles feature access, usage limits, tier enforcement, and seat management.
 * 
 * IMPORTANT: This TypeScript file is compiled to dist/entitlements.js
 * DO NOT create separate entitlements.js files elsewhere in the codebase.
 * All consumers (API, CLI, etc.) should import from @guardrail/core.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    Feature,
    SEAT_PRICING,
    SeatPricing,
    TIER_CONFIG,
    Tier,
    TierConfig,
    calculateEffectiveSeats,
    canAddMember,
    formatSeatInfo,
    getMinimumTierForFeature,
    getTierConfig,
    isValidTier,
    validateSeatReduction,
} from './tier-config';

// Re-export types for consumers
export type { Feature, SeatPricing, Tier, TierConfig };

// Re-export values for consumers
    export {
        SEAT_PRICING,
        TIER_CONFIG,
        calculateEffectiveSeats,
        canAddMember,
        formatSeatInfo,
        getMinimumTierForFeature,
        getTierConfig,
        isValidTier,
        validateSeatReduction
    };

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// ENTITLEMENTS MANAGER
// ============================================================================

export class EntitlementsManager {
  private configDir: string;
  private usageFile: string;
  private licenseFile: string;
  
  constructor() {
    this.configDir = path.join(os.homedir(), '.guardrail');
    this.usageFile = path.join(this.configDir, 'usage.json');
    this.licenseFile = path.join(this.configDir, 'license.json');
  }
  
  /**
   * Get current tier from license file or environment
   */
  async getCurrentTier(): Promise<Tier> {
    // SECURITY: Only allow tier override in test mode (NODE_ENV=test)
    // Prevents bypassing paid features in production
    if (process.env['GUARDRAIL_TIER']) {
      if (process.env['NODE_ENV'] === 'test') {
        // Test mode: allow override for testing
        return process.env['GUARDRAIL_TIER'] as Tier;
      } else {
        // Production/development: ignore override to prevent bypass
        console.warn('GUARDRAIL_TIER override ignored (only allowed in test mode)');
        // Continue to check license/API key normally
      }
    }
    
    // Check for license file
    try {
      const license = await this.readLicense();
      if (license?.tier && isValidTier(license.tier)) {
        // Check expiration
        if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
          return 'free';
        }
        return license.tier;
      }
    } catch {
      // No license file
    }
    
    // Check for API key - validate against server (NO local tier parsing)
    const apiKey = process.env['GUARDRAIL_API_KEY'];
    if (apiKey) {
      const tier = await this.validateApiKeyWithServer(apiKey);
      if (tier) return tier;
    }
    
    return 'free';
  }
  
  /**
   * Validate API key against server and return tier
   * 
   * SECURITY: Tier is determined server-side only.
   * The API key string contains NO tier information.
   */
  private async validateApiKeyWithServer(apiKey: string): Promise<Tier | null> {
    const apiUrl = process.env['GUARDRAIL_API_URL'] || 'https://api.guardrailai.dev';
    
    try {
      const response = await fetch(`${apiUrl}/api/api-keys/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });
      
      if (!response.ok) {
        return null;
      }
      
      const result = await response.json() as { valid: boolean; tier?: string };
      
      if (result.valid && result.tier && isValidTier(result.tier)) {
        return result.tier as Tier;
      }
    } catch (error) {
      // Network error or server unavailable - explicitly return free tier
      // SECURITY: Never grant paid features when offline
      // Log warning if logger available (might not be in all contexts)
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[guardrail] API unavailable, falling back to free tier');
      }
      return 'free'; // Explicit free tier, not null
    }
    
    return null; // Invalid key or invalid response
  }
  
  /**
   * Check if a feature is available for the current tier
   */
  async checkFeature(feature: Feature): Promise<EntitlementCheck> {
    const tier = await this.getCurrentTier();
    const config = TIER_CONFIG[tier];
    
    if (config.features.includes(feature)) {
      return { allowed: true };
    }
    
    // Find the minimum tier that has this feature
    const requiredTier = getMinimumTierForFeature(feature);
    
    return {
      allowed: false,
      reason: `'${feature}' requires ${requiredTier || 'higher'} tier`,
      upgradePrompt: this.formatUpgradePrompt(tier, requiredTier, feature),
    };
  }
  
  /**
   * Check usage limits
   */
  async checkLimit(limitType: 'scans' | 'realityRuns' | 'aiAgentRuns'): Promise<EntitlementCheck> {
    const tier = await this.getCurrentTier();
    const config = TIER_CONFIG[tier];
    const usage = await this.getUsage();
    
    const limitMap: Record<string, keyof TierConfig['limits']> = {
      scans: 'scansPerMonth',
      realityRuns: 'realityRunsPerMonth',
      aiAgentRuns: 'aiAgentRunsPerMonth',
    };
    
    const limitKey = limitMap[limitType] as keyof TierConfig['limits'];
    const limit = config.limits[limitKey] as number;
    const current = usage.usage[limitType] || 0;
    
    // Handle unlimited (-1)
    if (limit === -1 || current < limit) {
      return {
        allowed: true,
        usage: current,
        limit: limit === -1 ? -1 : limit,
        source: 'local',
      };
    }
    
    return {
      allowed: false,
      reason: `Monthly ${limitType} limit reached (${current}/${limit})`,
      usage: current,
      limit,
      upgradePrompt: this.formatLimitUpgradePrompt(tier, limitType, current, limit),
      source: 'local',
    };
  }
  
  /**
   * Track usage
   */
  async trackUsage(type: 'scans' | 'realityRuns' | 'aiAgentRuns' | 'gateRuns' | 'fixRuns', count: number = 1): Promise<void> {
    const usage = await this.getUsage();
    usage.usage[type] = (usage.usage[type] || 0) + count;
    usage.lastUpdated = new Date().toISOString();
    await this.saveUsage(usage);
  }
  
  /**
   * Enforce feature access (throws if not allowed)
   */
  async enforceFeature(feature: Feature): Promise<void> {
    const check = await this.checkFeature(feature);
    if (!check.allowed) {
      const error = new Error(check.reason) as any;
      error.code = 'FEATURE_NOT_AVAILABLE';
      error.upgradePrompt = check.upgradePrompt;
      error.feature = feature;
      throw error;
    }
  }
  
  /**
   * Enforce usage limits (throws if exceeded)
   */
  async enforceLimit(limitType: 'scans' | 'realityRuns' | 'aiAgentRuns'): Promise<void> {
    const check = await this.checkLimit(limitType);
    if (!check.allowed) {
      const error = new Error(check.reason) as any;
      error.code = 'LIMIT_EXCEEDED';
      error.upgradePrompt = check.upgradePrompt;
      error.usage = check.usage;
      error.limit = check.limit;
      throw error;
    }
  }
  
  // ============================================================================
  // SEAT MANAGEMENT
  // ============================================================================
  
  /**
   * Check if a member can be added to an organization
   */
  checkSeatLimit(
    tier: Tier,
    currentMemberCount: number,
    purchasedExtraSeats: number = 0
  ): SeatCheck {
    const config = TIER_CONFIG[tier];
    const baseSeats = config.limits.teamMembers;
    const result = canAddMember(tier, currentMemberCount, purchasedExtraSeats);
    
    return {
      allowed: result.allowed,
      reason: result.reason,
      effectiveSeats: result.effectiveSeats === Infinity ? -1 : result.effectiveSeats,
      baseSeats: baseSeats === -1 ? -1 : baseSeats,
      purchasedSeats: purchasedExtraSeats,
      currentMembers: currentMemberCount,
    };
  }
  
  /**
   * Get organization seat information
   */
  getOrganizationSeats(
    tier: Tier,
    purchasedExtraSeats: number,
    currentMembers: number
  ): OrganizationSeats {
    const config = TIER_CONFIG[tier];
    const baseSeats = config.limits.teamMembers;
    const effectiveSeats = calculateEffectiveSeats(tier, purchasedExtraSeats);
    
    return {
      tier,
      baseSeats: baseSeats === -1 ? -1 : baseSeats,
      purchasedExtraSeats,
      effectiveSeats: effectiveSeats === Infinity ? -1 : effectiveSeats,
      currentMembers,
      seatPricing: SEAT_PRICING[tier],
    };
  }
  
  /**
   * Validate seat reduction before processing
   */
  validateSeatReduction(
    currentMemberCount: number,
    currentPurchasedSeats: number,
    newPurchasedSeats: number,
    tier: Tier
  ): { safe: boolean; requiresAction: boolean; excessMembers: number; message: string } {
    const currentEffective = calculateEffectiveSeats(tier, currentPurchasedSeats);
    const newEffective = calculateEffectiveSeats(tier, newPurchasedSeats);
    
    return validateSeatReduction(
      currentMemberCount,
      currentEffective === Infinity ? -1 : currentEffective,
      newEffective === Infinity ? -1 : newEffective
    );
  }
  
  // ============================================================================
  // USAGE MANAGEMENT
  // ============================================================================
  
  /**
   * Get usage for current billing period
   */
  async getUsage(): Promise<UsageRecord> {
    try {
      await this.ensureConfigDir();
      const content = await fs.promises.readFile(this.usageFile, 'utf8');
      const usage = JSON.parse(content) as UsageRecord;
      
      // Check if we need to reset for new period
      if (this.isNewBillingPeriod(usage.periodStart)) {
        return this.createNewUsageRecord();
      }
      
      return usage;
    } catch {
      return this.createNewUsageRecord();
    }
  }
  
  /**
   * Get tier configuration
   */
  getTierConfig(tier: Tier): TierConfig {
    return TIER_CONFIG[tier];
  }
  
  /**
   * Get all tier configurations
   */
  getAllTiers(): Record<Tier, TierConfig> {
    return TIER_CONFIG;
  }
  
  /**
   * Get usage summary for display
   */
  async getUsageSummary(): Promise<string> {
    const tier = await this.getCurrentTier();
    const config = TIER_CONFIG[tier];
    const usage = await this.getUsage();
    
    const formatLimit = (current: number, limit: number): string => {
      if (limit === -1) return `${current} (unlimited)`;
      const pct = Math.round((current / limit) * 100);
      const bar = this.progressBar(pct);
      return `${current}/${limit} ${bar} ${pct}%`;
    };
    
    let summary = '\n';
    summary += `📊 Usage Summary (${config.name} tier)\n`;
    summary += '─'.repeat(50) + '\n';
    summary += `Scans:        ${formatLimit(usage.usage.scans, config.limits.scansPerMonth)}\n`;
    summary += `Reality Runs: ${formatLimit(usage.usage.realityRuns, config.limits.realityRunsPerMonth)}\n`;
    summary += `AI Agent:     ${formatLimit(usage.usage.aiAgentRuns, config.limits.aiAgentRunsPerMonth)}\n`;
    summary += `Team Seats:   ${formatSeatInfo(tier)}\n`;
    summary += '─'.repeat(50) + '\n';
    summary += `Period: ${usage.periodStart.split('T')[0]} to ${usage.periodEnd.split('T')[0]}\n`;
    
    return summary;
  }
  
  // ============================================================================
  // UPGRADE PROMPTS
  // ============================================================================
  
  /**
   * Format upgrade prompt for CLI output
   */
  formatUpgradePrompt(currentTier: Tier, requiredTier: Tier | null, feature: Feature): string {
    const required = requiredTier ? TIER_CONFIG[requiredTier] : null;
    
    let prompt = '\n';
    prompt += '╭─────────────────────────────────────────────────────────────╮\n';
    prompt += '│  ⚡ UPGRADE REQUIRED                                        │\n';
    prompt += '├─────────────────────────────────────────────────────────────┤\n';
    prompt += `│  Feature: ${feature.padEnd(48)}│\n`;
    prompt += `│  Your tier: ${currentTier.padEnd(46)}│\n`;
    
    if (required) {
      prompt += `│  Required: ${requiredTier} ($${required.price}/month)`.padEnd(62) + '│\n';
      prompt += '├─────────────────────────────────────────────────────────────┤\n';
      prompt += `│  ${required.name} includes:`.padEnd(62) + '│\n';
      
      // Show key features of required tier
      const keyFeatures = required.features.slice(0, 5);
      for (const f of keyFeatures) {
        prompt += `│    ✓ ${f}`.padEnd(62) + '│\n';
      }
    }
    
    prompt += '├─────────────────────────────────────────────────────────────┤\n';
    prompt += '│  → guardrail upgrade                                        │\n';
    prompt += '│  → https://guardrailai.dev/pricing                          │\n';
    prompt += '╰─────────────────────────────────────────────────────────────╯\n';
    
    return prompt;
  }
  
  /**
   * Format limit exceeded prompt
   */
  formatLimitUpgradePrompt(currentTier: Tier, limitType: string, current: number, limit: number): string {
    const config = TIER_CONFIG[currentTier];
    const nextConfig = TIER_CONFIG[config.upsell.nextTier];
    
    let prompt = '\n';
    prompt += '╭─────────────────────────────────────────────────────────────╮\n';
    prompt += '│  ⚠️  MONTHLY LIMIT REACHED                                   │\n';
    prompt += '├─────────────────────────────────────────────────────────────┤\n';
    prompt += `│  ${limitType}: ${current}/${limit} used this month`.padEnd(62) + '│\n';
    prompt += `│  Your tier: ${currentTier} ($${config.price}/month)`.padEnd(62) + '│\n';
    prompt += '├─────────────────────────────────────────────────────────────┤\n';
    prompt += `│  ${config.upsell.message}`.substring(0, 58).padEnd(62) + '│\n';
    
    if (nextConfig && config.upsell.nextTier !== currentTier) {
      const nextLimitMap: Record<string, keyof TierConfig['limits']> = {
        scans: 'scansPerMonth',
        realityRuns: 'realityRunsPerMonth',
        aiAgentRuns: 'aiAgentRunsPerMonth',
      };
      const nextLimit = nextConfig.limits[nextLimitMap[limitType] || 'scansPerMonth'];
      prompt += '├─────────────────────────────────────────────────────────────┤\n';
      prompt += `│  ${nextConfig.name} ($${nextConfig.price}/mo): ${nextLimit === -1 ? 'Unlimited' : nextLimit} ${limitType}/month`.padEnd(62) + '│\n';
    }
    
    prompt += '├─────────────────────────────────────────────────────────────┤\n';
    prompt += '│  → guardrail upgrade                                        │\n';
    prompt += '│  → https://guardrailai.dev/pricing                          │\n';
    prompt += '╰─────────────────────────────────────────────────────────────╯\n';
    
    return prompt;
  }
  
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================
  
  private isNewBillingPeriod(periodStart: string): boolean {
    const start = new Date(periodStart);
    const now = new Date();
    
    // Monthly billing period
    const nextPeriod = new Date(start);
    nextPeriod.setMonth(nextPeriod.getMonth() + 1);
    
    return now >= nextPeriod;
  }
  
  private createNewUsageRecord(): UsageRecord {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    return {
      tier: 'free',
      periodStart: now.toISOString(),
      periodEnd: periodEnd.toISOString(),
      usage: {
        scans: 0,
        realityRuns: 0,
        aiAgentRuns: 0,
        gateRuns: 0,
        fixRuns: 0,
      },
      lastUpdated: now.toISOString(),
    };
  }
  
  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.configDir, { recursive: true });
    } catch {
      // Directory exists
    }
  }
  
  private async saveUsage(usage: UsageRecord): Promise<void> {
    await this.ensureConfigDir();
    await fs.promises.writeFile(this.usageFile, JSON.stringify(usage, null, 2));
  }
  
  private async readLicense(): Promise<{ tier: Tier; expiresAt?: string; apiKey?: string } | null> {
    try {
      const content = await fs.promises.readFile(this.licenseFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  private progressBar(percent: number): string {
    const filled = Math.min(10, Math.round(percent / 10));
    const empty = 10 - filled;
    const color = percent >= 90 ? '🔴' : percent >= 70 ? '🟡' : '🟢';
    return `[${color.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const entitlements = new EntitlementsManager();

// Convenience exports
export const checkFeature = (feature: Feature) => entitlements.checkFeature(feature);
export const checkLimit = (limitType: 'scans' | 'realityRuns' | 'aiAgentRuns') => entitlements.checkLimit(limitType);
export const enforceFeature = (feature: Feature) => entitlements.enforceFeature(feature);
export const enforceLimit = (limitType: 'scans' | 'realityRuns' | 'aiAgentRuns') => entitlements.enforceLimit(limitType);
export const trackUsage = (type: 'scans' | 'realityRuns' | 'aiAgentRuns' | 'gateRuns' | 'fixRuns', count?: number) => entitlements.trackUsage(type, count);
export const getCurrentTier = () => entitlements.getCurrentTier();
export const getUsageSummary = () => entitlements.getUsageSummary();
export const checkSeatLimit = (tier: Tier, currentMemberCount: number, purchasedExtraSeats?: number) => 
  entitlements.checkSeatLimit(tier, currentMemberCount, purchasedExtraSeats);
export const getOrganizationSeats = (tier: Tier, purchasedExtraSeats: number, currentMembers: number) =>
  entitlements.getOrganizationSeats(tier, purchasedExtraSeats, currentMembers);
