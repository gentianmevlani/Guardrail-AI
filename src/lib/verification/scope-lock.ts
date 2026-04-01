/**
 * Scope Lock
 * Validates changes are within allowed scope
 */

import { CheckResult, ScopeLock, ParsedDiff } from './types';
import { parseDiff } from './checks/diff-validator';

/**
 * Default scope lock for different modes
 */
export function getDefaultScopeLock(mode: 'build' | 'explore' | 'ship'): ScopeLock {
  switch (mode) {
    case 'explore':
      return {
        allowedPaths: [],
        allowedCommands: [],
        maxFiles: 50,
        maxLinesChanged: 2000,
      };
    case 'build':
      return {
        allowedPaths: [],
        allowedCommands: [],
        maxFiles: 20,
        maxLinesChanged: 1000,
      };
    case 'ship':
      return {
        allowedPaths: [],
        allowedCommands: [],
        maxFiles: 10,
        maxLinesChanged: 500,
      };
  }
}

/**
 * Validate diff against scope lock
 */
export function validateScopeLock(
  diff: string,
  scopeLock: ScopeLock
): CheckResult {
  const parsed = parseDiff(diff);

  const violations: string[] = [];

  // Check file count
  if (scopeLock.maxFiles > 0 && parsed.totalFiles > scopeLock.maxFiles) {
    violations.push(
      `Too many files modified: ${parsed.totalFiles} (max: ${scopeLock.maxFiles})`
    );
  }

  // Check total lines changed
  const totalLinesChanged = parsed.totalAdditions + parsed.totalDeletions;
  if (scopeLock.maxLinesChanged > 0 && totalLinesChanged > scopeLock.maxLinesChanged) {
    violations.push(
      `Too many lines changed: ${totalLinesChanged} (max: ${scopeLock.maxLinesChanged})`
    );
  }

  // Check allowed paths
  if (scopeLock.allowedPaths.length > 0) {
    for (const file of parsed.files) {
      const isAllowed = scopeLock.allowedPaths.some(allowed => {
        const normalizedFile = file.path.replace(/\\/g, '/');
        const normalizedAllowed = allowed.replace(/\\/g, '/');

        // Exact match or directory prefix
        return (
          normalizedFile === normalizedAllowed ||
          normalizedFile.startsWith(normalizedAllowed + '/') ||
          matchGlob(normalizedFile, normalizedAllowed)
        );
      });

      if (!isAllowed) {
        violations.push(`File outside allowed scope: ${file.path}`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      check: 'scope-lock',
      status: 'fail',
      message: `Scope lock violation(s): ${violations.length}`,
      details: violations.join('\n'),
      blockers: violations,
      suggestedFix: 'Reduce the scope of changes or request expanded permissions',
    };
  }

  return {
    check: 'scope-lock',
    status: 'pass',
    message: `Within scope: ${parsed.totalFiles} file(s), ${totalLinesChanged} line(s) changed`,
  };
}

/**
 * Validate commands against scope lock
 */
export function validateCommandsInScope(
  commands: string[],
  scopeLock: ScopeLock
): CheckResult {
  if (!commands || commands.length === 0) {
    return {
      check: 'scope-lock-commands',
      status: 'pass',
      message: 'No commands to validate',
    };
  }

  if (scopeLock.allowedCommands.length === 0) {
    return {
      check: 'scope-lock-commands',
      status: 'pass',
      message: 'No command restrictions',
    };
  }

  const violations: string[] = [];

  for (const cmd of commands) {
    const isAllowed = scopeLock.allowedCommands.some(allowed => {
      return cmd.toLowerCase().startsWith(allowed.toLowerCase());
    });

    if (!isAllowed) {
      violations.push(`Command not in allowed list: ${cmd}`);
    }
  }

  if (violations.length > 0) {
    return {
      check: 'scope-lock-commands',
      status: 'fail',
      message: `${violations.length} command(s) outside allowed scope`,
      details: violations.join('\n'),
      blockers: violations,
      suggestedFix: `Allowed commands: ${scopeLock.allowedCommands.join(', ')}`,
    };
  }

  return {
    check: 'scope-lock-commands',
    status: 'pass',
    message: `All ${commands.length} command(s) within scope`,
  };
}

/**
 * Simple glob matching
 */
function matchGlob(path: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return false;
  }

  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Merge scope locks (most restrictive wins)
 */
export function mergeScopeLocks(base: ScopeLock, override: Partial<ScopeLock>): ScopeLock {
  return {
    allowedPaths:
      override.allowedPaths !== undefined
        ? override.allowedPaths
        : base.allowedPaths,
    allowedCommands:
      override.allowedCommands !== undefined
        ? override.allowedCommands
        : base.allowedCommands,
    maxFiles: Math.min(
      base.maxFiles || Infinity,
      override.maxFiles || Infinity
    ),
    maxLinesChanged: Math.min(
      base.maxLinesChanged || Infinity,
      override.maxLinesChanged || Infinity
    ),
  };
}

/**
 * Create a scope lock from a list of files
 */
export function createScopeLockFromFiles(files: string[]): Partial<ScopeLock> {
  if (files.length === 0) {
    return {};
  }

  // Find common directory prefix
  const directories = new Set<string>();
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    const dir = normalized.substring(0, normalized.lastIndexOf('/'));
    if (dir) {
      directories.add(dir);
    }
  }

  return {
    allowedPaths: Array.from(directories),
    maxFiles: files.length + 5,
  };
}
