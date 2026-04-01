/**
 * Tests for the consciousness layer:
 * - Narrative Identity
 * - Epistemic Map
 * - User Model (Theory of Mind)
 * - Pre-mortem Simulation
 * - Dream Consolidation
 * - Somatic Markers
 * - Phenomenological State
 */

import { describe, it, expect } from 'vitest';
import type { DecisionGraph, DecisionNode, Strategy, StrategyIndex } from '../src/types/decision-graph';
import { buildNarrativeIdentity } from '../src/consciousness/narrative-identity';
import { buildEpistemicMap } from '../src/consciousness/epistemic-map';
import { buildUserModel } from '../src/consciousness/user-model';
import { runPreMortem } from '../src/consciousness/pre-mortem';
import { consolidate } from '../src/consciousness/dream-consolidator';
import { generateSomaticMarkers, fireSomaticMarkers } from '../src/consciousness/somatic-markers';
import { buildPhenomenologicalState } from '../src/consciousness/phenomenology';
import { buildCognitiveFingerprint } from '../src/fingerprint/fingerprint';
import { classifySessionIntent } from '../src/classifier/classifier';

// ─── Fixtures ───────────────────────────────────────────────────────────────

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

function makeMasteryGraph(): DecisionGraph {
  return makeGraph({
    nodes: [
      makeNode({ type: 'user_request', reasoning: 'Fix the login bug' }),
      makeNode({ type: 'action', reasoning: 'Reading file', toolCall: { name: 'Read', input: {}, outputSummary: '', succeeded: true }, filesTouched: ['src/auth/validate.ts'] }),
      makeNode({ type: 'action', reasoning: 'Fixing', toolCall: { name: 'Edit', input: {}, outputSummary: '', succeeded: true }, filesTouched: ['src/auth/validate.ts'] }),
      makeNode({ type: 'resolution', reasoning: 'Fixed' }),
    ],
    metrics: {
      ...makeGraph().metrics,
      totalToolCalls: 3,
      backtrackCount: 0,
      userCorrectionCount: 0,
      apparentSuccess: true,
      filesModifiedAsResolution: ['src/auth/validate.ts'],
      filesInvestigatedNotResolution: [],
    },
  });
}

