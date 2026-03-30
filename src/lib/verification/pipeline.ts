/**
 * Verification Pipeline
 * Orchestrates all verification checks in the correct order
 */

import {
  VerificationContext,
  VerificationResult,
  CheckResult,
  StrictAgentOutput,
  RepoFingerprint,
  WorkspaceInfo,
} from './types';
import { validateFormat } from './format-validator';
import { fingerprint } from './repo-fingerprint';
import { getDefaultScopeLock, validateScopeLock, validateCommandsInScope } from './scope-lock';
import {
  setupWorkspace,
  applyDiff,
  readWorkspaceFile,
  runInWorkspace,
} from './workspace';
import {
  validateDiffStructure,
  getFilesFromDiff,
  parseDiff,
} from './checks/diff-validator';
import { validatePaths } from './checks/path-validator';
import { validateCommands } from './checks/command-safety';
import { validateCommandsTooling } from './checks/command-tooling';
import { validateFilesForStubs, extractAddedLinesFromDiff } from './checks/stub-detector';
import { validateFilesForSecrets } from './checks/secret-detector';
import { buildFailureContext } from './failure-context';

/**
 * Run the complete verification pipeline
 */
export async function runVerificationPipeline(
  output: StrictAgentOutput,
  context: VerificationContext
): Promise<VerificationResult> {
  const checks: CheckResult[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Handle error responses from agent
  if (output.error) {
    return {
      success: false,
      checks: [{
        check: 'agent-error',
        status: 'fail',
        message: `Agent reported error: ${output.error}`,
      }],
      blockers: [`Agent error: ${output.error}`],
      warnings: [],
      parsedOutput: output,
    };
  }

  // ========================================
  // PHASE 1: Instant checks (no I/O)
  // ========================================

  // 1. Diff structure validation
  const diffCheck = validateDiffStructure(output.diff);
  checks.push(diffCheck);
  if (diffCheck.status === 'fail') {
    blockers.push(diffCheck.message);
  }

  // 2. Path safety validation
  const files = getFilesFromDiff(output.diff);
  const pathCheck = validatePaths(files, context.scopeLock);
  checks.push(pathCheck);
  if (pathCheck.status === 'fail') {
    blockers.push(...(pathCheck.blockers || [pathCheck.message]));
  }

  // 3. Command safety validation
  const commandCheck = validateCommands(output.commands || []);
  checks.push(commandCheck);
  if (commandCheck.status === 'fail') {
    blockers.push(...(commandCheck.blockers || [commandCheck.message]));
  } else if (commandCheck.status === 'warn') {
    warnings.push(commandCheck.message);
  }

  // 4. Scope lock validation
  const scopeLock = context.scopeLock || getDefaultScopeLock(context.mode);
  const scopeCheck = validateScopeLock(output.diff, scopeLock);
  checks.push(scopeCheck);
  if (scopeCheck.status === 'fail') {
    blockers.push(...(scopeCheck.blockers || [scopeCheck.message]));
  }

  // Command scope check
  if (output.commands && output.commands.length > 0) {
    const cmdScopeCheck = validateCommandsInScope(output.commands, scopeLock);
    checks.push(cmdScopeCheck);
    if (cmdScopeCheck.status === 'fail') {
      blockers.push(...(cmdScopeCheck.blockers || [cmdScopeCheck.message]));
    }
  }

  // PHASE 1 aggregation - fail fast if any blockers
  if (blockers.length > 0) {
    const result: VerificationResult = {
      success: false,
      checks,
      blockers,
      warnings,
      parsedOutput: output,
    };
    result.failureContext = buildFailureContext(result);
    return result;
  }

  // ========================================
  // PHASE 2: Repo-aware checks (read FS)
  // ========================================

  // 5. Repo fingerprint
  let fp: RepoFingerprint;
  try {
    fp = fingerprint(context.projectRoot);
    checks.push({
      check: 'repo-fingerprint',
      status: 'pass',
      message: `Detected: ${fp.packageManager || 'unknown'} (pm), ${fp.testRunner || 'unknown'} (test), ${fp.framework || 'unknown'} (framework)`,
    });
  } catch (err) {
    checks.push({
      check: 'repo-fingerprint',
      status: 'warn',
      message: `Could not fingerprint repo: ${err instanceof Error ? err.message : String(err)}`,
    });
    fp = {
      packageManager: null,
      framework: null,
      monorepoTool: null,
      testRunner: null,
      linter: null,
      typescript: false,
      scripts: {},
      hasGit: false,
    };
  }

  // 6. Command tooling validation
  if (output.commands && output.commands.length > 0) {
    const toolingCheck = validateCommandsTooling(output.commands, fp);
    checks.push(toolingCheck);
    if (toolingCheck.status === 'fail') {
      blockers.push(...(toolingCheck.blockers || [toolingCheck.message]));
    } else if (toolingCheck.status === 'warn') {
      warnings.push(toolingCheck.message);
    }
  }

  // Fail fast if tooling check failed
  if (blockers.length > 0) {
    const result: VerificationResult = {
      success: false,
      checks,
      blockers,
      warnings,
      parsedOutput: output,
    };
    result.failureContext = buildFailureContext(result);
    return result;
  }

  // ========================================
  // PHASE 3: Workspace checks
  // ========================================

  let workspace: WorkspaceInfo | null = null;

  try {
    // 7. Setup temp workspace
    workspace = await setupWorkspace(context.projectRoot);
    checks.push({
      check: 'workspace-setup',
      status: 'pass',
      message: `Workspace created: ${workspace.isWorktree ? 'git worktree' : 'copy'}`,
    });

    // 8. Apply diff
    const applyResult = await applyDiff(workspace, output.diff);
    if (!applyResult.success) {
      checks.push({
        check: 'diff-apply',
        status: 'fail',
        message: applyResult.error || 'Failed to apply diff',
        suggestedFix: 'Ensure the diff is valid and applies cleanly to the current codebase',
      });
      blockers.push(applyResult.error || 'Diff application failed');

      const result: VerificationResult = {
        success: false,
        checks,
        blockers,
        warnings,
        parsedOutput: output,
      };
      result.failureContext = buildFailureContext(result);
      return result;
    }

    checks.push({
      check: 'diff-apply',
      status: 'pass',
      message: 'Diff applied successfully',
    });

    // 9. Secret detection on changed files
    const changedFiles: Array<{ path: string; content: string }> = [];
    for (const filePath of files) {
      const content = await readWorkspaceFile(workspace, filePath);
      if (content !== null) {
        changedFiles.push({ path: filePath, content });
      }
    }

    const secretCheck = validateFilesForSecrets(changedFiles);
    checks.push(secretCheck);
    if (secretCheck.status === 'fail') {
      blockers.push(...(secretCheck.blockers || [secretCheck.message]));
    } else if (secretCheck.status === 'warn') {
      warnings.push(secretCheck.message);
    }

    // 10. Stub detection on changed files (intent-aware)
    const stubCheck = validateFilesForStubs(changedFiles, context.mode);
    checks.push(stubCheck);
    if (stubCheck.status === 'fail') {
      blockers.push(...(stubCheck.blockers || [stubCheck.message]));
    } else if (stubCheck.status === 'warn') {
      warnings.push(stubCheck.message);
    }

    // Fail fast after content checks
    if (blockers.length > 0) {
      const result: VerificationResult = {
        success: false,
        checks,
        blockers,
        warnings,
        parsedOutput: output,
      };
      result.failureContext = buildFailureContext(result);
      return result;
    }

    // ========================================
    // PHASE 4: Execution checks
    // ========================================

    // 11. Typecheck (if TypeScript)
    if (fp.typescript && context.strict) {
      const tscResult = await runInWorkspace(workspace, 'npx tsc --noEmit', 120000);
      if (tscResult.exitCode !== 0 && !tscResult.timedOut) {
        checks.push({
          check: 'typecheck',
          status: 'fail',
          message: 'TypeScript compilation failed',
          details: tscResult.stderr || tscResult.stdout,
          suggestedFix: 'Fix type errors in the diff',
        });
        blockers.push('TypeScript compilation failed');
      } else if (tscResult.timedOut) {
        checks.push({
          check: 'typecheck',
          status: 'warn',
          message: 'TypeScript check timed out',
        });
        warnings.push('TypeScript check timed out');
      } else {
        checks.push({
          check: 'typecheck',
          status: 'pass',
          message: 'TypeScript compilation passed',
        });
      }
    } else {
      checks.push({
        check: 'typecheck',
        status: 'skip',
        message: fp.typescript ? 'Skipped (not strict mode)' : 'No TypeScript detected',
      });
    }

    // 12. Lint (if configured and not explore mode)
    if (fp.linter && context.mode !== 'explore') {
      const lintCmd = fp.linter === 'biome' ? 'npx biome check .' : 'npx eslint .';
      const lintResult = await runInWorkspace(workspace, lintCmd, 60000);
      if (lintResult.exitCode !== 0 && !lintResult.timedOut) {
        checks.push({
          check: 'lint',
          status: context.mode === 'ship' ? 'fail' : 'warn',
          message: 'Lint check failed',
          details: lintResult.stderr || lintResult.stdout,
          suggestedFix: 'Fix lint errors in the diff',
        });
        if (context.mode === 'ship') {
          blockers.push('Lint check failed');
        } else {
          warnings.push('Lint check failed');
        }
      } else if (lintResult.timedOut) {
        checks.push({
          check: 'lint',
          status: 'warn',
          message: 'Lint check timed out',
        });
        warnings.push('Lint check timed out');
      } else {
        checks.push({
          check: 'lint',
          status: 'pass',
          message: 'Lint check passed',
        });
      }
    } else {
      checks.push({
        check: 'lint',
        status: 'skip',
        message: context.mode === 'explore' ? 'Skipped (explore mode)' : 'No linter detected',
      });
    }

    // 13. Build (ship mode only)
    if (context.mode === 'ship' && fp.scripts['build']) {
      const buildCmd = `${fp.packageManager || 'npm'} run build`;
      const buildResult = await runInWorkspace(workspace, buildCmd, 300000);
      if (buildResult.exitCode !== 0 && !buildResult.timedOut) {
        checks.push({
          check: 'build',
          status: 'fail',
          message: 'Build failed',
          details: buildResult.stderr || buildResult.stdout,
          suggestedFix: 'Fix build errors',
        });
        blockers.push('Build failed');
      } else if (buildResult.timedOut) {
        checks.push({
          check: 'build',
          status: 'warn',
          message: 'Build timed out',
        });
        warnings.push('Build timed out');
      } else {
        checks.push({
          check: 'build',
          status: 'pass',
          message: 'Build succeeded',
        });
      }
    } else {
      checks.push({
        check: 'build',
        status: 'skip',
        message: context.mode !== 'ship' ? 'Skipped (not ship mode)' : 'No build script',
      });
    }

    // 14. Tests (if provided and runTests is true)
    if (context.runTests && output.tests && output.tests.length > 0) {
      for (const testCmd of output.tests) {
        const testResult = await runInWorkspace(workspace, testCmd, 120000);
        if (testResult.exitCode !== 0 && !testResult.timedOut) {
          checks.push({
            check: 'test',
            status: 'fail',
            message: `Test failed: ${testCmd}`,
            details: testResult.stderr || testResult.stdout,
            suggestedFix: 'Fix failing tests',
          });
          blockers.push(`Test failed: ${testCmd}`);
        } else if (testResult.timedOut) {
          checks.push({
            check: 'test',
            status: 'warn',
            message: `Test timed out: ${testCmd}`,
          });
          warnings.push(`Test timed out: ${testCmd}`);
        } else {
          checks.push({
            check: 'test',
            status: 'pass',
            message: `Test passed: ${testCmd}`,
          });
        }
      }
    } else {
      checks.push({
        check: 'test',
        status: 'skip',
        message: !context.runTests ? 'Tests disabled' : 'No tests specified',
      });
    }

  } finally {
    // Always cleanup workspace
    if (workspace) {
      await workspace.cleanup();
    }
  }

  // Build final result
  const success = blockers.length === 0;
  const result: VerificationResult = {
    success,
    checks,
    blockers,
    warnings,
    parsedOutput: output,
    appliedDiff: success,
  };

  if (!success) {
    result.failureContext = buildFailureContext(result);
  }

  return result;
}

/**
 * Verify raw agent output (parse + pipeline)
 */
export async function verifyAgentOutput(
  rawResponse: string,
  context: VerificationContext
): Promise<VerificationResult> {
  // Validate format first
  const formatResult = validateFormat(rawResponse);

  if (!formatResult.valid || !formatResult.output) {
    return {
      success: false,
      checks: [{
        check: 'format-validation',
        status: 'fail',
        message: formatResult.error || 'Invalid format',
        suggestedFix: formatResult.retryPrompt,
      }],
      blockers: [formatResult.error || 'Invalid format'],
      warnings: [],
      failureContext: formatResult.retryPrompt,
    };
  }

  // Run pipeline
  return runVerificationPipeline(formatResult.output, context);
}

/**
 * Verify with auto-retry support
 */
export async function verifyWithRetry(
  rawResponse: string,
  context: VerificationContext,
  maxRetries: number,
  retryCallback: (retryPrompt: string, attempt: number) => Promise<string>
): Promise<VerificationResult> {
  let currentResponse = rawResponse;
  let lastResult: VerificationResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await verifyAgentOutput(currentResponse, context);

    if (result.success) {
      return result;
    }

    lastResult = result;

    // Don't retry after max attempts
    if (attempt >= maxRetries) {
      break;
    }

    // Get retry prompt
    const retryPrompt = result.failureContext;
    if (!retryPrompt) {
      break;
    }

    // Call retry callback to get new response
    try {
      currentResponse = await retryCallback(retryPrompt, attempt + 1);
    } catch {
      break;
    }
  }

  return lastResult || {
    success: false,
    checks: [],
    blockers: ['Verification failed after retries'],
    warnings: [],
  };
}
