/**
 * Decision Graph Types
 * ====================
 * These types represent the ANALYZED form of a Claude Code session.
 * Raw JSONL → DecisionGraph is the first transformation step.
 *
 * The decision graph captures WHAT the agent decided, WHY, and
 * WHAT HAPPENED — the three signals needed for procedural learning.
 */

// ─── Decision Node Types ─────────────────────────────────────────────────────

export type NodeType =
  | 'hypothesis'    // Agent formed a theory about the problem
  | 'action'        // Agent took a tool action
  | 'observation'   // Agent received and interpreted output
  | 'correction'    // User intervened to redirect the agent
  | 'backtrack'     // Agent reversed course on its own
  | 'resolution'    // Task completed (final state)
  | 'user_request'  // Initial user prompt / task definition
  | 'escalation';   // Agent asked the user for clarification

export interface DecisionNode {
  id: string;
  type: NodeType;
  timestamp: string;
  /** The agent's text at this point (reasoning, explanation) */
  reasoning: string;
  /** Tool call details, if this node involved a tool */
  toolCall?: {
    name: string;
    input: Record<string, unknown>;
    /** Truncated output — just enough for pattern matching */
    outputSummary: string;
    /** Did the tool call succeed or error? */
    succeeded: boolean;
    /** Error message if failed */
    error?: string;
  };
  /** Files read or written at this step */
  filesTouched: string[];
  /** Source transcript record UUIDs that map to this node */
  sourceUuids: string[];
}

// ─── Decision Edge Types ─────────────────────────────────────────────────────

export type EdgeType =
  | 'hypothesis_driven'  // hypothesis → action (agent tested its theory)
  | 'evidence_based'     // observation → hypothesis (revised thinking based on evidence)
  | 'correction_forced'  // correction → backtrack (user forced a redirect)
  | 'self_correction'    // observation → backtrack (agent realized its own mistake)
  | 'sequential'         // action → observation (natural flow)
  | 'retry'              // backtrack → hypothesis (trying again with new approach)
  | 'user_initiated';    // user_request → hypothesis (starting a task)

export interface DecisionEdge {
  from: string;  // node id
  to: string;    // node id
  type: EdgeType;
}

// ─── Decision Graph (one per session) ────────────────────────────────────────

export interface DecisionGraph {
  sessionId: string;
  project: string;
  gitBranch: string;
  startTime: string;
  endTime: string;
  summary?: string;

  nodes: DecisionNode[];
  edges: DecisionEdge[];

  // ─── Derived Metrics (computed during parsing) ──────────────────────────────

  metrics: SessionMetrics;
}

export interface SessionMetrics {
  /** Total tool calls in the session */
  totalToolCalls: number;
  /** Unique tools used */
  toolsUsed: string[];
  /** Number of times the agent reversed course */
  backtrackCount: number;
  /** Number of times the user corrected the agent */
  userCorrectionCount: number;
  /** Total user messages (prompts) */
  userPromptCount: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Files that were part of the final resolution */
  filesModifiedAsResolution: string[];
  /** Files that were investigated but NOT part of resolution (false leads) */
  filesInvestigatedNotResolution: string[];
  /** How many tool calls happened between first action and resolution */
  toolCallsToResolution: number;
  /** Was the session "successful"? (user didn't abandon, corrections < 3) */
  apparentSuccess: boolean;
  /** Token usage totals */
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
}

// ─── Strategy Types (output of pattern extraction) ───────────────────────────

export type StrategyScope = 'universal' | 'framework' | 'toolchain' | 'project';

