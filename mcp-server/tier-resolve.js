/**
 * Effective tier for MCP — uses `@guardrail/core` unified auth resolver.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { resolveAuthLocal, normalizeTier, readCliState } = require("@guardrail/core");

/** @returns {string | null} raw tier string from CLI state.json if present */
export function readCliStateTier() {
  const st = readCliState();
  if (st?.tier && typeof st.tier === "string") {
    return st.tier.toLowerCase();
  }
  return null;
}

export { normalizeTier };

/** Effective product tier: env override → unified local resolver */
export function getEffectiveTier() {
  const envTier = process.env.GUARDRAIL_TIER;
  if (envTier) {
    return normalizeTier(envTier);
  }
  return resolveAuthLocal().tier;
}
