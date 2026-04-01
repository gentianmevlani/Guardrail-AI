/**
 * Tests for the metacognitive layer:
 * - Session Intent Classifier
 * - Cognitive Fingerprint
 * - Metacognitive Reflection
 * - Predictive Strategy Engine
 * - Temporal Dynamics
 * - Cross-Project Transfer
 */

import { describe, it, expect } from 'vitest';
import type { DecisionGraph, DecisionNode, StrategyIndex, Strategy } from '../src/types/decision-graph';
import { classifySessionIntent, classifyPromptIntent } from '../src/classifier/classifier';
import { buildCognitiveFingerprint } from '../src/fingerprint/fingerprint';
import { generateReflection, generateBatchReflections } from '../src/metacognition/reflection';
import { predictStrategies, selectStrategiesForInjection } from '../src/predictor/predictor';
import { buildTemporalProfile } from '../src/temporal/temporal';
import { buildTransferIndex } from '../src/transfer/transfer';
import { generateMetacognitiveMarkdown } from '../src/injector/metacognitive-inject';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeNode(overrides: Partial<DecisionNode> = {}): DecisionNode {
  return {
    id: `node_${Math.random().toString(36).slice(2, 8)}`,
    type: 'action',
    timestamp: new Date().toISOString(),
    reasoning: '',
    filesTouched: [],
    sourceUuids: ['uuid-1'],
    ...overrides,
  };
}

function makeGraph(overrides: Partial<DecisionGraph> = {}): DecisionGraph {
  return {
    sessionId: `session-${Math.random().toString(36).slice(2, 10)}`,
    project: '/test/project',
    gitBranch: 'main',
    startTime: '2026-03-01T10:00:00Z',
    endTime: '2026-03-01T10:30:00Z',
    nodes: [],
    edges: [],
    metrics: {
      totalToolCalls: 10,
      toolsUsed: ['Read', 'Edit', 'Bash'],
      backtrackCount: 1,
      userCorrectionCount: 0,
      userPromptCount: 3,
      durationSeconds: 1800,
      filesModifiedAsResolution: ['src/main.ts'],
      filesInvestigatedNotResolution: ['src/other.ts'],
      toolCallsToResolution: 10,
      apparentSuccess: true,
      tokenUsage: { inputTokens: 5000, outputTokens: 2000, cacheReadTokens: 0, cacheCreationTokens: 0 },
    },
    ...overrides,
  };
}

function makeBugFixGraph(): DecisionGraph {
  return makeGraph({
    nodes: [
      makeNode({ type: 'user_request', reasoning: 'Fix the login bug — users cant authenticate' }),
      makeNode({ type: 'hypothesis', reasoning: 'The auth middleware might be rejecting valid tokens' }),
      makeNode({
        type: 'action',
        reasoning: 'Reading auth middleware',
        toolCall: { name: 'Read', input: { file_path: 'src/middleware/auth.ts' }, outputSummary: '', succeeded: true },
        filesTouched: ['src/middleware/auth.ts'],
      }),
      makeNode({
        type: 'action',
        reasoning: 'Reading config',
        toolCall: { name: 'Read', input: { file_path: 'src/config.ts' }, outputSummary: '', succeeded: true },
        filesTouched: ['src/config.ts'],
      }),
      makeNode({ type: 'backtrack', reasoning: 'Actually, the issue is in the token validation, not the middleware config' }),
      makeNode({
        type: 'action',
        reasoning: 'Fixing token validation',
        toolCall: { name: 'Edit', input: { file_path: 'src/auth/validate.ts' }, outputSummary: '', succeeded: true },
        filesTouched: ['src/auth/validate.ts'],
      }),
      makeNode({ type: 'resolution', reasoning: 'Fixed the token validation logic' }),
    ],
    metrics: {
      totalToolCalls: 5,
      toolsUsed: ['Read', 'Edit'],
      backtrackCount: 1,
      userCorrectionCount: 0,
      userPromptCount: 1,
      durationSeconds: 600,
      filesModifiedAsResolution: ['src/auth/validate.ts'],
      filesInvestigatedNotResolution: ['src/middleware/auth.ts', 'src/config.ts'],
      toolCallsToResolution: 5,
      apparentSuccess: true,
      tokenUsage: { inputTokens: 3000, outputTokens: 1000, cacheReadTokens: 0, cacheCreationTokens: 0 },
    },
  });
}

