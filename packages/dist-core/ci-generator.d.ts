/**
 * CI/CD Generator Functions
 * Generates GitHub Actions workflows and git hooks for Guardrail integration
 */
interface GuardrailConfig {
    output?: {
        sarifUpload?: boolean;
        format?: string;
    };
    scans?: {
        secrets?: {
            enabled?: boolean;
        };
        vulnerabilities?: {
            enabled?: boolean;
        };
        compliance?: {
            enabled?: boolean;
        };
    };
}
/**
 * Generate GitHub Actions workflow for Guardrail
 */
export declare function generateGitHubActions(config: GuardrailConfig): string;
/**
 * Generate pre-commit hooks for Guardrail
 */
export declare function generatePreCommitHooks(_config: GuardrailConfig): string;
/**
 * Generate GitLab CI configuration
 */
export declare function generateGitLabCI(_config: GuardrailConfig): string;
/**
 * Generate Azure DevOps pipeline
 */
export declare function generateAzurePipeline(_config: GuardrailConfig): string;
/**
 * Generate Bitbucket Pipes configuration
 */
export declare function generateBitbucketPipes(_config: GuardrailConfig): string;
export {};
//# sourceMappingURL=ci-generator.d.ts.map