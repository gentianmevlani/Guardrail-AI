/**
 * Temporal Dynamics Tracker
 * =========================
 * Tracks how the agent's performance evolves OVER TIME.
 *
 * This is the "growth" layer. Humans improve at skills through practice,
 * hit plateaus, and sometimes have breakthroughs. The same happens with
 * an LLM agent operating in a codebase — but only if we measure it.
 *
 * This module detects:
 * - Skill acquisition curves per task type
 * - Plateaus: periods where performance flatlines
 * - Breakthroughs: sudden jumps in efficiency
 * - Decline: when strategies go stale or codebase changes
 * - Overall learning rate: how fast is the system improving?
 */

import type { DecisionGraph } from '../types/decision-graph';
import type {
  SkillPoint,
  SkillTrajectory,
  TemporalProfile,
  TaskType,
  SessionIntent,
} from '../types/metacognition';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Skill Point Collection ─────────────────────────────────────────────────

/**
 * Convert a decision graph into a skill data point.
 */
function toSkillPoint(graph: DecisionGraph, intent: SessionIntent): SkillPoint {
  const productive = graph.nodes.filter(n =>
    n.type === 'action' && n.filesTouched.some(f =>
      graph.metrics.filesModifiedAsResolution.includes(f)
    )
  ).length;
  const optimal = Math.max(productive, 1) + 1;
  const efficiency = graph.metrics.totalToolCalls > 0
    ? optimal / graph.metrics.totalToolCalls
    : 1.0;

  return {
    timestamp: graph.startTime,
    sessionId: graph.sessionId,
    taskType: intent.taskType,
    efficiency: round(Math.min(1.0, efficiency), 3),
    backtracks: graph.metrics.backtrackCount,
    corrections: graph.metrics.userCorrectionCount,
    toolCalls: graph.metrics.totalToolCalls,
  };
}

// ─── Trend Analysis ─────────────────────────────────────────────────────────

/**
 * Simple linear regression to detect trend direction and slope.
 */
function linearRegression(values: number[]): { slope: number; r2: number } {
  if (values.length < 3) return { slope: 0, r2: 0 };

  const n = values.length;
  const xs = values.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xMean) * (values[i] - yMean);
    denominator += (xs[i] - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope: round(slope, 4), r2: round(r2, 3) };
}

/**
 * Detect plateaus: periods where efficiency stays within a narrow band.
 */
function detectPlateaus(
  points: SkillPoint[],
  windowSize: number = 5,
  threshold: number = 0.05
): SkillTrajectory['plateaus'] {
  if (points.length < windowSize) return [];

  const plateaus: SkillTrajectory['plateaus'] = [];
  let plateauStart = 0;

  for (let i = windowSize; i <= points.length; i++) {
    const window = points.slice(i - windowSize, i);
    const efficiencies = window.map(p => p.efficiency);
    const range = Math.max(...efficiencies) - Math.min(...efficiencies);

    if (range <= threshold) {
      if (plateauStart === 0 || i - windowSize > plateauStart + 1) {
        // Start of a new plateau
        if (plateauStart > 0 && i - windowSize - plateauStart >= windowSize) {
          // Close previous plateau
          const plateauPoints = points.slice(plateauStart, i - windowSize);
          plateaus.push({
            startSession: plateauPoints[0].sessionId,
            endSession: plateauPoints[plateauPoints.length - 1].sessionId,
            avgEfficiency: round(
              plateauPoints.reduce((s, p) => s + p.efficiency, 0) / plateauPoints.length,
              3
            ),
          });
        }
        plateauStart = i - windowSize;
      }
    }
  }

  // Close final plateau if active
  if (plateauStart > 0 && points.length - plateauStart >= windowSize) {
    const plateauPoints = points.slice(plateauStart);
    plateaus.push({
      startSession: plateauPoints[0].sessionId,
      endSession: plateauPoints[plateauPoints.length - 1].sessionId,
      avgEfficiency: round(
        plateauPoints.reduce((s, p) => s + p.efficiency, 0) / plateauPoints.length,
        3
      ),
    });
  }

  return plateaus;
}

/**
 * Detect breakthroughs: sudden jumps in efficiency that persist.
 */
function detectBreakthroughs(
  points: SkillPoint[],
  windowSize: number = 3,
  jumpThreshold: number = 0.15
): SkillTrajectory['breakthroughs'] {
  if (points.length < windowSize * 2) return [];

  const breakthroughs: SkillTrajectory['breakthroughs'] = [];

  for (let i = windowSize; i <= points.length - windowSize; i++) {
    const beforeWindow = points.slice(i - windowSize, i);
    const afterWindow = points.slice(i, i + windowSize);

    const beforeAvg = beforeWindow.reduce((s, p) => s + p.efficiency, 0) / windowSize;
    const afterAvg = afterWindow.reduce((s, p) => s + p.efficiency, 0) / windowSize;

    if (afterAvg - beforeAvg >= jumpThreshold) {
      // Check what changed — look at the breakthrough session
      const breakSession = points[i];
      let likelyCause = 'unknown';

      // Drop in corrections suggests strategy was loaded
      const beforeCorrections = beforeWindow.reduce((s, p) => s + p.corrections, 0) / windowSize;
      const afterCorrections = afterWindow.reduce((s, p) => s + p.corrections, 0) / windowSize;
      if (afterCorrections < beforeCorrections * 0.5) {
        likelyCause = 'Fewer user corrections suggest strategies/learning took effect';
      }

      // Drop in backtracks suggests better initial approach
      const beforeBacktracks = beforeWindow.reduce((s, p) => s + p.backtracks, 0) / windowSize;
      const afterBacktracks = afterWindow.reduce((s, p) => s + p.backtracks, 0) / windowSize;
      if (afterBacktracks < beforeBacktracks * 0.5) {
        likelyCause = 'Fewer backtracks indicate better initial approach selection';
      }

      // Drop in tool calls suggests more efficient paths
      const beforeTools = beforeWindow.reduce((s, p) => s + p.toolCalls, 0) / windowSize;
      const afterTools = afterWindow.reduce((s, p) => s + p.toolCalls, 0) / windowSize;
      if (afterTools < beforeTools * 0.7) {
        likelyCause = 'Reduced tool calls suggest more direct problem-solving paths';
      }

      breakthroughs.push({
        sessionId: breakSession.sessionId,
        timestamp: breakSession.timestamp,
        efficiencyBefore: round(beforeAvg, 3),
        efficiencyAfter: round(afterAvg, 3),
        likelyCause,
      });
    }
  }

  return breakthroughs;
}