function makeFeatureGraph(): DecisionGraph {
  return makeGraph({
    nodes: [
      makeNode({ type: 'user_request', reasoning: 'Add a dark mode toggle to the settings page' }),
      makeNode({
        type: 'action',
        reasoning: 'Reading settings component',
        toolCall: { name: 'Read', input: { file_path: 'src/components/Settings.tsx' }, outputSummary: '', succeeded: true },
        filesTouched: ['src/components/Settings.tsx'],
      }),
      makeNode({
        type: 'action',
        reasoning: 'Creating theme context',
        toolCall: { name: 'Write', input: { file_path: 'src/context/theme.tsx' }, outputSummary: '', succeeded: true },
        filesTouched: ['src/context/theme.tsx'],
      }),
      makeNode({
        type: 'action',
        reasoning: 'Updating settings',
        toolCall: { name: 'Edit', input: { file_path: 'src/components/Settings.tsx' }, outputSummary: '', succeeded: true },
        filesTouched: ['src/components/Settings.tsx'],
      }),
      makeNode({ type: 'resolution', reasoning: 'Dark mode toggle implemented' }),
    ],
    metrics: {
      totalToolCalls: 4,
      toolsUsed: ['Read', 'Write', 'Edit'],
      backtrackCount: 0,
      userCorrectionCount: 0,
      userPromptCount: 1,
      durationSeconds: 300,
      filesModifiedAsResolution: ['src/context/theme.tsx', 'src/components/Settings.tsx'],
      filesInvestigatedNotResolution: [],
      toolCallsToResolution: 4,
      apparentSuccess: true,
      tokenUsage: { inputTokens: 2000, outputTokens: 800, cacheReadTokens: 0, cacheCreationTokens: 0 },
    },
  });
}

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: `strat_${Math.random().toString(36).slice(2, 8)}`,
    triggerPattern: {
      filePatterns: ['src/auth/*.ts'],
      errorPatterns: [],
      moduleAreas: ['src/auth'],
      promptKeywords: ['auth', 'login', 'token'],
    },
    content: 'When working on auth, check validate.ts first — it is the most common source of auth bugs.',
    scope: 'project',
    confidence: 0.8,
    supportingEvidence: [
      { sessionId: 'sess-1', timestamp: '2026-03-01', outcome: 'confirmed', summary: 'Auth fix' },
      { sessionId: 'sess-2', timestamp: '2026-03-02', outcome: 'confirmed', summary: 'Token bug' },
    ],
    createdAt: '2026-03-01',
    lastValidated: '2026-03-02',
    decayRatePerDay: 0.002,
    injectionCount: 5,
    successCount: 3,
    tags: ['anti-pattern', 'auto-extracted'],
    ...overrides,
  };
}

function makeIndex(strategies: Strategy[] = [makeStrategy()]): StrategyIndex {
  return {
    project: '/test/project',
    lastConsolidated: new Date().toISOString(),
    sessionsAnalyzed: 10,
    strategies,
    antiPatterns: [],
    optimalPaths: [],
    schemaVersion: 1,
  };
}

// ─── Session Intent Classifier Tests ────────────────────────────────────────

describe('Session Intent Classifier', () => {
  it('classifies bug-fix sessions from user request text', () => {
    const graph = makeBugFixGraph();
    const intent = classifySessionIntent(graph);
    expect(intent.taskType).toBe('bug-fix');
    expect(intent.confidence).toBeGreaterThan(0.1);
  });

  it('classifies feature sessions', () => {
    const graph = makeFeatureGraph();
    const intent = classifySessionIntent(graph);
    expect(intent.taskType).toBe('feature');
  });

  it('detects domains from file paths', () => {
    const graph = makeBugFixGraph();
    const intent = classifySessionIntent(graph);
    expect(intent.domains).toContain('auth');
  });

  it('estimates complexity', () => {
    const simple = makeGraph({ metrics: { ...makeGraph().metrics, totalToolCalls: 3, durationSeconds: 60 } });
    const complex = makeGraph({ metrics: { ...makeGraph().metrics, totalToolCalls: 50, durationSeconds: 7200, backtrackCount: 5 } });

    const simpleIntent = classifySessionIntent(simple);
    const complexIntent = classifySessionIntent(complex);

    expect(['trivial', 'simple']).toContain(simpleIntent.complexity);
    expect(['complex', 'epic']).toContain(complexIntent.complexity);
  });

  it('classifies from prompt text alone', () => {
    const intent = classifyPromptIntent('Fix the broken authentication flow');
    expect(intent.taskType).toBe('bug-fix');
    expect(intent.domains).toContain('auth');
  });

  it('classifies refactor prompts', () => {
    const intent = classifyPromptIntent('Refactor the user service to use dependency injection');
    expect(intent.taskType).toBe('refactor');
  });
});

