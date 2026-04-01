/**
 * Claude Code Audit
 * =================
 * Generates a structured failure analysis report from session data.
 *
 * This is the report that Anthropic's product team would want to see:
 * - How does Claude Code fail? With what frequency?
 * - What are the most common correction patterns?
 * - Where does the agent waste the most steps?
 * - What's the distribution of session efficiency?
 * - Which tool sequences predict failure?
 *
 * This isn't about the strategies — it's about the raw signal in
 * the session data. It's an X-ray of Claude Code's behavior.
 */

import type { DecisionGraph } from '../types/decision-graph';
import type { SessionIntent, TaskType } from '../types/metacognition';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuditReport {
  generatedAt: string;
  sessionCount: number;
  periodDays: number;

  // ─── High-level health ──────────────────────────────────────────────
  overallHealth: {
    successRate: number;
    avgToolCallsPerSession: number;
    medianToolCallsPerSession: number;
    avgBacktracksPerSession: number;
    avgCorrectionsPerSession: number;
    avgDurationMinutes: number;
    avgEfficiency: number; // optimal/actual steps
  };

  // ─── Failure analysis ───────────────────────────────────────────────
  failureAnalysis: {
    totalFailedSessions: number;
    failureRate: number;
    /** Top reasons sessions fail (by frequency) */
    failureReasons: Array<{
      reason: string;
      count: number;
      percentage: number;
      avgWastedSteps: number;
      exampleSessionIds: string[];
    }>;
  };

  // ─── Correction patterns ────────────────────────────────────────────
  correctionAnalysis: {
    totalCorrections: number;
    sessionsWithCorrections: number;
    avgCorrectionsWhenPresent: number;
    /** What triggers corrections (text patterns) */
    correctionTriggers: Array<{
      pattern: string;
      count: number;
    }>;
  };

  // ─── Tool usage ─────────────────────────────────────────────────────
  toolAnalysis: {
    toolFrequency: Array<{ tool: string; count: number; percentage: number }>;
    /** Tool sequences that correlate with failure */
    riskySequences: Array<{
      sequence: string[];
      failureRate: number;
      occurrences: number;
    }>;
    /** First tool used vs session success rate */
    firstToolSuccess: Array<{
      tool: string;
      successRate: number;
      sessionCount: number;
    }>;
  };

  // ─── Efficiency distribution ────────────────────────────────────────
  efficiencyDistribution: {
    /** Percentage of sessions in each efficiency bucket */
    buckets: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    /** Most wasteful sessions */
    worstSessions: Array<{
      sessionId: string;
      efficiency: number;
      toolCalls: number;
      falseLeads: number;
      date: string;
    }>;
  };

  // ─── Task type breakdown ────────────────────────────────────────────
  taskTypeBreakdown: Array<{
    taskType: TaskType;
    sessionCount: number;
    successRate: number;
    avgToolCalls: number;
    avgCorrections: number;
    avgEfficiency: number;
  }>;

  // ─── False lead hotspots ────────────────────────────────────────────
  falseLeadHotspots: Array<{
    path: string;
    timesInvestigated: number;
    timesWasResolution: number;
    falseLeadRate: number;
  }>;

  // ─── Token economics ────────────────────────────────────────────────
  tokenEconomics: {
    totalInputTokens: number;
    totalOutputTokens: number;
    avgInputPerSession: number;
    avgOutputPerSession: number;
    estimatedCost: number; // rough USD estimate
    wastedTokenEstimate: number; // tokens on false leads
  };
}

// ─── Computation ────────────────────────────────────────────────────────────

function computeEfficiency(graph: DecisionGraph): number {
  const productive = graph.nodes.filter(n =>
    n.type === 'action' && n.filesTouched.some(f =>
      graph.metrics.filesModifiedAsResolution.includes(f)
    )
  ).length;
  const optimal = Math.max(productive, 1) + 1;
  return graph.metrics.totalToolCalls > 0 ? optimal / graph.metrics.totalToolCalls : 1;
}

