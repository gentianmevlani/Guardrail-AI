/**
 * Metacognitive Reflection Engine
 * ================================
 * After each session, generates a REFLECTION — not just "what happened"
 * but "WHY it happened that way" and "what should change."
 *
 * This is the self-awareness layer. It detects:
 * - Causal chains: "The bug was misidentified BECAUSE the error message was misleading"
 * - Counterfactuals: "If the agent had read the test file first, 7 steps would have been saved"
 * - Momentum shifts: "The agent was in flow until the TypeScript error, then started thrashing"
 * - Transfer opportunities: "This is the same pattern as the auth session last week"
 * - Adaptations: specific behavioral changes for next time
 *
 * Humans do this naturally (reflection, journaling, retrospectives).
 * For an AI agent, it's the difference between repeating mistakes and learning.
 */

import type { DecisionGraph, DecisionNode, DecisionEdge } from '../types/decision-graph';
import type {
  MetacognitiveReflection,
  ReflectionInsight,
  ReflectionInsightType,
  SessionIntent,
} from '../types/metacognition';
import { classifySessionIntent } from '../classifier/classifier';

// ─── Flow State Detection ───────────────────────────────────────────────────

type FlowState = MetacognitiveReflection['momentum']['flowState'];

interface FlowSegment {
  startIdx: number;
  endIdx: number;
  state: FlowState;
  nodes: DecisionNode[];
}

/**
 * Detect flow state for a segment of the session.
 * Flow = productive actions without backtracks or corrections.
 * Thrashing = rapid backtracks, corrections, repeated tool calls on same files.
 */
function classifyFlowState(nodes: DecisionNode[]): FlowState {
  if (nodes.length === 0) return 'mixed';

  const actions = nodes.filter(n => n.type === 'action').length;
  const backtracks = nodes.filter(n => n.type === 'backtrack').length;
  const corrections = nodes.filter(n => n.type === 'correction').length;

  const totalSignificant = actions + backtracks + corrections;
  if (totalSignificant === 0) return 'mixed';

  const disruptionRate = (backtracks + corrections) / totalSignificant;

  // Check for repeated file access (sign of thrashing)
  const fileCounts = new Map<string, number>();
  for (const n of nodes) {
    for (const f of n.filesTouched) {
      fileCounts.set(f, (fileCounts.get(f) || 0) + 1);
    }
  }
  const maxRevisits = Math.max(0, ...[...fileCounts.values()]);

  if (disruptionRate === 0 && actions >= 5) return 'deep-flow';
  if (disruptionRate < 0.1 && maxRevisits <= 2) return 'productive';
  if (disruptionRate > 0.4 || maxRevisits > 5) return 'thrashing';
  if (backtracks + corrections > actions) return 'stuck';
  return 'mixed';
}

/**
 * Segment the session into flow phases and detect momentum shifts.
 */
function analyzeFlowDynamics(graph: DecisionGraph): MetacognitiveReflection['momentum'] {
  const windowSize = 5;
  const segments: FlowSegment[] = [];

  for (let i = 0; i < graph.nodes.length; i += Math.max(1, Math.floor(windowSize / 2))) {
    const window = graph.nodes.slice(i, i + windowSize);
    if (window.length < 2) break;

    segments.push({
      startIdx: i,
      endIdx: i + window.length - 1,
      state: classifyFlowState(window),
      nodes: window,
    });
  }

  // Detect shifts between segments
  const shifts: MetacognitiveReflection['momentum']['shifts'] = [];
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];

    if (prev.state !== curr.state) {
      // Find the node that triggered the shift
      const triggerNode = curr.nodes[0];
      let trigger = 'unknown';

      if (triggerNode.type === 'correction') {
        trigger = 'user correction';
      } else if (triggerNode.type === 'backtrack') {
        trigger = 'agent backtrack';
      } else if (triggerNode.toolCall && !triggerNode.toolCall.succeeded) {
        trigger = `tool failure (${triggerNode.toolCall.name})`;
      } else if (triggerNode.toolCall?.error) {
        trigger = `error: ${triggerNode.toolCall.error.slice(0, 80)}`;
      } else {
        trigger = `context shift at ${triggerNode.type} node`;
      }

      shifts.push({
        fromState: prev.state,
        toState: curr.state,
        atNodeId: triggerNode.id,
        trigger,
      });
    }
  }

  // Overall flow state = mode of segments
  const stateCounts = new Map<FlowState, number>();
  for (const seg of segments) {
    stateCounts.set(seg.state, (stateCounts.get(seg.state) || 0) + 1);
  }
  const overallState = [...stateCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

  return { flowState: overallState, shifts };
}

