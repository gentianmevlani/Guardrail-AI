/**
 * Loose shapes for webview / command-palette payloads (API responses vary by tier).
 */

/**
 * Reality quick-pick / webview row — intentionally loose so it accepts `Finding` from diagnostics.
 */
export type RealityCheckFindingItem = {
  type?: string;
  category?: string;
  intent?: string;
  reality?: string;
  code?: string;
  explanation?: string;
  confidence?: number;
  id?: string;
} & Record<string, unknown>;

export interface ProductionAuditPanelResult {
  integrity?: { score?: number; grade?: string; canShip?: boolean };
  counts?: Record<string, Record<string, number> | undefined>;
  [key: string]: unknown;
}

export interface AIVerificationPanelResult {
  inferredIntent?: string;
  actualBehavior?: string;
  gaps?: string[];
  suggestions?: string[];
  [key: string]: unknown;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
