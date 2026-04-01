/**
 * Cached tier label for synchronous UI (sidebar HTML, status bar suffix).
 * Use {@link refreshTierAndViews} from `tier-ui-sync.ts` to also refresh dashboard + sidebar.
 */

import type { ExtensionContext } from "vscode";
import {
  formatTierDisplayForExtension,
  resolveExtensionTierDetails,
  type ProductTierId,
} from "./tier-context";
import type { ScoreBadge } from "./score-badge";

let cachedDisplayLabel = "Free";
let cachedTierId: ProductTierId = "free";

export function getTierDisplayCached(): string {
  return cachedDisplayLabel;
}

export function getCachedTierId(): ProductTierId {
  return cachedTierId;
}

/**
 * Re-resolve tier (API → secrets → CLI state) and update cache + score badge.
 */
export async function refreshTierUi(
  context: ExtensionContext,
  scoreBadge: ScoreBadge | undefined,
): Promise<void> {
  const d = await resolveExtensionTierDetails(context);
  cachedTierId = d.tier;
  cachedDisplayLabel = formatTierDisplayForExtension(d.tier, d.rawPlan);
  scoreBadge?.setTierLabel(cachedDisplayLabel);
}
