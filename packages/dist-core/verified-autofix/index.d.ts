/**
 * Verified AutoFix Module - Public API
 *
 * Exports for the verified autofix pipeline:
 * - Format validation
 * - Temp workspace management
 * - Repo fingerprinting
 * - Full pipeline orchestration
 */
export { validateAgentOutput, validateJsonShape, validateUnifiedDiff, validatePathSafety, validateCommandSafety, detectStubs, stripMarkdownFences, isMarkdownWrapped, type GuardrailV1Output, type ValidationResult, type DiffValidationResult, type ParsedHunk, type FullValidationResult, } from './format-validator';
export { TempWorkspace, tempWorkspace, type WorkspaceOptions, type WorkspaceInfo, type ApplyResult, type VerifyResult, type CheckResult, } from './workspace';
export { fingerprintRepo, getInstallCommand, getBuildCommand, getTestCommand, getTypecheckCommand, type PackageManager, type BuildTool, type Framework, type TestRunner, type RepoFingerprint, type FingerprintResult, } from './repo-fingerprint';
export { VerifiedAutofixPipeline, verifiedAutofixPipeline, formatPipelineResult, formatPipelineResultJson, type PipelineOptions, type PipelineStage, type PipelineResult, } from './pipeline';
//# sourceMappingURL=index.d.ts.map