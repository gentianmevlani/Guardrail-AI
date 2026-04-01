/**
 * Build Enforcer
 * 
 * Enforces strictness rules during build process
 */

const { strictnessManager } = require('./strictness-config.js');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BuildEnforcer {
  /**
   * Enforce strictness during build
   */
  async enforceBuild(projectPath = process.cwd()) {
    const config = strictnessManager.getConfig();

    const [lintResult, typeResult] = await Promise.allSettled([
      this.runLint(projectPath),
      this.runTypeCheck(projectPath),
    ]);

    const lintErrors = lintResult.status === 'fulfilled' ? lintResult.value.errors : 0;
    const typeErrors = typeResult.status === 'fulfilled' ? typeResult.value.errors : 0;
    const warnings = (lintResult.status === 'fulfilled' ? lintResult.value.warnings : 0) +
                     (typeResult.status === 'fulfilled' ? typeResult.value.warnings : 0);

    const shouldBlock = strictnessManager.shouldBlockBuild(0, warnings, lintErrors, typeErrors);

    if (shouldBlock) {
      const reasons = [];
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
  async runLint(projectPath) {
    try {
      const { stdout, stderr } = await execAsync('npm run lint', {
        cwd: projectPath,
      });

      const errorMatch = stdout.match(/(\d+) error\(s\)/i) || stderr.match(/(\d+) error\(s\)/i);
      const warningMatch = stdout.match(/(\d+) warning\(s\)/i) || stderr.match(/(\d+) warning\(s\)/i);

      return {
        errors: errorMatch ? parseInt(errorMatch[1]) : 0,
        warnings: warningMatch ? parseInt(warningMatch[1]) : 0,
      };
    } catch (error) {
      const errorMatch = error.stdout?.match(/(\d+) error\(s\)/i) || 
                         error.stderr?.match(/(\d+) error\(s\)/i);
      const warningMatch = error.stdout?.match(/(\d+) warning\(s\)/i) || 
                           error.stderr?.match(/(\d+) warning\(s\)/i);

      return {
        errors: errorMatch ? parseInt(errorMatch[1]) : 1,
        warnings: warningMatch ? parseInt(warningMatch[1]) : 0,
      };
    }
  }

  /**
   * Run TypeScript type check
   */
  async runTypeCheck(projectPath) {
    try {
      const { stdout, stderr } = await execAsync('npm run type-check', {
        cwd: projectPath,
      });

      return {
        errors: 0,
        warnings: 0,
      };
    } catch (error) {
      const errorMatch = error.stdout?.match(/(\d+) error\(s\)/i) || 
                         error.stderr?.match(/(\d+) error\(s\)/i);

      return {
        errors: errorMatch ? parseInt(errorMatch[1]) : 1,
        warnings: 0,
      };
    }
  }

  /**
   * Hook into npm run build
   */
  async hookBuild(projectPath = process.cwd()) {
    const result = await this.enforceBuild(projectPath);

    if (result.blocked) {
      console.error(`\n❌ Build blocked by strictness rules!\n`);
      console.error(`Reason: ${result.reason}\n`);
      console.error('Fix the issues above before building.\n');
      process.exit(1);
    }
  }
}

module.exports = { buildEnforcer: new BuildEnforcer() };