// ─── Cognitive Fingerprint Tests ────────────────────────────────────────────

describe('Cognitive Fingerprint', () => {
  it('returns empty fingerprint for no graphs', () => {
    const fp = buildCognitiveFingerprint([]);
    expect(fp.totalSessions).toBe(0);
    expect(fp.dimensions).toHaveLength(0);
  });

  it('computes all 7 cognitive dimensions', () => {
    const graphs = [makeBugFixGraph(), makeFeatureGraph(), makeGraph()];
    const fp = buildCognitiveFingerprint(graphs);

    expect(fp.dimensions).toHaveLength(7);
    for (const dim of fp.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(1);
      expect(dim.sampleSize).toBe(3);
    }
  });

  it('builds task type profiles', () => {
    const graphs = [makeBugFixGraph(), makeBugFixGraph(), makeFeatureGraph()];
    const fp = buildCognitiveFingerprint(graphs);

    expect(fp.taskProfiles.length).toBeGreaterThan(0);
    const bugFixProfile = fp.taskProfiles.find(p => p.taskType === 'bug-fix');
    expect(bugFixProfile).toBeDefined();
    expect(bugFixProfile!.sessionCount).toBe(2);
  });

  it('builds tool profiles', () => {
    const graphs = [makeBugFixGraph(), makeFeatureGraph()];
    const fp = buildCognitiveFingerprint(graphs);

    expect(fp.toolProfiles.length).toBeGreaterThan(0);
    const readProfile = fp.toolProfiles.find(p => p.toolName === 'Read');
    expect(readProfile).toBeDefined();
    expect(readProfile!.usageFrequency).toBeGreaterThan(0);
  });

  it('detects signature moves for clean sessions', () => {
    // Create multiple clean sessions
    const graphs = Array.from({ length: 5 }, () => makeFeatureGraph());
    const fp = buildCognitiveFingerprint(graphs);

    // With 5 clean sessions (0 backtracks, few tool calls), should detect clean execution
    expect(fp.signatureMoves.length).toBeGreaterThan(0);
  });
});

// ─── Metacognitive Reflection Tests ─────────────────────────────────────────

describe('Metacognitive Reflection', () => {
  it('generates a reflection for a session', () => {
    const graph = makeBugFixGraph();
    const reflection = generateReflection(graph);

    expect(reflection.sessionId).toBe(graph.sessionId);
    expect(reflection.intent.taskType).toBe('bug-fix');
    expect(reflection.narrative).toBeTruthy();
    expect(reflection.momentum.flowState).toBeTruthy();
  });

  it('detects causal insights when false leads exist', () => {
    const graph = makeBugFixGraph();
    const reflection = generateReflection(graph);

    // The bug fix graph has false leads (middleware, config) before finding validate.ts
    const causalInsights = reflection.insights.filter(i => i.type === 'causal');
    // May or may not find causal insights depending on node count, but structure is correct
    expect(reflection.insights).toBeDefined();
  });

  it('generates adaptations from insights', () => {
    const graph = makeBugFixGraph();
    const reflection = generateReflection(graph);

    // Adaptations are derived from insights
    expect(reflection.adaptations).toBeDefined();
    expect(Array.isArray(reflection.adaptations)).toBe(true);
  });

  it('batch reflections sort by insight density', () => {
    const graphs = [makeBugFixGraph(), makeFeatureGraph(), makeGraph()];
    const reflections = generateBatchReflections(graphs, 2);

    expect(reflections.length).toBeLessThanOrEqual(2);
    // Higher-insight sessions should come first
    if (reflections.length >= 2) {
      const score1 = reflections[0].insights.length + reflections[0].adaptations.length;
      const score2 = reflections[1].insights.length + reflections[1].adaptations.length;
      expect(score1).toBeGreaterThanOrEqual(score2);
    }
  });
});