// ─── Causal Chain Analysis ──────────────────────────────────────────────────

/**
 * Find causal chains: sequences where one decision led to consequences.
 */
function findCausalInsights(graph: DecisionGraph): ReflectionInsight[] {
  const insights: ReflectionInsight[] = [];
  const { nodes, edges } = graph;

  // Pattern: action → (several steps) → backtrack/correction
  // = the action CAUSED the eventual need to backtrack
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'backtrack' && node.type !== 'correction') continue;

    // Look back to find the "wrong turn" action
    const wrongTurnChain: DecisionNode[] = [];
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      wrongTurnChain.unshift(nodes[j]);
      if (nodes[j].type === 'user_request' || nodes[j].type === 'correction') break;
    }

    if (wrongTurnChain.length < 2) continue;

    const wrongTurn = wrongTurnChain[0];
    const wastedSteps = wrongTurnChain.filter(n => n.type === 'action').length;

    if (wastedSteps >= 2) {
      const wrongFiles = wrongTurn.filesTouched.join(', ') || 'unknown files';
      const resolutionFiles = graph.metrics.filesModifiedAsResolution.slice(0, 3).join(', ') || 'other files';

      insights.push({
        type: 'causal',
        content: `Investigated ${wrongFiles} (${wastedSteps} steps) before ${node.type === 'correction' ? 'user redirected' : 'self-correcting'}. Resolution was in ${resolutionFiles}. The initial investigation path was likely triggered by surface-level pattern matching rather than deeper analysis of the actual error.`,
        confidence: Math.min(0.9, 0.5 + wastedSteps * 0.1),
        evidenceNodeIds: [wrongTurn.id, node.id],
      });
    }
  }

  return insights;
}

// ─── Counterfactual Analysis ────────────────────────────────────────────────

/**
 * Generate counterfactual insights: "If I had done X instead..."
 */
function findCounterfactualInsights(graph: DecisionGraph): ReflectionInsight[] {
  const insights: ReflectionInsight[] = [];
  const { metrics } = graph;

  // Counterfactual: going directly to resolution files
  if (metrics.filesInvestigatedNotResolution.length > 2 && metrics.filesModifiedAsResolution.length > 0) {
    const wastedReads = graph.nodes.filter(n =>
      n.type === 'action' &&
      n.toolCall?.name === 'Read' &&
      n.filesTouched.some(f => metrics.filesInvestigatedNotResolution.includes(f))
    ).length;

    if (wastedReads >= 3) {
      insights.push({
        type: 'counterfactual',
        content: `If the agent had gone directly to ${metrics.filesModifiedAsResolution.slice(0, 3).join(', ')}, approximately ${wastedReads} read operations on false-lead files could have been avoided. Key question: what signal in the initial prompt or error should have pointed to the resolution files?`,
        confidence: 0.7,
        evidenceNodeIds: [],
      });
    }
  }

  // Counterfactual: using the right tool first
  const toolSwitches = graph.nodes.filter((n, i) =>
    i > 0 &&
    n.type === 'action' &&
    graph.nodes[i - 1].type === 'action' &&
    n.toolCall?.name !== graph.nodes[i - 1].toolCall?.name &&
    n.filesTouched.some(f => graph.nodes[i - 1].filesTouched.includes(f))
  );

  if (toolSwitches.length >= 2) {
    insights.push({
      type: 'counterfactual',
      content: `Tool switching on same files happened ${toolSwitches.length} times. If the right tool had been chosen first, these redundant operations could have been avoided. Consider: Read for understanding, Grep for searching, Edit for known changes.`,
      confidence: 0.6,
      evidenceNodeIds: toolSwitches.map(n => n.id),
    });
  }

  return insights;
}

// ─── Metacognitive Pattern Detection ────────────────────────────────────────

/**
 * Detect metacognitive patterns: tendencies in how the agent reasons.
 */
