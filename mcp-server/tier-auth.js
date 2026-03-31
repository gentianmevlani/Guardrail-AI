/**
 * MCP Server Tier Authentication & Authorization
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
  };
}

/**
 * Middleware for MCP tool handlers
 */
export function withTierCheck(featureName, handler) {
  return async (args) => {
    const access = await checkFeatureAccess(featureName, args?.apiKey);
    
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
    args._tier = access.tier;
    return handler(args);
  };
}

/**
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
