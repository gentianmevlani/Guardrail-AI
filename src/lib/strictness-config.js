/**
 * Strictness Configuration
 * 
 * Controls how strict the AI agent and build process should be
 */

const fs = require('fs');
const path = require('path');

const STRICTNESS_PRESETS = {
  relaxed: {
    level: 'relaxed',
    rules: {
      buildBlocksOnErrors: true,
      buildBlocksOnWarnings: false,
      buildBlocksOnLintErrors: false,
      buildBlocksOnTypeErrors: false,
      requireTests: false,
      requireDocumentation: false,
      requireTypeSafety: false,
      blockAnyTypes: false,
      blockMockData: true,
      requireRealEndpoints: true,
      validateAPICalls: false,
      requireInputValidation: false,
      requireAuthChecks: false,
      blockSecurityIssues: true,
      requireOptimization: false,
      blockSlowCode: false,
      requireCaching: false,
      requireA11y: false,
      blockA11yIssues: false,
      preCommitBlocks: false,
      preCommitRequiresTests: false,
      preCommitRequiresLint: false,
    },
  },
  moderate: {
    level: 'moderate',
    rules: {
      buildBlocksOnErrors: true,
      buildBlocksOnWarnings: false,
      buildBlocksOnLintErrors: true,
      buildBlocksOnTypeErrors: true,
      requireTests: false,
      requireDocumentation: false,
      requireTypeSafety: true,
      blockAnyTypes: true,
      blockMockData: true,
      requireRealEndpoints: true,
      validateAPICalls: true,
      requireInputValidation: true,
      requireAuthChecks: false,
      blockSecurityIssues: true,
      requireOptimization: false,
      blockSlowCode: false,
      requireCaching: false,
      requireA11y: true,
      blockA11yIssues: false,
      preCommitBlocks: true,
      preCommitRequiresTests: false,
      preCommitRequiresLint: true,
    },
  },
  strict: {
    level: 'strict',
    rules: {
      buildBlocksOnErrors: true,
      buildBlocksOnWarnings: true,
      buildBlocksOnLintErrors: true,
      buildBlocksOnTypeErrors: true,
      requireTests: true,
      requireDocumentation: true,
      requireTypeSafety: true,
      blockAnyTypes: true,
      blockMockData: true,
      requireRealEndpoints: true,
      validateAPICalls: true,
      requireInputValidation: true,
      requireAuthChecks: true,
      blockSecurityIssues: true,
      requireOptimization: true,
      blockSlowCode: true,
      requireCaching: true,
      requireA11y: true,
      blockA11yIssues: true,
      preCommitBlocks: true,
      preCommitRequiresTests: true,
      preCommitRequiresLint: true,
    },
  },
  maximum: {
    level: 'maximum',
    rules: {
      buildBlocksOnErrors: true,
      buildBlocksOnWarnings: true,
      buildBlocksOnLintErrors: true,
      buildBlocksOnTypeErrors: true,
      requireTests: true,
      requireDocumentation: true,
      requireTypeSafety: true,
      blockAnyTypes: true,
      blockMockData: true,
      requireRealEndpoints: true,
      validateAPICalls: true,
      requireInputValidation: true,
      requireAuthChecks: true,
      blockSecurityIssues: true,
      requireOptimization: true,
      blockSlowCode: true,
      requireCaching: true,
      requireA11y: true,
      blockA11yIssues: true,
      preCommitBlocks: true,
      preCommitRequiresTests: true,
      preCommitRequiresLint: true,
    },
  },
};

class StrictnessManager {
  constructor(projectPath = process.cwd()) {
    this.configPath = path.join(projectPath, '.guardrail', 'strictness.json');
    this.config = this.loadConfig();
  }

  /**
   * Get current strictness config
   */
  getConfig() {
    return this.config;
  }

  /**
   * Set strictness level
   */
  setLevel(level) {
    this.config = {
      ...STRICTNESS_PRESETS[level],
      level,
    };
    this.saveConfig();
  }

  /**
   * Update specific rule
   */
  updateRule(rule, value) {
    this.config.rules[rule] = value;
    this.saveConfig();
  }

  /**
   * Customize rules
   */
  customizeRules(rules) {
    this.config.rules = {
      ...this.config.rules,
      ...rules,
    };
    this.config.level = 'moderate';
    this.saveConfig();
  }

  /**
   * Check if build should block
   */
  shouldBlockBuild(errors, warnings, lintErrors, typeErrors) {
    if (errors > 0 && this.config.rules.buildBlocksOnErrors) return true;
    if (warnings > 0 && this.config.rules.buildBlocksOnWarnings) return true;
    if (lintErrors > 0 && this.config.rules.buildBlocksOnLintErrors) return true;
    if (typeErrors > 0 && this.config.rules.buildBlocksOnTypeErrors) return true;
    return false;
  }

  /**
   * Check if pre-commit should block
   */
  shouldBlockPreCommit(hasTests, hasLintErrors) {
    if (!this.config.rules.preCommitBlocks) return false;
    if (this.config.rules.preCommitRequiresTests && !hasTests) return true;
    if (this.config.rules.preCommitRequiresLint && hasLintErrors) return true;
    return false;
  }

  /**
   * Validate code against strictness rules
   */
  validateCode(code, context) {
    const issues = [];

    if (this.config.rules.blockAnyTypes && /:\s*any\b/.test(code)) {
      issues.push({
        rule: 'blockAnyTypes',
        message: 'Type "any" is not allowed',
        severity: 'error',
      });
    }

    if (this.config.rules.blockMockData && /mock|fake|dummy|placeholder/i.test(code)) {
      issues.push({
        rule: 'blockMockData',
        message: 'Mock data detected',
        severity: 'error',
      });
    }

    if (this.config.rules.requireInputValidation && /req\.body|req\.query|req\.params/.test(code)) {
      if (!/validate|zod|yup|joi/.test(code)) {
        issues.push({
          rule: 'requireInputValidation',
          message: 'Input validation required',
          severity: 'warning',
        });
      }
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  // Private methods
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return data;
      }
    } catch {}

    return STRICTNESS_PRESETS.moderate;
  }

  saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save strictness config:', error);
    }
  }
}

module.exports = {
  strictnessManager: new StrictnessManager(),
  STRICTNESS_PRESETS,
};

