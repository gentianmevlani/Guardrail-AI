/**
 * Predictive Strategy Engine
 * ==========================
 * Predicts which strategies will be relevant BEFORE the session starts.
 *
 * This is the "pre-cognition" layer. Instead of dumping all strategies
 * into CLAUDE_STRATEGIES.md and hoping the right ones get noticed,
 * this engine ranks strategies by predicted relevance given:
 *
 * 1. Session intent (what type of task?)
 * 2. Cognitive fingerprint (what are this agent's tendencies?)
 * 3. Active context (which files are in scope?)
 * 4. Historical hit rates (how often did this strategy actually help?)
 * 5. Temporal context (time of day, session number, fatigue)
 *
 * The output is a ranked list with risk assessments:
 * "If you DON'T load this strategy, here's what's likely to go wrong."
 */

import type { Strategy, StrategyIndex } from '../types/decision-graph';
import type {
  SessionIntent,
  CognitiveFingerprint,
  StrategyPrediction,
  PredictiveContext,
  TaskType,
} from '../types/metacognition';

// ─── Strategy-Intent Affinity Matrix ────────────────────────────────────────

/**
 * How relevant is a given strategy tag/scope for a given task type?
 * This is the "prior" — learned from cross-session analysis.
 */
const TASK_STRATEGY_AFFINITY: Record<string, Partial<Record<TaskType, number>>> = {
  'anti-pattern': {
    'bug-fix': 0.9,
    'debug': 0.8,
    'feature': 0.5,
    'refactor': 0.4,
    'migration': 0.7,
  },
  'convergence': {
    'feature': 0.8,
    'refactor': 0.7,
    'bug-fix': 0.6,
    'migration': 0.5,
  },
  'module-checkpoint': {
    'feature': 0.9,
    'refactor': 0.8,
    'bug-fix': 0.7,
    'debug': 0.6,
    'performance': 0.5,
  },
  'llm-extracted': {
    'bug-fix': 0.7,
    'feature': 0.7,
    'debug': 0.8,
    'refactor': 0.6,
    'migration': 0.6,
  },
};

// ─── Prediction Logic ───────────────────────────────────────────────────────

/**
 * Compute relevance probability based on intent matching
 */
function computeIntentRelevance(strategy: Strategy, intent: SessionIntent): number {
  let score = 0;

  // Tag-based affinity
  for (const tag of strategy.tags) {
    const affinities = TASK_STRATEGY_AFFINITY[tag];
    if (affinities) {
      score += affinities[intent.taskType] || 0.3;
      for (const secondary of intent.secondaryTypes) {
        score += (affinities[secondary] || 0.2) * 0.5;
      }
    }
  }

  // Module area overlap with domains
  for (const area of strategy.triggerPattern.moduleAreas) {
    const areaLower = area.toLowerCase();
    for (const domain of intent.domains) {
      if (areaLower.includes(domain) || domain.includes(areaLower)) {
        score += 0.3;
      }
    }
  }

  // Keyword overlap with signals
  for (const keyword of strategy.triggerPattern.promptKeywords) {
    if (intent.signals.some(s => s.toLowerCase().includes(keyword))) {
      score += 0.2;
    }
  }

  return Math.min(1.0, score / 3); // Normalize
}

/**
 * Compute relevance based on active file context
 */
function computeFileRelevance(strategy: Strategy, activeFiles: string[]): number {
  if (activeFiles.length === 0) return 0.3; // No context = slight default

  let matches = 0;
  for (const pattern of strategy.triggerPattern.filePatterns) {
    const patternLower = pattern.toLowerCase();
    for (const file of activeFiles) {
      const fileLower = file.toLowerCase();
      if (fileLower.includes(patternLower) || patternLower.includes(fileLower)) {
        matches++;
        break;
      }
    }
  }

  for (const area of strategy.triggerPattern.moduleAreas) {
    const areaLower = area.toLowerCase();
    if (activeFiles.some(f => f.toLowerCase().includes(areaLower))) {
      matches++;
    }
  }

  const totalPatterns = strategy.triggerPattern.filePatterns.length + strategy.triggerPattern.moduleAreas.length;
  return totalPatterns > 0 ? Math.min(1.0, matches / Math.min(totalPatterns, 3)) : 0.3;
}

/**
 * Compute expected success rate based on historical performance
 * and cognitive fingerprint alignment
 */
function computeExpectedSuccess(
  strategy: Strategy,
  fingerprint: CognitiveFingerprint,
  intent: SessionIntent
): number {
  // Base rate from strategy's own track record
  let baseRate = strategy.injectionCount > 0
    ? strategy.successCount / strategy.injectionCount
    : 0.5; // No data = assume 50/50

  // Adjust based on fingerprint — if the agent is strong at this task type,
  // strategies are less critical (but still useful)
  const taskProfile = fingerprint.taskProfiles.find(p => p.taskType === intent.taskType);
  if (taskProfile) {
    // If agent is already good at this, strategy adds marginal value
    // If agent struggles, strategy is more valuable
    const strengthFactor = 1.0 - taskProfile.relativeStrength * 0.3;
    baseRate *= Math.max(0.5, Math.min(1.5, strengthFactor));
  }

  // Adjust based on strategy confidence
  baseRate *= strategy.confidence;

  return Math.min(0.95, Math.max(0.05, baseRate));
}

