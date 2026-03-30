/**
 * @guardrail/engines — Detection engines shared between VS Code, CLI, and CI.
 */

export { EngineRegistry, CircuitBreaker, createDefaultRegistry, createRegistryWithPlugins } from './registry.js';
export { BaseEngine } from './base-engine.js';
export { TypeContractEngine } from './TypeContractEngine.js';
export { SecurityPatternEngine } from './SecurityPatternEngine.js';
export { PerformanceAntipatternEngine } from './PerformanceAntipatternEngine.js';

// Re-export core types so consumers don't need a separate core package
export type {
  ScanEngine,
  Finding,
  DeltaContext,
  EngineId,
  Severity,
  IEnvIndex,
  DimensionKey,
  DimensionScore,
  TrustScoreReducer,
  TrendInfo,
  FileScore,
  TrustScore,
  TrustScoreScope,
  ReducerSeverity,
  Trend,
} from './core-types';
export type { EngineSlot, RegisterEngineOptions, ScanTelemetry, EngineMetric } from './engine-types.js';

export { APITruthEngine } from './APITruthEngine';
export { PhantomDepEngine } from './PhantomDepEngine';
export { VersionHallucinationEngine } from './VersionHallucinationEngine';
export { EnvVarEngine, type EnvVarEngineOptions } from './EnvVarEngine';
export { GhostRouteEngine } from './GhostRouteEngine';
export { CredentialsEngine } from './CredentialsEngine';
export { SecurityEngine } from './SecurityEngine';
export { FakeFeaturesEngine } from './FakeFeaturesEngine';
export { RuntimeProbeEngine, type RuntimeProbeConfig } from './RuntimeProbeEngine';
export { EnvLoader } from './EnvLoader';
export {
  loadTruthpack,
  TruthpackEnvIndex,
  truthpackToRouteIndex,
  type LoadedTruthpack,
  type TruthpackRoutes,
  type TruthpackEnvVar,
  type TruthpackRouteEntry,
} from './truthpack-loader';
export {
  computeTrustScore,
  diffScores,
  formatTrustScoreMarkdown,
  type TrustScoreOptions,
} from './TrustScoreService';

// Engine error handling
export {
  EngineError,
  EngineErrorCode,
  type EngineErrorContext,
  withEngineErrorHandling,
  isEngineError,
  createContext,
} from './EngineError';

// Output formatters (SARIF, JSON, text, compact)
export {
  toSarif,
  formatFindings,
  formatSummary,
  type SarifLog,
  type SarifInput,
  type ToSarifOptions,
  type RunSummaryLike,
  type RunResultLike,
  type OutputFormat,
  type FormatOptions,
} from './output/index.js';

// Polish engines — project-level quality checks
export {
  runPolish,
  seoEngine,
  securityEngine,
  resilienceEngine,
  performanceEngine,
  observabilityEngine,
  infrastructureEngine,
  documentationEngine,
  configurationEngine,
  backendEngine,
  accessibilityEngine,
  icons,
  categoryIcons,
  type PolishEngine,
  type PolishIssue,
  type PolishReport,
} from './polish';

// Plugin system — custom rules, framework packs, community plugins
export {
  CustomRuleEngine,
  PluginLoader,
  loadGuardrailConfig,
  detectFramework,
  nextjsPack,
  expressPack,
  pythonPack,
  BUILTIN_PACKS,
  getBuiltinPack,
  listBuiltinPacks,
  LANGUAGE_EXTENSIONS,
} from './plugins/index';

export type {
  RuleDefinition,
  RuleContext,
  RuleFinding,
  RuleLanguage,
  PluginManifest,
  PluginModule,
  GuardrailPluginConfig,
  RuleConfig,
  RuleSeverityConfig,
  PluginRef,
  LoadedPlugin,
  ResolvedRule,
} from './plugins/index';
