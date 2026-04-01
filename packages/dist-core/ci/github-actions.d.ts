/**
 * GitHub Actions Integration
 *
 * Provides integration with GitHub Actions for automated security scanning
 */
export interface GitHubActionsConfig {
    workflowName: string;
    triggers: {
        push?: {
            branches: string[];
        };
        pullRequest?: {
            branches: string[];
        };
        schedule?: {
            cron: string;
        }[];
        workflowDispatch?: boolean;
    };
    scanTypes: ('security' | 'secrets' | 'vulnerabilities' | 'compliance' | 'sbom')[];
    failOnCritical: boolean;
    failOnHigh: boolean;
    uploadArtifacts: boolean;
    createPRComments: boolean;
}
export interface WorkflowStep {
    name: string;
    uses?: string;
    run?: string;
    with?: Record<string, string | boolean | number>;
    env?: Record<string, string>;
    if?: string;
}
export interface WorkflowJob {
    name: string;
    runsOn: string;
    permissions?: Record<string, string>;
    steps: WorkflowStep[];
}
export interface GitHubWorkflow {
    name: string;
    on: Record<string, any>;
    permissions?: Record<string, string>;
    jobs: Record<string, WorkflowJob>;
}
export declare class GitHubActionsGenerator {
    /**
     * Generate a complete GitHub Actions workflow
     */
    generateWorkflow(config: GitHubActionsConfig): string;
    /**
     * Build workflow triggers
     */
    private buildTriggers;
    /**
     * Build the main scan job
     */
    private buildScanJob;
    /**
     * Build result check script
     */
    private buildCheckScript;
    /**
     * Convert workflow object to YAML
     */
    private toYAML;
    /**
     * Convert object to YAML with indentation
     */
    private objectToYAML;
    /**
     * Generate default workflow for quick setup
     */
    generateDefaultWorkflow(): string;
}
export declare const githubActionsGenerator: GitHubActionsGenerator;
//# sourceMappingURL=github-actions.d.ts.map