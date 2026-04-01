/**
 * Free-tier finding redaction for MCP tool payloads (uses @guardrail/core).
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { shouldRedactFindings, redactFindingsForFreeTier } = require("@guardrail/core");

/**
 * If tier is free, redact finding-level details in structured results.
 * @param {unknown} result - Tool handler result (object or MCP content shape)
 * @param {string} tier
 * @returns {unknown}
 */
export function applyFreeTierRedaction(result, tier) {
  if (!shouldRedactFindings(tier)) {
    return result;
  }

  if (result && typeof result === "object" && result.isError) {
    return result;
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    return redactFindingsForFreeTier(
      /** @type {Record<string, unknown>} */ (result),
    );
  }

  return result;
}

/**
 * Parse JSON text content, redact if free tier, re-stringify.
 * @param {string} text
 * @param {string} tier
 * @returns {string}
 */
export function redactJsonTextIfNeeded(text, tier) {
  if (!shouldRedactFindings(tier)) {
    return text;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const out = redactFindingsForFreeTier(/** @type {Record<string, unknown>} */ (parsed));
      return JSON.stringify(out, null, 2);
    }
  } catch {
    /* not JSON */
  }
  return text;
}
