/**
 * Unified tier resolution for the VS Code extension — delegates normalization
 * and issue-detail rules to `@guardrail/core` (same as MCP and web dashboard).
 */

import * as vscode from "vscode";
import {
  normalizeTier,
  type ProductTier,
  UPGRADE_HINT,
} from "@guardrail/core/unified-auth";
import {
  formatPlanSlugForDisplay,
  tierShowsFullIssueDetails,
} from "@guardrail/core/tier-config";
import { ApiClient } from "./services/api-client";
import { readCliGuardrailState } from "./services/cli-credentials-sync";
import { getGuardrailWebUrl } from "./guardrail-web-urls";

/** Matches `@guardrail/core` free-tier finding copy; uses local web base URL. */
export const FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT = `Upgrade to a paid plan for full finding details (paths, rules, evidence). ${getGuardrailWebUrl("/billing")}`;

/** Canonical tier ids — alias for core `ProductTier`. */
export type ProductTierId = ProductTier;

export function normalizePlanTier(raw: string | undefined | null): ProductTierId {
  return normalizeTier(raw ?? "free");
}

/** Same rule as web dashboard `hideIssueDetailsForTier`: Free shows counts only. */
export function shouldHideIssueDetailsForTier(tier: string): boolean {
  return !tierShowsFullIssueDetails(tier);
}

export function extractPlanFromProfileResponse(res: unknown): string | undefined {
  if (!res || typeof res !== "object") {
    return undefined;
  }
  const r = res as Record<string, unknown>;
  const data = (r.data as Record<string, unknown> | undefined) ?? r;
  const user = (data.user as Record<string, unknown> | undefined) ?? data;
  const sub =
    (user.subscription as { plan?: string } | undefined) ??
    (data.subscription as { plan?: string } | undefined);
  if (sub?.plan && typeof sub.plan === "string") {
    return sub.plan;
  }
  if (typeof data.tier === "string") {
    return data.tier;
  }
  return undefined;
}

/** Resolved tier plus optional raw plan slug for enterprise-accurate labels. */
export interface ExtensionTierResolution {
  tier: ProductTierId;
  rawPlan?: string;
}

/**
 * Resolve tier and raw plan slug (same source order as {@link resolveExtensionTier}).
 */
export async function resolveExtensionTierDetails(
  context: vscode.ExtensionContext,
): Promise<ExtensionTierResolution> {
  const client = new ApiClient(context);
  await client.ensureAuthLoaded();

  if (client.isAuthenticated()) {
    try {
      const res = await client.getUserProfile();
      const plan = extractPlanFromProfileResponse(res);
      if (plan) {
        return { tier: normalizePlanTier(plan), rawPlan: plan };
      }
    } catch {
      /* fall through */
    }
  }

  const cached = await context.secrets.get("guardrail.userInfo");
  if (cached) {
    try {
      const j = JSON.parse(cached) as { plan?: string };
      if (j.plan) {
        return { tier: normalizePlanTier(j.plan), rawPlan: j.plan };
      }
    } catch {
      /* ignore */
    }
  }

  const cli = await readCliGuardrailState();
  if (cli?.tier) {
    return { tier: normalizePlanTier(cli.tier), rawPlan: cli.tier };
  }

  return { tier: "free" };
}

/**
 * Resolve effective product tier for gating UI (findings list, scan redaction).
 * Uses API when authenticated, else device-login cache, else CLI on-disk state.
 */
export async function resolveExtensionTier(
  context: vscode.ExtensionContext,
): Promise<ProductTierId> {
  const d = await resolveExtensionTierDetails(context);
  return d.tier;
}

/**
 * Sidebar / status bar label: uses raw plan when present so Enterprise contracts
 * are not mislabeled as "Compliance".
 */
export function formatTierDisplayForExtension(
  tier: ProductTierId,
  rawPlan?: string | null,
): string {
  if (rawPlan) {
    return formatPlanSlugForDisplay(rawPlan);
  }
  return formatTierLabel(tier);
}

export function formatTierLabel(tier: ProductTierId): string {
  switch (tier) {
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "compliance":
      return "Compliance";
    default:
      return "Free";
  }
}

export { UPGRADE_HINT };