/**
 * Assess risk if this strategy is omitted
 */
function assessOmissionRisk(
  strategy: Strategy,
  intent: SessionIntent,
  fingerprint: CognitiveFingerprint
): StrategyPrediction['riskIfOmitted'] {
  // Anti-pattern strategies are highest risk to omit
  if (strategy.tags.includes('anti-pattern')) {
    const isWeakArea = fingerprint.weaknesses.some(w =>
      strategy.triggerPattern.moduleAreas.some(m => w.includes(m))
    );
    if (isWeakArea) return 'high';
    return 'medium';
  }

  // High-confidence strategies with many evidence sessions
  if (strategy.confidence > 0.8 && strategy.supportingEvidence.length >= 3) {
    return 'medium';
  }

  // Module checkpoints for complex tasks
  if (strategy.tags.includes('module-checkpoint') && intent.complexity === 'complex') {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate reasoning for why this strategy was predicted
 */
function generateReasoning(
  strategy: Strategy,
  intentScore: number,
  fileScore: number,
  successScore: number,
  intent: SessionIntent
): string {
  const reasons: string[] = [];

  if (intentScore > 0.5) {
    reasons.push(`high affinity with ${intent.taskType} tasks`);
  }
  if (fileScore > 0.5) {
    reasons.push('active files match trigger patterns');
  }
  if (strategy.tags.includes('anti-pattern')) {
    reasons.push('prevents known failure mode');
  }
  if (strategy.confidence > 0.8) {
    reasons.push(`high confidence (${Math.round(strategy.confidence * 100)}%)`);
  }
  if (strategy.supportingEvidence.length > 3) {
    reasons.push(`backed by ${strategy.supportingEvidence.length} sessions`);
  }

  return reasons.length > 0 ? reasons.join('; ') : 'baseline relevance';
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Predict which strategies will be relevant for the upcoming session.
 * Returns predictions sorted by combined score (relevance × expected success).
 */
export function predictStrategies(
  index: StrategyIndex,
  context: PredictiveContext
): StrategyPrediction[] {
  const predictions: StrategyPrediction[] = [];

  for (const strategy of index.strategies) {
    const intentScore = computeIntentRelevance(strategy, context.intent);
    const fileScore = computeFileRelevance(strategy, context.activeFiles);
    const successScore = computeExpectedSuccess(strategy, context.fingerprint, context.intent);

    // Combined relevance: weighted average of intent and file signals
    const relevanceProbability = Math.min(
      0.95,
      intentScore * 0.5 + fileScore * 0.35 + strategy.confidence * 0.15
    );

    const combinedScore = relevanceProbability * successScore;

    predictions.push({
      strategyId: strategy.id,
      relevanceProbability: round(relevanceProbability, 3),
      expectedSuccessRate: round(successScore, 3),
      combinedScore: round(combinedScore, 3),
      reasoning: generateReasoning(strategy, intentScore, fileScore, successScore, context.intent),
      riskIfOmitted: assessOmissionRisk(strategy, context.intent, context.fingerprint),
    });
  }

  return predictions.sort((a, b) => b.combinedScore - a.combinedScore);
}

/**
 * Select the top N strategies based on predictions, with token budget awareness.
 * This is what actually decides which strategies get injected into the markdown.
 */
export function selectStrategiesForInjection(
  index: StrategyIndex,
  predictions: StrategyPrediction[],
  options: {
    maxStrategies?: number;
    maxTokens?: number;
    includeHighRisk?: boolean;
  } = {}
): Strategy[] {
  const maxStrategies = options.maxStrategies || 15;
  const maxTokens = options.maxTokens || 4000;
  const charsPerToken = 4;

  const selected: Strategy[] = [];
  let totalChars = 0;

  // First pass: always include high-risk-if-omitted strategies
  if (options.includeHighRisk !== false) {
    for (const pred of predictions) {
      if (pred.riskIfOmitted === 'high' && selected.length < maxStrategies) {
        const strategy = index.strategies.find(s => s.id === pred.strategyId);
        if (strategy) {
          const chars = strategy.content.length + 100; // Account for markdown formatting
          if (totalChars + chars <= maxTokens * charsPerToken) {
            selected.push(strategy);
            totalChars += chars;
          }
        }
      }
    }
  }

  // Second pass: fill remaining slots by combined score
  for (const pred of predictions) {
    if (selected.length >= maxStrategies) break;
    if (selected.some(s => s.id === pred.strategyId)) continue; // Already added

    const strategy = index.strategies.find(s => s.id === pred.strategyId);
    if (strategy) {
      const chars = strategy.content.length + 100;
      if (totalChars + chars <= maxTokens * charsPerToken) {
        selected.push(strategy);
        totalChars += chars;
      }
    }
  }

  return selected;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
