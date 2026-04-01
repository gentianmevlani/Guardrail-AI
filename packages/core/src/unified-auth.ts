/**
 * Unified Auth & Tier Resolution — SINGLE ENTRY POINT for every surface.
 *
 * CLI, MCP server, VS Code extension, and web dashboard all share this module
 * for credential discovery, tier normalization, and feature/finding gating.
 *
 * Credential resolution order (same everywhere):
 *   1. Explicit API key or token passed in
 *   2. Environment variable GUARDRAIL_API_KEY
 *   3. On-disk CLI state.json (~/.config/guardrail/state.json or platform equivalent)
 *   4. ~/.guardrail/license.json
 *   5. Default → free
 *
 * DO NOT duplicate tier definitions or auth logic in surface-specific code.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  type Feature,
  type Tier,
  TIER_CONFIG,
  TIER_ORDER,
  isValidTier,
  tierHasFeature,
  getMinimumTierForFeature,
} from "./tier-config";

// ============================================================================
// CREDENTIAL RESOLUTION CHAIN (documented order — matches resolveAuthLocal)
// ============================================================================

/** Ordered steps for resolving API key and tier (same across CLI, MCP, VS Code, web). */
export const CREDENTIAL_RESOLUTION_CHAIN = [
  "explicit-api-key-or-token",
  "env:GUARDRAIL_API_KEY",
  "cli-state.json",
  "license.json",
  "legacy-credentials.json",
  "default:free",
] as const;

export type CredentialResolutionStep = (typeof CREDENTIAL_RESOLUTION_CHAIN)[number];

// ============================================================================
// TYPES
// ============================================================================

/** Canonical product tier ids. "enterprise" or "unlimited" always normalize to "compliance". */
export type ProductTier = Tier; // free | starter | pro | compliance

/** On-disk shape written by VS Code `syncCliCredentialsFromExtension` and read by CLI / `resolveAuthLocal`. */
export interface CliCredentialState {
  apiKey: string;
  tier: ProductTier;
  email?: string;
  authenticatedAt: string;
  cacheUntil: string;
}

export interface ResolvedAuth {
  /** Effective tier after all resolution steps. */
  tier: ProductTier;
  /** Where the tier was determined from. */
  source: "explicit" | "env" | "cli-state" | "license" | "api" | "default";
  /** API key if one was found (masked for logging). */
  apiKeyMasked?: string;
  /** Email from credentials if available. */
  email?: string;
  /** Whether the cached credential is still valid. */
  cacheValid?: boolean;
}

export interface CredentialDiscoveryOptions {
  /** Pre-supplied API key (e.g. from VS Code secrets or MCP args). */
  apiKey?: string;
  /** Pre-supplied access token (e.g. from web session). */
  accessToken?: string;
  /** Skip server validation and trust local cache only. */
  offlineMode?: boolean;
  /** Custom API base URL. */
  apiUrl?: string;
}

// ============================================================================
// PLATFORM CONFIG PATHS (shared across all surfaces)
// ============================================================================

/** Returns the platform-specific guardrail config directory (same as CLI). */
export function getGuardrailConfigDir(): string {
  if (process.platform === "win32") {
    return path.join(
      process.env["APPDATA"] || path.join(os.homedir(), "AppData", "Roaming"),
      "guardrail",
    );
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "guardrail");
  }
  return path.join(
    process.env["XDG_CONFIG_HOME"] || path.join(os.homedir(), ".config"),
    "guardrail",
  );
}

/** Legacy config path used by MCP server and some older CLI versions. */
export function getGuardrailLegacyDir(): string {
  return path.join(os.homedir(), ".guardrail");
}

export function getCliStateFilePath(): string {
  return path.join(getGuardrailConfigDir(), "state.json");
}

export function getLicenseFilePath(): string {
  return path.join(getGuardrailLegacyDir(), "license.json");
}

export function getLegacyCredentialsFilePath(): string {
  return path.join(getGuardrailLegacyDir(), "credentials.json");
}

// ============================================================================
// TIER NORMALIZATION (one implementation for all surfaces)
// ============================================================================

/**
 * Normalize any plan string into a canonical ProductTier.
 * Handles legacy names: enterprise → compliance, team → pro, unlimited → compliance.
 */
export function normalizeTier(raw: string | undefined | null): ProductTier {
  const p = (raw ?? "free").toLowerCase().trim();
  if (p.includes("enterprise") || p.includes("unlimited")) return "compliance";
  if (p.includes("compliance")) return "compliance";
  if (p.includes("pro") || p.includes("team")) return "pro";
  if (p.includes("starter")) return "starter";
  return "free";
}

