/**
 * Incremental scanning with git diff support
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface IncrementalOptions {
  since?: string;
  projectPath: string;
}

export interface IncrementalResult {
  enabled: boolean;
  changedFiles: string[];
  baseCommit?: string;
  error?: string;
}

export class IncrementalScanner {
  /**
   * Get list of changed files since a commit
   * Returns all files if not a git repo or if since is not provided
   */
  static getChangedFiles(options: IncrementalOptions): IncrementalResult {
    if (!options.since) {
      return {
        enabled: false,
        changedFiles: [],
      };
    }

    // Check if this is a git repository
    const gitDir = join(options.projectPath, '.git');
    if (!existsSync(gitDir)) {
      return {
        enabled: false,
        changedFiles: [],
        error: 'Not a git repository',
      };
    }

    try {
      // Get changed files using git diff
      const output = execSync(`git diff --name-only ${options.since}...HEAD`, {
        cwd: options.projectPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const changedFiles = output
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      return {
        enabled: true,
        changedFiles,
        baseCommit: options.since,
      };
    } catch (error: any) {
      // Git command failed (invalid commit, not a repo, etc.)
      return {
        enabled: false,
        changedFiles: [],
        error: error.message || 'Git diff failed',
      };
    }
  }

  /**
   * Filter files to scan based on incremental mode
   * Only applies to secrets scan - vulnerabilities/compliance run full
   */
  static shouldScanFile(filePath: string, incrementalResult: IncrementalResult): boolean {
    if (!incrementalResult.enabled) {
      return true; // Scan all files if incremental mode disabled
    }

    // Check if file is in changed files list
    return incrementalResult.changedFiles.some(changed => 
      filePath.includes(changed) || changed.includes(filePath)
    );
  }

  /**
   * Get explanation message for incremental mode
   */
  static getIncrementalMessage(incrementalResult: IncrementalResult): string {
    if (!incrementalResult.enabled) {
      return '';
    }

    if (incrementalResult.error) {
      return `Incremental mode disabled: ${incrementalResult.error}`;
    }

    return `Incremental mode: scanning ${incrementalResult.changedFiles.length} changed files since ${incrementalResult.baseCommit}`;
  }
}