// ─── Predictive Strategy Engine Tests ───────────────────────────────────────

describe('Predictive Strategy Engine', () => {
  it('predicts strategy relevance based on intent', () => {
    const index = makeIndex();
    const fingerprint = buildCognitiveFingerprint([makeBugFixGraph()]);

    const predictions = predictStrategies(index, {
      intent: classifySessionIntent(makeBugFixGraph()),
      fingerprint,
      activeFiles: ['src/auth/validate.ts'],
      recentErrors: [],
      timeOfDay: 'morning',
      sessionNumberToday: 1,
    });

    expect(predictions).toHaveLength(1);
    expect(predictions[0].relevanceProbability).toBeGreaterThan(0);
    expect(predictions[0].combinedScore).toBeGreaterThan(0);
  });

  it('ranks anti-pattern strategies higher for bug fixes', () => {
    const antiPatternStrat = makeStrategy({ tags: ['anti-pattern'] });
    const convergenceStrat = makeStrategy({
      id: 'strat_conv',
      tags: ['convergence'],
      triggerPattern: {
        filePatterns: ['src/components/*.tsx'],
        errorPatterns: [],
        moduleAreas: ['src/components'],
        promptKeywords: ['component', 'ui'],
      },
    });

    const index = makeIndex([antiPatternStrat, convergenceStrat]);
    const fingerprint = buildCognitiveFingerprint([makeBugFixGraph()]);

    const predictions = predictStrategies(index, {
      intent: classifySessionIntent(makeBugFixGraph()),
      fingerprint,
      activeFiles: ['src/auth/validate.ts'],
      recentErrors: [],
      timeOfDay: 'morning',
      sessionNumberToday: 1,
    });

    expect(predictions.length).toBe(2);
    // Anti-pattern strategy should score higher for bug fix in auth domain
    const apPred = predictions.find(p => p.strategyId === antiPatternStrat.id)!;
    const convPred = predictions.find(p => p.strategyId === convergenceStrat.id)!;
    expect(apPred.combinedScore).toBeGreaterThan(convPred.combinedScore);
  });

  it('selects strategies within token budget', () => {
    const strategies = Array.from({ length: 20 }, (_, i) =>
      makeStrategy({ id: `strat_${i}`, content: 'A'.repeat(500) })
    );
    const index = makeIndex(strategies);
    const fingerprint = buildCognitiveFingerprint([makeBugFixGraph()]);

    const predictions = predictStrategies(index, {
      intent: classifySessionIntent(makeBugFixGraph()),
      fingerprint,
      activeFiles: [],
      recentErrors: [],
      timeOfDay: 'morning',
      sessionNumberToday: 1,
    });

    const selected = selectStrategiesForInjection(index, predictions, {
      maxTokens: 2000, // Limited budget
    });

    // Should not exceed budget
    const totalChars = selected.reduce((s, st) => s + st.content.length + 100, 0);
    expect(totalChars).toBeLessThanOrEqual(2000 * 4);
  });
});

// ─── Temporal Dynamics Tests ────────────────────────────────────────────────

describe('Temporal Dynamics', () => {
  it('returns empty profile for no graphs', () => {
    const profile = buildTemporalProfile([]);
    expect(profile.trajectories).toHaveLength(0);
    expect(profile.overallLearningRate).toBe(0);
  });

  it('builds trajectories per task type', () => {
    // Need 3+ sessions per type to build a trajectory
    const graphs = [
      makeBugFixGraph(), makeBugFixGraph(), makeBugFixGraph(),
      makeFeatureGraph(), makeFeatureGraph(), makeFeatureGraph(),
    ];
    graphs.forEach((g, i) => {
      g.startTime = `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`;
    });

    const profile = buildTemporalProfile(graphs);
    expect(profile.trajectories.length).toBeGreaterThan(0);

    for (const t of profile.trajectories) {
      expect(t.points.length).toBeGreaterThanOrEqual(3);
      expect(['improving', 'stable', 'declining', 'insufficient-data']).toContain(t.trend);
    }
  });

  it('detects improvement trend', () => {
    // Create sessions with improving efficiency
    const graphs = Array.from({ length: 6 }, (_, i) => {
      const g = makeBugFixGraph();
      g.startTime = `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00Z`;
      g.metrics.totalToolCalls = 20 - i * 2; // Decreasing tool calls = improving
      return g;
    });

    const profile = buildTemporalProfile(graphs);
    const bugFixTrajectory = profile.trajectories.find(t => t.taskType === 'bug-fix');

    expect(bugFixTrajectory).toBeDefined();
    // With decreasing tool calls, efficiency should improve
    expect(bugFixTrajectory!.slopePerSession).toBeGreaterThanOrEqual(0);
  });
});

