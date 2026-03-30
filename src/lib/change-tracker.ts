/**
 * Change Tracker
 * 
 * Tracks changes in knowledge base and provides visual diffs
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodebaseKnowledge } from './codebase-knowledge';
import { execSync } from 'child_process';

export interface Change {
  type: 'added' | 'modified' | 'deleted';
  file: string;
  timestamp: string;
  description?: string;
}

export interface ChangeReport {
  projectPath: string;
  period: {
    start: string;
    end: string;
  };
  changes: Change[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
  };
}

export interface DiffVisualization {
  before: Partial<CodebaseKnowledge>;
  after: Partial<CodebaseKnowledge>;
  differences: Array<{
    path: string;
  before: unknown;
  after: unknown;
    type: 'added' | 'modified' | 'deleted';
  }>;
}

class ChangeTracker {
  // Note: changeHistory removed to fix unused variable error
  // Can be re-added when needed

  /**
   * Track changes in project
   */
  async trackChanges(projectPath: string, since?: string): Promise<ChangeReport> {
    const changes: Change[] = [];

    try {
      // Get git changes if available
      const gitChanges = await this.getGitChanges(projectPath, since);
      changes.push(...gitChanges);
    } catch {
      // Not a git repo or git not available
    }

    // Get file system changes
    const fsChanges = await this.getFileSystemChanges(projectPath, since);
    changes.push(...fsChanges);

    // Sort by timestamp
    changes.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const summary = {
      added: changes.filter(c => c.type === 'added').length,
      modified: changes.filter(c => c.type === 'modified').length,
      deleted: changes.filter(c => c.type === 'deleted').length,
    };

    return {
      projectPath,
      period: {
        start: since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      changes,
      summary,
    };
  }

  /**
   * Visualize diff between two knowledge bases
   */
  async visualizeDiff(
    before: CodebaseKnowledge,
    after: CodebaseKnowledge
  ): Promise<DiffVisualization> {
    const differences: DiffVisualization['differences'] = [];

    // Compare patterns
    const beforePatterns = new Map(before.patterns.map(p => [p.id, p]));
    const afterPatterns = new Map(after.patterns.map(p => [p.id, p]));

    for (const [id, pattern] of afterPatterns.entries()) {
      const beforePattern = beforePatterns.get(id);
      if (!beforePattern) {
        differences.push({
          path: `patterns.${id}`,
          before: undefined,
          after: pattern,
          type: 'added',
        });
      } else if (JSON.stringify(beforePattern) !== JSON.stringify(pattern)) {
        differences.push({
          path: `patterns.${id}`,
          before: beforePattern,
          after: pattern,
          type: 'modified',
        });
      }
    }

    for (const [id] of beforePatterns.entries()) {
      if (!afterPatterns.has(id)) {
        differences.push({
          path: `patterns.${id}`,
          before: beforePatterns.get(id),
          after: undefined,
          type: 'deleted',
        });
      }
    }

    // Compare decisions
    const beforeDecisions = new Map(before.decisions.map(d => [d.id, d]));
    const afterDecisions = new Map(after.decisions.map(d => [d.id, d]));

    for (const [id, decision] of afterDecisions.entries()) {
      if (!beforeDecisions.has(id)) {
        differences.push({
          path: `decisions.${id}`,
          before: undefined,
          after: decision,
          type: 'added',
        });
      }
    }

    // Compare architecture
    if (JSON.stringify(before.architecture) !== JSON.stringify(after.architecture)) {
      differences.push({
        path: 'architecture',
        before: before.architecture,
        after: after.architecture,
        type: 'modified',
      });
    }

    return {
      before: {
        patterns: before.patterns,
        decisions: before.decisions,
        architecture: before.architecture,
      },
      after: {
        patterns: after.patterns,
        decisions: after.decisions,
        architecture: after.architecture,
      },
      differences,
    };
  }

  /**
   * Get changes from git
   */
  private async getGitChanges(projectPath: string, since?: string): Promise<Change[]> {
    const changes: Change[] = [];

    try {
      const sinceArg = since ? `--since="${since}"` : '--since="7 days ago"';
      const result = execSync(
        `git log --name-status --pretty=format:"%H|%ai|%s" ${sinceArg}`,
        { cwd: projectPath, encoding: 'utf8' }
      );

      const lines = result.split('\n');
      // Note: currentCommit removed as it was unused
      let currentTimestamp: string | undefined = undefined;
      let currentMessage: string | undefined = undefined;

      for (const line of lines) {
        if (line.includes('|')) {
          const [hash, timestamp, ...messageParts] = line.split('|');
          currentCommit = hash || '';
          currentTimestamp = timestamp || undefined;
          currentMessage = messageParts.join('|') || undefined;
        } else if (line.match(/^[AMD]\s+/)) {
          const match = line.match(/^([AMD])\s+(.+)$/);
          if (match) {
            const [, status, file] = match;
            let type: Change['type'];
            if (status === 'A') type = 'added';
            else if (status === 'M') type = 'modified';
            else type = 'deleted';

            changes.push({
              type,
              file: file || '',
              timestamp: currentTimestamp || '',
              description: currentMessage || '',
            });
          }
        }
      }
    } catch {
      // Git not available or not a git repo
    }

    return changes;
  }

  /**
   * Get changes from file system
   */
  private async getFileSystemChanges(
    projectPath: string,
    since?: string
  ): Promise<Change[]> {
    const changes: Change[] = [];
    const sinceTime = since ? new Date(since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;

    try {
      const files = await this.findFiles(projectPath);
      for (const file of files) {
        const stats = await fs.promises.stat(file);
        if (stats.mtime.getTime() > sinceTime) {
          changes.push({
            type: 'modified',
            file: path.relative(projectPath, file),
            timestamp: stats.mtime.toISOString(),
          });
        }
      }
    } catch {
      // Error reading files
    }

    return changes;
  }

  /**
   * Find all files in project
   */
  private async findFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findFiles(fullPath));
        } else if (item.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.guardrail-cache'].includes(name);
  }
}

export const changeTracker = new ChangeTracker();

