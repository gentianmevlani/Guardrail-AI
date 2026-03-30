/**
 * TrustScoreService v3.0 — Ship/No-Ship decision engine.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  Finding[] → computeTrustScore()                                     │
 *   │                                                                      │
 *   │  1. Categorize findings by engine → dimension                        │
 *   │  2. Apply severity penalties with per-dimension caps                 │
 *   │  3. Score each dimension 0–100                                       │
 *   │  4. Weighted aggregate → overall score                               │
 *   │  5. Grade assignment (A–F)                                           │
 *   │  6. Decision model: SHIP / REVIEW / NO_SHIP                         │
 *   │     → Critical findings always force NO_SHIP                         │
 *   │     → Configurable thresholds per scope                              │
 *   │  7. Reducer explanations (human-readable impact breakdown)           │
 *   │  8. Temporal trend (compare against previous score)                  │
 *   │  9. Per-file breakdown for drill-down UI                             │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Decision thresholds (defaults):
 *   SHIP    ≥ 85
 *   REVIEW  70–84
 *   NO_SHIP < 70  (or any CRITICAL finding)
 */

import type {
  Finding,
  TrustScore,
  TrustScoreReducer,
  DimensionKey,
  DimensionScore,
  TrendInfo,
  FileScore,
  TrustScoreScope,
} from './core-types';

// ─── Types (re-export from core) ────────────────────────────────────────────

export type { TrustScore, TrustScoreReducer, DimensionKey, DimensionScore, TrendInfo, FileScore };
export type Decision = 'SHIP' | 'REVIEW' | 'NO_SHIP';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type Scope = TrustScoreScope;
export type ReducerSeverity = 'critical' | 'major' | 'minor' | 'info';
export type Trend = 'improving' | 'stable' | 'degrading';

