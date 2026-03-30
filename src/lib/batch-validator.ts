/**
 * Batch Validator
 * 
 * Validate multiple projects or files in parallel
 */

import * as fs from 'fs';
import * as path from 'path';
import { universalGuardrails } from './universal-guardrails';
import { apiValidator } from './api-validator';

export interface BatchValidationOptions {
  projects?: string[];
  files?: string[];
  parallel?: boolean;
  maxConcurrency?: number;
}

export interface BatchValidationResult {
  project?: string;
  file?: string;
  valid: boolean;
  errors: Array<{ rule: string; message: string; severity: string }>;
  warnings: Array<{ rule: string; message: string }>;
  duration: number;
}

export interface BatchValidationReport {
  total: number;
  valid: number;
  invalid: number;
  results: BatchValidationResult[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
    avgDuration: number;
  };
}

class BatchValidator {
  /**
   * Validate multiple projects
   */
  async validateProjects(
    projectPaths: string[],
    options?: { parallel?: boolean; maxConcurrency?: number }
  ): Promise<BatchValidationReport> {
    const results: BatchValidationResult[] = [];
    const parallel = options?.parallel ?? true;
    const maxConcurrency = options?.maxConcurrency ?? 5;

    if (parallel) {
      // Validate in parallel with concurrency limit
      const chunks = this.chunkArray(projectPaths, maxConcurrency);
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(projectPath => this.validateProject(projectPath))
        );
        results.push(...chunkResults);
      }
    } else {
      // Validate sequentially
      for (const projectPath of projectPaths) {
        const result = await this.validateProject(projectPath);
        results.push(result);
      }
    }

    return this.generateReport(results);
  }

  /**
   * Validate multiple files
   */
  async validateFiles(
    filePaths: string[],
    projectPath: string,
    options?: { parallel?: boolean; maxConcurrency?: number }
  ): Promise<BatchValidationReport> {
    const results: BatchValidationResult[] = [];
    const parallel = options?.parallel ?? true;
    const maxConcurrency = options?.maxConcurrency ?? 10;

    if (parallel) {
      const chunks = this.chunkArray(filePaths, maxConcurrency);
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(filePath => this.validateFile(filePath, projectPath))
        );
        results.push(...chunkResults);
      }
    } else {
      for (const filePath of filePaths) {
        const result = await this.validateFile(filePath, projectPath);
        results.push(result);
      }
    }

    return this.generateReport(results);
  }

  /**
   * Validate a single project
   */
  private async validateProject(projectPath: string): Promise<BatchValidationResult> {
    const startTime = Date.now();
    
    try {
      // Find all code files in project
      const files = await this.findCodeFiles(projectPath);
      let totalErrors = 0;
      let totalWarnings = 0;
      let allValid = true;

      for (const file of files) {
        const relativePath = path.relative(projectPath, file);
        const content = await fs.promises.readFile(file, 'utf8');
        const validation = await universalGuardrails.validateFile(relativePath, content);
        
        if (!validation.valid) {
          allValid = false;
        }
        totalErrors += validation.errors.length;
        totalWarnings += validation.warnings.length;
      }

      const duration = Date.now() - startTime;

      return {
        project: projectPath,
        valid: allValid,
        errors: totalErrors > 0 ? [{ rule: 'project', message: `${totalErrors} errors found`, severity: 'error' }] : [],
        warnings: totalWarnings > 0 ? [{ rule: 'project', message: `${totalWarnings} warnings found` }] : [],
        duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        project: projectPath,
        valid: false,
        errors: [{ rule: 'system', message: errorMessage, severity: 'error' }],
        warnings: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate a single file
   */
  private async validateFile(filePath: string, projectPath: string): Promise<BatchValidationResult> {
    const startTime = Date.now();
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const relativePath = path.relative(projectPath, filePath);
      const validation = await universalGuardrails.validateFile(relativePath, content);

      return {
        file: relativePath,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        file: path.relative(projectPath, filePath),
        valid: false,
        errors: [{ rule: 'system', message: errorMessage, severity: 'error' }],
        warnings: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate validation report
   */
  private generateReport(results: BatchValidationResult[]): BatchValidationReport {
    const valid = results.filter(r => r.valid).length;
    const invalid = results.filter(r => !r.valid).length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = results.length > 0 ? totalDuration / results.length : 0;

    return {
      total: results.length,
      valid,
      invalid,
      results,
      summary: {
        totalErrors,
        totalWarnings,
        avgDuration,
      },
    };
  }

  /**
   * Find all code files in project
   */
  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
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

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export const batchValidator = new BatchValidator();

