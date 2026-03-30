/**
 * Verification Workspace
 * Creates isolated temp workspaces for safe diff application and testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { WorkspaceInfo, CommandExecResult } from './types';
import { execCommand, execCommandWithTimeout } from './exec-utils';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.nuxt',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.cache',
  '.output',
  '.vercel',
  '.netlify',
  '__pycache__',
  '.pytest_cache',
  'target',
  'vendor',
]);

const IGNORE_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.env.local',
  '.env.production',
  '.env.development',
]);

/**
 * Generate unique temp directory name
 */
function generateTempDirName(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `guardrail-verify-${timestamp}-${random}`;
}

/**
 * Recursively copy directory, respecting ignore patterns
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });

  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        await copyDirectory(srcPath, destPath);
      }
    } else if (entry.isFile()) {
      if (!IGNORE_FILES.has(entry.name)) {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
}

/**
 * Remove directory recursively
 */
async function removeDirectory(dir: string): Promise<void> {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Check if path has a git repository
 */
function hasGitRepo(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, '.git'));
}

/**
 * Setup verification workspace using git worktree (if git repo)
 */
async function setupWorktree(
  projectRoot: string,
  tempDir: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create worktree in detached HEAD state
    const result = await execCommandWithTimeout(
      `git worktree add --detach "${tempDir}"`,
      { cwd: projectRoot, timeoutMs: 30000 }
    );

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `git worktree failed: ${result.stderr}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `git worktree exception: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Remove git worktree
 */
async function removeWorktree(
  projectRoot: string,
  tempDir: string
): Promise<void> {
  try {
    await execCommandWithTimeout(
      `git worktree remove --force "${tempDir}"`,
      { cwd: projectRoot, timeoutMs: 10000 }
    );
  } catch {
    // Ignore errors, fallback to directory removal
  }
}

/**
 * Setup verification workspace
 */
export async function setupWorkspace(projectRoot: string): Promise<WorkspaceInfo> {
  const tempDirName = generateTempDirName();
  const tempDir = path.join(os.tmpdir(), tempDirName);

  const hasGit = hasGitRepo(projectRoot);
  let isWorktree = false;

  if (hasGit) {
    // Try git worktree first
    const worktreeResult = await setupWorktree(projectRoot, tempDir);
    if (worktreeResult.success) {
      isWorktree = true;
    } else {
      // Fallback to copy
      await copyDirectory(projectRoot, tempDir);
      // Initialize git in the copy for diff application
      await execCommandWithTimeout('git init', { cwd: tempDir, timeoutMs: 5000 });
      await execCommandWithTimeout('git add -A', { cwd: tempDir, timeoutMs: 10000 });
      await execCommandWithTimeout('git commit -m "initial" --allow-empty', {
        cwd: tempDir,
        timeoutMs: 10000,
      });
    }
  } else {
    // No git repo - copy and init
    await copyDirectory(projectRoot, tempDir);
    await execCommandWithTimeout('git init', { cwd: tempDir, timeoutMs: 5000 });
    await execCommandWithTimeout('git add -A', { cwd: tempDir, timeoutMs: 10000 });
    await execCommandWithTimeout('git commit -m "initial" --allow-empty', {
      cwd: tempDir,
      timeoutMs: 10000,
    });
  }

  const cleanup = async (): Promise<void> => {
    if (isWorktree) {
      await removeWorktree(projectRoot, tempDir);
    }
    await removeDirectory(tempDir);
  };

  return {
    tempDir,
    isWorktree,
    cleanup,
  };
}

/**
 * Apply diff to workspace (check first, then apply)
 */
export async function applyDiff(
  workspace: WorkspaceInfo,
  diff: string
): Promise<{ success: boolean; error?: string }> {
  const diffFile = path.join(workspace.tempDir, '.guardrail-diff.patch');

  try {
    // Write diff to temp file
    await fs.promises.writeFile(diffFile, diff, 'utf-8');

    // Check if diff can be applied
    const checkResult = await execCommandWithTimeout(
      `git apply --check "${diffFile}"`,
      { cwd: workspace.tempDir, timeoutMs: 30000 }
    );

    if (checkResult.exitCode !== 0) {
      return {
        success: false,
        error: `Diff cannot be applied cleanly: ${checkResult.stderr}`,
      };
    }

    // Apply the diff
    const applyResult = await execCommandWithTimeout(
      `git apply "${diffFile}"`,
      { cwd: workspace.tempDir, timeoutMs: 30000 }
    );

    if (applyResult.exitCode !== 0) {
      return {
        success: false,
        error: `Failed to apply diff: ${applyResult.stderr}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Exception applying diff: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    // Clean up diff file
    try {
      await fs.promises.unlink(diffFile);
    } catch {
      // Ignore
    }
  }
}

/**
 * Read file content from workspace
 */
export async function readWorkspaceFile(
  workspace: WorkspaceInfo,
  filePath: string
): Promise<string | null> {
  const fullPath = path.join(workspace.tempDir, filePath);
  try {
    return await fs.promises.readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * List files in workspace matching pattern
 */
export async function listWorkspaceFiles(
  workspace: WorkspaceInfo,
  pattern?: string
): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string, base: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(base, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath, relativePath);
        }
      } else if (entry.isFile()) {
        if (!pattern || relativePath.includes(pattern)) {
          files.push(relativePath);
        }
      }
    }
  }

  await walk(workspace.tempDir, '');
  return files;
}

/**
 * Run command in workspace
 */
export async function runInWorkspace(
  workspace: WorkspaceInfo,
  command: string,
  timeoutMs: number = 60000
): Promise<CommandExecResult> {
  return execCommandWithTimeout(command, {
    cwd: workspace.tempDir,
    timeoutMs,
  });
}
