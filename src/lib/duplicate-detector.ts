/**
 * Duplicate File Detector
 * 
 * Detects duplicate or unnecessary files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface DuplicateFile {
  file: string;
  duplicates: string[];
  reason: 'exact' | 'similar' | 'unused';
  similarity?: number;
}

export interface DuplicateReport {
  duplicates: DuplicateFile[];
  unused: string[];
  suggestions: Array<{
    file: string;
    suggestion: string;
    reason: string;
  }>;
}

class DuplicateDetector {
  /**
   * Scan for duplicates
   */
  scan(projectPath: string = process.cwd()): DuplicateReport {
    const files = this.getAllFiles(projectPath);
    const duplicates: DuplicateFile[] = [];
    const unused: string[] = [];
    const suggestions: DuplicateReport['suggestions'] = [];

    // Check for exact duplicates
    const exactDuplicates = this.findExactDuplicates(files);
    duplicates.push(...exactDuplicates);

    // Check for similar files
    const similarFiles = this.findSimilarFiles(files);
    duplicates.push(...similarFiles);

    // Check for unused files
    const unusedFiles = this.findUnusedFiles(files, projectPath);
    unused.push(...unusedFiles);

    // Generate suggestions
    suggestions.push(...this.generateSuggestions(duplicates, unused));

    return {
      duplicates,
      unused,
      suggestions,
    };
  }

  /**
   * Find exact duplicate files
   */
  private findExactDuplicates(files: string[]): DuplicateFile[] {
    const fileHashes = new Map<string, string[]>();

    files.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        
        if (!fileHashes.has(hash)) {
          fileHashes.set(hash, []);
        }
        fileHashes.get(hash)!.push(file);
      } catch {
        // Skip if can't read
      }
    });

    const duplicates: DuplicateFile[] = [];
    fileHashes.forEach((fileList, hash) => {
      if (fileList.length > 1) {
        duplicates.push({
          file: fileList[0],
          duplicates: fileList.slice(1),
          reason: 'exact',
        });
      }
    });

    return duplicates;
  }

  /**
   * Find similar files
   */
  private findSimilarFiles(files: string[]): DuplicateFile[] {
    const duplicates: DuplicateFile[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file1 = files[i];
      if (checked.has(file1)) continue;

      try {
        const content1 = fs.readFileSync(file1, 'utf8');
        const similar: string[] = [];

        for (let j = i + 1; j < files.length; j++) {
          const file2 = files[j];
          if (checked.has(file2)) continue;

          try {
            const content2 = fs.readFileSync(file2, 'utf8');
            const similarity = this.calculateSimilarity(content1, content2);

            if (similarity > 0.8) {
              similar.push(file2);
              checked.add(file2);
            }
          } catch {
            // Skip if can't read
          }
        }

        if (similar.length > 0) {
          duplicates.push({
            file: file1,
            duplicates: similar,
            reason: 'similar',
            similarity: 0.8,
          });
          checked.add(file1);
        }
      } catch {
        // Skip if can't read
      }
    }

    return duplicates;
  }

  /**
   * Find unused files
   */
  private findUnusedFiles(files: string[], projectPath: string): string[] {
    const unused: string[] = [];

    files.forEach(file => {
      if (this.isUnusedFile(file, projectPath)) {
        unused.push(file);
      }
    });

    return unused;
  }

  /**
   * Check if file is unused
   */
  private isUnusedFile(file: string, projectPath: string): boolean {
    // Skip certain files
    if (file.includes('node_modules') || file.includes('.git')) {
      return false;
    }

    // Check if file is imported/used anywhere
    const relativePath = path.relative(projectPath, file);
    const fileName = path.basename(file, path.extname(file));
    
    // Simple check - see if file name is referenced in other files
    const allFiles = this.getAllFiles(projectPath);
    let isUsed = false;

    for (const otherFile of allFiles) {
      if (otherFile === file) continue;

      try {
        const content = fs.readFileSync(otherFile, 'utf8');
        if (content.includes(fileName) || content.includes(relativePath)) {
          isUsed = true;
          break;
        }
      } catch {
        // Skip if can't read
      }
    }

    return !isUsed;
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(
    duplicates: DuplicateFile[],
    unused: string[]
  ): Array<{ file: string; suggestion: string; reason: string }> {
    const suggestions: Array<{ file: string; suggestion: string; reason: string }> = [];

    duplicates.forEach(dup => {
      if (dup.reason === 'exact') {
        suggestions.push({
          file: dup.file,
          suggestion: `Remove duplicate files: ${dup.duplicates.join(', ')}`,
          reason: 'Exact duplicates found',
        });
      } else if (dup.reason === 'similar') {
        suggestions.push({
          file: dup.file,
          suggestion: `Consider merging similar files: ${dup.duplicates.join(', ')}`,
          reason: 'Similar files detected',
        });
      }
    });

    unused.forEach(file => {
      suggestions.push({
        file,
        suggestion: 'Consider removing this file if it\'s not needed',
        reason: 'File appears unused',
      });
    });

    return suggestions;
  }

  /**
   * Calculate similarity between two files
   */
  private calculateSimilarity(content1: string, content2: string): number {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const commonLines = lines1.filter(line => lines2.includes(line)).length;
    const totalLines = Math.max(lines1.length, lines2.length);

    return totalLines > 0 ? commonLines / totalLines : 0;
  }

  /**
   * Get all files in project
   */
  private getAllFiles(projectPath: string): string[] {
    const files: string[] = [];
    const ignored = ['node_modules', '.git', '.next', 'dist', 'build', '.guardrail'];

    const scanDir = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!ignored.some(ignore => entry.name.includes(ignore))) {
              scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx', '.md', '.json'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip if can't read
      }
    };

    scanDir(projectPath);
    return files;
  }
}

export const duplicateDetector = new DuplicateDetector();

