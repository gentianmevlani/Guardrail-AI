/**
 * Strictness Configuration
 * 
 * Controls how strict the AI agent and build process should be
 */

export type StrictnessLevel = 'relaxed' | 'moderate' | 'strict' | 'maximum';

export interface StrictnessConfig {
  level: StrictnessLevel;
  rules: {
    // Build & Compilation
    buildBlocksOnErrors: boolean;
    buildBlocksOnWarnings: boolean;
    buildBlocksOnLintErrors: boolean;
    buildBlocksOnTypeErrors: boolean;
    
    // Code Quality
    requireTests: boolean;
    requireDocumentation: boolean;
    requireTypeSafety: boolean;
    blockAnyTypes: boolean;
    
    // API & Data
    blockMockData: boolean;
    requireRealEndpoints: boolean;
    validateAPICalls: boolean;
    
    // Security
    requireInputValidation: boolean;
    requireAuthChecks: boolean;
    blockSecurityIssues: boolean;
    
    // Performance
    requireOptimization: boolean;
    blockSlowCode: boolean;
    requireCaching: boolean;
    
    // Accessibility
    requireA11y: boolean;
    blockA11yIssues: boolean;
    
    // Pre-commit
    preCommitBlocks: boolean;
    preCommitRequiresTests: boolean;
    preCommitRequiresLint: boolean;
  };
}

export const STRICTNESS_PRESETS: Record<StrictnessLevel, StrictnessConfig> = {
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
  private config: StrictnessConfig;
  private configPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.configPath = `${projectPath}/.guardrail/strictness.json`;
    this.config = this.loadConfig();
  }

  /**
   * Get current strictness config
   */
  getConfig(): StrictnessConfig {
    return this.config;
  }

  /**
   * Set strictness level
   */
  setLevel(level: StrictnessLevel): void {
    this.config = {
      ...STRICTNESS_PRESETS[level],
      level,
    };
    this.saveConfig();
  }

  /**
   * Update specific rule
   */
  updateRule(rule: keyof StrictnessConfig['rules'], value: boolean): void {
    this.config.rules[rule] = value;
    this.saveConfig();
  }

  /**
   * Customize rules
   */
  customizeRules(rules: Partial<StrictnessConfig['rules']>): void {
    this.config.rules = {
      ...this.config.rules,
      ...rules,
    };
    this.config.level = 'moderate'; // Custom level
    this.saveConfig();
  }

  /**
   * Check if build should block
   */
  shouldBlockBuild(errors: number, warnings: number, lintErrors: number, typeErrors: number): boolean {
    if (errors > 0 && this.config.rules.buildBlocksOnErrors) return true;
    if (warnings > 0 && this.config.rules.buildBlocksOnWarnings) return true;
    if (lintErrors > 0 && this.config.rules.buildBlocksOnLintErrors) return true;
    if (typeErrors > 0 && this.config.rules.buildBlocksOnTypeErrors) return true;
    return false;
  }

  /**
   * Check if pre-commit should block
   */
  shouldBlockPreCommit(hasTests: boolean, hasLintErrors: boolean): boolean {
    if (!this.config.rules.preCommitBlocks) return false;
    if (this.config.rules.preCommitRequiresTests && !hasTests) return true;
    if (this.config.rules.preCommitRequiresLint && hasLintErrors) return true;
    return false;
  }

  /**
   * Validate code against strictness rules
   */
  validateCode(code: string, context: Record<string, unknown>): {
    valid: boolean;
    issues: Array<{ rule: string; message: string; severity: 'error' | 'warning' }>;
  } {
    const issues: Array<{ rule: string; message: string; severity: 'error' | 'warning' }> = [];

    // Check for 'any' types
    if (this.config.rules.blockAnyTypes && /:\s*any\b/.test(code)) {
      issues.push({
        rule: 'blockAnyTypes',
        message: 'Type "any" is not allowed',
        severity: 'error',
      });
    }

    // Check for mock data
    if (this.config.rules.blockMockData && /mock|fake|dummy|placeholder/i.test(code)) {
      issues.push({
        rule: 'blockMockData',
        message: 'Mock data detected',
        severity: 'error',
      });
    }

    // Check for input validation
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
  private loadConfig(): StrictnessConfig {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return data;
      }
    } catch (error) {
      // Config file not found or invalid - using default preset
    }

    // Default to moderate
    return STRICTNESS_PRESETS.moderate;
  }

  private saveConfig(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save strictness config:', error);
    }
  }
}

export const strictnessManager = new StrictnessManager();

