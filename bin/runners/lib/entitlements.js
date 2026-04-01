/**
 * Entitlements System - CLI Wrapper
 *
 * ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 *
 * This file wraps the canonical entitlements implementation from @guardrail/core.
 * The source of truth is packages/core/src/entitlements.ts
 *
 * To modify entitlements logic, edit packages/core/src/entitlements.ts
 * then run `pnpm build` in packages/core.
 *
 * This wrapper exists to:
 * 1. Provide CommonJS exports for CLI runners
 * 2. Add CLI-specific functionality (server-usage integration)
 * 3. Maintain backward compatibility with existing CLI code
 */

"use strict";

// Import from compiled @guardrail/core
let coreEntitlements;
try {
  coreEntitlements = require("@guardrail/core");
} catch (e) {
  // Fallback for development: try direct path
  try {
    coreEntitlements = require("../../../packages/core/dist/index.js");
  } catch (e2) {
    // Silent fallback — @guardrail/core not available (standalone CLI install)
    // Only log in debug mode
    if (process.env.GUARDRAIL_DEBUG) {
      console.warn("[entitlements] @guardrail/core not found, using built-in fallback.");
    }
    // Provide minimal fallback
    coreEntitlements = {
      TIER_CONFIG: {},
      SEAT_PRICING: {},
      entitlements: {
        getCurrentTier: async () => "free",
        checkFeature: async () => ({ allowed: true }),
        checkLimit: async () => ({ allowed: true }),
        enforceFeature: async () => {},
        enforceLimit: async () => {},
        trackUsage: async () => {},
        getUsageSummary: async () => "Usage summary unavailable",
        getTierConfig: () => ({}),
        checkSeatLimit: () => ({ allowed: true, effectiveSeats: 1 }),
      },
      calculateEffectiveSeats: () => 1,
      canAddMember: () => ({ allowed: true }),
      formatSeatInfo: () => "1 seat",
      validateSeatReduction: () => ({ safe: true }),
    };
  }
}

// Import server-usage for CLI-specific server-authoritative enforcement
const { serverUsage } = require("./server-usage");

// Re-export everything from core
const {
  TIER_CONFIG,
  SEAT_PRICING,
  entitlements,
  calculateEffectiveSeats,
  canAddMember,
  formatSeatInfo,
  validateSeatReduction,
  isValidTier,
  getTierConfig,
  getMinimumTierForFeature,
} = coreEntitlements;

// ============================================================================
// CLI-SPECIFIC WRAPPER
// ============================================================================

/**
 * CLI Entitlements Manager
 * Wraps core entitlements with CLI-specific server-authoritative checks
 */
class CLIEntitlementsManager {
  constructor(coreManager) {
    this._core = coreManager;
  }

  async getCurrentTier() {
    return this._core.getCurrentTier();
  }

  async checkFeature(feature) {
    return this._core.checkFeature(feature);
  }

  /**
   * Check usage limits - SERVER-AUTHORITATIVE for CLI
   */
  async checkLimit(limitType) {
    // Map old limit types to new action types
    const actionMap = {
      scans: "scan",
      realityRuns: "reality",
      aiAgentRuns: "agent",
    };
    const actionType = actionMap[limitType] || limitType;

    // Use server-authoritative check
    try {
      const result = await serverUsage.checkUsage(actionType);

      if (result.allowed) {
        return {
          allowed: true,
          usage: result.current,
          limit: result.limit === -1 ? Infinity : result.limit,
          source: result.source,
        };
      }

      const tier = await this.getCurrentTier();
      return {
        allowed: false,
        reason:
          result.reason ||
          `Monthly ${limitType} limit reached (${result.current}/${result.limit})`,
        usage: result.current,
        limit: result.limit,
        upgradePrompt: this._core.formatLimitUpgradePrompt(
          tier,
          limitType,
          result.current,
          result.limit,
        ),
        source: result.source,
      };
    } catch (error) {
      // Fallback to core check if server is unreachable
      return this._core.checkLimit(limitType);
    }
  }

  /**
   * Track usage - SERVER-AUTHORITATIVE for CLI
   */
  async trackUsage(type, count = 1) {
    // Map old types to new action types
    const actionMap = {
      scans: "scan",
      realityRuns: "reality",
      aiAgentRuns: "agent",
      gateRuns: "gate",
      fixRuns: "fix",
    };
    const actionType = actionMap[type] || type;

    // Record on server (authoritative)
    try {
      const result = await serverUsage.recordUsage(actionType, count);
      // Also update local via core
      await this._core.trackUsage(type, count);
      return result;
    } catch (error) {
      // Still update local, mark as unsynced
      await this._core.trackUsage(type, count);
      return { success: false, error: error.message, queued: true };
    }
  }

  async enforceFeature(feature) {
    return this._core.enforceFeature(feature);
  }

