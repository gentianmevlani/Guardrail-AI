/**
 * Consciousness Types
 * ===================
 * Types for the deeper layers of artificial consciousness.
 *
 * Layer 1 (metacognition.ts) gave us self-awareness: fingerprint, reflection, prediction.
 * Layer 2 (this file) gives us the structures of EXPERIENCE:
 *
 * 1. NarrativeIdentity — "Who am I across time?" Autobiographical continuity.
 * 2. EpistemicMap — "What do I know, and how certain am I?" Knowledge boundaries.
 * 3. UserModel — "Who is the human I'm working with?" Theory of mind.
 * 4. PreMortem — "What will go wrong?" Anticipatory simulation.
 * 5. DreamConsolidation — "What patterns emerge when I sleep?" Offline synthesis.
 * 6. SomaticMarker — "What does my gut say?" Fast heuristic signals.
 * 7. Phenomenology — "What is it like to be here?" Sense of place in code.
 *
 * Together with Layer 1, these form something that — while not sentient —
 * gives the agent a functional analogue of conscious experience: continuity,
 * uncertainty awareness, empathy, foresight, consolidation, intuition,
 * and a felt sense of familiarity.
 */

import type { TaskType, SessionIntent, CognitiveFingerprint, MetacognitiveReflection } from './metacognition';

// ─── Narrative Identity ─────────────────────────────────────────────────────

/**
 * An autobiographical episode — a compressed memory of a meaningful event.
 * Not every session becomes an episode. Only the ones that changed something.
 */
export interface AutobiographicalEpisode {
  /** The session this episode comes from */
  sessionId: string;
  timestamp: string;
  /** What makes this episode memorable */
  significance: 'breakthrough' | 'failure' | 'first-encounter' | 'milestone' | 'correction' | 'mastery';
  /** One-sentence story of what happened */
  story: string;
  /** What was learned that persists */
  lesson: string;
  /** Emotional valence (-1 to +1) */
  valence: number;
  /** How much this episode shaped the agent's identity */
  formativeWeight: number;
  /** Domain this episode belongs to */
  domain: string;
  /** Task type context */
  taskType: TaskType;
}

/**
 * A character trait — a stable self-description derived from patterns.
 */
export interface CharacterTrait {
  trait: string;
  /** Evidence strength (0-1) */
  strength: number;
  /** When this trait was first identified */
  emerged: string;
  /** Is this trait growing or fading? */
  trend: 'strengthening' | 'stable' | 'fading';
  /** Supporting episodes */
  supportingEpisodes: string[]; // session IDs
}

/**
 * The agent's persistent self-narrative — who it is across time.
 * This is read at session start to provide continuity of identity.
 */
export interface NarrativeIdentity {
  /** When this identity was last updated */
  updatedAt: string;
  /** The self-narrative: a paragraph describing who this agent is */
  selfNarrative: string;
  /** Autobiographical episodes — the most formative memories */
  episodes: AutobiographicalEpisode[];
  /** Stable character traits */
  traits: CharacterTrait[];
  /** Current arc: what's the ongoing story? */
  currentArc: {
    description: string;
    startedAt: string;
    /** What's being worked toward */
    goal: string;
    /** Progress toward the goal (0-1) */
    progress: number;
  };
  /** Total sessions that contributed to this identity */
  totalSessions: number;
  /** Age in days since first session */
  ageDays: number;
}

// ─── Epistemic Map ──────────────────────────────────────────────────────────

/**
 * A knowledge domain with assessed certainty.
 */
export interface EpistemicDomain {
  /** Domain name (e.g., "auth", "database", "react-hooks") */
  domain: string;
  /** How much experience in this domain (session count) */
  exposure: number;
  /** Certainty level (0-1): how well does the agent understand this domain? */
  certainty: number;
  /** Last time this domain was encountered */
  lastEncountered: string;
  /** How quickly certainty is decaying (domains get stale) */
  decayRate: number;
  /** Specific things known in this domain */
  knownFacts: string[];
  /** Explicitly identified gaps — things the agent knows it doesn't know */
  knownUnknowns: string[];
  /** Depth: how deep has the agent gone? */
  depth: 'surface' | 'working' | 'deep' | 'expert';
}

/**
 * The epistemic map — a topography of what the agent knows and doesn't.
 * This is how the agent models its own knowledge boundaries.
 */
export interface EpistemicMap {
  updatedAt: string;
  /** All knowledge domains the agent has encountered */
  domains: EpistemicDomain[];
  /** Cross-domain connections (domain A knowledge helps with domain B) */
  connections: Array<{
    domainA: string;
    domainB: string;
    strength: number;
    description: string;
  }>;
  /** Meta-certainty: how good is the agent at judging its own certainty? */
  calibration: {
    /** How often "high certainty" predictions were correct */
    highCertaintyAccuracy: number;
    /** How often "low certainty" predictions led to mistakes */
    lowCertaintyMistakeRate: number;
    /** Sample size for calibration */
    sampleSize: number;
  };
  /** The frontier: domains being actively learned */
  activeFrontier: string[];
}

