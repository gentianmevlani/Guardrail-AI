/**
 * Verified AutoFix Module - Public API
 * 
 * Exports for the verified autofix pipeline:
 * - Format validation
 * - Temp workspace management
 * - Repo fingerprinting
 * - Full pipeline orchestration
 */

// Format validation
export {
  validateAgentOutput,
  validateJsonShape,
  validateUnifiedDiff,
  validatePathSafety,
  validateCommandSafety,
  detectStubs,
  stripMarkdownFences,
  isMarkdownWrapped,
  type GuardrailV1Output,
  type ValidationResult,
  type DiffValidationResult,
  type ParsedHunk,
  type FullValidationResult,
} from './format-validator';

// Workspace management
export {
  TempWorkspace,
  tempWorkspace,
  type WorkspaceOptions,
  type WorkspaceInfo,
  type ApplyResult,
  type VerifyResult,
  type CheckResult,
} from './workspace';

// Repo fingerprinting
export {
  fingerprintRepo,
  getInstallCommand,
  getBuildCommand,
  getTestCommand,
  getTypecheckCommand,
  type PackageManager,
  type BuildTool,
  type Framework,
  type TestRunner,
  type RepoFingerprint,
  type FingerprintResult,
} from './repo-fingerprint';

// Pipeline orchestration
export {
  VerifiedAutofixPipeline,
  verifiedAutofixPipeline,
  formatPipelineResult,
  formatPipelineResultJson,
  type PipelineOptions,
  type PipelineStage,
  type PipelineResult,
} from './pipeline';
