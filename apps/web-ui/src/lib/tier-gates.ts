/**
 * Product tier gates (aligned with @guardrail/core tier-config: free, starter, pro, compliance).
 */

export type PaidTier = "starter" | "pro" | "compliance";

/** Free: severity counts only; findings list blurred. */
export function hideIssueDetailsForTier(tier: string): boolean {
  return tier === "free";
}

/** Pro & Compliance: auto-fix enabled. Starter sees full findings but no auto-fix. */
export function tierSupportsAutoFix(tier: string): boolean {
  return tier === "pro" || tier === "compliance";
}
