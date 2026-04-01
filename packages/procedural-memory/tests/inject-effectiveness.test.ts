import { describe, it, expect } from 'vitest';
import { estimateStrategyEffectiveness, strategyWouldFire } from '../src/injector/inject';
import type { DecisionGraph, SessionMetrics, Strategy } from '../src/types/decision-graph';

const metrics = (over: Partial<SessionMetrics>): SessionMetrics => ({
  totalToolCalls: 10,
  toolsUsed: [],
  backtrackCount: 0,
  userCorrectionCount: 0,
  userPromptCount: 1,
  durationSeconds: 60,
  filesModifiedAsResolution: ['src/auth/middleware.ts'],
  filesInvestigatedNotResolution: [],
  toolCallsToResolution: 10,
  apparentSuccess: true,
  tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  ...over,
});

function graph(id: string, m: Partial<SessionMetrics>, files: string[]): DecisionGraph {
  return {
    sessionId: id,
    project: '/p',
    gitBranch: 'main',
    startTime: '2026-01-01T10:00:00Z',
    endTime: '2026-01-01T11:00:00Z',
    nodes: [
      {
        id: 'n1',
        type: 'action',
        timestamp: '2026-01-01T10:05:00Z',
        reasoning: '',
        filesTouched: files,
        sourceUuids: [],
      },
    ],
    edges: [],
    metrics: metrics(m),
  };
}

const strategy: Strategy = {
  id: 'st_1',
  triggerPattern: {
    filePatterns: ['auth/middleware'],
    errorPatterns: [],
    moduleAreas: [],
    promptKeywords: [],
  },
  content: 'Check middleware ordering first.',
  scope: 'project',
  confidence: 0.8,
  supportingEvidence: [],
  createdAt: '2026-01-01T00:00:00Z',
  lastValidated: '2026-01-01T00:00:00Z',
  decayRatePerDay: 0,
  injectionCount: 0,
  successCount: 0,
  tags: [],
};

describe('strategyWouldFire', () => {
  it('matches file path substring', () => {
    const g1 = graph('1', {}, ['src/auth/middleware.ts']);
    expect(strategyWouldFire(strategy, g1)).toBe(true);
  });
});

describe('estimateStrategyEffectiveness', () => {
  it('returns rows with counts for enhanced sessions', () => {
    const baseline = [graph('b1', { totalToolCalls: 30 }, ['other/file.ts'])];
    const enhanced = [
      graph('e1', { totalToolCalls: 8, apparentSuccess: true }, ['src/auth/middleware.ts']),
    ];
    const rows = estimateStrategyEffectiveness([strategy], baseline, enhanced);
    expect(rows).toHaveLength(1);
    expect(rows[0].timesInjected).toBe(1);
    expect(rows[0].timesRelevant).toBeGreaterThanOrEqual(1);
  });
});
