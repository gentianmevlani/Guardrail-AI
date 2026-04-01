/**
 * Pre-mortem Simulator
 * ====================
 * Before a session starts, simulates what will PROBABLY go wrong.
 *
 * A pre-mortem inverts the question: instead of "how do I succeed?"
 * it asks "assuming I failed, what went wrong?" This is a proven
 * technique from decision science (Gary Klein, 2007).
 *
 * Given:
 * - The session intent (task type, domain, complexity)
 * - The cognitive fingerprint (agent's tendencies)
 * - The epistemic map (what's known vs unknown)
 * - Historical failure patterns
 *
 * The simulator predicts specific failure modes with probabilities,
 * early warning signs, and prevention strategies. This gets injected
 * into the session briefing so the agent is pre-armed against its
 * own likely mistakes.
 */

import type { DecisionGraph } from '../types/decision-graph';
import type { SessionIntent, CognitiveFingerprint } from '../types/metacognition';
import type { PreMortem, FailurePrediction, FailureMode, EpistemicMap } from '../types/consciousness';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Failure Mode Signatures ────────────────────────────────────────────────

interface FailureSignature {
  mode: FailureMode;
  /** What session patterns indicate this failure occurred */
  detector: (graph: DecisionGraph) => boolean;
  /** What this failure typically costs */
  typicalCost: number;
  earlyWarning: string;
  prevention: string;
}

const FAILURE_SIGNATURES: FailureSignature[] = [
  {
    mode: 'wrong-file-first',
    detector: (g) => {
      const firstAction = g.nodes.find(n => n.type === 'action' && n.toolCall?.name === 'Read');
      if (!firstAction) return false;
      return firstAction.filesTouched.some(f =>
        g.metrics.filesInvestigatedNotResolution.includes(f)
      ) && !firstAction.filesTouched.some(f =>
        g.metrics.filesModifiedAsResolution.includes(f)
      );
    },
    typicalCost: 5,
    earlyWarning: 'First file opened is not in the resolution path',
    prevention: 'Read error messages, stack traces, and test output to identify the RIGHT file before exploring',
  },
  {
    mode: 'premature-edit',
    detector: (g) => {
      const actions = g.nodes.filter(n => n.type === 'action' && n.toolCall);
      const firstEdit = actions.findIndex(n =>
        ['Write', 'Edit', 'MultiEdit'].includes(n.toolCall?.name || '')
      );
      const readsBefore = actions.slice(0, firstEdit).filter(n =>
        n.toolCall?.name === 'Read'
      ).length;
      return firstEdit !== -1 && readsBefore < 2;
    },
    typicalCost: 8,
    earlyWarning: 'Editing a file before reading at least 2 relevant files',
    prevention: 'Always read the file being modified + at least one related file before making changes',
  },
  {
    mode: 'scope-creep',
    detector: (g) => {
      const uniqueFiles = new Set([
        ...g.metrics.filesModifiedAsResolution,
        ...g.metrics.filesInvestigatedNotResolution,
      ]);
      return uniqueFiles.size > 15 && g.metrics.totalToolCalls > 30;
    },
    typicalCost: 15,
    earlyWarning: 'Touching more than 10 files or exceeding 25 tool calls',
    prevention: 'Before expanding scope, ask: "Is this necessary for the SPECIFIC task requested?"',
  },
  {
    mode: 'tool-thrashing',
    detector: (g) => {
      let switches = 0;
      const actions = g.nodes.filter(n => n.type === 'action' && n.toolCall);
      for (let i = 1; i < actions.length; i++) {
        if (actions[i].toolCall?.name !== actions[i - 1].toolCall?.name &&
            actions[i].filesTouched.some(f => actions[i - 1].filesTouched.includes(f))) {
          switches++;
        }
      }
      return switches >= 3;
    },
    typicalCost: 6,
    earlyWarning: 'Switching tools on the same file more than twice',
    prevention: 'Choose the right tool ONCE: Read for understanding, Grep for searching, Edit for changes',
  },
  {
    mode: 'hypothesis-fixation',
    detector: (g) => {
      const hypotheses = g.nodes.filter(n => n.type === 'hypothesis');
      const corrections = g.nodes.filter(n => n.type === 'correction' || n.type === 'backtrack');
      return hypotheses.length <= 1 && corrections.length >= 2;
    },
    typicalCost: 10,
    earlyWarning: 'Pursuing a single hypothesis despite mounting contradictory evidence',
    prevention: 'After the first failure or correction, explicitly generate 2-3 alternative hypotheses',
  },
  {
    mode: 'escalation-avoidance',
    detector: (g) => {
      return g.metrics.backtrackCount >= 3 &&
             g.nodes.filter(n => n.type === 'escalation').length === 0 &&
             g.metrics.totalToolCalls > 20;
    },
    typicalCost: 12,
    earlyWarning: 'More than 3 backtracks without asking the user for help',
    prevention: 'After 2 backtracks on the same issue, ask the user for clarification instead of trying again',
  },
  {
    mode: 'test-blindness',
    detector: (g) => {
      const touchesCode = g.nodes.some(n =>
        n.toolCall && ['Write', 'Edit', 'MultiEdit'].includes(n.toolCall.name) &&
        n.filesTouched.some(f => /\.(ts|js|tsx|jsx|py|rs|go)$/.test(f) && !/(test|spec)/.test(f))
      );
      const touchesTests = g.nodes.some(n =>
        n.filesTouched.some(f => /(test|spec)\.(ts|js|tsx|jsx)$/.test(f) || f.includes('__tests__'))
      );
      return touchesCode && !touchesTests;
    },
    typicalCost: 4,
    earlyWarning: 'Modifying source code without checking related tests',
    prevention: 'After any code change, check if tests exist and whether they still pass',
  },
  {
    mode: 'type-error-spiral',
    detector: (g) => {
      const typeErrorNodes = g.nodes.filter(n =>
        n.reasoning.toLowerCase().includes('type error') ||
        n.reasoning.toLowerCase().includes('type \'') ||
        n.reasoning.toLowerCase().includes('is not assignable')
      );
      return typeErrorNodes.length >= 3;
    },
    typicalCost: 8,
    earlyWarning: 'Encountering the same or similar type error more than twice',
    prevention: 'Step back and understand the type hierarchy holistically rather than fixing one error at a time',
  },
  {
    mode: 'overengineering',
    detector: (g) => {
      const writtenFiles = g.nodes
        .filter(n => n.toolCall && ['Write'].includes(n.toolCall.name))
        .flatMap(n => n.filesTouched);
      const newFiles = writtenFiles.length;
      return newFiles >= 3 && g.metrics.totalToolCalls > 25;
    },
    typicalCost: 10,
    earlyWarning: 'Creating 3+ new files for what should be a localized change',
    prevention: 'Before creating a new file, ask: "Can this be done by modifying an existing file?"',
  },
  {
    mode: 'silent-regression',
    detector: (g) => {
      const editedFiles = g.nodes
        .filter(n => n.toolCall && ['Edit', 'MultiEdit'].includes(n.toolCall.name))
        .flatMap(n => n.filesTouched);
      const ranTests = g.nodes.some(n =>
        n.toolCall?.name === 'Bash' &&
        /\b(test|jest|vitest|mocha|pytest|cargo test|go test)\b/i.test(
          String((n.toolCall.input as Record<string, unknown>).command || '')
        )
      );
      return editedFiles.length >= 2 && !ranTests;
    },
    typicalCost: 6,
    earlyWarning: 'Editing multiple files without running the test suite',
    prevention: 'Run tests after every significant code change, not just at the end',
  },
];

