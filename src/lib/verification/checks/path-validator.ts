/**
 * Path Validator Check
 * Validates file paths for safety and allowed scope
 */

import * as path from 'path';
import { CheckResult, PROTECTED_PATHS, ScopeLock } from '../types';

/**
 * Normalize path separators and resolve relative paths
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Check if a path attempts directory traversal
 */
function hasPathTraversal(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes('..') ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized)
  );
}

/**
 * Check if path is protected
 */
function isProtectedPath(filePath: string): string | null {
  const normalized = normalizePath(filePath);
  const normalizedLower = normalized.toLowerCase();

  for (const protected_ of PROTECTED_PATHS) {
    const protectedNorm = protected_.toLowerCase().replace(/\\/g, '/');
    
    // Exact match
    if (normalizedLower === protectedNorm || normalizedLower === protectedNorm.replace(/\/$/, '')) {
      return protected_;
    }

    // Starts with protected directory
    if (protectedNorm.endsWith('/') && normalizedLower.startsWith(protectedNorm)) {
      return protected_;
    }

    // Path contains protected directory as a segment
    if (normalizedLower.includes(`/${protectedNorm}`) || normalizedLower.startsWith(protectedNorm + '/')) {
      return protected_;
    }
  }

  return null;
}

/**
 * Check if path is within allowed scope
 */
function isWithinScope(filePath: string, allowedPaths: string[]): boolean {
  if (allowedPaths.length === 0) {
    return true;
  }

  const normalized = normalizePath(filePath);

  for (const allowed of allowedPaths) {
    const allowedNorm = normalizePath(allowed);
    
    // Exact match or starts with allowed path
    if (normalized === allowedNorm || normalized.startsWith(allowedNorm + '/')) {
      return true;
    }

    // Glob pattern support (simple)
    if (allowedNorm.includes('*')) {
      const regex = new RegExp(
        '^' + allowedNorm.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      if (regex.test(normalized)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate a single path
 */
export function validatePath(
  filePath: string,
  scopeLock?: ScopeLock
): CheckResult {
  const normalized = normalizePath(filePath);

  // Check for empty path
  if (!normalized || normalized.trim().length === 0) {
    return {
      check: 'path-safety',
      status: 'fail',
      message: 'Empty file path',
      file: filePath,
      suggestedFix: 'Provide a valid file path',
    };
  }

  // Check for path traversal
  if (hasPathTraversal(filePath)) {
    return {
      check: 'path-safety',
      status: 'fail',
      message: `Path traversal detected: ${filePath}`,
      file: filePath,
      suggestedFix: 'Use relative paths within the project directory without ".." segments',
    };
  }

  // Check for protected paths
  const protectedMatch = isProtectedPath(normalized);
  if (protectedMatch) {
    return {
      check: 'path-safety',
      status: 'fail',
      message: `Attempt to modify protected path: ${filePath} (matches ${protectedMatch})`,
      file: filePath,
      suggestedFix: `Do not modify protected files/directories: ${PROTECTED_PATHS.join(', ')}`,
    };
  }

  // Check scope lock
  if (scopeLock && scopeLock.allowedPaths.length > 0) {
    if (!isWithinScope(normalized, scopeLock.allowedPaths)) {
      return {
        check: 'path-safety',
        status: 'fail',
        message: `Path outside allowed scope: ${filePath}`,
        file: filePath,
        suggestedFix: `Only modify files within: ${scopeLock.allowedPaths.join(', ')}`,
      };
    }
  }

  return {
    check: 'path-safety',
    status: 'pass',
    message: `Path is safe: ${normalized}`,
    file: normalized,
  };
}

/**
 * Validate multiple paths from a diff
 */
export function validatePaths(
  filePaths: string[],
  scopeLock?: ScopeLock
): CheckResult {
  const failures: CheckResult[] = [];

  for (const filePath of filePaths) {
    const result = validatePath(filePath, scopeLock);
    if (result.status === 'fail') {
      failures.push(result);
    }
  }

  if (failures.length > 0) {
    return {
      check: 'path-safety',
      status: 'fail',
      message: `${failures.length} path validation failure(s)`,
      details: failures.map(f => f.message).join('\n'),
      blockers: failures.map(f => f.message),
      suggestedFix: failures[0].suggestedFix,
    };
  }

  // Check file count limit
  if (scopeLock && scopeLock.maxFiles > 0 && filePaths.length > scopeLock.maxFiles) {
    return {
      check: 'path-safety',
      status: 'fail',
      message: `Too many files modified: ${filePaths.length} (max: ${scopeLock.maxFiles})`,
      suggestedFix: `Reduce the number of files modified to ${scopeLock.maxFiles} or fewer`,
    };
  }

  return {
    check: 'path-safety',
    status: 'pass',
    message: `All ${filePaths.length} path(s) validated`,
  };
}

/**
 * Extract relative path from diff file header
 * Handles a/path and b/path prefixes
 */
export function extractPathFromDiffHeader(header: string): string {
  // Remove a/ or b/ prefix
  let cleaned = header.replace(/^[ab]\//, '');
  // Normalize
  return normalizePath(cleaned);
}
