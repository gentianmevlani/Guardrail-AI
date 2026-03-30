import { describe, it, expect } from 'vitest';
import { computeTrustScore, diffScores, formatTrustScoreMarkdown } from '../TrustScoreService';
import type { Finding } from '../core-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: `test-${Math.random().toString(36).slice(2, 10)}`,
    engine: 'api_truth',
    severity: 'medium',
    category: 'api_truth',
    file: 'src/app.ts',
    line: 1,
    column: 0,
    message: 'test finding',
    evidence: 'test evidence',
    suggestion: 'test suggestion',
    confidence: 0.9,
    autoFixable: false,
    ...overrides,
  };
}

function makeFindings(count: number, overrides: Partial<Finding> = {}): Finding[] {
  return Array.from({ length: count }, (_, i) =>
    makeFinding({ id: `test-${i}`, line: i + 1, ...overrides })
  );
}

// ─── computeTrustScore ───────────────────────────────────────────────────────

describe('computeTrustScore', () => {
  // ── Basic scoring ──

  it('returns 100/A/SHIP with no findings', () => {
    const score = computeTrustScore([]);
    expect(score.overall).toBe(100);
    expect(score.grade).toBe('A');
    expect(score.decision).toBe('SHIP');
    expect(score.findingCount).toBe(0);
    expect(score.reducers).toHaveLength(0);
  });

  it('handles null findings gracefully', () => {
    const score = computeTrustScore(null);
    expect(score.overall).toBe(100);
    expect(score.decision).toBe('SHIP');
  });

  it('handles undefined findings gracefully', () => {
    const score = computeTrustScore(undefined);
    expect(score.overall).toBe(100);
  });

  // ── Severity penalties ──

  it('critical finding forces NO_SHIP regardless of score', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'critical', engine: 'api_truth' }),
    ]);
    expect(score.decision).toBe('NO_SHIP');
  });

  it('critical finding deducts 15 points from its dimension', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'critical', engine: 'api_truth' }),
    ]);
    expect(score.dimensions.api_integrity.score).toBe(85);
    expect(score.dimensions.api_integrity.penalty).toBe(15);
  });

  it('high finding deducts 8 points from its dimension', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'high', engine: 'phantom_dep' }),
    ]);
    expect(score.dimensions.dependency_safety.score).toBe(92);
    expect(score.dimensions.dependency_safety.penalty).toBe(8);
  });

  it('medium finding deducts 3 points', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'medium', engine: 'env_var' }),
    ]);
    expect(score.dimensions.env_coverage.score).toBe(97);
  });

  it('low finding deducts 1 point', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'low', engine: 'env_var' }),
    ]);
    expect(score.dimensions.env_coverage.score).toBe(99);
  });

  it('info findings have zero penalty', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'info', engine: 'env_var' }),
    ]);
    expect(score.dimensions.env_coverage.score).toBe(100);
    expect(score.overall).toBe(100);
  });

  // ── Penalty caps ──

  it('critical penalties are capped at 60 per dimension', () => {
    // 5 critical findings = 75 penalty points, but cap is 60
    const score = computeTrustScore(
      makeFindings(5, { severity: 'critical', engine: 'api_truth' })
    );
    expect(score.dimensions.api_integrity.score).toBe(40);
    expect(score.dimensions.api_integrity.penalty).toBe(60);
  });

  it('high penalties are capped at 40 per dimension', () => {
    // 6 high findings = 48 penalty points, but cap is 40
    const score = computeTrustScore(
      makeFindings(6, { severity: 'high', engine: 'phantom_dep' })
    );
    expect(score.dimensions.dependency_safety.score).toBe(60);
    expect(score.dimensions.dependency_safety.penalty).toBe(40);
  });

  it('medium penalties are capped at 20 per dimension', () => {
    // 10 medium findings = 30 penalty points, but cap is 20
    const score = computeTrustScore(
      makeFindings(10, { severity: 'medium', engine: 'env_var' })
    );
    expect(score.dimensions.env_coverage.score).toBe(80);
  });

  // ── Engine to dimension mapping ──

  it('maps api_truth to api_integrity dimension', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'api_truth', severity: 'high' }),
    ]);
    expect(score.dimensions.api_integrity.findingCount).toBe(1);
    expect(score.dimensions.api_integrity.penalty).toBeGreaterThan(0);
  });

  it('maps phantom_dep to dependency_safety dimension', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'phantom_dep', severity: 'high' }),
    ]);
    expect(score.dimensions.dependency_safety.findingCount).toBe(1);
  });

  it('maps env_var to env_coverage dimension', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'env_var', severity: 'high' }),
    ]);
    expect(score.dimensions.env_coverage.findingCount).toBe(1);
  });

  it('maps ghost_route to contract_health dimension', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'ghost_route', severity: 'high' }),
    ]);
    expect(score.dimensions.contract_health.findingCount).toBe(1);
  });

  it('maps credentials to contract_health dimension', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'credentials', severity: 'high' }),
    ]);
    expect(score.dimensions.contract_health.findingCount).toBe(1);
  });

  it('maps security to contract_health dimension', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'security', severity: 'high' }),
    ]);
    expect(score.dimensions.contract_health.findingCount).toBe(1);
  });

  it('maps unknown engines to contract_health by default', () => {
    const score = computeTrustScore([
      makeFinding({ engine: 'unknown_engine' as any, severity: 'high' }),
    ]);
    expect(score.dimensions.contract_health.findingCount).toBe(1);
  });

  // ── Weighted aggregate ──

  it('overall score reflects dimension weights', () => {
    // Single api_truth high finding: -8 on api_integrity (weight 0.30)
    // Expected: 100 - (8 * 0.30) = 97.6 → 98 rounded
    const score = computeTrustScore([
      makeFinding({ engine: 'api_truth', severity: 'high' }),
    ]);
    expect(score.overall).toBe(98);
  });

  // ── Grade assignment ──

  it('assigns grade A for score >= 95', () => {
    const score = computeTrustScore([]);
    expect(score.grade).toBe('A');
  });

  it('assigns grade B for score 85-94', () => {
    // 2 critical api_truth findings: -30 penalty (capped), api_integrity = 70
    // overall = 70*0.30 + 100*0.25 + 100*0.20 + 100*0.25 = 21 + 25 + 20 + 25 = 91
    const score = computeTrustScore(
      makeFindings(2, { severity: 'critical', engine: 'api_truth' })
    );
    expect(score.grade).toBe('B');
  });

  it('assigns grade C for score 70-84', () => {
    // Many findings across dimensions to get score into 70-84 range
    const findings = [
      ...makeFindings(3, { severity: 'critical', engine: 'api_truth' }),
      ...makeFindings(3, { severity: 'high', engine: 'phantom_dep' }),
      ...makeFindings(3, { severity: 'high', engine: 'env_var' }),
    ];
    const score = computeTrustScore(findings);
    expect(score.grade).toBe('C');
  });

  it('assigns grade F for score < 55', () => {
    const findings = [
      ...makeFindings(5, { severity: 'critical', engine: 'api_truth' }),
      ...makeFindings(5, { severity: 'critical', engine: 'phantom_dep' }),
      ...makeFindings(5, { severity: 'critical', engine: 'env_var' }),
      ...makeFindings(5, { severity: 'critical', engine: 'security' }),
    ];
    const score = computeTrustScore(findings);
    expect(score.grade).toBe('F');
  });

  // ── Decision thresholds ──

  it('SHIP when score >= 85 and no criticals', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'medium', engine: 'api_truth' }),
    ]);
    expect(score.decision).toBe('SHIP');
  });

  it('REVIEW when score 70-84 and no criticals', () => {
    const findings = [
      ...makeFindings(3, { severity: 'high', engine: 'api_truth' }),
      ...makeFindings(3, { severity: 'high', engine: 'phantom_dep' }),
      ...makeFindings(3, { severity: 'high', engine: 'env_var' }),
      ...makeFindings(3, { severity: 'high', engine: 'security' }),
    ];
    const score = computeTrustScore(findings);
    expect(score.decision).toBe('REVIEW');
  });

  it('NO_SHIP when score < 70', () => {
    const findings = [
      ...makeFindings(5, { severity: 'high', engine: 'api_truth' }),
      ...makeFindings(5, { severity: 'high', engine: 'phantom_dep' }),
      ...makeFindings(5, { severity: 'high', engine: 'env_var' }),
      ...makeFindings(5, { severity: 'high', engine: 'security' }),
    ];
    const score = computeTrustScore(findings);
    expect(score.decision).toBe('NO_SHIP');
  });

  // ── Custom thresholds ──

  it('respects custom ship threshold', () => {
    const score = computeTrustScore(
      [makeFinding({ severity: 'medium', engine: 'api_truth' })],
      { thresholds: { ship: 100 } }
    );
    // Score is ~99, custom threshold is 100 → REVIEW
    expect(score.decision).toBe('REVIEW');
  });

  // ── Custom weights ──

  it('normalizes custom weights to sum to 1.0', () => {
    const score = computeTrustScore([], {
      weights: { api_integrity: 1, dependency_safety: 1, env_coverage: 1, contract_health: 1 },
    });
    // Equal weights: each 0.25
    expect(score.dimensions.api_integrity.weight).toBe(0.25);
  });

  // ── Engine multipliers ──

  it('applies engine multiplier to penalties', () => {
    const baseScore = computeTrustScore([
      makeFinding({ severity: 'high', engine: 'api_truth' }),
    ]);
    const boostedScore = computeTrustScore(
      [makeFinding({ severity: 'high', engine: 'api_truth' })],
      { engineMultipliers: { api_truth: 2.0 } }
    );
    expect(boostedScore.dimensions.api_integrity.penalty).toBe(
      baseScore.dimensions.api_integrity.penalty * 2
    );
  });

  // ── Reducers ──

  it('generates reducers for medium+ findings', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'high', engine: 'api_truth' }),
      makeFinding({ severity: 'critical', engine: 'phantom_dep' }),
    ]);
    expect(score.reducers.length).toBeGreaterThanOrEqual(2);
  });

  it('sorts reducers by impact (highest first)', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'high', engine: 'api_truth' }),
      makeFinding({ severity: 'critical', engine: 'phantom_dep' }),
    ]);
    for (let i = 1; i < score.reducers.length; i++) {
      expect(score.reducers[i]!.impact).toBeLessThanOrEqual(score.reducers[i - 1]!.impact);
    }
  });

  it('does not generate reducers for info/low findings', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'info', engine: 'api_truth' }),
      makeFinding({ severity: 'low', engine: 'phantom_dep' }),
    ]);
    expect(score.reducers).toHaveLength(0);
  });

  it('reducer descriptions are human-readable', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'critical', engine: 'api_truth' }),
    ]);
    const reducer = score.reducers[0]!;
    expect(reducer.description).toContain('critical');
    expect(reducer.description).toContain('API Hallucinations');
  });

  it('reducer actions give engine-specific advice', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'high', engine: 'credentials' }),
    ]);
    const reducer = score.reducers[0]!;
    expect(reducer.action).toContain('environment variable');
  });

  // ── Trend ──

  it('computes improving trend when score increased', () => {
    const score = computeTrustScore([], {
      previousScore: { overall: 70, computedAt: '2024-01-01T00:00:00Z' },
    });
    expect(score.trend?.direction).toBe('improving');
    expect(score.trend?.delta).toBe(30);
  });

  it('computes degrading trend when score decreased', () => {
    const findings = makeFindings(5, { severity: 'critical', engine: 'api_truth' });
    const score = computeTrustScore(findings, {
      previousScore: { overall: 100, computedAt: '2024-01-01T00:00:00Z' },
    });
    expect(score.trend?.direction).toBe('degrading');
    expect(score.trend?.delta).toBeLessThan(0);
  });

  it('computes stable trend when delta within ±2', () => {
    const score = computeTrustScore(
      [makeFinding({ severity: 'low', engine: 'api_truth' })],
      { previousScore: { overall: 100, computedAt: '2024-01-01T00:00:00Z' } }
    );
    expect(score.trend?.direction).toBe('stable');
  });

  it('no trend when previousScore not provided', () => {
    const score = computeTrustScore([]);
    expect(score.trend).toBeUndefined();
  });

  // ── Per-file breakdown ──

  it('computes per-file scores', () => {
    const score = computeTrustScore([
      makeFinding({ file: 'src/a.ts', severity: 'critical' }),
      makeFinding({ file: 'src/a.ts', severity: 'high', id: 'f2' }),
      makeFinding({ file: 'src/b.ts', severity: 'medium', id: 'f3' }),
    ]);
    expect(score.perFile).toBeDefined();
    expect(score.perFile!.length).toBe(2);
    // Worst file first
    expect(score.perFile![0]!.file).toBe('src/a.ts');
  });

  it('tracks auto-fixable count per file', () => {
    const score = computeTrustScore([
      makeFinding({ file: 'src/a.ts', autoFixable: true }),
      makeFinding({ file: 'src/a.ts', autoFixable: false, id: 'f2' }),
    ]);
    const fileA = score.perFile?.find(f => f.file === 'src/a.ts');
    expect(fileA?.autoFixableCount).toBe(1);
  });

  it('no perFile when no findings', () => {
    const score = computeTrustScore([]);
    expect(score.perFile).toBeUndefined();
  });

  // ── Scope ──

  it('uses provided scope', () => {
    const score = computeTrustScore([], { scope: 'pr' });
    expect(score.scope).toBe('pr');
  });

  it('defaults to local scope', () => {
    const score = computeTrustScore([]);
    expect(score.scope).toBe('local');
  });

  // ── Metadata ──

  it('includes computedAt timestamp', () => {
    const before = new Date().toISOString();
    const score = computeTrustScore([]);
    const after = new Date().toISOString();
    expect(score.computedAt >= before).toBe(true);
    expect(score.computedAt <= after).toBe(true);
  });

  it('tracks total autoFixableCount', () => {
    const score = computeTrustScore([
      makeFinding({ autoFixable: true }),
      makeFinding({ autoFixable: true, id: 'f2' }),
      makeFinding({ autoFixable: false, id: 'f3' }),
    ]);
    expect(score.autoFixableCount).toBe(2);
  });

  // ── Score clamping ──

  it('score never goes below 0', () => {
    // Max penalties on all dimensions
    const findings = [
      ...makeFindings(5, { severity: 'critical', engine: 'api_truth' }),
      ...makeFindings(5, { severity: 'critical', engine: 'phantom_dep' }),
      ...makeFindings(5, { severity: 'critical', engine: 'env_var' }),
      ...makeFindings(5, { severity: 'critical', engine: 'security' }),
    ];
    const score = computeTrustScore(findings);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    for (const dim of Object.values(score.dimensions)) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('score never exceeds 100', () => {
    const score = computeTrustScore([]);
    expect(score.overall).toBeLessThanOrEqual(100);
  });
});

