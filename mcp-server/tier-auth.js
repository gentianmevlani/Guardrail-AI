/**
 * MCP Server Tier Authentication & Authorization
<<<<<<< HEAD
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
=======
 * 
 * Provides tier checking for MCP tools based on API keys
 */

import fs from "fs/promises";
import path from "path";
import os from "os";

// Tier definitions
export const TIERS = {
  free: {
    name: 'Free',
    features: ['verify', 'quality', 'hallucination'],
    limits: { scans: 10, projects: 1 }
  },
  starter: {
    name: 'Starter', 
    features: ['verify', 'quality', 'hallucination', 'smells', 'breaking'],
    limits: { scans: 100, projects: 3 }
  },
  pro: {
    name: 'Professional',
    features: ['verify', 'quality', 'hallucination', 'smells', 'breaking', 'mdc'],
    limits: { scans: 1000, projects: 10 }
  },
  enterprise: {
    name: 'Enterprise',
    features: ['verify', 'quality', 'hallucination', 'smells', 'breaking', 'mdc'],
    limits: { scans: -1, projects: -1 } // unlimited
  }
};

/**
 * Load user configuration from ~/.guardrail/credentials.json
 */
async function loadUserConfig() {
  try {
    const configPath = path.join(os.homedir(), '.guardrail', 'credentials.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    return null;
  }
}

/**
 * Determine tier from API key
 */
function getTierFromApiKey(apiKey) {
  if (!apiKey) return 'free';
  
  if (apiKey.startsWith('gr_starter_')) return 'starter';
  if (apiKey.startsWith('gr_pro_')) return 'pro';
  if (apiKey.startsWith('gr_ent_')) return 'enterprise';
  if (apiKey.startsWith('gr_free_')) return 'free';
  
  return 'free'; // default for unknown keys
}

/**
 * Check if user has access to a specific feature
 */
export async function checkFeatureAccess(featureName, providedApiKey = null) {
  // Try to load user config
  const userConfig = await loadUserConfig();
  const apiKey = providedApiKey || userConfig?.apiKey;
  
  if (!apiKey) {
    return {
      hasAccess: false,
      tier: 'free',
      reason: 'No API key provided. Run: guardrail auth --key YOUR_API_KEY',
      upgradeUrl: 'https://guardrailai.dev/pricing'
    };
  }
  
  const tier = getTierFromApiKey(apiKey);
  const tierConfig = TIERS[tier];
  
  if (!tierConfig.features.includes(featureName)) {
    const requiredTier = Object.entries(TIERS).find(([_, config]) => 
      config.features.includes(featureName)
    )?.[0];
    
    return {
      hasAccess: false,
      tier,
      reason: `${featureName} requires ${requiredTier} tier or higher`,
      upgradeUrl: 'https://guardrailai.dev/pricing'
    };
  }
  
  return {
    hasAccess: true,
    tier,
    reason: 'Access granted'
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  };
}

/**
 * Middleware for MCP tool handlers
<<<<<<< HEAD
 * @param {string} featureName - Canonical `Feature` id
 * @param {(args: object) => Promise<unknown>} handler
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
 */
export function withTierCheck(featureName, handler) {
  return async (args) => {
    const access = await checkFeatureAccess(featureName, args?.apiKey);
<<<<<<< HEAD

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

=======
    
    if (!access.hasAccess) {
      return {
        content: [{
          type: "text",
          text: `🚫 UPGRADE REQUIRED\n\n${access.reason}\n\nUpgrade at: ${access.upgradeUrl}`
        }],
        isError: true
      };
    }
    
    // Add tier info to args for the handler
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    args._tier = access.tier;
    return handler(args);
  };
}

/**
<<<<<<< HEAD
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
=======
 * Get current user info
 */
export async function getUserInfo() {
  const config = await loadUserConfig();
  if (!config) {
    return {
      authenticated: false,
      tier: 'free',
      message: 'Not authenticated. Run: guardrail auth --key YOUR_API_KEY'
    };
  }
  
  const tier = getTierFromApiKey(config.apiKey);
  return {
    authenticated: true,
    tier,
    email: config.email,
    authenticatedAt: config.authenticatedAt,
    features: TIERS[tier].features,
    limits: TIERS[tier].limits
  };
}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