// ─── Trajectory Building ────────────────────────────────────────────────────

function buildTrajectory(points: SkillPoint[], taskType: TaskType): SkillTrajectory {
  // Sort by timestamp
  const sorted = [...points].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const efficiencies = sorted.map(p => p.efficiency);
  const regression = linearRegression(efficiencies);

  let trend: SkillTrajectory['trend'];
  if (sorted.length < 5) {
    trend = 'insufficient-data';
  } else if (regression.slope > 0.01 && regression.r2 > 0.2) {
    trend = 'improving';
  } else if (regression.slope < -0.01 && regression.r2 > 0.2) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    taskType,
    points: sorted,
    trend,
    slopePerSession: regression.slope,
    plateaus: detectPlateaus(sorted),
    breakthroughs: detectBreakthroughs(sorted),
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Build the temporal profile: how is the agent's performance evolving over time?
 */
export function buildTemporalProfile(graphs: DecisionGraph[]): TemporalProfile {
  if (graphs.length === 0) {
    return {
      computedAt: new Date().toISOString(),
      trajectories: [],
      overallLearningRate: 0,
      daysSinceLastBreakthrough: -1,
      prediction: 'Insufficient data for temporal analysis',
    };
  }

  // Classify all sessions and convert to skill points
  // Skip noise types — tracking "improvement at unknown" is meaningless
  const noiseTypes = new Set<TaskType>(['unknown', 'multi-task', 'exploration', 'docs']);
  const pointsByType = new Map<TaskType, SkillPoint[]>();

  for (const g of graphs) {
    const intent = classifySessionIntent(g);
    if (noiseTypes.has(intent.taskType)) continue;
    const point = toSkillPoint(g, intent);

    if (!pointsByType.has(point.taskType)) {
      pointsByType.set(point.taskType, []);
    }
    pointsByType.get(point.taskType)!.push(point);
  }

  // Build trajectories per task type (need 3+ points for meaningful trajectory)
  const trajectories: SkillTrajectory[] = [];
  for (const [taskType, points] of pointsByType) {
    if (points.length >= 3) {
      trajectories.push(buildTrajectory(points, taskType));
    }
  }

  // Overall learning rate = weighted average of trajectory slopes
  const weightedSlopes = trajectories
    .filter(t => t.trend !== 'insufficient-data')
    .map(t => ({ slope: t.slopePerSession, weight: t.points.length }));

  const totalWeight = weightedSlopes.reduce((s, w) => s + w.weight, 0);
  const overallLearningRate = totalWeight > 0
    ? round(
        weightedSlopes.reduce((s, w) => s + w.slope * w.weight, 0) / totalWeight,
        4
      )
    : 0;

  // Find last breakthrough
  const allBreakthroughs = trajectories.flatMap(t => t.breakthroughs);
  const sortedBreakthroughs = allBreakthroughs.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const now = new Date();
  const daysSinceLastBreakthrough = sortedBreakthroughs.length > 0
    ? Math.round(
        (now.getTime() - new Date(sortedBreakthroughs[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
      )
    : -1;

  // Generate prediction
  const prediction = generatePrediction(trajectories, overallLearningRate, daysSinceLastBreakthrough);

  return {
    computedAt: now.toISOString(),
    trajectories,
    overallLearningRate,
    daysSinceLastBreakthrough,
    prediction,
  };
}

function generatePrediction(
  trajectories: SkillTrajectory[],
  learningRate: number,
  daysSinceBreakthrough: number
): string {
  const improving = trajectories.filter(t => t.trend === 'improving');
  const declining = trajectories.filter(t => t.trend === 'declining');
  const plateaued = trajectories.filter(t =>
    t.trend === 'stable' && t.plateaus.length > 0
  );

  const parts: string[] = [];

  if (improving.length > 0) {
    parts.push(
      `Improving in: ${improving.map(t => t.taskType).join(', ')} ` +
      `(rate: +${round(learningRate * 100, 1)}% efficiency per session)`
    );
  }

  if (plateaued.length > 0) {
    parts.push(
      `Plateaued in: ${plateaued.map(t => t.taskType).join(', ')}. ` +
      `Consider: new strategies, different approaches, or more challenging variants to break through`
    );
  }

  if (declining.length > 0) {
    parts.push(
      `Declining in: ${declining.map(t => t.taskType).join(', ')}. ` +
      `Possible causes: codebase growing more complex, strategies becoming stale, or task difficulty increasing`
    );
  }

  if (daysSinceBreakthrough > 14) {
    parts.push(
      `No breakthrough in ${daysSinceBreakthrough} days — the system may benefit from deep extraction (--deep) or manual strategy review`
    );
  }

  if (parts.length === 0) {
    parts.push('Insufficient data for predictions. Continue collecting session data.');
  }

  return parts.join('. ');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