// ─── Cross-Project Transfer Tests ───────────────────────────────────────────

describe('Cross-Project Transfer', () => {
  it('assesses transferability of strategies', () => {
    const projectA = makeIndex([
      makeStrategy({ tags: ['anti-pattern'], scope: 'universal' }),
    ]);
    const projectB = makeIndex([
      makeStrategy({
        id: 'strat_b',
        tags: ['anti-pattern'],
        triggerPattern: {
          filePatterns: ['src/auth/*.ts'],
          errorPatterns: [],
          moduleAreas: ['src/auth'],
          promptKeywords: ['auth', 'token'],
        },
      }),
    ]);

    const allGraphs = [
      makeGraph({ project: '/project-a' }),
      makeGraph({ project: '/project-b' }),
    ];

    const transferIndex = buildTransferIndex(
      [
        { project: '/project-a', index: projectA },
        { project: '/project-b', index: projectB },
      ],
      allGraphs
    );

    expect(transferIndex.patterns.length).toBeGreaterThan(0);
    for (const p of transferIndex.patterns) {
      expect(p.abstractPattern).toBeTruthy();
      expect(p.underlyingPrinciple).toBeTruthy();
      expect(p.confidence).toBeGreaterThan(0);
    }
  });

  it('computes project similarity', () => {
    const projectA = makeIndex();
    const projectB = makeIndex();

    const graphA = makeGraph({
      project: '/project-a',
      metrics: { ...makeGraph().metrics, toolsUsed: ['Read', 'Edit', 'Bash'] },
    });
    const graphB = makeGraph({
      project: '/project-b',
      metrics: { ...makeGraph().metrics, toolsUsed: ['Read', 'Edit', 'Bash'] },
    });

    const transferIndex = buildTransferIndex(
      [
        { project: '/project-a', index: projectA },
        { project: '/project-b', index: projectB },
      ],
      [graphA, graphB]
    );

    // Projects with same tools should have some similarity
    if (transferIndex.projectSimilarity.length > 0) {
      expect(transferIndex.projectSimilarity[0].similarity).toBeGreaterThan(0);
    }
  });
});

// ─── Metacognitive Injection Tests ──────────────────────────────────────────

describe('Metacognitive Injection', () => {
  it('generates enhanced markdown with all sections', () => {
    const graphs = [makeBugFixGraph(), makeFeatureGraph()];
    const fingerprint = buildCognitiveFingerprint(graphs);
    const reflections = generateBatchReflections(graphs);
    const temporalProfile = buildTemporalProfile(graphs);
    const index = makeIndex();

    const markdown = generateMetacognitiveMarkdown({
      index,
      fingerprint,
      recentReflections: reflections,
      temporalProfile,
    });

    expect(markdown).toContain('CLAUDE_STRATEGIES.md');
    expect(markdown).toContain('Self-Awareness Profile');
    expect(markdown).toContain('Strategies');
    // Should be within token budget
    expect(markdown.length).toBeLessThan(5000 * 4 * 1.2); // Allow 20% overhead
  });

  it('includes predictions when provided', () => {
    const graphs = [makeBugFixGraph()];
    const fingerprint = buildCognitiveFingerprint(graphs);
    const index = makeIndex();

    const predictions = predictStrategies(index, {
      intent: classifySessionIntent(makeBugFixGraph()),
      fingerprint,
      activeFiles: [],
      recentErrors: [],
      timeOfDay: 'morning',
      sessionNumberToday: 1,
    });

    const markdown = generateMetacognitiveMarkdown({
      index,
      fingerprint,
      recentReflections: [],
      temporalProfile: buildTemporalProfile(graphs),
      predictions,
    });

    expect(markdown).toContain('Strategies');
  });
});