export interface Strategy {
  id: string;
  /** When this strategy should fire — matched against session context */
  triggerPattern: {
    /** File paths or glob patterns that activate this strategy */
    filePatterns: string[];
    /** Error message patterns that activate this strategy */
    errorPatterns: string[];
    /** Module/directory areas this applies to */
    moduleAreas: string[];
    /** Keywords from user prompts that activate this */
    promptKeywords: string[];
  };
  /** What the agent should know/do when this fires */
  content: string;
  /** How transferable is this strategy? */
  scope: StrategyScope;
  /** Confidence score 0-1, decays over time */
  confidence: number;
  /** Sessions that support this strategy */
  supportingEvidence: Array<{
    sessionId: string;
    timestamp: string;
    outcome: 'confirmed' | 'contradicted' | 'partial';
    summary: string;
  }>;
  /** When this strategy was first identified */
  createdAt: string;
  /** When confidence was last updated */
  lastValidated: string;
  /** Rate of confidence decay per day */
  decayRatePerDay: number;
  /** How many times this strategy has been injected */
  injectionCount: number;
  /** How many times the injected strategy led to correct path */
  successCount: number;
  /** Tags for categorization */
  tags: string[];
}

// ─── Anti-Pattern (recurring failure mode) ───────────────────────────────────

export interface AntiPattern {
  id: string;
  /** What triggers the incorrect behavior */
  triggerDescription: string;
  /** What the agent typically tries first (wrong approach) */
  incorrectApproach: string;
  /** What actually works */
  correctApproach: string;
  /** Average wasted steps before correction */
  avgWastedSteps: number;
  /** Sessions where this pattern was observed */
  occurrences: Array<{
    sessionId: string;
    wastedSteps: number;
    correctionSource: 'user' | 'self' | 'test_failure';
  }>;
  /** Derived strategy to prevent this anti-pattern */
  derivedStrategyId?: string;
}

// ─── Optimal Path Reconstruction ─────────────────────────────────────────────

export interface OptimalPath {
  sessionId: string;
  /** Actual number of steps taken */
  actualSteps: number;
  /** Reconstructed minimum steps needed */
  optimalSteps: number;
  /** Efficiency ratio (optimal / actual) — 1.0 = perfect */
  efficiency: number;
  /** Key insight: what would have saved the most steps? */
  keyInsight: string;
  /** The "wrong turn" — which node started the wasted work */
  wrongTurnNodeId?: string;
  /** What the agent should have done instead */
  correctAlternative: string;
}

// ─── Performance Report ──────────────────────────────────────────────────────

export interface PerformanceReport {
  /** Period this report covers */
  period: {
    from: string;
    to: string;
    sessionCount: number;
  };
  /** How baseline vs enhanced cohorts were chosen */
  cohortNote?: string;
  /** Baseline metrics (sessions without strategies) */
  baseline: AggregateMetrics;
  /** Enhanced metrics (sessions with strategies injected) */
  enhanced?: AggregateMetrics;
  /** Per-strategy effectiveness */
  strategyEffectiveness: Array<{
    strategyId: string;
    timesInjected: number;
    timesRelevant: number;
    timesFollowed: number;
    timesSuccessful: number;
    avgStepsReduction: number;
  }>;
  /** Overall improvement (if enhanced data available) */
  improvement?: {
    toolCallReduction: number;     // percentage
    backtrackReduction: number;    // percentage
    correctionReduction: number;   // percentage
    durationReduction: number;     // percentage
  };
}

export interface AggregateMetrics {
  avgToolCallsPerSession: number;
  avgBacktracksPerSession: number;
  avgCorrectionsPerSession: number;
  avgDurationSeconds: number;
  medianToolCallsPerSession: number;
  sessionCount: number;
}

// ─── Strategy Index (the "searchable reflex library") ────────────────────────

export interface StrategyIndex {
  /** Project this index belongs to */
  project: string;
  /** When the index was last rebuilt */
  lastConsolidated: string;
  /** Total sessions analyzed to build this index */
  sessionsAnalyzed: number;
  /** Active strategies */
  strategies: Strategy[];
  /** Known anti-patterns */
  antiPatterns: AntiPattern[];
  /** Optimal path reconstructions */
  optimalPaths: OptimalPath[];
  /** Version for schema migrations */
  schemaVersion: number;
}
