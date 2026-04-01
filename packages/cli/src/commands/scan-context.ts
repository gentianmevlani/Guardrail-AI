/**
 * Optional Truth Pack (context engine) step for `guardrail scan`.
 * Keeps repo-grounded facts in sync before or alongside Reality Sniff.
 *
 * For Truth Pack → score weighting, see `../scan/truth-pack-scoring.ts`.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface TruthPackScanContext {
  enabled: boolean;
  truthPackGeneratedThisRun: boolean;
  truthPackSkippedFresh: boolean;
  symbolCount: number;
  routeCount: number;
  dependencyCount: number;
  error?: string;
}

function readJsonArrayLength(dir: string, file: string): number {
  const p = join(dir, file);
  if (!existsSync(p)) {
    return 0;
  }
  try {
    const data: unknown = JSON.parse(readFileSync(p, 'utf-8'));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Ensures `.guardrail-context` is populated for downstream AI guardrails / MCP.
 * Regenerates when missing, stale (>24h), or when forceRefresh is true.
 */
export async function ensureTruthPackForScan(
  projectPath: string,
  options: { forceRefresh: boolean }
): Promise<TruthPackScanContext> {
  const base: TruthPackScanContext = {
    enabled: true,
    truthPackGeneratedThisRun: false,
    truthPackSkippedFresh: false,
    symbolCount: 0,
    routeCount: 0,
    dependencyCount: 0,
  };

  try {
    const { TruthPackGenerator } = await import('../truth-pack');
    const gen = new TruthPackGenerator(projectPath);
    const ctxDir = gen.getPath();
    const truthPackFile = join(ctxDir, 'truthpack.json');

    if (options.forceRefresh || !existsSync(truthPackFile) || !gen.isFresh(24)) {
      await gen.generate();
      base.truthPackGeneratedThisRun = true;
    } else {
      base.truthPackSkippedFresh = true;
    }

    base.symbolCount = readJsonArrayLength(ctxDir, 'symbols.json');
    base.routeCount = readJsonArrayLength(ctxDir, 'routes.json');
    base.dependencyCount = readJsonArrayLength(ctxDir, 'deps.json');

    return base;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      error: message,
    };
  }
}