// ─── Failure Rate Computation ───────────────────────────────────────────────

/**
 * Compute historical failure rates from past sessions.
 * Uses domain-specific subsets when available for more accurate predictions.
 */
function computeHistoricalRates(
  graphs: DecisionGraph[],
  intent: SessionIntent
): Map<FailureMode, number> {
  const rates = new Map<FailureMode, number>();

  if (graphs.length === 0) return rates;

  // Filter to sessions matching the intent's domains for domain-specific rates
  // Fall back to global rates if < 5 domain-matched sessions
  const domainMatched = intent.domains.length > 0
    ? graphs.filter(g => {
        const sessionIntent = classifySessionIntent(g);
        return sessionIntent.domains.some(d => intent.domains.includes(d));
      })
    : [];

  const relevantGraphs = domainMatched.length >= 5 ? domainMatched : graphs;

  for (const sig of FAILURE_SIGNATURES) {
    const occurrences = relevantGraphs.filter(g => sig.detector(g)).length;
    rates.set(sig.mode, occurrences / relevantGraphs.length);
  }

  return rates;
}

// ─── Context-Adjusted Probability ───────────────────────────────────────────

/**
 * Adjust failure probability based on the specific context.
 */
function adjustProbability(
  baseRate: number,
  mode: FailureMode,
  intent: SessionIntent,
  fingerprint: CognitiveFingerprint,
  epistemicMap?: EpistemicMap
): number {
  let probability = baseRate;

  // Task complexity amplifies failure probability
  const complexityMultiplier: Record<string, number> = {
    trivial: 0.5, simple: 0.7, moderate: 1.0, complex: 1.3, epic: 1.6,
  };
  probability *= complexityMultiplier[intent.complexity] || 1.0;

  // Domain unfamiliarity amplifies failure
  if (epistemicMap) {
    const domainCertainty = intent.domains.map(d => {
      const domain = epistemicMap.domains.find(ed => ed.domain === d);
      return domain?.certainty || 0.1;
    });
    const avgCertainty = domainCertainty.length > 0
      ? domainCertainty.reduce((a, b) => a + b, 0) / domainCertainty.length
      : 0.5;

    // Low certainty = higher failure probability
    probability *= (2 - avgCertainty);
  }

  // Fingerprint adjustments
  for (const dim of fingerprint.dimensions) {
    if (mode === 'premature-edit' && dim.name === 'caution-boldness') {
      // Bold agents are more likely to edit prematurely
      probability *= (2 - dim.score); // Low caution = higher probability
    }
    if (mode === 'scope-creep' && dim.name === 'efficiency-thoroughness') {
      // Thorough agents are more likely to scope creep
      probability *= (1 + dim.score * 0.5);
    }
    if (mode === 'escalation-avoidance' && dim.name === 'persistence-pivoting') {
      // Persistent agents are more likely to avoid escalation
      probability *= (1 + dim.score * 0.5);
    }
    if (mode === 'wrong-file-first' && dim.name === 'exploration-exploitation') {
      // Exploiters who go straight to target might pick wrong target
      probability *= (2 - dim.score);
    }
  }

  return Math.min(0.95, Math.max(0.01, probability));
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run a pre-mortem simulation: predict what will go wrong in the upcoming session.
 */
export function runPreMortem(
  intent: SessionIntent,
  fingerprint: CognitiveFingerprint,
  historicalGraphs: DecisionGraph[],
  epistemicMap?: EpistemicMap
): PreMortem {
  const historicalRates = computeHistoricalRates(historicalGraphs, intent);

  const predictions: FailurePrediction[] = FAILURE_SIGNATURES.map(sig => {
    const baseRate = historicalRates.get(sig.mode) || 0.1;
    const adjustedProb = adjustProbability(
      baseRate, sig.mode, intent, fingerprint, epistemicMap
    );

    return {
      mode: sig.mode,
      probability: round(adjustedProb, 3),
      trigger: describeFailureTrigger(sig.mode, intent),
      earlyWarning: sig.earlyWarning,
      prevention: sig.prevention,
      expectedCost: sig.typicalCost,
      historicalRate: round(baseRate, 3),
    };
  });

  // Sort by risk (probability × cost)
  predictions.sort((a, b) => (b.probability * b.expectedCost) - (a.probability * a.expectedCost));

  // Overall risk
  const topRisk = predictions[0]?.probability || 0;
  const overallRisk: PreMortem['overallRisk'] =
    topRisk > 0.6 ? 'critical'
    : topRisk > 0.4 ? 'high'
    : topRisk > 0.2 ? 'moderate'
    : 'low';

  // Top warning
  const topPrediction = predictions[0];
  const topWarning = topPrediction
    ? `Highest risk: ${topPrediction.mode} (${Math.round(topPrediction.probability * 100)}% likely, ~${topPrediction.expectedCost} wasted steps). ${topPrediction.prevention}`
    : 'No significant risks predicted.';

  // Preparation steps
  const preparation = predictions
    .filter(p => p.probability > 0.15)
    .slice(0, 5)
    .map(p => p.prevention);

  return {
    intent,
    generatedAt: new Date().toISOString(),
    predictions,
    overallRisk,
    topWarning,
    preparation,
  };
}

function describeFailureTrigger(mode: FailureMode, intent: SessionIntent): string {
  const domain = intent.domains[0] || 'this area';

  const triggers: Record<FailureMode, string> = {
    'wrong-file-first': `Opening a file in ${domain} based on filename guessing rather than error analysis`,
    'premature-edit': `Starting to edit before understanding the ${intent.taskType} context fully`,
    'scope-creep': `Expanding beyond the requested ${intent.taskType} into adjacent cleanup or improvements`,
    'tool-thrashing': `Switching between Read/Edit/Grep on the same files without clear purpose`,
    'hypothesis-fixation': `Locking onto the first theory about this ${intent.taskType} and ignoring alternatives`,
    'escalation-avoidance': `Trying 3+ approaches without asking the user when stuck on ${intent.taskType}`,
    'test-blindness': `Making changes in ${domain} without checking or running related tests`,
    'config-confusion': `Misunderstanding configuration in ${domain} due to env/config complexity`,
    'type-error-spiral': `Chasing TypeScript type errors one at a time instead of understanding the type graph`,
    'dependency-hell': `Getting stuck resolving package or import dependency issues`,
    'silent-regression': `Breaking existing behavior while fixing something in ${domain}`,
    'overengineering': `Building abstractions or extra files beyond what the ${intent.taskType} requires`,
  };

  return triggers[mode] || `Encountering ${mode} during ${intent.taskType}`;
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
