/**
 * Metacognition Types
 * ===================
 * Types for the self-aware layer of procedural memory.
 *
 * This goes beyond pattern extraction into genuine metacognition:
 * the system reasons about its OWN reasoning patterns, predicts
 * failure before it happens, and transfers knowledge across contexts.
 *
 * Three core concepts:
 * 1. CognitiveFingerprint — WHO the agent is as a reasoner
 * 2. SessionIntent — WHAT type of task is being attempted
 * 3. MetacognitiveReflection — WHY things went the way they did
 */

// ─── Session Intent Classification ──────────────────────────────────────────

export type TaskType =
  | 'bug-fix'        // Fixing a known broken behavior
  | 'feature'        // Adding new functionality
  | 'refactor'       // Restructuring without behavior change
  | 'debug'          // Investigating unknown issues
  | 'config'         // Configuration, environment, tooling
  | 'test'           // Writing or fixing tests
  | 'docs'           // Documentation changes
  | 'migration'      // Data/schema/API migrations
  | 'performance'    // Optimization work
  | 'security'       // Security hardening
  | 'exploration'    // Reading/understanding code without changes
  | 'multi-task'     // Session spans multiple task types
  | 'unknown';

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic';

export interface SessionIntent {
  /** Primary task type */
  taskType: TaskType;
  /** Secondary task types if multi-faceted */
  secondaryTypes: TaskType[];
  /** Estimated complexity based on scope signals */
  complexity: TaskComplexity;
  /** Confidence in classification (0-1) */
  confidence: number;
  /** Keywords/signals that drove the classification */
  signals: string[];
  /** Domain areas (e.g., "auth", "database", "UI", "API") */
  domains: string[];
  /** File scope estimate: how many files will likely be touched */
  estimatedFileScope: 'single-file' | 'module' | 'cross-module' | 'system-wide';
}

// ─── Cognitive Fingerprint ──────────────────────────────────────────────────

/**
 * A cognitive dimension — one axis of the agent's reasoning profile.
 * Each dimension is a spectrum between two poles.
 */
export interface CognitiveDimension {
  /** Name of this dimension */
  name: string;
  /** Left pole label (score 0.0) */
  leftPole: string;
  /** Right pole label (score 1.0) */
  rightPole: string;
  /** Current score on the spectrum (0.0 - 1.0) */
  score: number;
  /** How many sessions contributed to this score */
  sampleSize: number;
  /** Standard deviation — how consistent is this tendency */
  stdDev: number;
}

/**
 * Performance profile across different task types.
 */
export interface TaskTypeProfile {
  taskType: TaskType;
  /** Number of sessions of this type */
  sessionCount: number;
  /** Average efficiency (optimal/actual steps) */
  avgEfficiency: number;
  /** Average backtracks per session */
  avgBacktracks: number;
  /** Average user corrections per session */
  avgCorrections: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average tool calls to resolution */
  avgToolCalls: number;
  /** Relative strength score (-1 to +1, 0 = average) */
  relativeStrength: number;
}

/**
 * Tool usage profile — how the agent uses its tools.
 */
export interface ToolProfile {
  toolName: string;
  /** How often this tool is used (relative frequency) */
  usageFrequency: number;
  /** How often this tool's use leads to productive outcomes */
  productivityRate: number;
  /** Average number of times used per session */
  avgPerSession: number;
  /** How often this tool is used in wasted work vs resolution */
  wasteRatio: number;
}

/**
 * The complete cognitive fingerprint — a multidimensional profile
 * of how this agent reasons, where it excels, and where it struggles.
 */
export interface CognitiveFingerprint {
  /** When this fingerprint was last computed */
  computedAt: string;
  /** Total sessions analyzed */
  totalSessions: number;

  // ─── Reasoning Dimensions ───────────────────────────────────────────────

  dimensions: CognitiveDimension[];

  // ─── Task Type Performance ──────────────────────────────────────────────

  taskProfiles: TaskTypeProfile[];

  // ─── Tool Usage Patterns ────────────────────────────────────────────────

  toolProfiles: ToolProfile[];

  // ─── Derived Insights ───────────────────────────────────────────────────

  /** Top 3 strongest task types */
  strengths: string[];
  /** Top 3 weakest task types */
  weaknesses: string[];
  /** Recurring blind spots (things the agent consistently misses) */
  blindSpots: string[];
  /** Signature moves (distinctive positive patterns) */
  signatureMoves: string[];
}

// ─── Metacognitive Reflection ───────────────────────────────────────────────

export type ReflectionInsightType =
  | 'causal'           // "X happened BECAUSE of Y"
  | 'counterfactual'   // "If I had done X instead of Y..."
  | 'transfer'         // "This is the same pattern as..."
  | 'metacognitive'    // "I tend to X when facing Y"
  | 'strategic'        // "Next time, I should..."
  | 'environmental';   // "The codebase structure led to..."

export interface ReflectionInsight {
  type: ReflectionInsightType;
  content: string;
  confidence: number;
  /** Which session events support this insight */
  evidenceNodeIds: string[];
}

