/**
 * MDC Generator Module
 * 
 * Comprehensive Markdown Context (MDC) generation system with:
 * - AST-based code analysis
 * - Anti-hallucination verification
 * - Source code anchoring
 * - Code quality analysis
 * - Breaking change detection
 * - Test coverage mapping
 * - Incremental updates
 */

// Core MDC Generator
export {
  AdvancedMDCGenerator,
  MDCSpecification,
  MDCGenerationOptions,
  ComponentSpec,
  PatternSpec,
  RelationshipSpec,
  CodeExample,
} from './mdc-generator';

// Verification Engine - Anti-Hallucination
export {
  VerificationEngine,
  VerificationResult,
  VerificationIssue,
  Evidence,
} from './verification-engine';

// Source Anchor System
export {
  SourceAnchorSystem,
  AnchoredClaim,
  AnchoredComponent,
  AnchoredRelationship,
  AnchoredPattern,
  SourceAnchoredMDC,
} from './source-anchor';

// Hallucination Detector
export {
  HallucinationDetector,
  HallucinationRisk,
  HallucinationReport,
} from './hallucination-detector';

// Code Quality Analyzer
export {
  CodeQualityAnalyzer,
  CodeQualityMetrics,
  QualityIssue,
  QualityReport,
} from './code-quality-analyzer';

// Breaking Change Detector
export {
  BreakingChangeDetector,
  BreakingChange,
  BreakingChangeReport,
} from './breaking-change-detector';

// Incremental Updater
export {
  IncrementalMDCUpdater,
  FileHash,
  UpdatePlan as IncrementalUpdatePlan,
} from './incremental-updater';

// Intelligent Auto-Updater
export {
  IntelligentAutoUpdater,
  ChangeDetected,
  UpdatePlan as IntelligentUpdatePlan,
} from './intelligent-updater';

// Test Coverage Mapper
export {
  TestCoverageMapper,
  TestCoverageInfo,
  CoverageSummary,
} from './test-coverage-mapper';