function findMetacognitiveInsights(graph: DecisionGraph): ReflectionInsight[] {
  const insights: ReflectionInsight[] = [];

  // Pattern: premature hypothesis (hypothesis before sufficient evidence)
  const hypothesisBeforeRead = graph.nodes.filter((n, i) => {
    if (n.type !== 'hypothesis') return false;
    const priorReads = graph.nodes.slice(0, i).filter(p =>
      p.type === 'action' && p.toolCall?.name === 'Read'
    ).length;
    return priorReads < 2;
  });

  if (hypothesisBeforeRead.length > 0) {
    insights.push({
      type: 'metacognitive',
      content: `Formed ${hypothesisBeforeRead.length} hypothesis/hypotheses before reading more than 1 file. This "hypothesis-first" tendency can lead to confirmation bias — the agent may seek evidence that confirms the initial theory rather than exploring alternatives.`,
      confidence: 0.6,
      evidenceNodeIds: hypothesisBeforeRead.map(n => n.id),
    });
  }

  // Pattern: escalation avoidance (agent should have asked user but didn't)
  const longStuckPeriods = findStuckPeriods(graph.nodes);
  if (longStuckPeriods.length > 0) {
    insights.push({
      type: 'metacognitive',
      content: `${longStuckPeriods.length} period(s) of sustained ineffective work detected (5+ actions without progress). Consider asking the user for clarification earlier when the problem isn't clear.`,
      confidence: 0.5,
      evidenceNodeIds: longStuckPeriods.flatMap(p => p.map(n => n.id)),
    });
  }

  return insights;
}

function findStuckPeriods(nodes: DecisionNode[]): DecisionNode[][] {
  const periods: DecisionNode[][] = [];
  let current: DecisionNode[] = [];

  for (const node of nodes) {
    if (node.type === 'action' || node.type === 'backtrack') {
      current.push(node);
    } else if (node.type === 'resolution' || node.type === 'user_request' || node.type === 'correction') {
      if (current.length >= 5) {
        const backtracks = current.filter(n => n.type === 'backtrack').length;
        if (backtracks >= 2) {
          periods.push(current);
        }
      }
      current = [];
    }
  }

  if (current.length >= 5) {
    const backtracks = current.filter(n => n.type === 'backtrack').length;
    if (backtracks >= 2) {
      periods.push(current);
    }
  }

  return periods;
}

// ─── Strategic Insights ─────────────────────────────────────────────────────

function findStrategicInsights(graph: DecisionGraph, intent: SessionIntent): ReflectionInsight[] {
  const insights: ReflectionInsight[] = [];

  // What should change next time for this task type?
  if (!graph.metrics.apparentSuccess) {
    insights.push({
      type: 'strategic',
      content: `Session did not reach apparent success for ${intent.taskType} task. For future ${intent.taskType} sessions in ${intent.domains.join('/')} domain: consider starting with a broader file search before diving into specific files.`,
      confidence: 0.5,
      evidenceNodeIds: [],
    });
  }

  // If high efficiency, capture what went right
  const productive = graph.nodes.filter(n =>
    n.type === 'action' && n.filesTouched.some(f =>
      graph.metrics.filesModifiedAsResolution.includes(f)
    )
  ).length;
  const total = graph.metrics.totalToolCalls;
  const efficiency = total > 0 ? productive / total : 0;

  if (efficiency > 0.6 && graph.metrics.backtrackCount === 0) {
    insights.push({
      type: 'strategic',
      content: `High-efficiency session (${Math.round(efficiency * 100)}% productive actions, zero backtracks). This ${intent.taskType} approach worked well — the direct path was found quickly. Reinforce this pattern for similar ${intent.domains.join('/')} tasks.`,
      confidence: 0.8,
      evidenceNodeIds: [],
    });
  }

  return insights;
}

// ─── Adaptation Generation ──────────────────────────────────────────────────

function generateAdaptations(
  graph: DecisionGraph,
  intent: SessionIntent,
  insights: ReflectionInsight[]
): MetacognitiveReflection['adaptations'] {
  const adaptations: MetacognitiveReflection['adaptations'] = [];

  // Adaptation from causal insights
  const causalInsights = insights.filter(i => i.type === 'causal');
  if (causalInsights.length > 0) {
    const wrongFiles = graph.metrics.filesInvestigatedNotResolution.slice(0, 3);
    const rightFiles = graph.metrics.filesModifiedAsResolution.slice(0, 3);

    if (wrongFiles.length > 0 && rightFiles.length > 0) {
      adaptations.push({
        trigger: `Working on ${intent.taskType} in ${intent.domains[0] || 'this'} domain`,
        currentBehavior: `Investigating ${wrongFiles.join(', ')} first`,
        proposedBehavior: `Check ${rightFiles.join(', ')} first — these are where resolutions typically occur`,
        expectedImprovement: `Save ~${causalInsights.length * 3} investigation steps`,
      });
    }
  }

  // Adaptation from flow analysis
  const stuckInsights = insights.filter(i =>
    i.type === 'metacognitive' && i.content.includes('sustained ineffective')
  );
  if (stuckInsights.length > 0) {
    adaptations.push({
      trigger: 'More than 5 actions without visible progress',
      currentBehavior: 'Continue trying variations of the same approach',
      proposedBehavior: 'Stop and ask the user for clarification, or try a fundamentally different approach',
      expectedImprovement: 'Reduce thrashing episodes, get unstuck faster',
    });
  }

  // Adaptation from tool switching
  const toolInsights = insights.filter(i =>
    i.type === 'counterfactual' && i.content.includes('Tool switching')
  );
  if (toolInsights.length > 0) {
    adaptations.push({
      trigger: 'About to interact with a file',
      currentBehavior: 'Try one tool, then switch to another on the same file',
      proposedBehavior: 'Decide the right tool upfront: Read for understanding, Grep for searching, Edit for known changes',
      expectedImprovement: 'Eliminate redundant file operations',
    });
  }

  return adaptations;
}