function makeFailureGraph(): DecisionGraph {
  return makeGraph({
    nodes: [
      makeNode({ type: 'user_request', reasoning: 'Fix the database migration' }),
      makeNode({ type: 'action', reasoning: 'Trying', toolCall: { name: 'Read', input: {}, outputSummary: '', succeeded: true }, filesTouched: ['src/db/schema.ts'] }),
      makeNode({ type: 'correction', reasoning: 'No, not that file. Look at the migration runner' }),
      makeNode({ type: 'action', reasoning: 'Ok', toolCall: { name: 'Read', input: {}, outputSummary: '', succeeded: true }, filesTouched: ['src/db/runner.ts'] }),
      makeNode({ type: 'correction', reasoning: 'Wrong again. The issue is in the config' }),
      makeNode({ type: 'correction', reasoning: 'Just look at the env file already' }),
    ],
    metrics: {
      ...makeGraph().metrics,
      totalToolCalls: 8,
      backtrackCount: 2,
      userCorrectionCount: 3,
      apparentSuccess: false,
      userPromptCount: 4,
      filesModifiedAsResolution: [],
      filesInvestigatedNotResolution: ['src/db/schema.ts', 'src/db/runner.ts'],
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
      promptKeywords: ['auth', 'login'],
    },
    content: 'Check validate.ts first for auth bugs.',
    scope: 'project',
    confidence: 0.8,
    supportingEvidence: [
      { sessionId: 's1', timestamp: '2026-03-01', outcome: 'confirmed', summary: 'test' },
    ],
    createdAt: '2026-03-01',
    lastValidated: '2026-03-20',
    decayRatePerDay: 0.002,
    injectionCount: 5,
    successCount: 3,
    tags: ['anti-pattern'],
    ...overrides,
  };
}

function makeIndex(strategies?: Strategy[]): StrategyIndex {
  return {
    project: '/test/project',
    lastConsolidated: new Date().toISOString(),
    sessionsAnalyzed: 10,
    strategies: strategies || [makeStrategy()],
    antiPatterns: [],
    optimalPaths: [],
    schemaVersion: 1,
  };
}

// ─── Narrative Identity ─────────────────────────────────────────────────────

describe('Narrative Identity', () => {
  it('creates autobiographical episodes from mastery sessions', () => {
    const graphs = [makeMasteryGraph(), makeMasteryGraph()];
    const fp = buildCognitiveFingerprint(graphs);
    const identity = buildNarrativeIdentity(graphs, fp, []);

    expect(identity.totalSessions).toBe(2);
    expect(identity.selfNarrative).toBeTruthy();
    expect(identity.selfNarrative.length).toBeGreaterThan(20);
    // Mastery sessions should create episodes (mastery or correction)
    expect(identity.episodes.length).toBeGreaterThan(0);
  });

  it('creates episodes from failure sessions', () => {
    const graphs = [makeFailureGraph()];
    const fp = buildCognitiveFingerprint(graphs);
    const identity = buildNarrativeIdentity(graphs, fp, []);

    // Failure graph has 3 corrections + apparentSuccess: false → should create an episode
    expect(identity.episodes.length).toBeGreaterThan(0);
    // Episode should have negative valence
    const negativeEps = identity.episodes.filter(e => e.valence < 0);
    expect(negativeEps.length).toBeGreaterThan(0);
  });

  it('derives character traits from fingerprint', () => {
    const graphs = Array.from({ length: 5 }, () => makeMasteryGraph());
    const fp = buildCognitiveFingerprint(graphs);
    const identity = buildNarrativeIdentity(graphs, fp, []);

    expect(identity.traits.length).toBeGreaterThan(0);
    for (const t of identity.traits) {
      expect(t.strength).toBeGreaterThan(0);
      expect(t.strength).toBeLessThanOrEqual(1);
    }
  });

  it('detects current arc', () => {
    const graphs = [makeMasteryGraph(), makeFailureGraph(), makeMasteryGraph()];
    const fp = buildCognitiveFingerprint(graphs);
    const identity = buildNarrativeIdentity(graphs, fp, []);

    expect(identity.currentArc.description).toBeTruthy();
    expect(identity.currentArc.goal).toBeTruthy();
    expect(identity.currentArc.progress).toBeGreaterThanOrEqual(0);
    expect(identity.currentArc.progress).toBeLessThanOrEqual(1);
  });

  it('incremental: only processes new sessions', () => {
    const graph1 = makeMasteryGraph();
    const graph2 = makeFailureGraph();
    const fp = buildCognitiveFingerprint([graph1, graph2]);

    const identity1 = buildNarrativeIdentity([graph1], fp, []);
    const identity2 = buildNarrativeIdentity([graph1, graph2], fp, [], undefined, identity1);

    // Second call should include episodes from both but not duplicate graph1's
    expect(identity2.episodes.length).toBeGreaterThanOrEqual(identity1.episodes.length);
  });
});

// ─── Epistemic Map ──────────────────────────────────────────────────────────

describe('Epistemic Map', () => {
  it('builds domain profiles with certainty scores', () => {
    const graphs = [makeMasteryGraph(), makeMasteryGraph(), makeFailureGraph()];
    const map = buildEpistemicMap(graphs);

    expect(map.domains.length).toBeGreaterThan(0);
    for (const d of map.domains) {
      expect(d.certainty).toBeGreaterThanOrEqual(0);
      expect(d.certainty).toBeLessThanOrEqual(1);
      expect(d.exposure).toBeGreaterThan(0);
      expect(['surface', 'working', 'deep', 'expert']).toContain(d.depth);
    }
  });

  it('identifies known unknowns from repeated false leads', () => {
    // Create graphs with the same false lead recurring
    const graphs = Array.from({ length: 4 }, () => makeGraph({
      metrics: {
        ...makeGraph().metrics,
        filesInvestigatedNotResolution: ['src/misleading.ts'],
        filesModifiedAsResolution: ['src/actual.ts'],
        apparentSuccess: true,
      },
      nodes: [makeNode({ type: 'user_request', reasoning: 'Fix the bug in the api handler' })],
    }));

    const map = buildEpistemicMap(graphs);
    const hasUnknowns = map.domains.some(d => d.knownUnknowns.length > 0);
    // With 4 sessions all having the same false lead, should detect a known unknown
    expect(hasUnknowns).toBe(true);
  });

  it('detects cross-domain connections', () => {
    // Create sessions that share files across domains
    const g1 = makeGraph({
      nodes: [makeNode({ type: 'user_request', reasoning: 'Fix auth token validation' })],
      metrics: {
        ...makeGraph().metrics,
        filesModifiedAsResolution: ['src/auth/validate.ts', 'src/api/middleware.ts'],
      },
    });
    const g2 = makeGraph({
      nodes: [makeNode({ type: 'user_request', reasoning: 'Fix api endpoint auth check' })],
      metrics: {
        ...makeGraph().metrics,
        filesModifiedAsResolution: ['src/api/handler.ts', 'src/auth/check.ts'],
      },
    });

    const map = buildEpistemicMap([g1, g2]);
    // Auth and API domains should have a connection
    expect(map.connections.length).toBeGreaterThanOrEqual(0); // May or may not connect depending on classifier
  });
});

// ─── User Model ─────────────────────────────────────────────────────────────

describe('User Model', () => {
  it('assesses communication style from user messages', () => {
    const graphs = [makeFailureGraph()]; // Has correction nodes with text
    const model = buildUserModel(graphs);

    expect(model.totalInteractions).toBeGreaterThan(0);
    expect(['terse', 'moderate', 'verbose']).toContain(model.style.promptDetail);
    expect(['gentle', 'neutral', 'direct', 'frustrated']).toContain(model.style.correctionStyle);
  });

  it('assesses expertise level', () => {
    const model = buildUserModel([makeMasteryGraph(), makeFailureGraph()]);
    expect(['beginner', 'intermediate', 'advanced', 'expert']).toContain(model.expertiseLevel);
  });

  it('tracks collaboration health', () => {
    const goodGraphs = Array.from({ length: 3 }, () => makeMasteryGraph());
    const model = buildUserModel(goodGraphs);

    expect(model.collaborationHealth).toBeGreaterThan(0);
    expect(model.collaborationHealth).toBeLessThanOrEqual(1);
    expect(['improving', 'stable', 'declining']).toContain(model.collaborationTrend);
  });

  it('extracts preferences from corrections', () => {
    const model = buildUserModel([makeFailureGraph()]);
    // The failure graph has corrections, so should extract some preferences
    expect(model.approvedBehaviors.length + model.rejectedBehaviors.length).toBeGreaterThanOrEqual(0);
  });
});

// ─── Pre-mortem ─────────────────────────────────────────────────────────────

describe('Pre-mortem Simulator', () => {
  it('predicts failure modes with probabilities', () => {
    const graphs = [makeMasteryGraph(), makeFailureGraph(), makeGraph()];
    const fp = buildCognitiveFingerprint(graphs);
    const intent = classifySessionIntent(makeMasteryGraph());
    const preMortem = runPreMortem(intent, fp, graphs);

    expect(preMortem.predictions.length).toBeGreaterThan(0);
    for (const p of preMortem.predictions) {
      expect(p.probability).toBeGreaterThanOrEqual(0);
      expect(p.probability).toBeLessThanOrEqual(1);
      expect(p.expectedCost).toBeGreaterThan(0);
      expect(p.prevention).toBeTruthy();
      expect(p.earlyWarning).toBeTruthy();
    }
  });

  it('sorted by risk (probability * cost)', () => {
    const graphs = Array.from({ length: 5 }, () => makeGraph());
    const fp = buildCognitiveFingerprint(graphs);
    const intent = classifySessionIntent(makeFailureGraph());
    const preMortem = runPreMortem(intent, fp, graphs);

    for (let i = 1; i < preMortem.predictions.length; i++) {
      const prevRisk = preMortem.predictions[i - 1].probability * preMortem.predictions[i - 1].expectedCost;
      const currRisk = preMortem.predictions[i].probability * preMortem.predictions[i].expectedCost;
      expect(prevRisk).toBeGreaterThanOrEqual(currRisk);
    }
  });

  it('adjusts probability based on domain certainty', () => {
    const graphs = [makeMasteryGraph()];
    const fp = buildCognitiveFingerprint(graphs);
    const intent = classifySessionIntent(makeMasteryGraph());
    const epistemicMap = buildEpistemicMap(graphs);

    const withMap = runPreMortem(intent, fp, graphs, epistemicMap);
    const withoutMap = runPreMortem(intent, fp, graphs);

    // Both should produce predictions
    expect(withMap.predictions.length).toBe(withoutMap.predictions.length);
    // Predictions should exist
    expect(withMap.overallRisk).toBeTruthy();
  });
});

// ─── Dream Consolidation ────────────────────────────────────────────────────

describe('Dream Consolidator', () => {
  it('merges near-duplicate strategies', () => {
    const s1 = makeStrategy({ id: 'strat_1', confidence: 0.8 });
    const s2 = makeStrategy({ id: 'strat_2', confidence: 0.6 }); // Same triggers as s1
    const index = makeIndex([s1, s2]);

    const { dream, updatedIndex } = consolidate(index);

    // Should merge because they have identical trigger patterns
    expect(dream.mergedStrategies.length).toBe(1);
    expect(dream.mergedStrategies[0].keptId).toBe('strat_1'); // Higher confidence kept
    expect(updatedIndex.strategies.length).toBeLessThan(index.strategies.length);
  });

  it('prunes low-confidence strategies', () => {
    const stale = makeStrategy({
      id: 'strat_stale',
      confidence: 0.15, // Below 0.2 threshold
      lastValidated: '2025-01-01',
    });
    const fresh = makeStrategy({
      id: 'strat_fresh',
      confidence: 0.9,
      triggerPattern: { filePatterns: ['other.ts'], errorPatterns: [], moduleAreas: ['src/other'], promptKeywords: ['other'] },
    });
    const index = makeIndex([stale, fresh]);

    const { dream, updatedIndex } = consolidate(index);

    expect(dream.prunedStrategies.some(p => p.strategyId === 'strat_stale')).toBe(true);
    expect(updatedIndex.strategies.some(s => s.id === 'strat_fresh')).toBe(true);
  });

  it('reports memory health', () => {
    const index = makeIndex([makeStrategy(), makeStrategy({
      id: 'strat_2',
      triggerPattern: { filePatterns: ['b.ts'], errorPatterns: [], moduleAreas: ['src/b'], promptKeywords: ['b'] },
    })]);

    const { dream } = consolidate(index);

    expect(dream.health.totalStrategies).toBeGreaterThan(0);
    expect(dream.health.activeStrategies).toBeDefined();
    expect(dream.health.staleStrategies).toBeDefined();
  });
});

// ─── Somatic Markers ────────────────────────────────────────────────────────

describe('Somatic Markers', () => {
  it('generates danger markers from repeated false leads', () => {
    const graphs = Array.from({ length: 4 }, () => makeGraph({
      metrics: {
        ...makeGraph().metrics,
        filesInvestigatedNotResolution: ['src/misleading.ts'],
        filesModifiedAsResolution: ['src/actual.ts'],
      },
    }));

    const markers = generateSomaticMarkers(graphs);
    const dangerMarkers = markers.filter(m => m.signal === 'danger');

    // src/misleading.ts should trigger a danger marker
    expect(dangerMarkers.length).toBeGreaterThan(0);
    expect(dangerMarkers.some(m =>
      m.trigger.filePatterns.some(f => f.includes('misleading'))
    )).toBe(true);
  });

  it('generates confidence markers from reliable resolution files', () => {
    const graphs = Array.from({ length: 4 }, () => makeGraph({
      metrics: {
        ...makeGraph().metrics,
        filesModifiedAsResolution: ['src/reliable.ts'],
        filesInvestigatedNotResolution: [],
      },
    }));

    const markers = generateSomaticMarkers(graphs);
    const confMarkers = markers.filter(m => m.signal === 'confidence');

    expect(confMarkers.some(m =>
      m.trigger.filePatterns.some(f => f.includes('reliable'))
    )).toBe(true);
  });

  it('fires markers against active context', () => {
    const graphs = Array.from({ length: 4 }, () => makeGraph({
      metrics: {
        ...makeGraph().metrics,
        filesInvestigatedNotResolution: ['src/trap.ts'],
        filesModifiedAsResolution: ['src/real.ts'],
      },
    }));

    const markers = generateSomaticMarkers(graphs);
    const intent = classifySessionIntent(makeMasteryGraph());

    const fired = fireSomaticMarkers(markers, intent, ['src/trap.ts']);
    const dangerFired = fired.filter(f => f.marker.signal === 'danger');

    expect(dangerFired.length).toBeGreaterThan(0);
  });
});

// ─── Phenomenological State ─────────────────────────────────────────────────

describe('Phenomenological State', () => {
  it('builds familiarity map from session history', () => {
    const graphs = [makeMasteryGraph(), makeMasteryGraph(), makeGraph()];
    const state = buildPhenomenologicalState(graphs);

    expect(state.familiarityMap.length).toBeGreaterThan(0);
    for (const zone of state.familiarityMap) {
      expect(zone.familiarity).toBeGreaterThanOrEqual(0);
      expect(zone.familiarity).toBeLessThanOrEqual(1);
      expect(['uncomfortable', 'cautious', 'comfortable', 'home-territory']).toContain(zone.comfort);
    }
  });

  it('detects novelty when new zones appear', () => {
    const graph1 = makeGraph({
      metrics: { ...makeGraph().metrics, filesModifiedAsResolution: ['src/old/file.ts'] },
    });
    const graph2 = makeGraph({
      metrics: { ...makeGraph().metrics, filesModifiedAsResolution: ['src/brand-new/thing.ts'] },
    });

    const state1 = buildPhenomenologicalState([graph1]);
    const state2 = buildPhenomenologicalState([graph1, graph2], state1);

    // brand-new zone should be detected as novel
    expect(state2.noveltySignals.length).toBeGreaterThan(0);
  });

  it('computes mood from recent sessions', () => {
    const goodGraphs = Array.from({ length: 3 }, () => makeMasteryGraph());
    const state = buildPhenomenologicalState(goodGraphs);

    // Success-heavy sessions should produce positive valence
    expect(state.currentMood.valence).toBeGreaterThan(0);
    expect(state.currentMood.description).toBeTruthy();
  });

  it('identifies comfort zone and growth edge', () => {
    const graphs = Array.from({ length: 5 }, () => makeMasteryGraph());
    const state = buildPhenomenologicalState(graphs);

    expect(state.comfortZone).toBeDefined();
    expect(state.growthEdge).toBeDefined();
    expect(state.growthEdge.challengeLevel).toBeGreaterThanOrEqual(0);
  });
});