// ─── diffScores ──────────────────────────────────────────────────────────────

describe('diffScores', () => {
  it('detects improving scores', () => {
    const before = computeTrustScore(
      makeFindings(3, { severity: 'high', engine: 'api_truth' })
    );
    const after = computeTrustScore([]);
    const diff = diffScores(before, after, makeFindings(3), []);
    expect(diff.direction).toBe('improving');
    expect(diff.delta).toBeGreaterThan(0);
    expect(diff.resolvedFindings).toBe(3);
  });

  it('detects degrading scores', () => {
    const before = computeTrustScore([]);
    const findings = makeFindings(3, { severity: 'high', engine: 'api_truth' });
    const after = computeTrustScore(findings);
    const diff = diffScores(before, after, [], findings);
    expect(diff.direction).toBe('degrading');
    expect(diff.newFindings).toBe(3);
  });

  it('detects stable scores', () => {
    const findings = [makeFinding({ severity: 'low', engine: 'api_truth' })];
    const before = computeTrustScore(findings);
    const after = computeTrustScore(findings);
    const diff = diffScores(before, after, findings, findings);
    expect(diff.direction).toBe('stable');
  });

  it('detects decision changes', () => {
    const beforeFindings = makeFindings(1, { severity: 'critical', engine: 'api_truth' });
    const before = computeTrustScore(beforeFindings);
    const after = computeTrustScore([]);
    const diff = diffScores(before, after, beforeFindings, []);
    expect(diff.decisionChanged).toBe(true);
    expect(diff.previousDecision).toBe('NO_SHIP');
    expect(diff.currentDecision).toBe('SHIP');
  });

  it('generates human-readable summary', () => {
    const before = computeTrustScore([]);
    const findings = makeFindings(2, { severity: 'high', engine: 'api_truth' });
    const after = computeTrustScore(findings);
    const diff = diffScores(before, after, [], findings);
    expect(diff.summary).toContain('→');
    expect(diff.summary).toContain('new finding');
  });
});