// ─── Narrative Generation ───────────────────────────────────────────────────

function generateNarrative(
  graph: DecisionGraph,
  intent: SessionIntent,
  flowDynamics: MetacognitiveReflection['momentum'],
  insights: ReflectionInsight[]
): string {
  const { metrics } = graph;
  const parts: string[] = [];

  // Opening: what was attempted
  parts.push(
    `This was a ${intent.complexity} ${intent.taskType} session` +
    (intent.domains.length > 0 ? ` in the ${intent.domains.join('/')} domain` : '') +
    '.'
  );

  // Middle: how it went
  if (metrics.apparentSuccess) {
    parts.push(
      `The session resolved successfully with ${metrics.totalToolCalls} tool calls` +
      (metrics.backtrackCount > 0 ? ` (including ${metrics.backtrackCount} backtrack(s))` : '') +
      '.'
    );
  } else {
    parts.push(
      `The session did not reach a clean resolution. ` +
      `${metrics.userCorrectionCount} user correction(s) and ${metrics.backtrackCount} backtrack(s) ` +
      `suggest the initial approach was misaligned with the actual problem.`
    );
  }

  // Flow dynamics
  if (flowDynamics.shifts.length > 0) {
    const keyShift = flowDynamics.shifts.find(s =>
      s.toState === 'thrashing' || s.toState === 'stuck'
    );
    if (keyShift) {
      parts.push(
        `A critical momentum shift occurred: ${keyShift.fromState} → ${keyShift.toState}, ` +
        `triggered by ${keyShift.trigger}.`
      );
    }
  }

  // Key insight
  const topInsight = insights.sort((a, b) => b.confidence - a.confidence)[0];
  if (topInsight) {
    parts.push(`Key insight: ${topInsight.content.split('.')[0]}.`);
  }

  return parts.join(' ');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Generate a metacognitive reflection for a completed session.
 * This is the "thinking about thinking" pass that happens after each session.
 */
export function generateReflection(graph: DecisionGraph): MetacognitiveReflection {
  const intent = classifySessionIntent(graph);
  const flowDynamics = analyzeFlowDynamics(graph);

  // Gather all insights
  const insights: ReflectionInsight[] = [
    ...findCausalInsights(graph),
    ...findCounterfactualInsights(graph),
    ...findMetacognitiveInsights(graph),
    ...findStrategicInsights(graph, intent),
  ];

  // Generate adaptations from insights
  const adaptations = generateAdaptations(graph, intent, insights);

  // Generate narrative
  const narrative = generateNarrative(graph, intent, flowDynamics, insights);

  return {
    sessionId: graph.sessionId,
    generatedAt: new Date().toISOString(),
    intent,
    narrative,
    insights: insights.sort((a, b) => b.confidence - a.confidence),
    adaptations,
    momentum: flowDynamics,
  };
}

/**
 * Generate reflections for a batch of graphs, returning only the most
 * insightful ones (to keep storage manageable).
 */
export function generateBatchReflections(
  graphs: DecisionGraph[],
  maxReflections: number = 50
): MetacognitiveReflection[] {
  const reflections = graphs.map(g => generateReflection(g));

  // Score each reflection by insight density and quality
  const scored = reflections.map(r => ({
    reflection: r,
    score:
      r.insights.length * 0.3 +
      r.adaptations.length * 0.4 +
      r.momentum.shifts.length * 0.2 +
      (r.momentum.flowState === 'thrashing' ? 0.5 : 0) +
      r.insights.reduce((s, i) => s + i.confidence, 0) * 0.1,
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxReflections)
    .map(s => s.reflection);
}
