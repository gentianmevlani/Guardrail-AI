/**
 * ~/.procedural-memory persistence: merged decision graphs + per-project strategy indices.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { DecisionGraph, StrategyIndex } from '../types/decision-graph';

export function projectStorageKey(projectPath: string): string {
  const normalized = projectPath.trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export function graphsPath(dataDir: string): string {
  return join(dataDir, 'decision-graphs.json');
}

export function legacyIndexPath(dataDir: string): string {
  return join(dataDir, 'strategy-index.json');
}

export function projectIndexPath(dataDir: string, projectPath: string): string {
  return join(dataDir, 'indices', `${projectStorageKey(projectPath)}.json`);
}

export function loadGraphs(dataDir: string): DecisionGraph[] {
  const p = graphsPath(dataDir);
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as DecisionGraph[];
  } catch {
    return [];
  }
}

export function saveGraphs(dataDir: string, graphs: DecisionGraph[]): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(graphsPath(dataDir), JSON.stringify(graphs, null, 2));
}

export function upsertGraph(graphs: DecisionGraph[], next: DecisionGraph): DecisionGraph[] {
  const idx = graphs.findIndex((g) => g.sessionId === next.sessionId);
  if (idx >= 0) {
    const copy = [...graphs];
    copy[idx] = next;
    return copy;
  }
  return [...graphs, next];
}

export function loadStrategyIndex(dataDir: string, projectPath?: string): StrategyIndex | null {
  if (projectPath) {
    const pp = projectIndexPath(dataDir, projectPath);
    if (existsSync(pp)) {
      try {
        return JSON.parse(readFileSync(pp, 'utf-8')) as StrategyIndex;
      } catch {
        return null;
      }
    }
    return null;
  }
  const leg = legacyIndexPath(dataDir);
  if (!existsSync(leg)) return null;
  try {
    return JSON.parse(readFileSync(leg, 'utf-8')) as StrategyIndex;
  } catch {
    return null;
  }
}

export function saveStrategyIndex(dataDir: string, index: StrategyIndex, projectPath?: string): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (projectPath) {
    const dir = join(dataDir, 'indices');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(projectIndexPath(dataDir, projectPath), JSON.stringify(index, null, 2));
    return;
  }
  writeFileSync(legacyIndexPath(dataDir), JSON.stringify(index, null, 2));
}

/** Normalize for comparing graph.project to CLI --project */
export function pathsLikelySame(a: string, b: string): boolean {
  try {
    return resolve(a) === resolve(b);
  } catch {
    return a === b;
  }
}

export function filterGraphsByProject(graphs: DecisionGraph[], projectPath: string): DecisionGraph[] {
  return graphs.filter((g) => pathsLikelySame(g.project, projectPath));
}