export interface TrustScoreOptions {
  /** Override default dimension weights. Must sum to 1.0. */
  weights?: Partial<Record<DimensionKey, number>>;
  /** Override decision thresholds. */
  thresholds?: { ship?: number; review?: number };
  /** Previous score for trend computation. */
  previousScore?: { overall: number; computedAt: string };
  /** Scope of the scan. */
  scope?: Scope;
  /** Extra penalty multiplier for specific engines (e.g. stricter on api_truth). */
  engineMultipliers?: Record<string, number>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS: Record<DimensionKey, number> = {
  api_integrity:     0.30,
  dependency_safety: 0.25,
  env_coverage:      0.20,
  contract_health:   0.25,
};

/** Per-severity penalty points. */
const PENALTIES = {
  critical: 15,
  high:     8,
  medium:   3,
  low:      1,
  info:     0,
} as const;

/** Per-severity, per-dimension penalty caps (prevents a single dimension from tanking entirely). */
const PENALTY_CAPS = {
  critical: 60,
  high:     40,
  medium:   20,
  low:      10,
  info:     0,
} as const;

const SHIP_THRESHOLD   = 85;
const REVIEW_THRESHOLD = 70;

const TREND_THRESHOLD = 2; // score delta within ±2 is "stable"

/** Maps engine IDs to dimensions. */
const ENGINE_TO_DIMENSION: Record<string, DimensionKey> = {
  api_truth:              'api_integrity',
  version_hallucination:  'api_integrity',
  ghost_route:            'contract_health',
  phantom_dep:            'dependency_safety',
  env_var:                'env_coverage',
  credentials:            'contract_health',
  security:               'contract_health',
  fake_features:          'contract_health',
};

/** Human-readable dimension labels. */
const DIMENSION_META: Record<DimensionKey, { label: string; description: string }> = {
  api_integrity: {
    label: 'API Integrity',
    description: 'SDK/API method calls are correct — no hallucinated, deprecated, or version-mismatched methods.',
  },
  dependency_safety: {
    label: 'Dependency Safety',
    description: 'All imported packages exist, are installed, and are free from typosquatting or confusion attacks.',
  },
  env_coverage: {
    label: 'Environment Coverage',
    description: 'All referenced environment variables are defined in .env files or CI config.',
  },
  contract_health: {
    label: 'Contract Health',
    description: 'Routes have handlers, no hardcoded secrets, no security vulnerabilities, no fake/stub code.',
  },
};

const ENGINE_DISPLAY: Record<string, string> = {
  ghost_route:            'Ghost Routes',
  phantom_dep:            'Phantom Dependencies',
  api_truth:              'API Hallucinations',
  version_hallucination:  'Version Mismatches',
  env_var:                'Undefined Env Vars',
  credentials:            'Hardcoded Secrets',
  security:               'Security Vulnerabilities',
  fake_features:          'Fake Features',
};

const SEVERITY_TO_REDUCER: Record<string, ReducerSeverity> = {
  critical: 'critical',
  high:     'major',
  medium:   'minor',
  low:      'info',
  info:     'info',
};

// ─── Core Computation ────────────────────────────────────────────────────────

export function computeTrustScore(
  findings: Finding[] | null | undefined,
  options: TrustScoreOptions = {}
): TrustScore {
  const safeFindings = findings ?? [];
  const {
    weights: weightOverrides,
    thresholds,
    previousScore,
    scope = 'local',
    engineMultipliers = {},
  } = options;

  // Input validation for deterministic behavior
  if (!Array.isArray(safeFindings)) {
    throw new Error('Findings must be an array');
  }
  
  // Sort findings by ID to ensure deterministic processing order
  const sortedFindings = [...safeFindings].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const shipThreshold   = thresholds?.ship   ?? SHIP_THRESHOLD;
  const reviewThreshold = thresholds?.review  ?? REVIEW_THRESHOLD;

  // Resolve weights — normalize to sum=1.0 if overridden
  const rawWeights = { ...DEFAULT_WEIGHTS, ...weightOverrides };
  const weightSum = Object.values(rawWeights).reduce((a, b) => a + b, 0);
  const weights: Record<DimensionKey, number> = {
    api_integrity: rawWeights.api_integrity / weightSum,
    dependency_safety: rawWeights.dependency_safety / weightSum,
    env_coverage: rawWeights.env_coverage / weightSum,
    contract_health: rawWeights.contract_health / weightSum,
  };

  // ── Accumulate penalties per dimension per severity ─────────────────────

  type SevKey = keyof typeof PENALTIES;
  const dimPenalties: Record<DimensionKey, Record<SevKey, number>> = {
    api_integrity:     { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    dependency_safety: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    env_coverage:      { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    contract_health:   { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  };

  const dimCounts: Record<DimensionKey, number> = {
    api_integrity: 0, dependency_safety: 0, env_coverage: 0, contract_health: 0,
  };

  // Group findings by engine → severity for reducer construction
  const engineSeverityGroups = new Map<string, Map<string, Finding[]>>();
  const perFileMap = new Map<string, { count: number; criticals: number; autoFixable: number }>();
  let autoFixableTotal = 0;

  for (const f of sortedFindings) {
    const dim = ENGINE_TO_DIMENSION[f.engine] ?? 'contract_health';
    const sev = (f.severity ?? 'medium') as SevKey;
    const multiplier = engineMultipliers[f.engine] ?? 1.0;
    const penalty = (PENALTIES[sev] ?? 1) * multiplier;
    const cap = PENALTY_CAPS[sev] ?? 10;

    dimPenalties[dim][sev] = Math.min(dimPenalties[dim][sev] + penalty, cap);
    dimCounts[dim]++;

    // Engine severity groups
    if (!engineSeverityGroups.has(f.engine)) engineSeverityGroups.set(f.engine, new Map());
    const sevMap = engineSeverityGroups.get(f.engine)!;
    if (!sevMap.has(sev)) sevMap.set(sev, []);
    sevMap.get(sev)!.push(f);

    // Per-file tracking
    const fileEntry = perFileMap.get(f.file) ?? { count: 0, criticals: 0, autoFixable: 0 };
    fileEntry.count++;
    if (sev === 'critical') fileEntry.criticals++;
    if (f.autoFixable) fileEntry.autoFixable++;
    perFileMap.set(f.file, fileEntry);

    if (f.autoFixable) autoFixableTotal++;
  }

  // ── Compute dimension scores ───────────────────────────────────────────

  const dimensionKeys = Object.keys(DIMENSION_META) as DimensionKey[];

  const dimensions = Object.fromEntries(
    dimensionKeys.map(key => {
      const totalPenalty = Object.values(dimPenalties[key]).reduce((a, b) => a + b, 0);
      const score = clamp(100 - totalPenalty);
      const meta = DIMENSION_META[key];
      return [key, {
        score: Math.round(score),
        weight: round2(weights[key]),
        penalty: Math.round(totalPenalty),
        findingCount: dimCounts[key],
        label: meta.label,
        description: meta.description,
      }];
    })
  ) as Record<DimensionKey, DimensionScore>;

  // ── Weighted overall ───────────────────────────────────────────────────

  const overall = Math.round(clamp(
    (Object.keys(dimensions) as DimensionKey[]).reduce(
      (acc, key) => acc + dimensions[key].score * weights[key],
      0
    )
  ));

  // ── Build reducers ─────────────────────────────────────────────────────

  const reducers: TrustScoreReducer[] = [];

  for (const [engine, sevMap] of engineSeverityGroups) {
    const dim = ENGINE_TO_DIMENSION[engine] ?? 'contract_health';
    const engineLabel = ENGINE_DISPLAY[engine] ?? engine;

    for (const [sev, sevFindings] of sevMap) {
      if (sev === 'info' || sev === 'low') continue; // Skip noise
      const count = sevFindings.length;
      const impact = count * (PENALTIES[sev as SevKey] ?? 1);
      const reducerSev = SEVERITY_TO_REDUCER[sev] ?? 'minor';

      reducers.push({
        id: `${engine}_${sev}`,
        description: buildReducerDescription(count, sev, engineLabel),
        impact,
        severity: reducerSev,
        engine,
        dimension: dim,
        findingIds: sevFindings.map(f => f.id),
        action: buildReducerAction(engine, sev, count),
      });
    }
  }

  reducers.sort((a, b) => b.impact - a.impact);

  // ── Decision ───────────────────────────────────────────────────────────

  const hasCritical = safeFindings.some(f => f.severity === 'critical');
  let decision: Decision;
  if (hasCritical || overall < reviewThreshold) {
    decision = 'NO_SHIP';
  } else if (overall < shipThreshold) {
    decision = 'REVIEW';
  } else {
    decision = 'SHIP';
  }

  // ── Trend ──────────────────────────────────────────────────────────────

  let trend: TrendInfo | undefined;
  if (previousScore) {
    const delta = overall - previousScore.overall;
    const direction: Trend =
      delta > TREND_THRESHOLD ? 'improving' :
      delta < -TREND_THRESHOLD ? 'degrading' :
      'stable';

    trend = {
      direction,
      delta,
      previousScore: previousScore.overall,
      previousComputedAt: previousScore.computedAt,
    };
  }

  // ── Per-file breakdown ─────────────────────────────────────────────────

  const perFile: FileScore[] = [...perFileMap.entries()]
    .map(([file, data]) => ({
      file,
      score: clamp(100 - data.criticals * PENALTIES.critical - (data.count - data.criticals) * PENALTIES.medium),
      findingCount: data.count,
      criticalCount: data.criticals,
      autoFixableCount: data.autoFixable,
    }))
    .sort((a, b) => a.score - b.score); // worst files first

  // ── Result ─────────────────────────────────────────────────────────────

  return {
    overall,
    grade: gradeFromScore(overall),
    decision,
    dimensions,
    reducers,
    trend,
    perFile: perFile.length > 0 ? perFile : undefined,
    computedAt: new Date().toISOString(),
    scope,
    findingCount: safeFindings.length,
    autoFixableCount: autoFixableTotal,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function gradeFromScore(n: number): Grade {
  if (n >= 95) return 'A';
  if (n >= 85) return 'B';
  if (n >= 70) return 'C';
  if (n >= 55) return 'D';
  return 'F';
}

function buildReducerDescription(count: number, severity: string, engineLabel: string): string {
  const plural = count === 1 ? '' : 's';
  if (severity === 'critical') {
    return `${count} critical ${engineLabel} finding${plural} — blocks shipping`;
  }
  if (severity === 'high') {
    return `${count} high-severity ${engineLabel} finding${plural}`;
  }
  return `${count} ${severity} ${engineLabel} warning${plural}`;
}

function buildReducerAction(engine: string, severity: string, count: number): string {
  if (severity === 'critical' || severity === 'high') {
    switch (engine) {
      case 'api_truth':
        return count === 1
          ? 'Fix the hallucinated API call — check the SDK docs for the correct method.'
          : `Fix ${count} hallucinated API calls. Run "guardrail scan --json" for details.`;
      case 'version_hallucination':
        return count === 1
          ? 'Check your library version and update the API call to match — the method may have been renamed or removed.'
          : `Fix ${count} version-mismatched API calls. Check migration guides for the libraries involved.`;
      case 'phantom_dep':
        return count === 1
          ? 'Install the missing dependency or remove the import.'
          : `Install ${count} missing dependencies: run "guardrail scan" to see which packages to add.`;
      case 'env_var':
        return count === 1
          ? 'Add the missing variable to your .env file or CI config.'
          : `Add ${count} missing env vars to .env. Run "guardrail truthpack" to see all expected variables.`;
      case 'ghost_route':
        return count === 1
          ? 'Create the missing API route handler or fix the endpoint URL.'
          : `Fix ${count} ghost routes — create handlers or correct the URLs in your fetch calls.`;
      case 'credentials':
        return count === 1
          ? 'Move the hardcoded secret to an environment variable immediately. Rotate the exposed key.'
          : `Move ${count} hardcoded secrets to environment variables. Rotate ALL exposed keys — they\'re in git history.`;
      case 'security':
        return count === 1
          ? 'Fix the security vulnerability — see the finding message for the safe alternative.'
          : `Fix ${count} security vulnerabilities. Prioritize critical findings first.`;
      case 'fake_features':
        return count === 1
          ? 'Replace the placeholder/stub with a real implementation or remove it.'
          : `Address ${count} fake features — stubs, empty handlers, and placeholders that shipped to production.`;
      default:
        return `Resolve the ${severity} finding${count > 1 ? 's' : ''}.`;
    }
  }
  return `Consider addressing ${count > 1 ? 'these' : 'this'} to improve your trust score.`;
}

// ─── Convenience: Score diff for PR comments ─────────────────────────────────

export interface ScoreDiff {
  before: number;
  after: number;
  delta: number;
  direction: Trend;
  decisionChanged: boolean;
  previousDecision: Decision;
  currentDecision: Decision;
  newFindings: number;
  resolvedFindings: number;
  summary: string;
}

export function diffScores(
  before: TrustScore,
  after: TrustScore,
  beforeFindings: Finding[],
  afterFindings: Finding[]
): ScoreDiff {
  const delta = after.overall - before.overall;
  const direction: Trend =
    delta > TREND_THRESHOLD ? 'improving' :
    delta < -TREND_THRESHOLD ? 'degrading' :
    'stable';

  const beforeIds = new Set(beforeFindings.map(f => f.id));
  const afterIds = new Set(afterFindings.map(f => f.id));

  const newFindings = afterFindings.filter(f => !beforeIds.has(f.id)).length;
  const resolvedFindings = beforeFindings.filter(f => !afterIds.has(f.id)).length;

  const decisionChanged = before.decision !== after.decision;

  let summary: string;
  if (direction === 'improving') {
    summary = `Trust score improved ${before.overall} → ${after.overall} (+${delta}). ${resolvedFindings} finding${resolvedFindings !== 1 ? 's' : ''} resolved.`;
  } else if (direction === 'degrading') {
    summary = `Trust score dropped ${before.overall} → ${after.overall} (${delta}). ${newFindings} new finding${newFindings !== 1 ? 's' : ''} introduced.`;
  } else {
    summary = `Trust score stable at ${after.overall}. ${newFindings} new, ${resolvedFindings} resolved.`;
  }

  if (decisionChanged) {
    summary += ` Decision changed: ${before.decision} → ${after.decision}.`;
  }

  return {
    before: before.overall,
    after: after.overall,
    delta,
    direction,
    decisionChanged,
    previousDecision: before.decision,
    currentDecision: after.decision,
    newFindings,
    resolvedFindings,
    summary,
  };
}

// ─── Convenience: Format for CLI/PR ──────────────────────────────────────────

export function formatTrustScoreMarkdown(score: TrustScore): string {
  const icon = score.decision === 'SHIP' ? '🟢' : score.decision === 'REVIEW' ? '🟡' : '🔴';
  const lines: string[] = [];

  lines.push(`## ${icon} Guardrail Trust Score: ${score.overall}/100 (${score.grade})`);
  lines.push('');
  lines.push(`**Decision:** ${score.decision}${score.decision === 'NO_SHIP' ? ' ⛔' : score.decision === 'SHIP' ? ' ✅' : ' ⚠️'}`);
  lines.push(`**Findings:** ${score.findingCount} total, ${score.autoFixableCount} auto-fixable`);
  lines.push('');

  // Dimensions table
  lines.push('| Dimension | Score | Weight | Findings |');
  lines.push('|-----------|-------|--------|----------|');
  for (const [_key, dim] of Object.entries(score.dimensions)) {
    const bar = progressBar(dim.score);
    lines.push(`| ${dim.label} | ${bar} ${dim.score} | ${Math.round(dim.weight * 100)}% | ${dim.findingCount} |`);
  }
  lines.push('');

  // Top reducers
  if (score.reducers.length > 0) {
    lines.push('### What\'s dragging the score down');
    lines.push('');
    for (const r of score.reducers.slice(0, 5)) {
      const sevIcon = r.severity === 'critical' ? '🔴' : r.severity === 'major' ? '🟠' : '🟡';
      lines.push(`- ${sevIcon} **${r.description}** (−${r.impact} pts)`);
      if (r.action) lines.push(`  - 💡 ${r.action}`);
    }
    lines.push('');
  }

  // Trend
  if (score.trend) {
    const t = score.trend;
    const arrow = t.direction === 'improving' ? '📈' : t.direction === 'degrading' ? '📉' : '➡️';
    lines.push(`${arrow} **Trend:** ${t.previousScore} → ${score.overall} (${t.delta >= 0 ? '+' : ''}${t.delta})`);
    lines.push('');
  }

  // Worst files
  if (score.perFile && score.perFile.length > 0) {
    const worst = score.perFile.filter(f => f.score < 80).slice(0, 5);
    if (worst.length > 0) {
      lines.push('### Files needing attention');
      lines.push('');
      for (const f of worst) {
        lines.push(`- \`${f.file}\` — score ${f.score}, ${f.findingCount} findings${f.autoFixableCount > 0 ? ` (${f.autoFixableCount} auto-fixable)` : ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function progressBar(score: number): string {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}