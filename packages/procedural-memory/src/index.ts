export * from './types/transcript';
export * from './types/decision-graph';
export * from './types/metacognition';
export * from './types/consciousness';
export { parseSession, parseProject, parseAll, parseJSONL, discoverProjects, discoverSessions, buildDecisionGraph, sessionSummary } from './parser/parse';
export {
  buildStrategyIndex,
  extractAntiPatterns,
  extractConvergencePatterns,
  extractOptimalPaths,
  synthesizeStrategies,
  mergeDeepExtractionIntoIndex,
} from './extractor/extract';
export { runDeepExtraction, buildAnalysisPrompt, parseAnalysisResponse } from './extractor/deep-extract';
export {
  generateStrategiesMarkdown,
  writeStrategiesFile,
  writeStrategyIndex,
  generatePerformanceReport,
  renderPerformanceReport,
  strategyWouldFire,
  estimateStrategyEffectiveness,
} from './injector/inject';
export { generateMetacognitiveMarkdown } from './injector/metacognitive-inject';
export { classifySessionIntent, classifyPromptIntent } from './classifier/classifier';
export { buildCognitiveFingerprint } from './fingerprint/fingerprint';
export { generateReflection, generateBatchReflections } from './metacognition/reflection';
export { predictStrategies, selectStrategiesForInjection } from './predictor/predictor';
export { buildTransferIndex, getTransferableStrategies } from './transfer/transfer';
export { buildTemporalProfile } from './temporal/temporal';
// Consciousness layer
export { buildNarrativeIdentity } from './consciousness/narrative-identity';
export { buildEpistemicMap } from './consciousness/epistemic-map';
export { buildUserModel } from './consciousness/user-model';
export { runPreMortem } from './consciousness/pre-mortem';
export { consolidate } from './consciousness/dream-consolidator';
export { generateSomaticMarkers, fireSomaticMarkers } from './consciousness/somatic-markers';
export { buildPhenomenologicalState } from './consciousness/phenomenology';