// ============================================================================
// CREDENTIAL READING (local, no network)
// ============================================================================

interface CliState {
  apiKey?: string;
  tier?: string;
  email?: string;
  cacheUntil?: string;
  authenticatedAt?: string;
}

/** Read on-disk CLI state.json (written by CLI login or VS Code sync). */
export function readCliState(): CliState | null {
  try {
    const raw = fs.readFileSync(getCliStateFilePath(), "utf8");
    const j = JSON.parse(raw) as CliState;
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

/** Read legacy ~/.guardrail/credentials.json (used by older MCP server). */
export function readLegacyCredentials(): { apiKey?: string; email?: string; authenticatedAt?: string } | null {
  try {
    const raw = fs.readFileSync(getLegacyCredentialsFilePath(), "utf8");
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

/** Read ~/.guardrail/license.json. */
export function readLicense(): { tier?: string; expiresAt?: string; apiKey?: string } | null {
  try {
    const raw = fs.readFileSync(getLicenseFilePath(), "utf8");
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

function isCacheValid(cacheUntil: string | undefined): boolean {
  if (!cacheUntil) return false;
  const exp = new Date(cacheUntil).getTime();
  return exp > Date.now() + 60_000; // require at least 1 min remaining
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "…" + key.slice(-4);
}

// ============================================================================
// UNIFIED RESOLUTION (local-only, synchronous)
// ============================================================================

/**
 * Resolve effective auth & tier from all local sources. Synchronous — no network.
 * Call this from any surface for fast local tier resolution.
 */
export function resolveAuthLocal(opts: CredentialDiscoveryOptions = {}): ResolvedAuth {
  // 1. Explicit key/token passed in
  if (opts.apiKey) {
    // Don't parse tier from key prefix — that's insecure.
    // Use alongside CLI state or license for tier info.
    const cliState = readCliState();
    const tier = cliState?.tier ? normalizeTier(cliState.tier) : "free";
    return {
      tier,
      source: "explicit",
      apiKeyMasked: maskApiKey(opts.apiKey),
      email: cliState?.email,
      cacheValid: isCacheValid(cliState?.cacheUntil),
    };
  }

  // 2. Environment variable
  const envKey = process.env["GUARDRAIL_API_KEY"];
  if (envKey) {
    const cliState = readCliState();
    const tier = cliState?.tier ? normalizeTier(cliState.tier) : "free";
    return {
      tier,
      source: "env",
      apiKeyMasked: maskApiKey(envKey),
      email: cliState?.email,
      cacheValid: isCacheValid(cliState?.cacheUntil),
    };
  }

  // 3. CLI state.json (written by CLI login or VS Code sync)
  const cliState = readCliState();
  if (cliState?.apiKey && cliState.tier) {
    return {
      tier: normalizeTier(cliState.tier),
      source: "cli-state",
      apiKeyMasked: maskApiKey(cliState.apiKey),
      email: cliState.email,
      cacheValid: isCacheValid(cliState.cacheUntil),
    };
  }

  // 4. License file
  const license = readLicense();
  if (license?.tier) {
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      // Expired license → free
    } else if (isValidTier(normalizeTier(license.tier))) {
      return {
        tier: normalizeTier(license.tier),
        source: "license",
      };
    }
  }

  // 5. Legacy credentials.json (MCP compat)
  const legacyCreds = readLegacyCredentials();
  if (legacyCreds?.apiKey) {
    // Still resolve tier from CLI state if available, not key prefix
    const tier = cliState?.tier ? normalizeTier(cliState.tier) : "free";
    return {
      tier,
      source: "cli-state",
      apiKeyMasked: maskApiKey(legacyCreds.apiKey),
      email: legacyCreds.email,
    };
  }

  // 6. Default
  return { tier: "free", source: "default" };
}

// ============================================================================
// FEATURE GATING (unified across all surfaces)
// ============================================================================

export interface FeatureGateResult {
  allowed: boolean;
  tier: ProductTier;
  reason?: string;
  requiredTier?: ProductTier;
  upgradeUrl: string;
}

const UPGRADE_URL = "https://guardrailai.dev/pricing";

/**
 * Check if a feature is available for the given tier.
 * Works identically in CLI, MCP, VS Code, and web dashboard.
 */
export function checkFeatureForTier(tier: ProductTier, feature: Feature): FeatureGateResult {
  if (tierHasFeature(tier, feature)) {
    return { allowed: true, tier, upgradeUrl: UPGRADE_URL };
  }

  const requiredTier = getMinimumTierForFeature(feature) as ProductTier | null;
  const requiredConfig = requiredTier ? TIER_CONFIG[requiredTier] : null;

  return {
    allowed: false,
    tier,
    reason: `'${feature}' requires ${requiredConfig?.name ?? "a higher"} plan (${requiredTier ?? "higher"})`,
    requiredTier: requiredTier ?? undefined,
    upgradeUrl: UPGRADE_URL,
  };
}

// ============================================================================
// FINDING REDACTION (unified across all surfaces)
// ============================================================================

/** Free tier: hide full findings, show severity counts only. */
export function shouldRedactFindings(tier: ProductTier): boolean {
  return tier === "free";
}

/** Standard upgrade hint shown across all surfaces. */
export const UPGRADE_HINT =
  "Upgrade to a paid plan for full finding details (paths, rules, evidence). https://guardrailai.dev/billing";

/**
 * Redact findings from any scan-like result object.
 * Returns summary counts but clears individual finding details.
 */
export function redactFindingsForFreeTier<T extends Record<string, unknown>>(result: T): T & {
  issueDetailsRedacted: true;
  upgradeHint: string;
} {
  const output = { ...result } as Record<string, unknown>;

  // Clear common finding arrays
  if (Array.isArray(output["findings"])) {
    output["findingCount"] = (output["findings"] as unknown[]).length;
    output["findings"] = [];
  }
  if (Array.isArray(output["topBlockers"])) {
    output["topBlockers"] = [];
  }
  if (Array.isArray(output["hotspots"])) {
    output["hotspots"] = [];
  }
  if (Array.isArray(output["issues"])) {
    output["issueCount"] = (output["issues"] as unknown[]).length;
    output["issues"] = [];
  }

  // Filter next-actions that reference finding IDs
  if (Array.isArray(output["nextActions"])) {
    output["nextActions"] = (output["nextActions"] as string[]).filter(
      (a: string) => typeof a === "string" && !a.includes("finding-id") && !a.includes("explain <finding"),
    );
  }

  output["truthPackContext"] = undefined;

  return {
    ...output,
    issueDetailsRedacted: true,
    upgradeHint: UPGRADE_HINT,
  } as T & { issueDetailsRedacted: true; upgradeHint: string };
}

// ============================================================================
// TIER COMPARISON HELPERS
// ============================================================================

/** Check if the current tier meets the minimum required tier. */
export function tierMeetsMinimum(current: ProductTier, required: ProductTier): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}

/** Get tier display info for UI across all surfaces. */
export function getTierDisplayInfo(tier: ProductTier): {
  label: string;
  badge: string;
  color: string;
} {
  switch (tier) {
    case "compliance":
      return { label: "Compliance", badge: "COMPLIANCE", color: "#a855f7" };
    case "pro":
      return { label: "Pro", badge: "PRO", color: "#3b82f6" };
    case "starter":
      return { label: "Starter", badge: "STARTER", color: "#22c55e" };
    default:
      return { label: "Free", badge: "FREE", color: "#6b7280" };
  }
}

/**
 * MCP-compatible tier feature map derived from canonical TIER_CONFIG.
 * Use this instead of hardcoded feature lists in MCP server.
 */
export function getTierFeaturesMap(): Record<ProductTier, { name: string; features: Feature[]; limits: Record<string, number> }> {
  return {
    free: {
      name: TIER_CONFIG.free.name,
      features: [...TIER_CONFIG.free.features],
      limits: {
        scans: TIER_CONFIG.free.limits.scansPerMonth,
        projects: TIER_CONFIG.free.limits.projects,
      },
    },
    starter: {
      name: TIER_CONFIG.starter.name,
      features: [...TIER_CONFIG.starter.features],
      limits: {
        scans: TIER_CONFIG.starter.limits.scansPerMonth,
        projects: TIER_CONFIG.starter.limits.projects,
      },
    },
    pro: {
      name: TIER_CONFIG.pro.name,
      features: [...TIER_CONFIG.pro.features],
      limits: {
        scans: TIER_CONFIG.pro.limits.scansPerMonth,
        projects: TIER_CONFIG.pro.limits.projects,
      },
    },
    compliance: {
      name: TIER_CONFIG.compliance.name,
      features: [...TIER_CONFIG.compliance.features],
      limits: {
        scans: TIER_CONFIG.compliance.limits.scansPerMonth,
        projects: TIER_CONFIG.compliance.limits.projects,
      },
    },
  };
}
