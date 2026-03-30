/**
 * Codebase Size Detection and Tracking
 * 
 * Measures codebase size for subscription tier enforcement
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CodebaseMetrics {
  totalFiles: number;
  totalLines: number;
  totalSize: number; // in bytes
  languages: Record<string, { files: number; lines: number }>;
  largestFiles: Array<{ path: string; size: number; lines: number }>;
}

export interface SizeLimits {
  maxFiles: number;
  maxLines: number;
  maxSize: number; // in bytes
}

class CodebaseSizeTracker {
  private ignoredPatterns = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
    'vendor',
    'venv',
    '__pycache__',
    '.DS_Store',
  ];

  /**
   * Calculate codebase size
   */
  async calculateSize(projectPath: string): Promise<CodebaseMetrics> {
    const metrics: CodebaseMetrics = {
      totalFiles: 0,
      totalLines: 0,
      totalSize: 0,
      languages: {},
      largestFiles: [],
    };

    await this.scanDirectory(projectPath, projectPath, metrics);

    // Sort largest files
    metrics.largestFiles.sort((a, b) => b.size - a.size);
    metrics.largestFiles = metrics.largestFiles.slice(0, 10);

    return metrics;
  }

  private async scanDirectory(
    rootPath: string,
    currentPath: string,
    metrics: CodebaseMetrics
  ): Promise<void> {
    try {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);
        const relativePath = path.relative(rootPath, fullPath);

        // Skip ignored patterns
        if (this.shouldIgnore(relativePath)) {
          continue;
        }

        if (item.isDirectory()) {
          await this.scanDirectory(rootPath, fullPath, metrics);
        } else if (item.isFile()) {
          await this.processFile(fullPath, relativePath, metrics);
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
  }

  private shouldIgnore(relativePath: string): boolean {
    return this.ignoredPatterns.some((pattern) => {
      const normalized = relativePath.replace(/\\/g, '/');
      return normalized.includes(pattern) || normalized.startsWith(pattern);
    });
  }

  private async processFile(
    filePath: string,
    relativePath: string,
    metrics: CodebaseMetrics
  ): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const language = this.getLanguage(ext);

      // Only count code files
      if (!this.isCodeFile(ext)) {
        return;
      }

      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n').length;

      metrics.totalFiles++;
      metrics.totalSize += stats.size;
      metrics.totalLines += lines;

      // Track by language
      if (!metrics.languages[language]) {
        metrics.languages[language] = { files: 0, lines: 0 };
      }
      metrics.languages[language].files++;
      metrics.languages[language].lines += lines;

      // Track largest files
      metrics.largestFiles.push({
        path: relativePath,
        size: stats.size,
        lines,
      });
    } catch (error) {
      // Skip files we can't read
    }
  }

  private isCodeFile(ext: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.java', '.go', '.rs',
      '.php', '.rb', '.swift', '.kt',
      '.cs', '.cpp', '.c', '.h',
      '.vue', '.svelte', '.html', '.css',
      '.scss', '.less', '.sass',
      '.sql', '.sh', '.yaml', '.yml',
      '.json', '.xml', '.md',
    ];
    return codeExtensions.includes(ext);
  }

  private getLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.vue': 'Vue',
      '.svelte': 'Svelte',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sql': 'SQL',
    };
    return languageMap[ext] || 'Other';
  }

  /**
   * Check if codebase exceeds limits
   */
  async checkLimits(projectPath: string, limits: SizeLimits): Promise<{
    withinLimits: boolean;
    metrics: CodebaseMetrics;
    exceeded: {
      files?: boolean;
      lines?: boolean;
      size?: boolean;
    };
  }> {
    const metrics = await this.calculateSize(projectPath);

    const exceeded = {
      files: metrics.totalFiles > limits.maxFiles,
      lines: metrics.totalLines > limits.maxLines,
      size: metrics.totalSize > limits.maxSize,
    };

    return {
      withinLimits: !exceeded.files && !exceeded.lines && !exceeded.size,
      metrics,
      exceeded,
    };
  }

  /**
   * Format size for display
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

export const codebaseSizeTracker = new CodebaseSizeTracker();

