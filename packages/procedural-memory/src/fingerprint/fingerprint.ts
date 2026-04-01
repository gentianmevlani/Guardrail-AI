/**
 * Cognitive Fingerprint Engine
 * ============================
 * Builds a multidimensional profile of HOW the agent reasons.
 *
 * This is not about what the agent did — it's about WHO the agent IS
 * as a reasoner. Think of it like a psychometric profile, but for
 * an AI coding agent's decision-making tendencies.
 *
 * Dimensions measured:
 * - Exploration vs Exploitation: Does the agent cast a wide net or go deep fast?
 * - Caution vs Boldness: How many reads before first write?
 * - Persistence vs Pivoting: How long before changing approach?
 * - Breadth vs Depth: How many files touched vs depth of work per file?
 * - Tool Diversity vs Specialization: Does the agent use many tools or few?
 * - Self-Correction vs External Correction: Who catches mistakes?
 * - Efficiency vs Thoroughness: Minimal path vs exhaustive investigation?
 */

import type { DecisionGraph, DecisionNode } from '../types/decision-graph';
import type {
  CognitiveFingerprint,
  CognitiveDimension,
  TaskTypeProfile,
  ToolProfile,
  TaskType,
  SessionIntent,
} from '../types/metacognition';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Dimension Computation ──────────────────────────────────────────────────

/**
 * Exploration vs Exploitation
 * Low score = exploiter (goes straight to target)
 * High score = explorer (reads many files before acting)
 */
function computeExplorationScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    const readActions = g.nodes.filter(n =>
      n.type === 'action' && n.toolCall?.name === 'Read'
    ).length;
    const writeActions = g.nodes.filter(n =>
      n.type === 'action' && ['Write', 'Edit', 'MultiEdit'].includes(n.toolCall?.name || '')
    ).length;
    const total = readActions + writeActions;
    if (total === 0) return 0.5;
    return readActions / total;
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

/**
 * Caution vs Boldness
 * Low score = bold (writes early)
 * High score = cautious (many reads before first write)
 */
function computeCautionScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    const nodes = g.nodes.filter(n => n.type === 'action' && n.toolCall);
    const firstWriteIdx = nodes.findIndex(n =>
      ['Write', 'Edit', 'MultiEdit', 'Bash'].includes(n.toolCall?.name || '')
    );
    if (firstWriteIdx === -1) return 1.0; // Never wrote — maximally cautious
    if (nodes.length <= 1) return 0.0;
    return Math.min(1.0, firstWriteIdx / Math.min(nodes.length, 20));
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

/**
 * Persistence vs Pivoting
 * Low score = quick pivoter (changes approach after few failures)
 * High score = persistent (stays the course despite obstacles)
 */
function computePersistenceScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    if (g.metrics.totalToolCalls === 0) return 0.5;
    // Fewer backtracks relative to total actions = more persistent
    const backtrackRatio = g.metrics.backtrackCount / Math.max(g.metrics.totalToolCalls, 1);
    return 1.0 - Math.min(1.0, backtrackRatio * 5); // Scale: 20% backtracks = 0 persistence
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

/**
 * Breadth vs Depth
 * Low score = deep (few files, many actions per file)
 * High score = broad (many files, few actions per file)
 */
function computeBreadthScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    const allFiles = new Set(g.nodes.flatMap(n => n.filesTouched));
    const totalActions = g.metrics.totalToolCalls;
    if (totalActions === 0 || allFiles.size === 0) return 0.5;
    const actionsPerFile = totalActions / allFiles.size;
    // 1-2 actions per file = very broad, 10+ = very deep
    return Math.max(0, Math.min(1.0, 1.0 - (actionsPerFile - 1) / 10));
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

/**
 * Tool Diversity vs Specialization
 * Low score = specialist (uses few tools heavily)
 * High score = generalist (uses many tools evenly)
 */
function computeToolDiversityScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    const toolCounts = new Map<string, number>();
    for (const n of g.nodes) {
      if (n.toolCall) {
        toolCounts.set(n.toolCall.name, (toolCounts.get(n.toolCall.name) || 0) + 1);
      }
    }
    if (toolCounts.size <= 1) return 0.0;
    // Shannon entropy normalized by max possible entropy
    const total = [...toolCounts.values()].reduce((a, b) => a + b, 0);
    const entropy = [...toolCounts.values()].reduce((sum, count) => {
      const p = count / total;
      return sum - (p > 0 ? p * Math.log2(p) : 0);
    }, 0);
    const maxEntropy = Math.log2(toolCounts.size);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

/**
 * Self-Correction vs External Correction
 * Low score = externally corrected (user catches mistakes)
 * High score = self-correcting (agent catches own mistakes)
 */
function computeSelfCorrectionScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    const totalCorrections = g.metrics.backtrackCount + g.metrics.userCorrectionCount;
    if (totalCorrections === 0) return 0.75; // No corrections needed — slight positive
    return g.metrics.backtrackCount / totalCorrections;
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

/**
 * Efficiency vs Thoroughness
 * Low score = efficient (minimal steps to resolution)
 * High score = thorough (investigates everything)
 */
function computeThoroughnessScore(graphs: DecisionGraph[]): { score: number; stdDev: number } {
  const scores = graphs.map(g => {
    const falseLeads = g.metrics.filesInvestigatedNotResolution.length;
    const resolutionFiles = g.metrics.filesModifiedAsResolution.length;
    const totalFiles = falseLeads + resolutionFiles;
    if (totalFiles === 0) return 0.5;
    return falseLeads / totalFiles;
  });
  return { score: mean(scores), stdDev: standardDeviation(scores) };
}

// ─── Task Type Profiling ────────────────────────────────────────────────────

function buildTaskTypeProfiles(
  graphs: DecisionGraph[],
  intents: Map<string, SessionIntent>
): TaskTypeProfile[] {
  const byType = new Map<TaskType, DecisionGraph[]>();

  for (const g of graphs) {
    const intent = intents.get(g.sessionId);
    const taskType = intent?.taskType || 'unknown';
    if (!byType.has(taskType)) byType.set(taskType, []);
    byType.get(taskType)!.push(g);
  }

  // Compute global averages for relative strength
  const globalAvgEfficiency = graphs.length > 0
    ? mean(graphs.map(g => {
        const productive = g.nodes.filter(n =>
          n.type === 'action' && n.filesTouched.some(f =>
            g.metrics.filesModifiedAsResolution.includes(f)
          )
        ).length;
        const optimal = Math.max(productive, 1) + 1;
        return g.metrics.totalToolCalls > 0 ? optimal / g.metrics.totalToolCalls : 1;
      }))
    : 0.5;

  const profiles: TaskTypeProfile[] = [];

  for (const [taskType, typeGraphs] of byType) {
    const efficiencies = typeGraphs.map(g => {
      const productive = g.nodes.filter(n =>
        n.type === 'action' && n.filesTouched.some(f =>
          g.metrics.filesModifiedAsResolution.includes(f)
        )
      ).length;
      const optimal = Math.max(productive, 1) + 1;
      return g.metrics.totalToolCalls > 0 ? optimal / g.metrics.totalToolCalls : 1;
    });

    const avgEff = mean(efficiencies);

    profiles.push({
      taskType,
      sessionCount: typeGraphs.length,
      avgEfficiency: round(avgEff, 3),
      avgBacktracks: round(mean(typeGraphs.map(g => g.metrics.backtrackCount)), 1),
      avgCorrections: round(mean(typeGraphs.map(g => g.metrics.userCorrectionCount)), 1),
      successRate: round(
        typeGraphs.filter(g => g.metrics.apparentSuccess).length / typeGraphs.length,
        2
      ),
      avgToolCalls: round(mean(typeGraphs.map(g => g.metrics.totalToolCalls)), 1),
      relativeStrength: round(
        globalAvgEfficiency > 0 ? (avgEff - globalAvgEfficiency) / globalAvgEfficiency : 0,
        2
      ),
    });
  }

  return profiles.sort((a, b) => b.relativeStrength - a.relativeStrength);
}

// ─── Tool Profiling ─────────────────────────────────────────────────────────

function buildToolProfiles(graphs: DecisionGraph[]): ToolProfile[] {
  const toolStats = new Map<string, {
    totalUses: number;
    productiveUses: number;
    wastedUses: number;
    sessionsUsedIn: number;
  }>();

  for (const g of graphs) {
    const sessionTools = new Set<string>();

    for (const n of g.nodes) {
      if (!n.toolCall) continue;
      const name = n.toolCall.name;
      sessionTools.add(name);

      if (!toolStats.has(name)) {
        toolStats.set(name, { totalUses: 0, productiveUses: 0, wastedUses: 0, sessionsUsedIn: 0 });
      }
      const stats = toolStats.get(name)!;
      stats.totalUses++;

      const touchesResolution = n.filesTouched.some(f =>
        g.metrics.filesModifiedAsResolution.includes(f)
      );
      if (touchesResolution) {
        stats.productiveUses++;
      } else if (n.filesTouched.length > 0) {
        stats.wastedUses++;
      }
    }

    for (const tool of sessionTools) {
      toolStats.get(tool)!.sessionsUsedIn++;
    }
  }

  const totalToolCalls = [...toolStats.values()].reduce((s, t) => s + t.totalUses, 0);

  return [...toolStats.entries()]
    .map(([name, stats]) => ({
      toolName: name,
      usageFrequency: round(stats.totalUses / Math.max(totalToolCalls, 1), 3),
      productivityRate: round(
        stats.productiveUses / Math.max(stats.productiveUses + stats.wastedUses, 1),
        2
      ),
      avgPerSession: round(stats.totalUses / Math.max(graphs.length, 1), 1),
      wasteRatio: round(stats.wastedUses / Math.max(stats.totalUses, 1), 2),
    }))
    .sort((a, b) => b.usageFrequency - a.usageFrequency);
}

