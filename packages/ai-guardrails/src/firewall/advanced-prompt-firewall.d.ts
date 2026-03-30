/**
 * Advanced Prompt Firewall Service
 *
 * Comprehensive prompt firewall with:
 * - Detailed task breakdown
 * - Verification and validation
 * - Version control integration
 * - Immediate fixes
 * - Advanced tools integration
 * - Future planning
 */
export interface TaskBreakdown {
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedTime: number;
    dependencies: string[];
    verification: {
        type: 'automated' | 'manual' | 'hybrid';
        checks: string[];
    };
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}
export interface VerificationResult {
    passed: boolean;
    checks: Array<{
        name: string;
        status: 'pass' | 'fail' | 'warning';
        message: string;
        evidence?: string;
    }>;
    score: number;
    blockers: string[];
}
export interface VersionControlInfo {
    branch: string;
    commit: string;
    changes: Array<{
        file: string;
        status: 'added' | 'modified' | 'deleted';
        lines?: {
            added: number;
            removed: number;
        };
    }>;
    conflicts: string[];
}
export interface ImmediateFix {
    id: string;
    type: 'code' | 'config' | 'dependency' | 'test';
    description: string;
    file: string;
    change: {
        before: string;
        after: string;
    };
    confidence: number;
    applied: boolean;
    verified: boolean;
}
export interface FuturePlan {
    phase: 'immediate' | 'short_term' | 'long_term';
    tasks: Array<{
        id: string;
        title: string;
        description: string;
        estimatedEffort: string;
        dependencies: string[];
    }>;
    milestones: string[];
    risks: Array<{
        description: string;
        mitigation: string;
    }>;
}
export interface PromptFirewallResult {
    prompt: string;
    taskBreakdown: TaskBreakdown[];
    verification: VerificationResult;
    versionControl: VersionControlInfo;
    immediateFixes: ImmediateFix[];
    futurePlan: FuturePlan;
    context: {
        projectPath: string;
        timestamp: string;
        confidence: number;
    };
    recommendations: string[];
}
export declare class AdvancedPromptFirewall {
    private projectPath;
    private fixHistory;
    constructor(projectPath: string);
    /**
     * Process prompt through firewall with full analysis
     */
    process(prompt: string, options?: {
        autoBreakdown?: boolean;
        autoVerify?: boolean;
        autoFix?: boolean;
        includeVersionControl?: boolean;
        generatePlan?: boolean;
    }): Promise<PromptFirewallResult>;
    /**
     * Break down prompt into detailed tasks
     */
    private breakDownTask;
    /**
     * Verify prompt against context and patterns
     */
    private verifyPrompt;
    /**
     * Get version control information
     */
    private getVersionControlInfo;
    /**
     * Generate immediate fixes
     */
    private generateImmediateFixes;
    /**
     * Generate future plan
     */
    private generateFuturePlan;
    /**
     * Apply immediate fix
     */
    applyFix(fix: ImmediateFix): Promise<{
        success: boolean;
        message: string;
    }>;
    private extractTaskKeywords;
    private createTask;
    private addTaskDependencies;
    private checkContextRelevance;
    private checkPatternCompliance;
    private checkCompleteness;
    private createFixForCheck;
    private verifyFix;
    private generateRecommendations;
    private getEmptyVersionControl;
    private getEmptyFuturePlan;
}
export declare function createPromptFirewall(projectPath: string): AdvancedPromptFirewall;
//# sourceMappingURL=advanced-prompt-firewall.d.ts.map