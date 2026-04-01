/**
 * Polish Service Utilities
 * 
 * Shared utility functions for polish checkers
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if a path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a file by pattern in a directory
 */
export async function findFile(
  dir: string,
  pattern: RegExp
): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await findFile(fullPath, pattern);
        if (found) return found;
      } else if (pattern.test(entry.name)) {
        return fullPath;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Read file content safely
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Check if file contains pattern
 */
export async function fileContains(
  filePath: string,
  pattern: RegExp
): Promise<boolean> {
  const content = await readFileSafe(filePath);
  if (!content) return false;
  return pattern.test(content);
}

/**
 * Find all files matching pattern
 */
export async function findAllFiles(
  dir: string,
  pattern: RegExp
): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await findAllFiles(fullPath, pattern);
        results.push(...found);
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }

  return results;
}


