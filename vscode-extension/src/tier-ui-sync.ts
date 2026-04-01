/**
 * After tier resolution, refresh all surfaces that show plan / connection (sidebar, dashboard).
 */

import type { ExtensionContext } from "vscode";
import { GuardrailDashboardPanel } from "./features/guardrail-dashboard-panel";
import { GuardrailSidebarViewProvider } from "./features/guardrail-sidebar-view";
import type { ScoreBadge } from "./score-badge";
import { refreshTierUi } from "./tier-ui-cache";

export { getCachedTierId, getTierDisplayCached, refreshTierUi } from "./tier-ui-cache";

export async function refreshTierAndViews(
  context: ExtensionContext,
  scoreBadge: ScoreBadge | undefined,
): Promise<void> {
  await refreshTierUi(context, scoreBadge);
  GuardrailSidebarViewProvider.refreshIfOpen();
  GuardrailDashboardPanel.refreshIfOpen();
}
