/**
 * Truth Pack → Reality Sniff scoring bridge.
 * Reads `.guardrail-context` (same output as guardrail-context / TruthPackGenerator).
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve, relative, sep } from 'path';
import { TRUTH_PACK_DIR } from '../truth-pack';

export interface TruthPackScoringIndex {
  importanceNorm: Map<string, number>;
  routeCountByFile: Map<string, number>;
  symbolCountByFile: Map<string, number>;
}

/** Normalize paths to posix-style keys to match Truth Pack `file` fields. */
export function normalizeRepoPath(projectRoot: string, absolutePath: string): string {
  const rel = relative(resolve(projectRoot), resolve(absolutePath));
  return rel.split(sep).join('/');
}

function posixKey(pathKey: string): string {
  return pathKey.split(/[/\\]/).join('/');
}

/**
 * Loads symbol/route/importance indices when `.guardrail-context/truthpack.json` exists.
 */
export function loadTruthPackScoringIndex(projectPath: string): TruthPackScoringIndex | null {
  const root = resolve(projectPath);
  const ctxDir = join(root, TRUTH_PACK_DIR);
  const marker = join(ctxDir, 'truthpack.json');
  if (!existsSync(marker)) {
    return null;
  }

  const importanceNorm = new Map<string, number>();
  const routeCountByFile = new Map<string, number>();
  const symbolCountByFile = new Map<string, number>();

  try {
    const impPath = join(ctxDir, 'importance.json');
    if (existsSync(impPath)) {
      const raw = JSON.parse(readFileSync(impPath, 'utf-8')) as Record<string, number>;
      const vals = Object.values(raw);
      const max = Math.max(...vals, 1e-9);
      for (const [file, v] of Object.entries(raw)) {
        importanceNorm.set(posixKey(file), v / max);
      }
    }
  } catch {
    // ignore malformed
  }

  try {
    const symPath = join(ctxDir, 'symbols.json');
    if (existsSync(symPath)) {
      const symbols = JSON.parse(readFileSync(symPath, 'utf-8')) as Array<{ file?: string }>;
      if (Array.isArray(symbols)) {
        for (const s of symbols) {
          if (typeof s.file !== 'string') continue;
          const k = posixKey(s.file);
          symbolCountByFile.set(k, (symbolCountByFile.get(k) ?? 0) + 1);
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    const routesPath = join(ctxDir, 'routes.json');
    if (existsSync(routesPath)) {
      const routes = JSON.parse(readFileSync(routesPath, 'utf-8')) as Array<{ file?: string }>;
      if (Array.isArray(routes)) {
        for (const r of routes) {
          if (typeof r.file !== 'string') continue;
          const k = posixKey(r.file);
          routeCountByFile.set(k, (routeCountByFile.get(k) ?? 0) + 1);
        }
      }
    }
  } catch {
    // ignore
  }

  if (
    importanceNorm.size === 0 &&
    routeCountByFile.size === 0 &&
    symbolCountByFile.size === 0
  ) {
    return null;
  }

  return { importanceNorm, routeCountByFile, symbolCountByFile };
}