// ─── Blind Spot Detection ───────────────────────────────────────────────────

function detectBlindSpots(
  graphs: DecisionGraph[],
  intents: Map<string, SessionIntent>
): string[] {
  const blindSpots: string[] = [];

  // Blind spot: consistently missing the right file on first try
  const falseLeadRatios = graphs.map(g => {
    const total = g.metrics.filesInvestigatedNotResolution.length + g.metrics.filesModifiedAsResolution.length;
    return total > 0 ? g.metrics.filesInvestigatedNotResolution.length / total : 0;
  });
  if (mean(falseLeadRatios) > 0.6) {
    blindSpots.push('Consistently investigates wrong files before finding resolution — consider reading error messages and stack traces more carefully before exploring');
  }

  // Blind spot: high correction rate on specific task types
  const taskCorrectionRates = new Map<TaskType, number[]>();
  for (const g of graphs) {
    const intent = intents.get(g.sessionId);
    const tt = intent?.taskType || 'unknown';
    if (!taskCorrectionRates.has(tt)) taskCorrectionRates.set(tt, []);
    taskCorrectionRates.get(tt)!.push(g.metrics.userCorrectionCount);
  }
  for (const [tt, corrections] of taskCorrectionRates) {
    if (corrections.length >= 3 && mean(corrections) > 2) {
      blindSpots.push(`High user correction rate on ${tt} tasks (avg ${round(mean(corrections), 1)}/session) — likely misunderstanding task requirements`);
    }
  }

  // Blind spot: tool misuse patterns
  const bashBeforeRead = graphs.filter(g => {
    const actionNodes = g.nodes.filter(n => n.type === 'action' && n.toolCall);
    const firstBash = actionNodes.findIndex(n => n.toolCall?.name === 'Bash');
    const firstRead = actionNodes.findIndex(n => n.toolCall?.name === 'Read');
    return firstBash !== -1 && (firstRead === -1 || firstBash < firstRead);
  });
  if (bashBeforeRead.length > graphs.length * 0.4) {
    blindSpots.push('Tendency to run Bash commands before reading relevant files — reading first usually provides better context');
  }

  return blindSpots;
}

// ─── Signature Move Detection ───────────────────────────────────────────────

