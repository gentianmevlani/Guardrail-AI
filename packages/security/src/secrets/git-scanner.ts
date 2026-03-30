/**
 * git-scanner.ts
 * Scan git history for secrets in commit diffs
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { SecretDetection, SecretsGuardian, ScanOptions } from './guardian';

export interface HistoricalDetection extends SecretDetection {
  commitHash: string;
  commitDate: string;
  author: string;
}

export interface GitHistoryScanOptions extends ScanOptions {
  depth?: number; // Number of commits to scan (default 50)
  branch?: string; // Branch to scan (default: current)
}

export interface GitHistoryScanResult {
  projectId: string;
  commitsScanned: number;
  detections: HistoricalDetection[];
  summary: {
    totalSecrets: number;
    byCommit: Record<string, number>;
    byType: Record<string, number>;
  };
}

/**
 * Scan git history for secrets
 */
export async function scanGitHistory(
  projectPath: string,
  projectId: string,
  guardian: SecretsGuardian,
  options: GitHistoryScanOptions = {}
): Promise<GitHistoryScanResult> {
  const depth = options.depth ?? 50;
  const branch = options.branch ?? 'HEAD';

  // Check if git repo exists
  const gitDir = join(projectPath, '.git');
  if (!existsSync(gitDir)) {
    throw new Error('Not a git repository');
  }

  // Get commit list
  const commits = getRecentCommits(projectPath, depth, branch);
  
  const allDetections: HistoricalDetection[] = [];
  const byCommit: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const commit of commits) {
    const diff = getCommitDiff(projectPath, commit.hash);
    
    // Scan the diff content
    const detections = await guardian.scanContent(
      diff,
      `commit:${commit.hash}`,
      projectId,
      options
    );

    // Convert to historical detections
    for (const detection of detections) {
      const historical: HistoricalDetection = {
        ...detection,
        commitHash: commit.hash,
        commitDate: commit.date,
        author: commit.author,
      };
      
      allDetections.push(historical);
      byCommit[commit.hash] = (byCommit[commit.hash] ?? 0) + 1;
      byType[detection.secretType] = (byType[detection.secretType] ?? 0) + 1;
    }
  }

  return {
    projectId,
    commitsScanned: commits.length,
    detections: allDetections,
    summary: {
      totalSecrets: allDetections.length,
      byCommit,
      byType,
    },
  };
}

interface CommitInfo {
  hash: string;
  date: string;
  author: string;
}

/**
 * Get recent commits
 */
function getRecentCommits(projectPath: string, depth: number, branch: string): CommitInfo[] {
  try {
    const output = execSync(
      `git log ${branch} --format=%H|%aI|%an -n ${depth}`,
      {
        cwd: projectPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const commits: CommitInfo[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 3) {
        commits.push({
          hash: parts[0] ?? '',
          date: parts[1] ?? '',
          author: parts[2] ?? '',
        });
      }
    }

    return commits;
  } catch (err) {
    throw new Error(`Failed to get git commits: ${(err as Error).message}`);
  }
}

/**
 * Get diff for a commit
 */
function getCommitDiff(projectPath: string, commitHash: string): string {
  try {
    // Get the diff for added lines only (+ lines)
    const output = execSync(
      `git show ${commitHash} --format= --unified=0`,
      {
        cwd: projectPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    // Extract only added lines (lines starting with +)
    const lines = output.split('\n');
    const addedLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // Remove the leading + and add to content
        addedLines.push(line.substring(1));
      }
    }

    return addedLines.join('\n');
  } catch (err) {
    // If commit doesn't exist or error, return empty
    return '';
  }
}
