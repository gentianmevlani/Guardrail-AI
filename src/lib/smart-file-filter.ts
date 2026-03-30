/**
 * Smart File Filter
 * 
 * Intelligently filters files to process only what's necessary
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface FilterOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number; // bytes
  minFileSize?: number;
  languages?: string[];
  gitTracked?: boolean;
  recentlyModified?: number; // days
  priorityExtensions?: string[];
}

export interface FileStats {
  total: number;
  included: number;
  excluded: number;
  byReason: Record<string, number>;
}

class SmartFileFilter {
  /**
   * Filter files intelligently
   */
  async filterFiles(
    projectPath: string,
    options: FilterOptions = {}
  ): Promise<{ files: string[]; stats: FileStats }> {
    const {
      includePatterns = [],
      excludePatterns = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '.next/**',
        'coverage/**',
        'vendor/**',
        'target/**',
        '**/*.min.js',
        '**/*.bundle.js',
      ],
      maxFileSize = 10 * 1024 * 1024, // 10MB
      minFileSize = 0,
      languages = ['typescript', 'javascript'],
      gitTracked = false,
      recentlyModified,
      priorityExtensions = ['.ts', '.tsx'],
    } = options;

    const allFiles: string[] = [];
    const stats: FileStats = {
      total: 0,
      included: 0,
      excluded: 0,
      byReason: {},
    };

    // Get all files
    await this.walkDirectory(projectPath, (file) => {
      allFiles.push(file);
    });

    stats.total = allFiles.length;

    // Get git tracked files if requested
    let gitFiles: Set<string> | null = null;
    if (gitTracked) {
      gitFiles = await this.getGitTrackedFiles(projectPath);
    }

    // Get recently modified files if requested
    let recentFiles: Set<string> | null = null;
    if (recentlyModified) {
      recentFiles = await this.getRecentlyModifiedFiles(projectPath, recentlyModified);
    }

    // Filter files
    const included: string[] = [];
    const priority: string[] = [];

    for (const file of allFiles) {
      const relativePath = path.relative(projectPath, file);
      let excluded = false;
      let reason = '';

      // Check exclude patterns
      if (this.matchesPatterns(relativePath, excludePatterns)) {
        excluded = true;
        reason = 'exclude-pattern';
      }

      // Check include patterns
      if (!excluded && includePatterns.length > 0) {
        if (!this.matchesPatterns(relativePath, includePatterns)) {
          excluded = true;
          reason = 'not-in-include-pattern';
        }
      }

      // Check file size
      if (!excluded) {
        try {
          const stats = await fs.promises.stat(file);
          if (stats.size > maxFileSize) {
            excluded = true;
            reason = 'file-too-large';
          } else if (stats.size < minFileSize) {
            excluded = true;
            reason = 'file-too-small';
          }
        } catch {
          excluded = true;
          reason = 'stat-error';
        }
      }

      // Check language
      if (!excluded && languages.length > 0) {
        const ext = path.extname(file);
        const langMap: Record<string, string> = {
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.py': 'python',
          '.rs': 'rust',
          '.go': 'go',
        };
        const fileLang = langMap[ext];
        if (!fileLang || !languages.includes(fileLang)) {
          excluded = true;
          reason = 'language-filter';
        }
      }

      // Check git tracked
      if (!excluded && gitTracked && gitFiles) {
        if (!gitFiles.has(relativePath)) {
          excluded = true;
          reason = 'not-git-tracked';
        }
      }

      // Check recently modified
      if (!excluded && recentlyModified && recentFiles) {
        if (!recentFiles.has(relativePath)) {
          excluded = true;
          reason = 'not-recently-modified';
        }
      }

      if (excluded) {
        stats.excluded++;
        stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
      } else {
        stats.included++;
        // Check if priority
        const ext = path.extname(file);
        if (priorityExtensions.includes(ext)) {
          priority.push(file);
        } else {
          included.push(file);
        }
      }
    }

    // Return priority files first
    return {
      files: [...priority, ...included],
      stats,
    };
  }

  /**
   * Check if path matches patterns
   */
  private matchesPatterns(path: string, patterns: string[]): boolean {
    const normalized = path.replace(/\\/g, '/');
    return patterns.some(pattern => {
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\./g, '\\.')
      );
      return regex.test(normalized);
    });
  }

  /**
   * Get git tracked files
   */
  private async getGitTrackedFiles(projectPath: string): Promise<Set<string>> {
    const files = new Set<string>();
    try {
      const result = execSync('git ls-files', {
        cwd: projectPath,
        encoding: 'utf8',
      });
      result.split('\n').forEach(file => {
        if (file.trim()) {
          files.add(file.trim());
        }
      });
    } catch {
      // Not a git repo or git not available
    }
    return files;
  }

  /**
   * Get recently modified files
   */
  private async getRecentlyModifiedFiles(
    projectPath: string,
    days: number
  ): Promise<Set<string>> {
    const files = new Set<string>();
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    try {
      await this.walkDirectory(projectPath, async (file) => {
        try {
          const stats = await fs.promises.stat(file);
          if (stats.mtime.getTime() > cutoffTime) {
            const relativePath = path.relative(projectPath, file);
            files.add(relativePath);
          }
        } catch {
          // Skip
        }
      });
    } catch {
      // Error
    }

    return files;
  }

  /**
   * Walk directory
   */
  private async walkDirectory(
    dir: string,
    callback: (file: string) => void | Promise<void>
  ): Promise<void> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (!this.shouldIgnore(item.name)) {
            await this.walkDirectory(fullPath, callback);
          }
        } else if (item.isFile()) {
          await callback(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
  }

  private shouldIgnore(name: string): boolean {
    return [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      'vendor',
      'target',
      '__pycache__',
      '.venv',
      'venv',
    ].includes(name);
  }
}

export const smartFileFilter = new SmartFileFilter();