function normalizeForDisplay(filePath: string): string {
  return filePath
    .replace(/^\/Users\/[^/]+\/(?:Desktop\/)?/, '')
    .replace(/^\/home\/[^/]+\//, '');
}

export function generateAuditReport(graphs: DecisionGraph[]): AuditReport {
  const now = new Date();
  const sorted = [...graphs].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const earliest = sorted[0]?.startTime ? new Date(sorted[0].startTime) : now;
  const periodDays = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)));

  // Classify all sessions
  const intents = new Map<string, SessionIntent>();
  for (const g of graphs) {
    intents.set(g.sessionId, classifySessionIntent(g));
  }

  // ─── Overall health ─────────────────────────────────────────────

  const efficiencies = graphs.map(g => computeEfficiency(g));
  const toolCounts = graphs.map(g => g.metrics.totalToolCalls).sort((a, b) => a - b);
  const medianTools = toolCounts.length > 0
    ? toolCounts[Math.floor(toolCounts.length / 2)]
    : 0;

  const overallHealth = {
    successRate: round(graphs.filter(g => g.metrics.apparentSuccess).length / graphs.length, 3),
    avgToolCallsPerSession: round(avg(graphs.map(g => g.metrics.totalToolCalls)), 1),
    medianToolCallsPerSession: medianTools,
    avgBacktracksPerSession: round(avg(graphs.map(g => g.metrics.backtrackCount)), 2),
    avgCorrectionsPerSession: round(avg(graphs.map(g => g.metrics.userCorrectionCount)), 2),
    avgDurationMinutes: round(avg(graphs.map(g => g.metrics.durationSeconds)) / 60, 1),
    avgEfficiency: round(avg(efficiencies), 3),
  };

  // ─── Failure analysis ───────────────────────────────────────────

  const failedGraphs = graphs.filter(g => !g.metrics.apparentSuccess);
  const failureReasons = new Map<string, { count: number; wastedSteps: number[]; sessions: string[] }>();

  for (const g of failedGraphs) {
    const reasons: string[] = [];
    if (g.metrics.userCorrectionCount >= 3) reasons.push('excessive-corrections');
    if (g.metrics.backtrackCount >= 5) reasons.push('excessive-backtracks');
    if (g.metrics.totalToolCalls > 50 && g.metrics.filesModifiedAsResolution.length === 0) reasons.push('no-resolution-found');
    if (reasons.length === 0) reasons.push('below-success-threshold');

    const wastedSteps = g.metrics.totalToolCalls - g.metrics.filesModifiedAsResolution.length;

    for (const reason of reasons) {
      if (!failureReasons.has(reason)) failureReasons.set(reason, { count: 0, wastedSteps: [], sessions: [] });
      const entry = failureReasons.get(reason)!;
      entry.count++;
      entry.wastedSteps.push(wastedSteps);
      entry.sessions.push(g.sessionId);
    }
  }

  const failureAnalysis = {
    totalFailedSessions: failedGraphs.length,
    failureRate: round(failedGraphs.length / graphs.length, 3),
    failureReasons: [...failureReasons.entries()]
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: round(data.count / Math.max(failedGraphs.length, 1) * 100, 1),
        avgWastedSteps: round(avg(data.wastedSteps), 1),
        exampleSessionIds: data.sessions.slice(0, 3),
      }))
      .sort((a, b) => b.count - a.count),
  };

  // ─── Correction analysis ────────────────────────────────────────

  const sessionsWithCorr = graphs.filter(g => g.metrics.userCorrectionCount > 0);
  const correctionNodes = graphs.flatMap(g =>
    g.nodes.filter(n => n.type === 'correction')
  );

  // Extract correction text patterns
  const corrTriggerMap = new Map<string, number>();
  for (const node of correctionNodes) {
    const text = node.reasoning.toLowerCase();
    const patterns = [
      { key: 'wrong-file', test: /wrong|not that|different file|other file/ },
      { key: 'wrong-approach', test: /instead|try.*different|not what|approach/ },
      { key: 'scope-redirect', test: /don't|stop|only|just the|focus on/ },
      { key: 'clarification', test: /actually|I meant|what I want/ },
      { key: 'revert', test: /undo|revert|go back|put.*back/ },
    ];
    for (const { key, test } of patterns) {
      if (test.test(text)) {
        corrTriggerMap.set(key, (corrTriggerMap.get(key) || 0) + 1);
      }
    }
  }

  const correctionAnalysis = {
    totalCorrections: graphs.reduce((s, g) => s + g.metrics.userCorrectionCount, 0),
    sessionsWithCorrections: sessionsWithCorr.length,
    avgCorrectionsWhenPresent: round(
      sessionsWithCorr.length > 0
        ? sessionsWithCorr.reduce((s, g) => s + g.metrics.userCorrectionCount, 0) / sessionsWithCorr.length
        : 0,
      1
    ),
    correctionTriggers: [...corrTriggerMap.entries()]
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count),
  };

  // ─── Tool analysis ──────────────────────────────────────────────

  const toolCounts2 = new Map<string, number>();
  for (const g of graphs) {
    for (const n of g.nodes) {
      if (n.toolCall) {
        toolCounts2.set(n.toolCall.name, (toolCounts2.get(n.toolCall.name) || 0) + 1);
      }
    }
  }
  const totalToolUses = [...toolCounts2.values()].reduce((a, b) => a + b, 0);
  const toolFrequency = [...toolCounts2.entries()]
    .map(([tool, count]) => ({ tool, count, percentage: round(count / totalToolUses * 100, 1) }))
    .sort((a, b) => b.count - a.count);

  // First tool → success rate
  const firstToolMap = new Map<string, { success: number; total: number }>();
  for (const g of graphs) {
    const firstAction = g.nodes.find(n => n.type === 'action' && n.toolCall);
    if (firstAction?.toolCall) {
      const tool = firstAction.toolCall.name;
      if (!firstToolMap.has(tool)) firstToolMap.set(tool, { success: 0, total: 0 });
      firstToolMap.get(tool)!.total++;
      if (g.metrics.apparentSuccess) firstToolMap.get(tool)!.success++;
    }
  }
  const firstToolSuccess = [...firstToolMap.entries()]
    .filter(([, data]) => data.total >= 3)
    .map(([tool, data]) => ({
      tool,
      successRate: round(data.success / data.total, 2),
      sessionCount: data.total,
    }))
    .sort((a, b) => b.successRate - a.successRate);

  // Risky tool sequences (3-grams that correlate with failure)
  const sequenceFailures = new Map<string, { failures: number; total: number }>();
  for (const g of graphs) {
    const toolSeq = g.nodes
      .filter(n => n.toolCall)
      .map(n => n.toolCall!.name);
    for (let i = 0; i <= toolSeq.length - 3; i++) {
      const trigram = toolSeq.slice(i, i + 3).join('→');
      if (!sequenceFailures.has(trigram)) sequenceFailures.set(trigram, { failures: 0, total: 0 });
      sequenceFailures.get(trigram)!.total++;
      if (!g.metrics.apparentSuccess) sequenceFailures.get(trigram)!.failures++;
    }
  }
  const riskySequences = [...sequenceFailures.entries()]
    .filter(([, d]) => d.total >= 5 && d.failures / d.total > 0.3)
    .map(([seq, d]) => ({
      sequence: seq.split('→'),
      failureRate: round(d.failures / d.total, 2),
      occurrences: d.total,
    }))
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 10);

  // ─── Efficiency distribution ────────────────────────────────────

  const buckets = [
    { range: '90-100%', min: 0.9, max: 1.01 },
    { range: '70-90%', min: 0.7, max: 0.9 },
    { range: '50-70%', min: 0.5, max: 0.7 },
    { range: '30-50%', min: 0.3, max: 0.5 },
    { range: '0-30%', min: 0, max: 0.3 },
  ];
  const bucketCounts = buckets.map(b => ({
    range: b.range,
    count: efficiencies.filter(e => e >= b.min && e < b.max).length,
    percentage: round(efficiencies.filter(e => e >= b.min && e < b.max).length / efficiencies.length * 100, 1),
  }));

  const worstSessions = graphs
    .map(g => ({ g, eff: computeEfficiency(g) }))
    .sort((a, b) => a.eff - b.eff)
    .slice(0, 5)
    .map(({ g, eff }) => ({
      sessionId: g.sessionId.slice(0, 12),
      efficiency: round(eff, 2),
      toolCalls: g.metrics.totalToolCalls,
      falseLeads: g.metrics.filesInvestigatedNotResolution.length,
      date: g.startTime.split('T')[0],
    }));

  // ─── Task type breakdown ────────────────────────────────────────

  const byTaskType = new Map<TaskType, DecisionGraph[]>();
  for (const g of graphs) {
    const tt = intents.get(g.sessionId)?.taskType || 'unknown';
    if (!byTaskType.has(tt)) byTaskType.set(tt, []);
    byTaskType.get(tt)!.push(g);
  }
  const taskTypeBreakdown = [...byTaskType.entries()]
    .filter(([, gs]) => gs.length >= 2)
    .map(([tt, gs]) => ({
      taskType: tt,
      sessionCount: gs.length,
      successRate: round(gs.filter(g => g.metrics.apparentSuccess).length / gs.length, 2),
      avgToolCalls: round(avg(gs.map(g => g.metrics.totalToolCalls)), 1),
      avgCorrections: round(avg(gs.map(g => g.metrics.userCorrectionCount)), 2),
      avgEfficiency: round(avg(gs.map(g => computeEfficiency(g))), 3),
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  // ─── False lead hotspots ────────────────────────────────────────

  const fileStats = new Map<string, { investigated: number; resolution: number }>();
  for (const g of graphs) {
    for (const f of g.metrics.filesInvestigatedNotResolution) {
      const norm = normalizeForDisplay(f);
      if (!fileStats.has(norm)) fileStats.set(norm, { investigated: 0, resolution: 0 });
      fileStats.get(norm)!.investigated++;
    }
    for (const f of g.metrics.filesModifiedAsResolution) {
      const norm = normalizeForDisplay(f);
      if (!fileStats.has(norm)) fileStats.set(norm, { investigated: 0, resolution: 0 });
      fileStats.get(norm)!.resolution++;
    }
  }
  const falseLeadHotspots = [...fileStats.entries()]
    .filter(([, s]) => s.investigated >= 3)
    .map(([path, s]) => ({
      path,
      timesInvestigated: s.investigated,
      timesWasResolution: s.resolution,
      falseLeadRate: round(s.investigated / (s.investigated + s.resolution), 2),
    }))
    .sort((a, b) => b.falseLeadRate - a.falseLeadRate)
    .slice(0, 15);

  // ─── Token economics ────────────────────────────────────────────

  const totalInput = graphs.reduce((s, g) => s + g.metrics.tokenUsage.inputTokens, 0);
  const totalOutput = graphs.reduce((s, g) => s + g.metrics.tokenUsage.outputTokens, 0);
  const avgFalseLeadRatio = avg(graphs.map(g => {
    const total = g.metrics.filesInvestigatedNotResolution.length + g.metrics.filesModifiedAsResolution.length;
    return total > 0 ? g.metrics.filesInvestigatedNotResolution.length / total : 0;
  }));

  const tokenEconomics = {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    avgInputPerSession: round(totalInput / graphs.length, 0),
    avgOutputPerSession: round(totalOutput / graphs.length, 0),
    estimatedCost: round((totalInput * 3 + totalOutput * 15) / 1_000_000, 2), // Rough Sonnet pricing
    wastedTokenEstimate: round((totalInput + totalOutput) * avgFalseLeadRatio, 0),
  };

  return {
    generatedAt: now.toISOString(),
    sessionCount: graphs.length,
    periodDays,
    overallHealth,
    failureAnalysis,
    correctionAnalysis,
    toolAnalysis: { toolFrequency, riskySequences, firstToolSuccess },
    efficiencyDistribution: { buckets: bucketCounts, worstSessions },
    taskTypeBreakdown,
    falseLeadHotspots,
    tokenEconomics,
  };
}

// ─── Render ─────────────────────────────────────────────────────────────────

export function renderAuditReport(report: AuditReport): string {
  const lines: string[] = [];

  lines.push('╔═══════════════════════════════════════════════════════════╗');
  lines.push('║     CLAUDE CONSCIOUS — CLAUDE CODE QUALITY AUDIT        ║');
  lines.push('╚═══════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Period: ${report.periodDays} days | Sessions: ${report.sessionCount} | Generated: ${report.generatedAt.split('T')[0]}`);
  lines.push('');

  // Health
  lines.push('── OVERALL HEALTH ──────────────────────────────────────────');
  lines.push(`  Success rate:           ${round(report.overallHealth.successRate * 100, 1)}%`);
  lines.push(`  Avg tool calls:         ${report.overallHealth.avgToolCallsPerSession} (median: ${report.overallHealth.medianToolCallsPerSession})`);
  lines.push(`  Avg backtracks:         ${report.overallHealth.avgBacktracksPerSession}/session`);
  lines.push(`  Avg corrections:        ${report.overallHealth.avgCorrectionsPerSession}/session`);
  lines.push(`  Avg duration:           ${report.overallHealth.avgDurationMinutes} min`);
  lines.push(`  Avg efficiency:         ${round(report.overallHealth.avgEfficiency * 100, 1)}% (optimal/actual steps)`);
  lines.push('');

  // Failures
  lines.push('── FAILURE ANALYSIS ────────────────────────────────────────');
  lines.push(`  Failed sessions: ${report.failureAnalysis.totalFailedSessions}/${report.sessionCount} (${round(report.failureAnalysis.failureRate * 100, 1)}%)`);
  for (const r of report.failureAnalysis.failureReasons) {
    lines.push(`    ${r.reason}: ${r.count}x (${r.percentage}%) — avg ${r.avgWastedSteps} wasted steps`);
  }
  lines.push('');

  // Corrections
  lines.push('── CORRECTION PATTERNS ─────────────────────────────────────');
  lines.push(`  Total corrections: ${report.correctionAnalysis.totalCorrections} across ${report.correctionAnalysis.sessionsWithCorrections} sessions`);
  lines.push(`  Avg when present: ${report.correctionAnalysis.avgCorrectionsWhenPresent}/session`);
  if (report.correctionAnalysis.correctionTriggers.length > 0) {
    lines.push('  Triggers:');
    for (const t of report.correctionAnalysis.correctionTriggers.slice(0, 5)) {
      lines.push(`    ${t.pattern}: ${t.count}x`);
    }
  }
  lines.push('');

  // Tools
  lines.push('── TOOL USAGE ─────────────────────────────────────────────');
  for (const t of report.toolAnalysis.toolFrequency.slice(0, 8)) {
    lines.push(`  ${t.tool.padEnd(20)} ${t.count.toString().padStart(5)}x  (${t.percentage}%)`);
  }
  lines.push('');
  if (report.toolAnalysis.firstToolSuccess.length > 0) {
    lines.push('  First tool → success rate:');
    for (const t of report.toolAnalysis.firstToolSuccess.slice(0, 5)) {
      lines.push(`    ${t.tool.padEnd(20)} ${round(t.successRate * 100, 0)}% success (${t.sessionCount} sessions)`);
    }
    lines.push('');
  }
  if (report.toolAnalysis.riskySequences.length > 0) {
    lines.push('  Risky tool sequences (high failure rate):');
    for (const s of report.toolAnalysis.riskySequences.slice(0, 5)) {
      lines.push(`    ${s.sequence.join(' → ')}: ${round(s.failureRate * 100, 0)}% failure (${s.occurrences}x)`);
    }
    lines.push('');
  }

  // Efficiency
  lines.push('── EFFICIENCY DISTRIBUTION ─────────────────────────────────');
  for (const b of report.efficiencyDistribution.buckets) {
    const bar = '█'.repeat(Math.round(b.percentage / 3));
    lines.push(`  ${b.range.padEnd(10)} ${bar} ${b.percentage}% (${b.count})`);
  }
  lines.push('');
  if (report.efficiencyDistribution.worstSessions.length > 0) {
    lines.push('  Least efficient sessions:');
    for (const w of report.efficiencyDistribution.worstSessions) {
      lines.push(`    ${w.sessionId} — ${round(w.efficiency * 100, 0)}% eff, ${w.toolCalls} tools, ${w.falseLeads} false leads (${w.date})`);
    }
    lines.push('');
  }

  // Task types
  lines.push('── TASK TYPE BREAKDOWN ─────────────────────────────────────');
  for (const t of report.taskTypeBreakdown) {
    lines.push(`  ${t.taskType.padEnd(15)} ${t.sessionCount.toString().padStart(3)} sessions  ${round(t.successRate * 100, 0)}% success  ${t.avgToolCalls} avg tools  ${round(t.avgEfficiency * 100, 0)}% eff`);
  }
  lines.push('');

  // False leads
  if (report.falseLeadHotspots.length > 0) {
    lines.push('── FALSE LEAD HOTSPOTS ────────────────────────────────────');
    lines.push('  Files most often investigated but NOT part of resolution:');
    for (const f of report.falseLeadHotspots.slice(0, 10)) {
      lines.push(`    ${f.path.slice(0, 60).padEnd(60)} ${f.timesInvestigated}x investigated, ${round(f.falseLeadRate * 100, 0)}% false lead`);
    }
    lines.push('');
  }

  // Token economics
  if (report.tokenEconomics.totalInputTokens > 0) {
    lines.push('── TOKEN ECONOMICS ────────────────────────────────────────');
    lines.push(`  Total input:    ${formatTokens(report.tokenEconomics.totalInputTokens)}`);
    lines.push(`  Total output:   ${formatTokens(report.tokenEconomics.totalOutputTokens)}`);
    lines.push(`  Avg/session:    ${formatTokens(report.tokenEconomics.avgInputPerSession)} in / ${formatTokens(report.tokenEconomics.avgOutputPerSession)} out`);
    lines.push(`  Est. cost:      $${report.tokenEconomics.estimatedCost}`);
    lines.push(`  Wasted tokens:  ~${formatTokens(report.tokenEconomics.wastedTokenEstimate)} (on false leads)`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${round(n / 1_000_000, 1)}M`;
  if (n >= 1_000) return `${round(n / 1_000, 1)}K`;
  return String(n);
}
