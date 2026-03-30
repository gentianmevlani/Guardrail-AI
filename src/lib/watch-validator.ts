/**
 * Watch Mode & Real-Time Validation
 * 
 * File system watcher for real-time validation as files change
 */

import * as fs from 'fs';
import * as path from 'path';
import { universalGuardrails } from './universal-guardrails';
import { apiValidator } from './api-validator';

export interface WatchOptions {
  projectPath: string;
  watchPatterns?: string[];
  ignorePatterns?: string[];
  onFileChange?: (file: string, result: ValidationResult) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
}

export interface ValidationResult {
  file: string;
  valid: boolean;
  errors: Array<{ rule: string; message: string; severity: string }>;
  warnings: Array<{ rule: string; message: string }>;
}

class WatchValidator {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isWatching = false;

  /**
   * Start watching project for changes
   */
  async watch(options: WatchOptions): Promise<void> {
    const {
      projectPath,
      watchPatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      ignorePatterns = ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**'],
      onFileChange,
      onError,
      debounceMs = 500,
    } = options;

    if (this.isWatching) {
      throw new Error('Already watching. Call stop() first.');
    }

    this.isWatching = true;
    console.log(`👀 Watching ${projectPath} for changes...\n`);

    // Watch entire directory
    try {
      const watcher = fs.watch(
        projectPath,
        { recursive: true },
        async (eventType, filename) => {
          if (!filename) return;

          const filePath = path.join(projectPath, filename);

          // Check if file should be ignored
          if (this.shouldIgnore(filePath, ignorePatterns)) {
            return;
          }

          // Check if file matches watch patterns
          if (!this.matchesPattern(filePath, watchPatterns)) {
            return;
          }

          // Debounce rapid changes
          const existingTimer = this.debounceTimers.get(filePath);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(async () => {
            this.debounceTimers.delete(filePath);

            if (eventType === 'change' || eventType === 'rename') {
              await this.validateFile(filePath, projectPath, onFileChange, onError);
            }
          }, debounceMs);

          this.debounceTimers.set(filePath, timer);
        }
      );

      this.watchers.set(projectPath, watcher);
    } catch (error) {
      this.isWatching = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (onError) {
        onError(new Error(errorMessage));
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate a single file
   */
  private async validateFile(
    filePath: string,
    projectPath: string,
    onFileChange?: (file: string, result: ValidationResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Check if file exists
      if (!await this.pathExists(filePath)) {
        return; // File was deleted
      }

      const content = await fs.promises.readFile(filePath, 'utf8');
      const relativePath = path.relative(projectPath, filePath);

      // Validate with guardrails
      const validation = await universalGuardrails.validateFile(relativePath, content);

      const result: ValidationResult = {
        file: relativePath,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      };

      // Report results
      if (!validation.valid || validation.warnings.length > 0) {
        console.log(`\n📋 ${relativePath}`);
        if (validation.errors.length > 0) {
          console.log(`   ❌ ${validation.errors.length} error(s)`);
          validation.errors.forEach(err => {
            console.log(`      • ${err.rule}: ${err.message}`);
          });
        }
        if (validation.warnings.length > 0) {
          console.log(`   ⚠️  ${validation.warnings.length} warning(s)`);
          validation.warnings.forEach(warn => {
            console.log(`      • ${warn.rule}: ${warn.message}`);
          });
        }
      } else {
        console.log(`✅ ${relativePath} - No issues`);
      }

      if (onFileChange) {
        onFileChange(relativePath, result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (onError) {
        onError(new Error(errorMessage));
      } else {
        console.error(`❌ Error validating ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Stop watching
   */
  stop(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.isWatching = false;
    console.log('\n👀 Stopped watching');
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return ignorePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(normalized);
    });
  }

  /**
   * Check if file matches watch patterns
   */
  private matchesPattern(filePath: string, patterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(normalized);
    });
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const watchValidator = new WatchValidator();

