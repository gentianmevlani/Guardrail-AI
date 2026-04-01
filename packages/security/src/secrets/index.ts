/**
 * Secrets & Credential Guardian
 *
 * Detects and prevents exposure of secrets and credentials
 */

export * from './patterns';
export * from './stripe-placeholder-prefix';
export { secretsGuardian, SecretsGuardian } from './guardian';
export { preCommitHook } from './pre-commit';
export { vaultIntegration } from './vault-integration';
export { loadCustomPatterns, ConfigValidationError } from './config-loader';
export { Allowlist } from './allowlist';
export { adjustRiskByContext, getContextDescription } from './contextual-risk';
export { scanGitHistory } from './git-scanner';