  /**
   * Enforce usage limits - SERVER-AUTHORITATIVE for CLI
   */
  async enforceLimit(limitType) {
    // Check if sync is required first
    const needsSync = await serverUsage.requiresSync();
    if (needsSync) {
      const syncResult = await serverUsage.syncOfflineUsage();
      if (syncResult.error) {
        // Allow offline mode by default - CLI should work without internet
        console.warn(
          "\x1b[33mWarning: Could not connect to guardrail API, using offline mode\x1b[0m\n",
        );
        return { allowed: true, source: "offline" };
      }
    }

    const check = await this.checkLimit(limitType);
    if (!check.allowed) {
      const error = new Error(check.reason);
      error.code = "LIMIT_EXCEEDED";
      error.upgradePrompt = check.upgradePrompt;
      error.usage = check.usage;
      error.limit = check.limit;
      throw error;
    }

    return check;
  }

  async getUsageSummary() {
    // Try to get server-authoritative summary
    try {
      const serverSummary = await serverUsage.getUsageSummary();

      if (serverSummary.success !== false && serverSummary.usage) {
        const tier = serverSummary.tier || (await this.getCurrentTier());
        const config = TIER_CONFIG[tier];
        const limits = serverSummary.limits || config.limits;

        const formatLimit = (current, limit) => {
          if (limit === -1) return `${current} (unlimited)`;
          const pct = Math.round((current / limit) * 100);
          const bar = this.progressBar(pct);
          return `${current}/${limit} ${bar} ${pct}%`;
        };

        const lines = [
          "",
          `\x1b[1m📊 Usage Summary\x1b[0m (\x1b[36m${config.name}\x1b[0m tier - $${config.price}/mo)`,
          "\x1b[90m" + "─".repeat(50) + "\x1b[0m",
          `Scans:        ${formatLimit(serverSummary.usage.scan || 0, limits.scans || limits.scansPerMonth)}`,
          `Reality Runs: ${formatLimit(serverSummary.usage.reality || 0, limits.reality || limits.realityRunsPerMonth)}`,
          `AI Agent:     ${formatLimit(serverSummary.usage.agent || 0, limits.agent || limits.aiAgentRunsPerMonth)}`,
          `Team Seats:   ${formatSeatInfo(tier)}`,
          "\x1b[90m" + "─".repeat(50) + "\x1b[0m",
        ];

        if (serverSummary.period) {
          lines.push(
            `Period: ${serverSummary.period.start.split("T")[0]} to ${serverSummary.period.end.split("T")[0]}`,
          );
        }

        if (serverSummary.pendingOffline > 0) {
          lines.push(
            `\x1b[33m⚠ ${serverSummary.pendingOffline} action(s) pending sync\x1b[0m`,
          );
        }

        lines.push(
          `\x1b[90mSource: ${serverSummary.source || "server"}\x1b[0m`,
        );
        lines.push("");

        return lines.join("\n");
      }
    } catch {
      // Fall through to core summary
    }

    return this._core.getUsageSummary();
  }

  getTierConfig(tier) {
    return this._core.getTierConfig(tier);
  }

  getAllTiers() {
    return this._core.getAllTiers();
  }

  // Seat management
  checkSeatLimit(tier, currentMemberCount, purchasedExtraSeats) {
    return this._core.checkSeatLimit(
      tier,
      currentMemberCount,
      purchasedExtraSeats,
    );
  }

  getOrganizationSeats(tier, purchasedExtraSeats, currentMembers) {
    return this._core.getOrganizationSeats(
      tier,
      purchasedExtraSeats,
      currentMembers,
    );
  }

  progressBar(percent) {
    const filled = Math.min(10, Math.round(percent / 10));
    const empty = 10 - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  }
}

// Create CLI-specific wrapper
const cliEntitlements = new CLIEntitlementsManager(entitlements);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main entitlements instance (CLI wrapper)
  entitlements: cliEntitlements,

  // Tier configuration
  TIER_CONFIG,
  SEAT_PRICING,

  // Convenience functions
  checkFeature: (feature) => cliEntitlements.checkFeature(feature),
  checkLimit: (limitType) => cliEntitlements.checkLimit(limitType),
  enforceFeature: (feature) => cliEntitlements.enforceFeature(feature),
  enforceLimit: (limitType) => cliEntitlements.enforceLimit(limitType),
  trackUsage: (type, count) => cliEntitlements.trackUsage(type, count),
  getCurrentTier: () => cliEntitlements.getCurrentTier(),
  getUsageSummary: () => cliEntitlements.getUsageSummary(),
  getTierConfig: (tier) => cliEntitlements.getTierConfig(tier),

  // Seat management
  checkSeatLimit: (tier, currentMemberCount, purchasedExtraSeats) =>
    cliEntitlements.checkSeatLimit(
      tier,
      currentMemberCount,
      purchasedExtraSeats,
    ),
  calculateEffectiveSeats,
  canAddMember,
  formatSeatInfo,
  validateSeatReduction,

  // Tier helpers
  isValidTier,
  getMinimumTierForFeature,

  // Server-authoritative usage enforcement
  serverUsage,
  syncOfflineUsage: () => serverUsage.syncOfflineUsage(),
  requiresSync: () => serverUsage.requiresSync(),
};
