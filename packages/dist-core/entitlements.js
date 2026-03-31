"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizationSeats = exports.checkSeatLimit = exports.getUsageSummary = exports.getCurrentTier = exports.trackUsage = exports.enforceLimit = exports.enforceFeature = exports.checkLimit = exports.checkFeature = exports.entitlements = exports.EntitlementsManager = exports.validateSeatReduction = exports.isValidTier = exports.getTierConfig = exports.getMinimumTierForFeature = exports.formatSeatInfo = exports.canAddMember = exports.calculateEffectiveSeats = exports.TIER_CONFIG = exports.SEAT_PRICING = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tier_config_1 = require("./tier-config");
Object.defineProperty(exports, "SEAT_PRICING", { enumerable: true, get: function () { return tier_config_1.SEAT_PRICING; } });
Object.defineProperty(exports, "TIER_CONFIG", { enumerable: true, get: function () { return tier_config_1.TIER_CONFIG; } });
Object.defineProperty(exports, "calculateEffectiveSeats", { enumerable: true, get: function () { return tier_config_1.calculateEffectiveSeats; } });
Object.defineProperty(exports, "canAddMember", { enumerable: true, get: function () { return tier_config_1.canAddMember; } });
Object.defineProperty(exports, "formatSeatInfo", { enumerable: true, get: function () { return tier_config_1.formatSeatInfo; } });
Object.defineProperty(exports, "getMinimumTierForFeature", { enumerable: true, get: function () { return tier_config_1.getMinimumTierForFeature; } });
Object.defineProperty(exports, "getTierConfig", { enumerable: true, get: function () { return tier_config_1.getTierConfig; } });
Object.defineProperty(exports, "isValidTier", { enumerable: true, get: function () { return tier_config_1.isValidTier; } });
Object.defineProperty(exports, "validateSeatReduction", { enumerable: true, get: function () { return tier_config_1.validateSeatReduction; } });
// ============================================================================
// ENTITLEMENTS MANAGER
// ============================================================================
class EntitlementsManager {
    configDir;
    usageFile;
    licenseFile;
    constructor() {
        this.configDir = path.join(os.homedir(), '.guardrail');
        this.usageFile = path.join(this.configDir, 'usage.json');
        this.licenseFile = path.join(this.configDir, 'license.json');
    }
    /**
     * Get current tier from license file or environment
     */
    async getCurrentTier() {
        // SECURITY: Only allow tier override in test mode (NODE_ENV=test)
        // Prevents bypassing paid features in production
        if (process.env['GUARDRAIL_TIER']) {
            if (process.env['NODE_ENV'] === 'test') {
                // Test mode: allow override for testing
                return process.env['GUARDRAIL_TIER'];
            }
            else {
                // Production/development: ignore override to prevent bypass
                console.warn('GUARDRAIL_TIER override ignored (only allowed in test mode)');
                // Continue to check license/API key normally
            }
        }
        // Check for license file
        try {
            const license = await this.readLicense();
            if (license?.tier && (0, tier_config_1.isValidTier)(license.tier)) {
                // Check expiration
                if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
                    return 'free';
                }
                return license.tier;
            }
        }
        catch {
            // No license file
        }
        // Check for API key - validate against server (NO local tier parsing)
        const apiKey = process.env['GUARDRAIL_API_KEY'];
        if (apiKey) {
            const tier = await this.validateApiKeyWithServer(apiKey);
            if (tier)
                return tier;
        }
        return 'free';
    }
    /**
     * Validate API key against server and return tier
     *
     * SECURITY: Tier is determined server-side only.
     * The API key string contains NO tier information.
     */
    async validateApiKeyWithServer(apiKey) {
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
            const result = await response.json();
            if (result.valid && result.tier && (0, tier_config_1.isValidTier)(result.tier)) {
                return result.tier;
            }
        }
        catch (error) {
            // Network error or server unavailable - explicitly return free tier
            // SECURITY: Never grant paid features when offline
            // Log warning if logger available (might not be in all contexts)
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[Guardrail] API unavailable, falling back to free tier');
            }
            return 'free'; // Explicit free tier, not null
        }
        return null; // Invalid key or invalid response
    }
    /**
     * Check if a feature is available for the current tier
     */
    async checkFeature(feature) {
        const tier = await this.getCurrentTier();
        const config = tier_config_1.TIER_CONFIG[tier];
        // Unlimited tier has all features
        if (tier === 'unlimited' || config.features.includes(feature)) {
            return { allowed: true };
        }
        // Find the minimum tier that has this feature
        const requiredTier = (0, tier_config_1.getMinimumTierForFeature)(feature);
        return {
            allowed: false,
            reason: `'${feature}' requires ${requiredTier || 'higher'} tier`,
            upgradePrompt: this.formatUpgradePrompt(tier, requiredTier, feature),
        };
    }
    /**
     * Check usage limits
     */
    async checkLimit(limitType) {
        const tier = await this.getCurrentTier();
        const config = tier_config_1.TIER_CONFIG[tier];
        const usage = await this.getUsage();
        const limitMap = {
            scans: 'scansPerMonth',
            realityRuns: 'realityRunsPerMonth',
            aiAgentRuns: 'aiAgentRunsPerMonth',
        };
        const limitKey = limitMap[limitType];
        const limit = config.limits[limitKey];
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
    async trackUsage(type, count = 1) {
        const usage = await this.getUsage();
        usage.usage[type] = (usage.usage[type] || 0) + count;
        usage.lastUpdated = new Date().toISOString();
        await this.saveUsage(usage);
    }
    /**
     * Enforce feature access (throws if not allowed)
     */
    async enforceFeature(feature) {
        const check = await this.checkFeature(feature);
        if (!check.allowed) {
            const error = new Error(check.reason);
            error.code = 'FEATURE_NOT_AVAILABLE';
            error.upgradePrompt = check.upgradePrompt;
            error.feature = feature;
            throw error;
        }
    }
    /**
     * Enforce usage limits (throws if exceeded)
     */
    async enforceLimit(limitType) {
        const check = await this.checkLimit(limitType);
        if (!check.allowed) {
            const error = new Error(check.reason);
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
    checkSeatLimit(tier, currentMemberCount, purchasedExtraSeats = 0) {
        const config = tier_config_1.TIER_CONFIG[tier];
        const baseSeats = config.limits.teamMembers;
        const result = (0, tier_config_1.canAddMember)(tier, currentMemberCount, purchasedExtraSeats);
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
    getOrganizationSeats(tier, purchasedExtraSeats, currentMembers) {
        const config = tier_config_1.TIER_CONFIG[tier];
        const baseSeats = config.limits.teamMembers;
        const effectiveSeats = (0, tier_config_1.calculateEffectiveSeats)(tier, purchasedExtraSeats);
        return {
            tier,
            baseSeats: baseSeats === -1 ? -1 : baseSeats,
            purchasedExtraSeats,
            effectiveSeats: effectiveSeats === Infinity ? -1 : effectiveSeats,
            currentMembers,
            seatPricing: tier_config_1.SEAT_PRICING[tier],
        };
    }
    /**
     * Validate seat reduction before processing
     */
    validateSeatReduction(currentMemberCount, currentPurchasedSeats, newPurchasedSeats, tier) {
        const currentEffective = (0, tier_config_1.calculateEffectiveSeats)(tier, currentPurchasedSeats);
        const newEffective = (0, tier_config_1.calculateEffectiveSeats)(tier, newPurchasedSeats);
        return (0, tier_config_1.validateSeatReduction)(currentMemberCount, currentEffective === Infinity ? -1 : currentEffective, newEffective === Infinity ? -1 : newEffective);
    }
    // ============================================================================
    // USAGE MANAGEMENT
    // ============================================================================
    /**
     * Get usage for current billing period
     */
    async getUsage() {
        try {
            await this.ensureConfigDir();
            const content = await fs.promises.readFile(this.usageFile, 'utf8');
            const usage = JSON.parse(content);
            // Check if we need to reset for new period
            if (this.isNewBillingPeriod(usage.periodStart)) {
                return this.createNewUsageRecord();
            }
            return usage;
        }
        catch {
            return this.createNewUsageRecord();
        }
    }
    /**
     * Get tier configuration
     */
    getTierConfig(tier) {
        return tier_config_1.TIER_CONFIG[tier];
    }
    /**
     * Get all tier configurations
     */
    getAllTiers() {
        return tier_config_1.TIER_CONFIG;
    }
    /**
     * Get usage summary for display
     */
    async getUsageSummary() {
        const tier = await this.getCurrentTier();
        const config = tier_config_1.TIER_CONFIG[tier];
        const usage = await this.getUsage();
        const formatLimit = (current, limit) => {
            if (limit === -1)
                return `${current} (unlimited)`;
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
        summary += `Team Seats:   ${(0, tier_config_1.formatSeatInfo)(tier)}\n`;
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
    formatUpgradePrompt(currentTier, requiredTier, feature) {
        const required = requiredTier ? tier_config_1.TIER_CONFIG[requiredTier] : null;
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
    formatLimitUpgradePrompt(currentTier, limitType, current, limit) {
        const config = tier_config_1.TIER_CONFIG[currentTier];
        const nextConfig = tier_config_1.TIER_CONFIG[config.upsell.nextTier];
        let prompt = '\n';
        prompt += '╭─────────────────────────────────────────────────────────────╮\n';
        prompt += '│  ⚠️  MONTHLY LIMIT REACHED                                   │\n';
        prompt += '├─────────────────────────────────────────────────────────────┤\n';
        prompt += `│  ${limitType}: ${current}/${limit} used this month`.padEnd(62) + '│\n';
        prompt += `│  Your tier: ${currentTier} ($${config.price}/month)`.padEnd(62) + '│\n';
        prompt += '├─────────────────────────────────────────────────────────────┤\n';
        prompt += `│  ${config.upsell.message}`.substring(0, 58).padEnd(62) + '│\n';
        if (nextConfig && config.upsell.nextTier !== 'unlimited') {
            const nextLimitMap = {
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
    isNewBillingPeriod(periodStart) {
        const start = new Date(periodStart);
        const now = new Date();
        // Monthly billing period
        const nextPeriod = new Date(start);
        nextPeriod.setMonth(nextPeriod.getMonth() + 1);
        return now >= nextPeriod;
    }
    createNewUsageRecord() {
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
    async ensureConfigDir() {
        try {
            await fs.promises.mkdir(this.configDir, { recursive: true });
        }
        catch {
            // Directory exists
        }
    }
    async saveUsage(usage) {
        await this.ensureConfigDir();
        await fs.promises.writeFile(this.usageFile, JSON.stringify(usage, null, 2));
    }
    async readLicense() {
        try {
            const content = await fs.promises.readFile(this.licenseFile, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    progressBar(percent) {
        const filled = Math.min(10, Math.round(percent / 10));
        const empty = 10 - filled;
        const color = percent >= 90 ? '🔴' : percent >= 70 ? '🟡' : '🟢';
        return `[${color.repeat(filled)}${'░'.repeat(empty)}]`;
    }
}
exports.EntitlementsManager = EntitlementsManager;
// ============================================================================
// SINGLETON EXPORT
// ============================================================================
exports.entitlements = new EntitlementsManager();
// Convenience exports
const checkFeature = (feature) => exports.entitlements.checkFeature(feature);
exports.checkFeature = checkFeature;
const checkLimit = (limitType) => exports.entitlements.checkLimit(limitType);
exports.checkLimit = checkLimit;
const enforceFeature = (feature) => exports.entitlements.enforceFeature(feature);
exports.enforceFeature = enforceFeature;
const enforceLimit = (limitType) => exports.entitlements.enforceLimit(limitType);
exports.enforceLimit = enforceLimit;
const trackUsage = (type, count) => exports.entitlements.trackUsage(type, count);
exports.trackUsage = trackUsage;
const getCurrentTier = () => exports.entitlements.getCurrentTier();
exports.getCurrentTier = getCurrentTier;
const getUsageSummary = () => exports.entitlements.getUsageSummary();
exports.getUsageSummary = getUsageSummary;
const checkSeatLimit = (tier, currentMemberCount, purchasedExtraSeats) => exports.entitlements.checkSeatLimit(tier, currentMemberCount, purchasedExtraSeats);
exports.checkSeatLimit = checkSeatLimit;
const getOrganizationSeats = (tier, purchasedExtraSeats, currentMembers) => exports.entitlements.getOrganizationSeats(tier, purchasedExtraSeats, currentMembers);
exports.getOrganizationSeats = getOrganizationSeats;
