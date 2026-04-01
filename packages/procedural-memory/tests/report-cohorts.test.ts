import { describe, it, expect } from 'vitest';
import { partitionCohorts } from '../src/lib/report-cohorts';
import type { DecisionGraph, SessionMetrics } from '../src/types/decision-graph';

const emptyMetrics: SessionMetrics = {
  totalToolCalls: 0,
  toolsUsed: [],
  backtrackCount: 0,
  userCorrectionCount: 0,
  userPromptCount: 0,
  durationSeconds: 0,
  filesModifiedAsResolution: [],
  filesInvestigatedNotResolution: [],
  toolCallsToResolution: 0,
  apparentSuccess: true,
  tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
};

function g(sessionId: string, start: string, end: string): DecisionGraph {
  return {
    sessionId,
    project: '/Users/demo/app',
    gitBranch: 'main',
    startTime: start,
    endTime: end,
    nodes: [],
    edges: [],
    metrics: { ...emptyMetrics },
  };
}

describe('partitionCohorts', () => {
  it('splits by chronological count', () => {
    const graphs = [
      g('a', '2026-01-01T10:00:00Z', '2026-01-01T10:30:00Z'),
      g('b', '2026-01-02T10:00:00Z', '2026-01-02T10:30:00Z'),
      g('c', '2026-01-03T10:00:00Z', '2026-01-03T10:30:00Z'),
    ];
    const { baseline, enhanced, cohortNote } = partitionCohorts(graphs, { baselineCount: 1 });
    expect(baseline.map((x) => x.sessionId)).toEqual(['a']);
    expect(enhanced?.map((x) => x.sessionId)).toEqual(['b', 'c']);
    expect(cohortNote).toContain('first 1');
  });

  it('splits by --split-date semantics', () => {
    const graphs = [
      g('old', '2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z'),
      g('new', '2026-02-15T10:00:00Z', '2026-02-15T12:00:00Z'),
    ];
    const { baseline, enhanced } = partitionCohorts(graphs, {
      splitDate: '2026-02-01T00:00:00Z',
      baselineCount: 20,
    });
    expect(baseline.map((x) => x.sessionId)).toEqual(['old']);
    expect(enhanced?.map((x) => x.sessionId)).toEqual(['new']);
  });

  it('throws on invalid date', () => {
    expect(() =>
      partitionCohorts([], { splitDate: 'not-a-date', baselineCount: 5 })
    ).toThrow(/Invalid --split-date/);
  });
});
