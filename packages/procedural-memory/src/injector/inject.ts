/**
 * Strategy Injector
 * =================
 * Generates CLAUDE_STRATEGIES.md from a StrategyIndex.
 *
 * This file is placed alongside CLAUDE.md in the project root.
 * Claude Code reads it as part of its instruction loading.
 *
 * Design principles:
 * - Output fits Claude Code's existing memory file conventions
 * - Strategies are organized by module area for quick context matching
 * - Confidence scores and evidence counts are visible for transparency
 * - Total content stays under 4K tokens to avoid context bloat
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  type StrategyIndex,
  type Strategy,
  type PerformanceReport,
  type AggregateMetrics,
  type DecisionGraph,
} from '../types/decision-graph';

// ─── Markdown Generation ─────────────────────────────────────────────────────

const MAX_STRATEGY_TOKENS_APPROX = 4000; // ~4K token budget
const CHARS_PER_TOKEN_APPROX = 4;
const MAX_CHARS = MAX_STRATEGY_TOKENS_APPROX * CHARS_PER_TOKEN_APPROX;

/**
 * Generate CLAUDE_STRATEGIES.md content from a strategy index.
 */
export function generateStrategiesMarkdown(index: StrategyIndex): string {
  const lines: string[] = [];

  lines.push('# CLAUDE_STRATEGIES.md');
  lines.push('# Auto-generated procedural memory — do not edit manually');
  lines.push(`# Last consolidated: ${index.lastConsolidated.split('T')[0]}`);
  lines.push(`# Sessions analyzed: ${index.sessionsAnalyzed}`);
  lines.push(`# Active strategies: ${index.strategies.length}`);
  lines.push(`# Schema version: ${index.schemaVersion}`);
  lines.push('');
  lines.push('> These strategies are learned from past session outcomes.');
  lines.push('> They help you avoid known pitfalls and take efficient paths.');
  lines.push('> Confidence decays over time unless revalidated by new sessions.');
  lines.push('');

  // Group strategies by module area
  const grouped = groupByModule(index.strategies);

  for (const [module, strategies] of grouped) {
    // Check if we're within token budget
    const currentLength = lines.join('\n').length;
    if (currentLength > MAX_CHARS) {
      lines.push('');
      lines.push(`<!-- ${index.strategies.length - strategies.length} lower-confidence strategies omitted for context budget -->`);
      break;
    }

    lines.push(`## ${module}`);
    lines.push('');

    for (const strategy of strategies) {
      const confidenceBar = renderConfidenceBar(strategy.confidence);
      const evidenceCount = strategy.supportingEvidence.length;
      const lastValidated = strategy.lastValidated.split('T')[0];

      lines.push(`### ${confidenceBar} (confidence: ${Math.round(strategy.confidence * 100)}%, evidence: ${evidenceCount} sessions, validated: ${lastValidated})`);
      lines.push('');
      lines.push(strategy.content);
      lines.push('');
    }
  }

  // Add anti-pattern summary if space remains
  const currentLength = lines.join('\n').length;
  if (currentLength < MAX_CHARS * 0.8 && index.antiPatterns.length > 0) {
    lines.push('## Known Anti-Patterns');
    lines.push('');
    for (const ap of index.antiPatterns.slice(0, 5)) {
      lines.push(`- **${ap.triggerDescription}** (${ap.occurrences.length}x, avg ${ap.avgWastedSteps} wasted steps)`);
      lines.push(`  → ${ap.correctApproach}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write CLAUDE_STRATEGIES.md to the project root.
 */
export function writeStrategiesFile(projectRoot: string, index: StrategyIndex): string {
  const content = generateStrategiesMarkdown(index);
  const filePath = join(projectRoot, 'CLAUDE_STRATEGIES.md');
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Write the raw strategy index as JSON for programmatic access.
 */
export function writeStrategyIndex(projectRoot: string, index: StrategyIndex): string {
  const filePath = join(projectRoot, '.claude-strategies.json');
  writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf-8');
  return filePath;
}

// ─── Performance Report Generation ───────────────────────────────────────────

function collectSessionPaths(graph: DecisionGraph): string[] {
  const fromNodes = graph.nodes.flatMap((n) => n.filesTouched);
  const fromMetrics = [
    ...graph.metrics.filesModifiedAsResolution,
    ...graph.metrics.filesInvestigatedNotResolution,
  ];
  return [...new Set([...fromNodes, ...fromMetrics].map((p) => p.replace(/\\/g, '/').toLowerCase()))];
}

/** Substring / very light glob (* segments) match */
function pathMatchesPattern(fileNorm: string, pattern: string): boolean {
  const p = pattern.replace(/\\/g, '/').toLowerCase();
  if (!p.includes('*')) {
    return fileNorm.includes(p) || p.includes(fileNorm);
  }
  const parts = p.split('*').filter(Boolean);
  if (parts.length === 0) return true;
  let idx = 0;
  for (const part of parts) {
    const j = fileNorm.indexOf(part, idx);
    if (j < 0) return false;
    idx = j + part.length;
  }
  return true;
}

/**
 * Proxy: would this strategy have been injected for this session given file paths alone.
 * (Real hit tracking would need runtime logging from Claude Code.)
 */
export function strategyWouldFire(strategy: Strategy, graph: DecisionGraph): boolean {
  const files = collectSessionPaths(graph);
  for (const pat of strategy.triggerPattern.filePatterns) {
    if (files.some((f) => pathMatchesPattern(f, pat))) return true;
  }
  for (const area of strategy.triggerPattern.moduleAreas) {
    const a = area.toLowerCase();
    if (a && files.some((f) => f.includes(a))) return true;
  }
  return false;
}

/**
 * Heuristic effectiveness from path overlap + session outcomes.
 * Documented as approximate — not a substitute for instrumented evals.
 */
export function estimateStrategyEffectiveness(
  strategies: Strategy[],
  baselineGraphs: DecisionGraph[],
  enhancedGraphs: DecisionGraph[]
): PerformanceReport['strategyEffectiveness'] {
  if (strategies.length === 0 || enhancedGraphs.length === 0) return [];

  const baselineMedTools = baselineGraphs.length
    ? median(baselineGraphs.map((g) => g.metrics.totalToolCalls))
    : 0;

  return strategies.map((strategy) => {
    let timesInjected = 0;
    let timesRelevant = 0;
    let timesFollowed = 0;
    let timesSuccessful = 0;
    const reductions: number[] = [];

    for (const g of enhancedGraphs) {
      if (!strategyWouldFire(strategy, g)) continue;
      timesInjected += 1;
      const tools = g.metrics.totalToolCalls;
      const lowFriction =
        g.metrics.apparentSuccess ||
        tools <= baselineMedTools + 2 ||
        g.metrics.userCorrectionCount <= 1;
      if (lowFriction) timesRelevant += 1;
      if (g.metrics.apparentSuccess) {
        timesFollowed += 1;
        if (g.metrics.backtrackCount <= 1) timesSuccessful += 1;
      }
      reductions.push(baselineMedTools - tools);
    }

    const avgStepsReduction =
      reductions.length > 0
        ? Math.round((reductions.reduce((a, b) => a + b, 0) / reductions.length) * 10) / 10
        : 0;

    return {
      strategyId: strategy.id,
      timesInjected,
      timesRelevant,
      timesFollowed,
      timesSuccessful,
      avgStepsReduction,
    };
  });
}

/**
 * Generate a performance comparison report.
 * Compares baseline sessions (no strategies) vs enhanced sessions (with strategies).
 */
export function generatePerformanceReport(
  baselineGraphs: DecisionGraph[],
  enhancedGraphs?: DecisionGraph[],
  options?: { cohortNote?: string; strategies?: Strategy[] }
): PerformanceReport {
  const baseline = computeAggregateMetrics(baselineGraphs);

  const allSessions = [...baselineGraphs, ...(enhancedGraphs || [])];
  const sortedAll = [...allSessions].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const fromT = sortedAll[0]?.startTime || '';
  const toT = sortedAll[sortedAll.length - 1]?.endTime || '';

  const report: PerformanceReport = {
    period: {
      from: fromT,
      to: toT,
      sessionCount: baselineGraphs.length + (enhancedGraphs?.length || 0),
    },
    cohortNote: options?.cohortNote,
    baseline,
    strategyEffectiveness: [],
  };

  if (enhancedGraphs && enhancedGraphs.length > 0) {
    const enhanced = computeAggregateMetrics(enhancedGraphs);
    report.enhanced = enhanced;

    report.improvement = {
      toolCallReduction: percentChange(baseline.avgToolCallsPerSession, enhanced.avgToolCallsPerSession),
      backtrackReduction: percentChange(baseline.avgBacktracksPerSession, enhanced.avgBacktracksPerSession),
      correctionReduction: percentChange(baseline.avgCorrectionsPerSession, enhanced.avgCorrectionsPerSession),
      durationReduction: percentChange(baseline.avgDurationSeconds, enhanced.avgDurationSeconds),
    };

    if (options?.strategies && options.strategies.length > 0) {
      report.strategyEffectiveness = estimateStrategyEffectiveness(
        options.strategies,
        baselineGraphs,
        enhancedGraphs
      );
    }
  }

  return report;
}

/**
 * Render the performance report as a human-readable string.
 */
export function renderPerformanceReport(report: PerformanceReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('  PROCEDURAL MEMORY — PERFORMANCE REPORT');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  lines.push(`Period: ${report.period.from.split('T')[0]} → ${report.period.to.split('T')[0]}`);
  lines.push(`Sessions analyzed: ${report.period.sessionCount}`);
  if (report.cohortNote) {
    lines.push(`Cohort: ${report.cohortNote}`);
  }
  lines.push('');

  lines.push('Baseline (without strategies):');
  lines.push(renderMetrics(report.baseline, '  '));
  lines.push('');

  if (report.enhanced && report.improvement) {
    lines.push('Enhanced (with strategies):');
    lines.push(renderMetrics(report.enhanced, '  '));
    lines.push('');

    lines.push('Improvement:');
    lines.push(`  Tool calls:       ${formatPercent(report.improvement.toolCallReduction)}`);
    lines.push(`  Backtracks:       ${formatPercent(report.improvement.backtrackReduction)}`);
    lines.push(`  User corrections: ${formatPercent(report.improvement.correctionReduction)}`);
    lines.push(`  Session duration: ${formatPercent(report.improvement.durationReduction)}`);
    lines.push('');

    const eff = report.strategyEffectiveness.filter((e) => e.timesInjected > 0);
    if (eff.length > 0) {
      const sumInj = eff.reduce((s, e) => s + e.timesInjected, 0);
      const sumRel = eff.reduce((s, e) => s + e.timesRelevant, 0);
      const sumFol = eff.reduce((s, e) => s + e.timesFollowed, 0);
      const sumOk = eff.reduce((s, e) => s + e.timesSuccessful, 0);
      const hitRate = sumInj > 0 ? Math.round((sumRel / sumInj) * 1000) / 10 : 0;
      const accApprox = sumRel > 0 ? Math.round((sumFol / sumRel) * 1000) / 10 : 0;
      const falsePosApprox = sumInj > 0 ? Math.round(((sumInj - sumRel) / sumInj) * 1000) / 10 : 0;

      lines.push('Strategy effectiveness (path-overlap proxy — see README):');
      lines.push(`  Aggregate hit rate (relevant | fired):     ${hitRate}%`);
      lines.push(`  Accuracy proxy (followed | relevant):      ${accApprox}%`);
      lines.push(`  False-positive proxy (irrelevant | fired): ${falsePosApprox}%`);
      lines.push(`  Sessions with ≥1 strategy match:            ${sumInj} (across ${eff.length} strategies)`);
      lines.push(`  Low-backtrack successes after match:       ${sumOk}`);
      lines.push('');
      lines.push('  Top strategies by matches:');
      for (const row of [...eff].sort((a, b) => b.timesInjected - a.timesInjected).slice(0, 8)) {
        lines.push(
          `    ${row.strategyId}: fired=${row.timesInjected} relevant=${row.timesRelevant} success-proxy=${row.timesSuccessful} avg Δtools vs baseline median=${row.avgStepsReduction}`
        );
      }
      lines.push('');
    }
  }

  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByModule(strategies: Strategy[]): Map<string, Strategy[]> {
  const grouped = new Map<string, Strategy[]>();

  for (const s of strategies) {
    const module = s.triggerPattern.moduleAreas[0] || 'General';
    if (!grouped.has(module)) grouped.set(module, []);
    grouped.get(module)!.push(s);
  }

  return grouped;
}

function renderConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence * 5);
  return '●'.repeat(filled) + '○'.repeat(5 - filled);
}

function computeAggregateMetrics(graphs: DecisionGraph[]): AggregateMetrics {
  if (graphs.length === 0) {
    return {
      avgToolCallsPerSession: 0,
      avgBacktracksPerSession: 0,
      avgCorrectionsPerSession: 0,
      avgDurationSeconds: 0,
      medianToolCallsPerSession: 0,
      sessionCount: 0,
    };
  }

  const toolCalls = graphs.map(g => g.metrics.totalToolCalls);
  const backtracks = graphs.map(g => g.metrics.backtrackCount);
  const corrections = graphs.map(g => g.metrics.userCorrectionCount);
  const durations = graphs.map(g => g.metrics.durationSeconds);

  return {
    avgToolCallsPerSession: avg(toolCalls),
    avgBacktracksPerSession: avg(backtracks),
    avgCorrectionsPerSession: avg(corrections),
    avgDurationSeconds: avg(durations),
    medianToolCallsPerSession: median(toolCalls),
    sessionCount: graphs.length,
  };
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentChange(baseline: number, enhanced: number): number {
  if (baseline === 0) return 0;
  return Math.round(((baseline - enhanced) / baseline) * 1000) / 10;
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '-' : '+';
  const color = value > 0 ? '↓' : '↑';
  return `${sign}${Math.abs(value)}% ${color}`;
}

function renderMetrics(m: AggregateMetrics, indent: string): string {
  return [
    `${indent}Avg tool calls/session:       ${m.avgToolCallsPerSession}`,
    `${indent}Avg backtracks/session:       ${m.avgBacktracksPerSession}`,
    `${indent}Avg user corrections/session: ${m.avgCorrectionsPerSession}`,
    `${indent}Avg duration:                 ${Math.round(m.avgDurationSeconds / 60)}m`,
    `${indent}Median tool calls:            ${m.medianToolCallsPerSession}`,
    `${indent}Sessions:                     ${m.sessionCount}`,
  ].join('\n');
}
