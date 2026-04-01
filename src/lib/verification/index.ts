/**
 * Verification Layer
 * Main entry point for the Prompt Firewall + Output Verification system
 */

export * from './types';
export { validateFormat, FormatValidationResult } from './format-validator';
export { fingerprint, getRunPrefix, getInstallCommand } from './repo-fingerprint';
export {
  getDefaultScopeLock,
  validateScopeLock,
  validateCommandsInScope,
  mergeScopeLocks,
  createScopeLockFromFiles,
} from './scope-lock';
export {
  setupWorkspace,
  applyDiff,
  readWorkspaceFile,
  listWorkspaceFiles,
  runInWorkspace,
} from './workspace';
export {
  execCommand,
  execCommandWithTimeout,
  commandExists,
  getGitVersion,
  isGitRepo,
} from './exec-utils';
export {
  buildFailureContext,
  buildFailureSummary,
  formatCheckResults,
  buildJsonReport,
  getFailureLocations,
} from './failure-context';
export {
  runVerificationPipeline,
  verifyAgentOutput,
  verifyWithRetry,
} from './pipeline';

// Re-export checks
export * from './checks';
