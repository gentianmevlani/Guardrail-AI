/**
 * Build Enforcer
 * 
 * Enforces strictness rules during build process
 */

import { strictnessManager, StrictnessConfig } from './strictness-config';
import * as child_process from 'child_process';
import * as util from 'util';

const exec = util.promisify(child_process.exec);

export interface BuildResult {
  success: boolean;
  blocked: boolean;
  reason?: string;
  errors: number;
  warnings: number;
  lintErrors: number;
  typeErrors: number;
}

class BuildEnforcer {
  /**
   * Enforce strictness during build
   */
  async enforceBuild(projectPath: string = process.cwd()): Promise<BuildResult> {
    const config = strictnessManager.getConfig();

    // Run checks
    const [lintResult, typeResult] = await Promise.allSettled([
      this.runLint(projectPath),
      this.runTypeCheck(projectPath),
    ]);

    // Count issues
    const lintErrors = lintResult.status === 'fulfilled' ? lintResult.value.errors : 0;
    const typeErrors = typeResult.status === 'fulfilled' ? typeResult.value.errors : 0;
    const warnings = (lintResult.status === 'fulfilled' ? lintResult.value.warnings : 0) +
                     (typeResult.status === 'fulfilled' ? typeResult.value.warnings : 0);

    // Check if build should be blocked
    const shouldBlock = strictnessManager.shouldBlockBuild(0, warnings, lintErrors, typeErrors);

    if (shouldBlock) {
      const reasons: string[] = [];
      if (lintErrors > 0 && config.rules.buildBlocksOnLintErrors) {
        reasons.push(`${lintErrors} ESLint error(s)`);
      }
      if (typeErrors > 0 && config.rules.buildBlocksOnTypeErrors) {
        reasons.push(`${typeErrors} TypeScript error(s)`);
      }
      if (warnings > 0 && config.rules.buildBlocksOnWarnings) {
        reasons.push(`${warnings} warning(s)`);
      }

      return {
        success: false,
        blocked: true,
        reason: `Build blocked: ${reasons.join(', ')}`,
        errors: 0,
        warnings,
        lintErrors,
        typeErrors,
      };
    }

    // Build can proceed
    return {
      success: true,
      blocked: false,
      errors: 0,
      warnings,
      lintErrors,
      typeErrors,
    };
  }

  /**
   * Run ESLint
   */
  private async runLint(projectPath: string): Promise<{ errors: number; warnings: number }> {
    try {
      const { stdout, stderr } = await exec('npm run lint', {
        cwd: projectPath,
      });

      // Parse ESLint output
      const errorMatch = stdout.match(/(\d+) error\(s\)/i) || stderr.match(/(\d+) error\(s\)/i);
      const warningMatch = stdout.match(/(\d+) warning\(s\)/i) || stderr.match(/(\d+) warning\(s\)/i);

      return {
        errors: errorMatch ? parseInt(errorMatch[1]) : 0,
        warnings: warningMatch ? parseInt(warningMatch[1]) : 0,
      };
    } catch (error) {
      // ESLint found errors
      const errorObj = error as { stdout?: string; stderr?: string };
      const errorMatch = errorObj.stdout?.match(/(\d+) error\(s\)/i) ||
                         errorObj.stderr?.match(/(\d+) error\(s\)/i);
      const warningMatch = errorObj.stdout?.match(/(\d+) warning\(s\)/i) ||
                           errorObj.stderr?.match(/(\d+) warning\(s\)/i);

      return {
        errors: errorMatch ? parseInt(errorMatch[1]) : 1,
        warnings: warningMatch ? parseInt(warningMatch[1]) : 0,
      };
    }
  }

  /**
   * Run TypeScript type check
   */
  private async runTypeCheck(projectPath: string): Promise<{ errors: number; warnings: number }> {
    try {
      const { stdout, stderr } = await exec('npm run type-check', {
        cwd: projectPath,
      });

      return {
        errors: 0,
        warnings: 0,
      };
    } catch (error) {
      // TypeScript found errors
      const errorObj = error as { stdout?: string; stderr?: string };
      const errorMatch = errorObj.stdout?.match(/(\d+) error\(s\)/i) ||
                         errorObj.stderr?.match(/(\d+) error\(s\)/i);

      return {
        errors: errorMatch ? parseInt(errorMatch[1]) : 1,
        warnings: 0,
      };
    }
  }

  /**
   * Hook into npm run build
   */
  async hookBuild(projectPath: string = process.cwd()): Promise<void> {
    const result = await this.enforceBuild(projectPath);

    if (result.blocked) {
      console.error(`\n❌ Build blocked by strictness rules!\n`);
      console.error(`Reason: ${result.reason}\n`);
      console.error('Fix the issues above before building.\n');
      process.exit(1);
    }
  }
}

export const buildEnforcer = new BuildEnforcer();