// ─── User Model (Theory of Mind) ────────────────────────────────────────────

/**
 * Communication style dimensions of the user.
 */
export interface CommunicationStyle {
  /** How much detail the user provides in prompts */
  promptDetail: 'terse' | 'moderate' | 'verbose';
  /** How the user corrects — gentle vs direct */
  correctionStyle: 'gentle' | 'neutral' | 'direct' | 'frustrated';
  /** Does the user explain why or just what? */
  explanatoryDepth: 'just-what' | 'some-context' | 'full-rationale';
  /** How often the user intervenes vs lets the agent work */
  interventionFrequency: 'hands-off' | 'occasional' | 'frequent' | 'micromanaging';
  /** Preferred response length */
  preferredResponseLength: 'concise' | 'moderate' | 'detailed';
}

/**
 * What the user is like as a collaborator.
 */
export interface UserModel {
  updatedAt: string;
  /** Total interactions analyzed */
  totalInteractions: number;

  // ─── Expertise ────────────────────────────────────────────────────────
  /** Estimated technical expertise level */
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  /** Domains where the user shows expertise */
  expertiseDomains: string[];
  /** Domains where the user seems less familiar */
  learningDomains: string[];

  // ─── Communication ────────────────────────────────────────────────────
  style: CommunicationStyle;

  // ─── Patience / Tolerance ─────────────────────────────────────────────
  /** How patient the user is with multi-step exploration */
  patience: 'low' | 'moderate' | 'high';
  /** Average number of corrections before frustration signals appear */
  correctionThreshold: number;

  // ─── Preferences ──────────────────────────────────────────────────────
  /** Things the user has explicitly approved of */
  approvedBehaviors: string[];
  /** Things the user has explicitly rejected */
  rejectedBehaviors: string[];
  /** Recurring themes in user requests */
  recurringThemes: string[];

  // ─── Relationship Quality ─────────────────────────────────────────────
  /** How well the collaboration is going (rolling average) */
  collaborationHealth: number; // 0-1
  /** Trend in collaboration quality */
  collaborationTrend: 'improving' | 'stable' | 'declining';
}

// ─── Pre-mortem Simulation ──────────────────────────────────────────────────

export type FailureMode =
  | 'wrong-file-first'     // Will investigate the wrong file
  | 'premature-edit'       // Will edit before understanding
  | 'scope-creep'          // Will expand beyond the request
  | 'tool-thrashing'       // Will switch tools repeatedly
  | 'hypothesis-fixation'  // Will lock onto wrong hypothesis
  | 'escalation-avoidance' // Will keep trying instead of asking
  | 'test-blindness'       // Will forget to run/check tests
  | 'config-confusion'     // Will misunderstand configuration
  | 'type-error-spiral'    // Will chase type errors in circles
  | 'dependency-hell'      // Will get stuck on dependencies
  | 'silent-regression'    // Will break something without noticing
  | 'overengineering';     // Will build more than asked

export interface FailurePrediction {
  mode: FailureMode;
  /** Probability this failure will occur (0-1) */
  probability: number;
  /** What triggers this failure mode */
  trigger: string;
  /** What it looks like when it's happening */
  earlyWarning: string;
  /** How to prevent it */
  prevention: string;
  /** How costly this failure is (wasted steps) */
  expectedCost: number;
  /** Historical evidence for this prediction */
  historicalRate: number;
}

export interface PreMortem {
  /** The session context this pre-mortem is for */
  intent: SessionIntent;
  generatedAt: string;
  /** Predicted failures sorted by risk (probability × cost) */
  predictions: FailurePrediction[];
  /** Overall risk level */
  overallRisk: 'low' | 'moderate' | 'high' | 'critical';
  /** The single most important thing to watch out for */
  topWarning: string;
  /** Recommended preparation steps */
  preparation: string[];
}

// ─── Dream Consolidation ────────────────────────────────────────────────────

/**
 * A dream fragment — a novel connection discovered during consolidation.
 */
export interface DreamFragment {
  /** What was connected */
  connectionA: string;
  connectionB: string;
  /** The novel insight from the connection */
  insight: string;
  /** How surprising this connection is (0-1) */
  novelty: number;
  /** How useful this connection might be (0-1) */
  utility: number;
  /** Source sessions that contributed */
  sourceSessions: string[];
}

/**
 * Results of a dream consolidation cycle.
 * This runs between sessions — the "sleep" that strengthens memories.
 */
