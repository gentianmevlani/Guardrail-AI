/**
 * Shared CLI Utilities
 *
 * Common validation, error handling, and helpers
 * used across all commands.
 */

import { resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { ExitCode, exitWith, getExitCodeForError } from '../runtime/exit-codes';
import { styles, icons } from '../ui';

// ─────────────────────────────────────────────────────────────────────────────
// PATH VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and resolve a project path.
 * Exits with USER_ERROR if path doesn't exist or isn't a directory.
 */
export function validateProjectPath(pathArg: string): string {
  const projectPath = resolve(pathArg);

  if (!existsSync(projectPath)) {
    exitWith(ExitCode.USER_ERROR, `Path does not exist: ${projectPath}`);
  }

  try {
    const stat = statSync(projectPath);
    if (!stat.isDirectory()) {
      exitWith(ExitCode.USER_ERROR, `Path is not a directory: ${projectPath}`);
    }
  } catch {
    exitWith(ExitCode.USER_ERROR, `Cannot access path: ${projectPath}`);
  }

  return projectPath;
}

/**
 * Validate a URL string.
 * Returns the cleaned URL or exits with USER_ERROR.
 */
export function validateUrl(urlArg: string): string {
  const trimmed = urlArg.trim();

  // Add protocol if missing
  let url = trimmed;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname || parsed.hostname.length < 3) {
      exitWith(ExitCode.USER_ERROR, `Invalid URL: missing hostname in "${urlArg}"`);
    }
    // Strip trailing slash for consistency
    return url.replace(/\/+$/, '');
  } catch {
    exitWith(ExitCode.USER_ERROR, `Invalid URL: "${urlArg}". Expected format: https://example.com`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap a command action with top-level error handling.
 * Catches unhandled errors, classifies them, and exits cleanly.
 */
export function withErrorHandler(
  commandName: string,
  fn: () => Promise<void>,
  options?: { silent?: boolean },
): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const exitCode = getExitCodeForError(err);
      const silent = options?.silent ?? false;

      if (!silent) {
        console.error('');
        console.error(
          `  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${commandName} failed${styles.reset}`,
        );
        console.error(`  ${styles.dim}${err.message}${styles.reset}`);

        if (exitCode === ExitCode.SYSTEM_ERROR) {
          console.error(`  ${styles.dim}This looks like an internal error. Please report it.${styles.reset}`);
        } else if (exitCode === ExitCode.NETWORK_FAILURE) {
          console.error(`  ${styles.dim}Check your network connection and try again.${styles.reset}`);
        } else if (exitCode === ExitCode.AUTH_FAILURE) {
          console.error(`  ${styles.dim}Run: guardrail auth --key YOUR_KEY${styles.reset}`);
        }
        console.error('');
      }

      process.exit(exitCode);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GIT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a path is inside a git repository.
 */
export function isGitRepo(projectPath: string): boolean {
  try {
    const { execSync } = require('child_process');
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}
