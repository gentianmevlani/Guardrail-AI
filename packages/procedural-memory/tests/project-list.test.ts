import { describe, it, expect } from 'vitest';
import { projectSessionCounts } from '../src/lib/project-list';
import type { DecisionGraph, SessionMetrics } from '../src/types/decision-graph';

const m: SessionMetrics = {
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

function g(project: string, id: string): DecisionGraph {
  return {
    sessionId: id,
    project,
    gitBranch: 'main',
    startTime: '2026-01-01T10:00:00Z',
    endTime: '2026-01-01T11:00:00Z',
    nodes: [],
    edges: [],
    metrics: { ...m },
  };
}

describe('projectSessionCounts', () => {
  it('aggregates and sorts by session count', () => {
    const graphs = [
      g('/Users/a/b', '1'),
      g('/Users/a/b', '2'),
      g('/Users/x', '3'),
    ];
    expect(projectSessionCounts(graphs)).toEqual([
      { project: '/Users/a/b', sessions: 2 },
      { project: '/Users/x', sessions: 1 },
    ]);
  });
});
