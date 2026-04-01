import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Fix, FixPack } from './engine';

export interface ApplyResult {
  success: boolean;
  appliedFixes: number;
  failedFixes: number;
  errors: Array<{ fix: Fix; error: string }>;
}

export interface VerificationResult {
  passed: boolean;
  typecheck: { passed: boolean; output: string };
  build: { passed: boolean; output: string };
}

export class FixApplicator {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Apply fixes from selected packs
   */
  async applyPacks(packs: FixPack[]): Promise<ApplyResult> {
    let appliedFixes = 0;
    let failedFixes = 0;
    const errors: Array<{ fix: Fix; error: string }> = [];

    for (const pack of packs) {
      for (const fix of pack.fixes) {
        try {
          await this.applyFix(fix);
          appliedFixes++;
        } catch (error: any) {
          failedFixes++;
          errors.push({
            fix,
            error: error.message || 'Unknown error',
          });
        }
      }
    }

    return {
      success: failedFixes === 0,
      appliedFixes,
      failedFixes,
      errors,
    };
  }

  /**
   * Apply a single fix
   */
  private async applyFix(fix: Fix): Promise<void> {
    const filePath = join(this.projectPath, fix.file);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (fix.line <= 0 || fix.line > lines.length) {
      throw new Error(`Invalid line number: ${fix.line}`);
    }

    // Verify the old code matches
    const actualLine = lines[fix.line - 1];
<<<<<<< HEAD
    if (actualLine === undefined) {
      throw new Error(`Line ${fix.line} out of range in ${fix.file}`);
    }
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    if (actualLine.trim() !== fix.oldCode.trim()) {
      throw new Error(
        `Line mismatch at ${fix.file}:${fix.line}. Expected: "${fix.oldCode.trim()}", Found: "${actualLine.trim()}"`
      );
    }

    // Apply the fix
    lines[fix.line - 1] = fix.newCode;
    
    // Write back to file
    writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * Verify project after applying fixes
   */
  async verify(): Promise<VerificationResult> {
    const typecheck = await this.runTypecheck();
    const build = await this.runBuild();

    return {
      passed: typecheck.passed && build.passed,
      typecheck,
      build,
    };
  }

  private async runTypecheck(): Promise<{ passed: boolean; output: string }> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('tsc --noEmit', {
        cwd: this.projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      
      return {
        passed: true,
        output: output || 'Type check passed',
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.stdout || error.message || 'Type check failed',
      };
    }
  }

  private async runBuild(): Promise<{ passed: boolean; output: string }> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('npm run build --if-present', {
        cwd: this.projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 60000, // 60 second timeout
      });
      
      return {
        passed: true,
        output: output || 'Build passed',
      };
    } catch (error: any) {
      // Build script might not exist, which is okay
      if (error.message?.includes('missing script')) {
        return {
          passed: true,
          output: 'No build script found (skipped)',
        };
      }
      
      return {
        passed: false,
        output: error.stdout || error.message || 'Build failed',
      };
    }
  }

  /**
   * Generate unified diff for preview
   */
  generateDiff(packs: FixPack[]): string {
    const lines: string[] = [];

    for (const pack of packs) {
      lines.push(`# Fix Pack: ${pack.name}`);
      lines.push(`# Category: ${pack.category}`);
      lines.push(`# Risk: ${pack.estimatedRisk}`);
      lines.push(`# Confidence: ${(pack.confidence * 100).toFixed(0)}%`);
      lines.push('');

      for (const fix of pack.fixes) {
        lines.push(`--- a/${fix.file}`);
        lines.push(`+++ b/${fix.file}`);
        lines.push(`@@ -${fix.line},1 +${fix.line},1 @@`);
        lines.push(`-${fix.oldCode}`);
        lines.push(`+${fix.newCode}`);
        lines.push(`# ${fix.explanation}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