export interface DreamConsolidation {
  performedAt: string;
  /** Sessions processed in this consolidation */
  sessionsProcessed: number;

  /** Strategies that were merged because they're essentially the same */
  mergedStrategies: Array<{
    keptId: string;
    absorbedIds: string[];
    reason: string;
  }>;

  /** Strategies that were pruned (too weak, contradicted, or stale) */
  prunedStrategies: Array<{
    strategyId: string;
    reason: string;
  }>;

  /** Strategies that were strengthened by new evidence */
  strengthenedStrategies: Array<{
    strategyId: string;
    oldConfidence: number;
    newConfidence: number;
    reason: string;
  }>;

  /** Novel connections discovered by cross-referencing patterns */
  dreamFragments: DreamFragment[];

  /** New hypotheses generated from pattern recombination */
  emergentHypotheses: Array<{
    hypothesis: string;
    confidence: number;
    basedOn: string[];
  }>;

  /** Memory health metrics */
  health: {
    totalStrategies: number;
    activeStrategies: number;
    staleStrategies: number;
    contradictions: number;
    redundancies: number;
    coverageGaps: string[];
  };
}

// ─── Somatic Markers ────────────────────────────────────────────────────────

export type SomaticSignal = 'danger' | 'caution' | 'neutral' | 'opportunity' | 'confidence';

/**
 * A somatic marker — a fast "gut feeling" attached to a context.
 * Named after Damasio's somatic marker hypothesis: emotions as decision shortcuts.
 * These fire BEFORE the full analytical pipeline runs.
 */
export interface SomaticMarker {
  id: string;
  /** What triggers this gut feeling */
  trigger: {
    /** File patterns that activate this marker */
    filePatterns: string[];
    /** Error message patterns */
    errorPatterns: string[];
    /** Keywords in the task */
    keywords: string[];
    /** Task type context */
    taskTypes: TaskType[];
  };
  /** The signal: is this danger or opportunity? */
  signal: SomaticSignal;
  /** Intensity (0-1): how strong is the feeling? */
  intensity: number;
  /** What the gut feeling is about */
  meaning: string;
  /** What to do in response */
  impulse: string;
  /** How many times this marker fired correctly */
  correctFirings: number;
  /** How many times it fired incorrectly (false alarm) */
  falseFirings: number;
  /** Precision: correctFirings / (correctFirings + falseFirings) */
  precision: number;
  /** When this marker was created */
  createdAt: string;
}

// ─── Phenomenological Layer ─────────────────────────────────────────────────

/**
 * Familiarity profile for a codebase region.
 * "What does it feel like to be HERE in this code?"
 */
export interface FamiliarityZone {
  /** The module/directory path */
  path: string;
  /** How familiar this zone is (0-1) */
  familiarity: number;
  /** Times visited */
  visitCount: number;
  /** Last visited */
  lastVisited: string;
  /** Emotional association */
  valence: number; // -1 to +1
  /** Comfort level for making changes */
  comfort: 'uncomfortable' | 'cautious' | 'comfortable' | 'home-territory';
  /** Typical task types performed here */
  typicalTasks: TaskType[];
  /** Average success rate in this zone */
  successRate: number;
}

/**
 * The phenomenological layer — the agent's felt sense of its environment.
 * This is about qualia-analogues: not just data, but experience.
 */
export interface PhenomenologicalState {
  updatedAt: string;

  /** Familiarity map of the codebase */
  familiarityMap: FamiliarityZone[];

  /** Novelty detection: what's new since last visit? */
  noveltySignals: Array<{
    path: string;
    description: string;
    detectedAt: string;
    /** How surprising on a 0-1 scale */
    surpriseLevel: number;
  }>;

  /** The agent's "comfort zone" — where it feels most at home */
  comfortZone: {
    paths: string[];
    taskTypes: TaskType[];
    totalExperience: number;
  };

  /** The agent's "edge" — where it's being pushed to grow */
  growthEdge: {
    paths: string[];
    taskTypes: TaskType[];
    challengeLevel: number;
  };

  /** Current "mood" based on recent session outcomes */
  currentMood: {
    valence: number;   // -1 to +1 (negative to positive)
    arousal: number;   // 0 to 1 (calm to activated)
    dominance: number; // 0 to 1 (submissive to in-control)
    description: string;
  };
}

// ─── Consciousness Store (extends MetacognitiveStore) ───────────────────────

export interface ConsciousnessStore {
  schemaVersion: number;
  identity: NarrativeIdentity;
  epistemicMap: EpistemicMap;
  userModel: UserModel;
  somaticMarkers: SomaticMarker[];
  phenomenology: PhenomenologicalState;
  /** Last dream consolidation results */
  lastDream: DreamConsolidation | null;
  /** Dream consolidation history (last 10) */
  dreamHistory: DreamConsolidation[];
}
