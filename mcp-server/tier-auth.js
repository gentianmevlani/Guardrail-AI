/**
 * MCP Server Tier Authentication & Authorization
 *
 * Delegates tier definitions and gates to `@guardrail/core` (tier-config + unified-auth).
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
/** @type {import('@guardrail/core')} */
const core = require("@guardrail/core");

const { resolveAuthLocal, checkFeatureForTier, getTierFeaturesMap, normalizeTier } = core;

/**
 * @param {string} featureName - Canonical `Feature` id from `@guardrail/core` (e.g. `scan`, `scan:full`, `mcp`).
 * @param {string | null} [providedApiKey]
 */
export async function checkFeatureAccess(featureName, providedApiKey = null) {
  const auth = resolveAuthLocal({
    apiKey: providedApiKey ?? undefined,
  });
  const tier = auth.tier;

  if (!featureName || typeof featureName !== "string") {
    return {
      hasAccess: false,
      tier,
      reason: "Invalid feature",
      upgradeUrl: checkFeatureForTier(tier, "scan").upgradeUrl,
    };
  }

  const gate = checkFeatureForTier(tier, featureName);
  if (gate.allowed) {
    return {
      hasAccess: true,
      tier,
      reason: "Access granted",
    };
  }

  return {
    hasAccess: false,
    tier,
    reason: gate.reason ?? `${featureName} is not included in your plan`,
    upgradeUrl: gate.upgradeUrl,
  };
}

/**
 * Middleware for MCP tool handlers
 * @param {string} featureName - Canonical `Feature` id
 * @param {(args: object) => Promise<unknown>} handler
 */
export function withTierCheck(featureName, handler) {
  return async (args) => {
    const access = await checkFeatureAccess(featureName, args?.apiKey);

    if (!access.hasAccess) {
      return {
        content: [
          {
            type: "text",
            text: `🚫 UPGRADE REQUIRED\n\n${access.reason}\n\nUpgrade at: ${access.upgradeUrl}`,
          },
        ],
        isError: true,
      };
    }

    args._tier = access.tier;
    return handler(args);
  };
}

/**
 * Get current user info (tier from unified local resolver + canonical feature list).
 */
export async function getUserInfo() {
  const auth = resolveAuthLocal();
  const tier = auth.tier;
  const map = getTierFeaturesMap();
  const entry = map[tier] ?? map.free;

  return {
    authenticated: auth.source !== "default",
    tier,
    email: auth.email,
    features: entry.features,
    limits: entry.limits,
    source: auth.source,
  };
}

export { normalizeTier };
