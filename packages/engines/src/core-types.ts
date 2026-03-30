/**
 * @guardrail/engines — Core types inlined from @guardrail/core.
 * These are the canonical engine/finding/trust-score types for Guardrail.
 * AI writes code. Guardrail proves it's real.
 */

// ─── Finding Types ──────────────────────────────────────────────────────────

export type EngineId =
  | 'ghost_route'
  | 'phantom_dep'
  | 'api_truth'
  | 'env_var'
  | 'credentials'
  | 'security'
  | 'fake_features'
  | 'version_hallucination'
  | 'runtime_probe'
  | 'custom-rules'
  | (string & {});

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;
  engine: EngineId;
  severity: Severity;
  category: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  evidence: string;
  suggestion?: string;
  confidence: number;
  autoFixable: boolean;
  ruleId?: string;
}

export interface DeltaContext {
  documentUri: string;
  documentLanguage: string;
  fullText: string;
  changedRanges: Array<{ start: number; end: number }>;
  changedText: string;
}

// ─── Engine Types ───────────────────────────────────────────────────────────

/**
 * Contract every scan engine must satisfy.
 * Implemented by built-in engines AND third-party engines via @guardrail/sdk.
 */
export interface ScanEngine {
  /** Unique engine identifier. Convention: kebab-case, e.g. 'api-truth', 'phantom-dep'. */
  readonly id: string;

  /** Human-readable name for UI display. e.g. 'API Truth Engine'. */
  readonly name?: string;

  /** Semantic version of this engine. Used in telemetry + SARIF output. */
  readonly version?: string;

  /**
   * File extensions this engine supports. `null` or `undefined` = all checked extensions.
   * Example: new Set(['.ts', '.tsx', '.js', '.jsx'])
   */
  readonly supportedExtensions?: Set<string> | null;

  /**
   * Run detection on a code delta.
   * @param delta - The code context (file content, changed ranges, uri, languageId)
   * @param signal - AbortSignal for cancellation. Engine MUST check signal.aborted periodically.
   * @returns Array of findings. May be empty.
   */
  scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]>;

  /**
   * Optional async activation. Called once when the engine is first registered.
   * Use for loading SDK maps, warming caches, indexing workspace, etc.
   */
  activate?(): Promise<void>;

  /**
   * Optional cleanup. Called when the engine is deregistered or the extension shuts down.
   */
  dispose?(): void;

  /**
   * Optional async pre-dispose. Called before dispose() when the registry is shutting down.
   * Use for flushing caches, waiting for in-flight requests, etc.
   */
  prepareDispose?(): Promise<void>;

  /**
   * Optional stats for telemetry/sidebar display.
   * Return whatever is useful: cache hit rates, pattern counts, etc.
   */
  getStats?(): Record<string, unknown>;
}

// ─── Trust Score Types ──────────────────────────────────────────────────────

/** Dimension keys for trust score breakdown. */
export type DimensionKey =
  | 'api_integrity'
  | 'dependency_safety'
  | 'env_coverage'
  | 'contract_health';

/** Per-dimension score with metadata. */
export interface DimensionScore {
  score: number;
  weight: number;
  penalty: number;
  findingCount: number;
  label: string;
  description: string;
}

export type ReducerSeverity = 'critical' | 'major' | 'minor' | 'info';

export interface TrustScoreReducer {
  id: string;
  description: string;
  impact: number;
  severity: ReducerSeverity;
  engine: string;
  dimension: DimensionKey;
  /** Representative finding IDs for drill-down. */
  findingIds: string[];
  /** Actionable fix hint. */
  action?: string;
}

export type Trend = 'improving' | 'stable' | 'degrading';

export interface TrendInfo {
  direction: Trend;
  delta: number;
  previousScore: number;
  previousComputedAt: string;
}

export interface FileScore {
  file: string;
  score: number;
  findingCount: number;
  criticalCount: number;
  autoFixableCount: number;
}

export type TrustScoreScope = 'local' | 'staged' | 'branch' | 'project' | 'full' | 'pr' | 'proof';

/** Canonical TrustScore — single source of truth. Used by engines, CLI, extension, API. */
export interface TrustScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  decision: 'SHIP' | 'REVIEW' | 'NO_SHIP';
  dimensions: Record<DimensionKey, DimensionScore>;
  reducers: TrustScoreReducer[];
  trend?: TrendInfo;
  perFile?: FileScore[];
  computedAt: string;
  scope: TrustScoreScope;
  findingCount: number;
  autoFixableCount: number;
}

/** Implemented by EnvIndexer (VS Code) and EnvLoader (CLI/Action) */
export interface IEnvIndex {
  has(name: string): boolean;
  readonly index: Set<string>;
}