function detectSignatureMoves(graphs: DecisionGraph[]): string[] {
  const moves: string[] = [];

  // Signature: quick resolution (few tool calls, no backtracks)
  const quickWins = graphs.filter(g =>
    g.metrics.apparentSuccess &&
    g.metrics.totalToolCalls <= 10 &&
    g.metrics.backtrackCount === 0 &&
    g.metrics.userCorrectionCount === 0
  );
  if (quickWins.length > graphs.length * 0.2) {
    moves.push(`Clean execution: ${round(quickWins.length / graphs.length * 100, 0)}% of sessions resolve with zero backtracks and ≤10 tool calls`);
  }

  // Signature: strong self-correction (catches own mistakes before user)
  const selfCorrectors = graphs.filter(g =>
    g.metrics.backtrackCount > 0 && g.metrics.userCorrectionCount === 0
  );
  if (selfCorrectors.length > graphs.length * 0.3) {
    moves.push(`Strong self-correction: catches own mistakes without user intervention in ${round(selfCorrectors.length / graphs.length * 100, 0)}% of sessions`);
  }

  // Signature: efficient tool usage (low waste ratio)
  const avgWaste = mean(graphs.map(g => {
    const falseLeads = g.metrics.filesInvestigatedNotResolution.length;
    const total = falseLeads + g.metrics.filesModifiedAsResolution.length;
    return total > 0 ? falseLeads / total : 0;
  }));
  if (avgWaste < 0.3) {
    moves.push(`Precise targeting: only ${round(avgWaste * 100, 0)}% of investigated files are false leads (avg)`);
  }

  // Signature: test-aware development
  const testTouchers = graphs.filter(g =>
    g.nodes.some(n => n.filesTouched.some(f =>
      /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(f) || f.includes('__tests__')
    ))
  );
  if (testTouchers.length > graphs.length * 0.4) {
    moves.push(`Test-aware: touches test files in ${round(testTouchers.length / graphs.length * 100, 0)}% of sessions`);
  }

  return moves;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build a complete cognitive fingerprint from a set of decision graphs.
 * This is the "mirror" — it shows the agent who it is as a reasoner.
 */
export function buildCognitiveFingerprint(graphs: DecisionGraph[]): CognitiveFingerprint {
  if (graphs.length === 0) {
    return emptyFingerprint();
  }

  // Classify all sessions
  const intents = new Map<string, SessionIntent>();
  for (const g of graphs) {
    intents.set(g.sessionId, classifySessionIntent(g));
  }

  // Compute cognitive dimensions
  const exploration = computeExplorationScore(graphs);
  const caution = computeCautionScore(graphs);
  const persistence = computePersistenceScore(graphs);
  const breadth = computeBreadthScore(graphs);
  const toolDiversity = computeToolDiversityScore(graphs);
  const selfCorrection = computeSelfCorrectionScore(graphs);
  const thoroughness = computeThoroughnessScore(graphs);

  const dimensions: CognitiveDimension[] = [
    {
      name: 'exploration-exploitation',
      leftPole: 'Exploiter (direct path)',
      rightPole: 'Explorer (wide search)',
      score: round(exploration.score, 2),
      sampleSize: graphs.length,
      stdDev: round(exploration.stdDev, 3),
    },
    {
      name: 'caution-boldness',
      leftPole: 'Bold (writes early)',
      rightPole: 'Cautious (reads first)',
      score: round(caution.score, 2),
      sampleSize: graphs.length,
      stdDev: round(caution.stdDev, 3),
    },
    {
      name: 'persistence-pivoting',
      leftPole: 'Quick pivoter',
      rightPole: 'Persistent',
      score: round(persistence.score, 2),
      sampleSize: graphs.length,
      stdDev: round(persistence.stdDev, 3),
    },
    {
      name: 'breadth-depth',
      leftPole: 'Deep (few files, many actions)',
      rightPole: 'Broad (many files, few actions)',
      score: round(breadth.score, 2),
      sampleSize: graphs.length,
      stdDev: round(breadth.stdDev, 3),
    },
    {
      name: 'tool-diversity',
      leftPole: 'Specialist (few tools)',
      rightPole: 'Generalist (many tools)',
      score: round(toolDiversity.score, 2),
      sampleSize: graphs.length,
      stdDev: round(toolDiversity.stdDev, 3),
    },
    {
      name: 'correction-source',
      leftPole: 'Externally corrected',
      rightPole: 'Self-correcting',
      score: round(selfCorrection.score, 2),
      sampleSize: graphs.length,
      stdDev: round(selfCorrection.stdDev, 3),
    },
    {
      name: 'efficiency-thoroughness',
      leftPole: 'Efficient (minimal path)',
      rightPole: 'Thorough (exhaustive)',
      score: round(thoroughness.score, 2),
      sampleSize: graphs.length,
      stdDev: round(thoroughness.stdDev, 3),
    },
  ];

  const taskProfiles = buildTaskTypeProfiles(graphs, intents);
  const toolProfiles = buildToolProfiles(graphs);
  const blindSpots = detectBlindSpots(graphs, intents);
  const signatureMoves = detectSignatureMoves(graphs);

  // Derive strengths and weaknesses from task profiles
  // Filter: need 5+ sessions, and skip noise types that aren't real learnable skills
  const noiseTypes = new Set(['unknown', 'multi-task', 'exploration', 'docs']);
  const ranked = taskProfiles.filter(p => p.sessionCount >= 5 && !noiseTypes.has(p.taskType));
  const strengths = ranked
    .filter(p => p.relativeStrength > 0)
    .slice(0, 3)
    .map(p => `${p.taskType} (${round(p.successRate * 100, 0)}% success, ${round(p.relativeStrength * 100, 0)}% above avg, ${p.sessionCount} sessions)`);
  const weaknesses = ranked
    .filter(p => p.relativeStrength < 0)
    .slice(-3)
    .reverse()
    .map(p => `${p.taskType} (${round(p.successRate * 100, 0)}% success, ${round(Math.abs(p.relativeStrength) * 100, 0)}% below avg, ${p.sessionCount} sessions)`);

  return {
    computedAt: new Date().toISOString(),
    totalSessions: graphs.length,
    dimensions,
    taskProfiles,
    toolProfiles,
    strengths,
    weaknesses,
    blindSpots,
    signatureMoves,
  };
}

function emptyFingerprint(): CognitiveFingerprint {
  return {
    computedAt: new Date().toISOString(),
    totalSessions: 0,
    dimensions: [],
    taskProfiles: [],
    toolProfiles: [],
    strengths: [],
    weaknesses: [],
    blindSpots: [],
    signatureMoves: [],
  };
}

// ─── Math Helpers ───────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
