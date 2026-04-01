/**
 * Pre-commit Hooks Integration
 *
 * Generates pre-commit hook configurations for local validation
 * before commits are pushed to the repository
 */
export interface PreCommitConfig {
    scanSecrets: boolean;
    scanVulnerabilities: boolean;
    checkCompliance: boolean;
    validateTypes: boolean;
    runLint: boolean;
    runTests: boolean;
    blockOnCritical: boolean;
    blockOnHigh: boolean;
    maxFileSize: number;
    excludePatterns: string[];
}
export interface HuskyConfig {
    hooks: {
        'pre-commit'?: string;
        'pre-push'?: string;
        'commit-msg'?: string;
    };
}
export declare class PreCommitGenerator {
    /**
     * Generate Husky pre-commit configuration
     */
    generateHuskyConfig(config: PreCommitConfig): HuskyConfig;
    /**
     * Generate pre-push commands
     */
    private generatePrePushCommands;
    /**
     * Generate .husky/pre-commit script
     */
    generatePreCommitScript(config: PreCommitConfig): string;
    /**
     * Generate .husky/pre-push script
     */
    generatePrePushScript(config: PreCommitConfig): string;
    /**
     * Generate lint-staged configuration
     */
    generateLintStagedConfig(config: PreCommitConfig): Record<string, string[]>;
    /**
     * Generate package.json scripts for hooks
     */
    generatePackageJsonScripts(): Record<string, string>;
    /**
     * Generate commitlint configuration
     */
    generateCommitlintConfig(): Record<string, any>;
    /**
     * Generate default configuration
     */
    generateDefaultConfig(): PreCommitConfig;
    /**
     * Generate setup instructions
     */
    generateSetupInstructions(): string;
}
export declare const preCommitGenerator: PreCommitGenerator;
//# sourceMappingURL=pre-commit.d.ts.map