import { describe, it, expect } from 'vitest';
import { mergeDeepExtractionIntoIndex } from '../src/extractor/extract';
import type { StrategyIndex, Strategy, AntiPattern } from '../src/types/decision-graph';

const strat = (id: string, areas: string[], files: string[]): Strategy => ({
  id,
  triggerPattern: {
    filePatterns: files,
    errorPatterns: [],
    moduleAreas: areas,
    promptKeywords: [],
  },
  content: 'do x',
  scope: 'project',
  confidence: 0.5,
  supportingEvidence: [],
  createdAt: '2026-01-01T00:00:00Z',
  lastValidated: '2026-01-01T00:00:00Z',
  decayRatePerDay: 0,
  injectionCount: 0,
  successCount: 0,
  tags: [],
});

const emptyIndex = (): StrategyIndex => ({
  project: '/p',
  lastConsolidated: '2026-01-01T00:00:00Z',
  sessionsAnalyzed: 1,
  strategies: [strat('h1', ['src/a'], ['x.ts'])],
  antiPatterns: [],
  optimalPaths: [],
  schemaVersion: 1,
});

describe('mergeDeepExtractionIntoIndex', () => {
  it('adds new LLM strategies when triggers do not overlap', () => {
    const base = emptyIndex();
    const deep = {
      strategies: [strat('d1', ['src/b'], ['y.ts'])],
      antiPatterns: [] as AntiPattern[],
    };
    const out = mergeDeepExtractionIntoIndex(base, deep);
    expect(out.strategies.map((s) => s.id).sort()).toEqual(['d1', 'h1']);
  });
});
