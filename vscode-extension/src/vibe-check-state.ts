/**
 * Last Vibe Check snapshot for sidebar / dashboard (CLI JSON, parsed in extension).
 * Persisted in {@link vscode.ExtensionContext.workspaceState} so the sidebar survives reloads.
 */

import * as vscode from "vscode";

const STORAGE_KEY = "guardrail.vibeCheckSnapshot";

export interface VibeCheckSnapshot {
  /** `null` when the CLI did not return a numeric score. */
  score: number | null;
  canShip: boolean;
  missingCritical: number;
  missingEssential: number;
  missingImportant: number;
  topGaps: string[];
  estimatedTimeToShip: string;
  updatedAt: string;
}

let last: VibeCheckSnapshot | null = null;
let workspaceState: vscode.Memento | null = null;

export function registerVibeCheckMemento(memento: vscode.Memento): void {
  workspaceState = memento;
  const raw = memento.get<string | undefined>(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as VibeCheckSnapshot;
      if (
        (parsed.score === null || typeof parsed.score === "number") &&
        typeof parsed.updatedAt === "string" &&
        Array.isArray(parsed.topGaps)
      ) {
        last = parsed;
      }
    } catch {
      /* ignore corrupt storage */
    }
  }
}

export function setLastVibeCheckFromJson(data: Record<string, unknown>): void {
  const mc = data.missingCritical;
  const me = data.missingEssential;
  const mi = data.missingImportant;
  const crit = Array.isArray(mc) ? mc.length : 0;
  const ess = Array.isArray(me) ? me.length : 0;
  const imp = Array.isArray(mi) ? mi.length : 0;

  const top: string[] = [];
  const pushNames = (arr: unknown, n: number) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (top.length >= n) break;
      if (item && typeof item === "object" && "feature" in item) {
        const f = (item as { feature?: string }).feature;
        if (typeof f === "string" && f.length) top.push(f);
      }
    }
  };
  pushNames(mc, 3);
  pushNames(me, 3 - top.length);

  last = {
    score: typeof data.score === "number" ? Math.round(data.score) : null,
    canShip: data.canShip === true,
    missingCritical: crit,
    missingEssential: ess,
    missingImportant: imp,
    topGaps: top,
    estimatedTimeToShip:
      typeof data.estimatedTimeToShip === "string"
        ? data.estimatedTimeToShip
        : "—",
    updatedAt: new Date().toISOString(),
  };

  if (workspaceState) {
    void workspaceState.update(STORAGE_KEY, JSON.stringify(last));
  }
}

export function getLastVibeCheckSnapshot(): VibeCheckSnapshot | null {
  return last;
}

export function clearLastVibeCheckSnapshot(): void {
  last = null;
  if (workspaceState) {
    void workspaceState.update(STORAGE_KEY, undefined);
  }
}
