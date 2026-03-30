/**
 * Shared filesystem utilities for polish engines.
 */

import fs from 'fs';
import path from 'path';

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findFile(
  dir: string,
  pattern: RegExp,
  maxDepth = 5,
  currentDepth = 0
): Promise<string | null> {
  if (currentDepth >= maxDepth) return null;

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build'
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await findFile(fullPath, pattern, maxDepth, currentDepth + 1);
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

export async function findAllFiles(
  dir: string,
  pattern: RegExp,
  maxDepth = 5,
  currentDepth = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];
  const results: string[] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build'
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await findAllFiles(fullPath, pattern, maxDepth, currentDepth + 1);
        results.push(...found);
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Ignore permission / read errors
  }

  return results;
}

export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function fileContains(filePath: string, pattern: RegExp): Promise<boolean> {
  const content = await readFileSafe(filePath);
  if (!content) return false;
  return pattern.test(content);
}