export interface MetacognitiveReflection {
  sessionId: string;
  /** When this reflection was generated */
  generatedAt: string;
  /** The classified intent of the session */
  intent: SessionIntent;
  /** Overall session narrative — the story of what happened and why */
  narrative: string;
  /** Specific insights from reflection */
  insights: ReflectionInsight[];
  /** What should change for next time */
  adaptations: Array<{
    trigger: string;
    currentBehavior: string;
    proposedBehavior: string;
    expectedImprovement: string;
  }>;
  /** Emotional/momentum indicators */
  momentum: {
    /** Was the agent in flow or thrashing? */
    flowState: 'deep-flow' | 'productive' | 'mixed' | 'thrashing' | 'stuck';
    /** Did momentum shift during the session? */
    shifts: Array<{
      fromState: string;
      toState: string;
      atNodeId: string;
      trigger: string;
    }>;
  };
}

// ─── Cross-Project Transfer ─────────────────────────────────────────────────

export type TransferabilityLevel =
  | 'universal'        // Works everywhere (e.g., "read error messages carefully")
  | 'language-level'   // TypeScript-specific, Python-specific, etc.
  | 'framework-level'  // React-specific, Express-specific, etc.
  | 'domain-level'     // Auth-specific, database-specific, etc.
  | 'project-specific' // Only works in this exact codebase
  | 'ephemeral';       // Was useful once, won't transfer

export interface TransferablePattern {
  /** The pattern ID from the source strategy */
  sourceStrategyId: string;
  /** Source project */
  sourceProject: string;
  /** Abstracted form of the pattern (project-specific details removed) */
  abstractPattern: string;
  /** How transferable is this? */
  transferability: TransferabilityLevel;
  /** Confidence in transferability assessment */
  confidence: number;
  /** Projects where this pattern has been validated */
  validatedIn: string[];
  /** Projects where this pattern was attempted but didn't help */
  failedIn: string[];
  /** The underlying principle (why this works) */
  underlyingPrinciple: string;
  /** Tags for matching */
  tags: string[];
}

export interface TransferLearningIndex {
  /** When this index was last computed */
  computedAt: string;
  /** Patterns organized by transferability level */
  patterns: TransferablePattern[];
  /** Cross-project similarity matrix (project pairs → similarity score) */
  projectSimilarity: Array<{
    projectA: string;
    projectB: string;
    similarity: number;
    sharedPatterns: string[];
  }>;
}

// ─── Temporal Dynamics ──────────────────────────────────────────────────────

export interface SkillPoint {
  timestamp: string;
  sessionId: string;
  taskType: TaskType;
  efficiency: number;
  backtracks: number;
  corrections: number;
  toolCalls: number;
}

export interface SkillTrajectory {
  taskType: TaskType;
  /** Ordered data points over time */
  points: SkillPoint[];
  /** Current trend direction */
  trend: 'improving' | 'stable' | 'declining' | 'insufficient-data';
  /** Rate of improvement (positive) or decline (negative) per session */
  slopePerSession: number;
  /** Detected plateau periods */
  plateaus: Array<{
    startSession: string;
    endSession: string;
    avgEfficiency: number;
  }>;
  /** Detected breakthroughs */
  breakthroughs: Array<{
    sessionId: string;
    timestamp: string;
    efficiencyBefore: number;
    efficiencyAfter: number;
    likelyCause: string;
  }>;
}

export interface TemporalProfile {
  computedAt: string;
  /** Skill trajectories per task type */
  trajectories: SkillTrajectory[];
  /** Overall learning rate */
  overallLearningRate: number;
  /** Time since last breakthrough */
  daysSinceLastBreakthrough: number;
  /** Predicted next plateau/breakthrough */
  prediction: string;
}

// ─── Predictive Strategy Selection ──────────────────────────────────────────

export interface StrategyPrediction {
  strategyId: string;
  /** Probability this strategy will be relevant (0-1) */
  relevanceProbability: number;
  /** If relevant, probability it leads to success (0-1) */
  expectedSuccessRate: number;
  /** Combined score (relevance × success) */
  combinedScore: number;
  /** Why this strategy was predicted */
  reasoning: string;
  /** Risk if this strategy is NOT loaded */
  riskIfOmitted: 'high' | 'medium' | 'low' | 'none';
}

export interface PredictiveContext {
  intent: SessionIntent;
  fingerprint: CognitiveFingerprint;
  /** Files currently open / recently modified */
  activeFiles: string[];
  /** Recent error messages */
  recentErrors: string[];
  /** Time of day (affects performance patterns) */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Session number today (fatigue factor) */
  sessionNumberToday: number;
}

// ─── Metacognitive Store (persisted alongside strategy index) ────────────────

export interface MetacognitiveStore {
  schemaVersion: number;
  fingerprint: CognitiveFingerprint;
  reflections: MetacognitiveReflection[];
  transferIndex: TransferLearningIndex;
  temporalProfile: TemporalProfile;
  /** Last N session intents for temporal context */
  recentIntents: SessionIntent[];
}