// ─── formatTrustScoreMarkdown ────────────────────────────────────────────────

describe('formatTrustScoreMarkdown', () => {
  it('formats clean score with green icon', () => {
    const score = computeTrustScore([]);
    const md = formatTrustScoreMarkdown(score);
    expect(md).toContain('🟢');
    expect(md).toContain('100/100');
    expect(md).toContain('SHIP');
  });

  it('formats NO_SHIP score with red icon', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'critical', engine: 'api_truth' }),
    ]);
    const md = formatTrustScoreMarkdown(score);
    expect(md).toContain('🔴');
    expect(md).toContain('NO_SHIP');
  });

  it('includes dimension table', () => {
    const score = computeTrustScore([]);
    const md = formatTrustScoreMarkdown(score);
    expect(md).toContain('API Integrity');
    expect(md).toContain('Dependency Safety');
    expect(md).toContain('Environment Coverage');
    expect(md).toContain('Contract Health');
  });

  it('includes reducers when present', () => {
    const score = computeTrustScore([
      makeFinding({ severity: 'high', engine: 'api_truth' }),
    ]);
    const md = formatTrustScoreMarkdown(score);
    expect(md).toContain('dragging the score down');
  });

  it('includes trend when present', () => {
    const score = computeTrustScore([], {
      previousScore: { overall: 50, computedAt: '2024-01-01T00:00:00Z' },
    });
    const md = formatTrustScoreMarkdown(score);
    expect(md).toContain('Trend');
    expect(md).toContain('📈');
  });

  it('includes worst files when present', () => {
    const findings = [
      makeFinding({ file: 'src/bad.ts', severity: 'critical' }),
      ...makeFindings(5, { file: 'src/bad.ts', severity: 'high' }),
    ];
    const score = computeTrustScore(findings);
    const md = formatTrustScoreMarkdown(score);
    expect(md).toContain('src/bad.ts');
  });
});
