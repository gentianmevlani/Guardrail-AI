/**
 * Verified Autofix System - PRO+ Feature
 *
 * Core monetization feature that provides:
 * 1. Strict Build Mode prompts requiring JSON output with unified diff
 * 2. Validation of strict output protocol
 * 3. Temp workspace application with full verification pipeline
 * 4. Auto-reprompt on failure with tight failure context
 * 5. Apply patch only if verification passes
 *
 * PRICING: This is a PRO+ feature. Prompts alone are free.
 * Paid value = prompts + strict diff protocol + verification + apply-only-if-pass
 */
export type FixPackType = 'route-integrity' | 'placeholders' | 'type-errors' | 'build-blockers' | 'test-failures';
export interface FixPackConfig {
    type: FixPackType;
    name: string;
    description: string;
    scanCommand: string;
    verifyCommands: string[];
    maxAttempts: number;
    requiredTier: 'pro' | 'compliance' | 'enterprise';
}
export interface DiffHunk {
    file: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
}
export interface StrictAgentOutput {
    success: boolean;
    explanation: string;
    diffs: DiffHunk[];
    filesModified: string[];
    confidence: number;
    warnings?: string[];
}
export interface VerificationResult {
    passed: boolean;
    checks: {
        name: string;
        passed: boolean;
        message: string;
        duration: number;
    }[];
    blockers: string[];
    duration: number;
}
export interface AutofixResult {
    success: boolean;
    fixPack: FixPackType;
    attempts: number;
    maxAttempts: number;
    duration: number;
    verification: VerificationResult | null;
    appliedDiffs: number;
    filesModified: string[];
    errors: string[];
    generatedDiffs: DiffHunk[];
    aiExplanation: string;
    metrics: {
        promptTokens: number;
        completionTokens: number;
        repromptCount: number;
        verificationTime: number;
    };
}
export interface AutofixOptions {
    projectPath: string;
    fixPack: FixPackType;
    dryRun?: boolean;
    verbose?: boolean;
    maxAttempts?: number;
    onProgress?: (stage: string, message: string) => void;
}
export declare const FIX_PACKS: Record<FixPackType, FixPackConfig>;
/**
 * Validate strict agent output format
 */
export declare function validateStrictOutput(output: unknown): {
    valid: boolean;
    errors: string[];
};
/**
 * Generate strict Build Mode prompt for agent with file context
 */
export declare function generateBuildModePromptWithContext(fixPack: FixPackType, scanOutput: string, context: {
    projectPath: string;
    framework?: string;
}): Promise<string>;
/**
 * Generate strict Build Mode prompt for agent (sync version for compatibility)
 */
export declare function generateBuildModePrompt(fixPack: FixPackType, scanOutput: string, context: {
    projectPath: string;
    framework?: string;
}): string;
/**
 * Generate reprompt with failure context
 */
export declare function generateRepromptWithFailures(originalPrompt: string, _previousOutput: StrictAgentOutput, verification: VerificationResult): string;
export declare class TempWorkspaceManager {
    private baseDir;
    private workspaces;
    constructor();
    /**
     * Create isolated workspace using git worktree (preferred) or copy
     */
    createWorkspace(projectPath: string): Promise<string>;
    /**
     * Apply diffs to workspace
     */
    applyDiffs(workspacePath: string, diffs: DiffHunk[]): Promise<{
        applied: number;
        errors: string[];
    }>;
    /**
     * Cleanup workspace
     */
    cleanup(workspacePath: string): Promise<void>;
    private findProjectForWorkspace;
    private copyProject;
    private applyUnifiedDiff;
    /**
     * Check if this is a simple line addition/replacement
     */
    private isSimpleReplacement;
    /**
     * Apply a simple replacement/insertion
     */
    private applySimpleReplacement;
}
export declare class VerificationPipeline {
    /**
     * Run verification checks on workspace
     */
    verify(workspacePath: string, checks: string[], onProgress?: (check: string, status: 'running' | 'passed' | 'failed') => void): Promise<VerificationResult>;
    /**
     * Run additional security checks
     */
    securityChecks(workspacePath: string): Promise<{
        passed: boolean;
        issues: string[];
    }>;
    private findFiles;
}
export declare class VerifiedAutofixRunner {
    private workspaceManager;
    private verificationPipeline;
    constructor();
    /**
     * Run verified autofix process
     */
    run(options: AutofixOptions): Promise<AutofixResult>;
    /**
     * Call AI agent using OpenAI or Anthropic API
     * Prefers OpenAI if OPENAI_API_KEY is set, otherwise falls back to Anthropic
     */
    private callAgent;
    /**
     * Apply diffs to actual project
     */
    private applyToProject;
}
export interface CostEstimate {
    model: string;
    estimatedTokens: number;
    estimatedCost: number;
    currency: string;
}
export declare function estimateCost(promptLength: number, model?: string): CostEstimate;
export declare function listBackups(projectPath: string): Promise<string[]>;
export declare function restoreBackups(projectPath: string): Promise<{
    restored: string[];
    errors: string[];
}>;
export declare function cleanBackups(projectPath: string): Promise<number>;
export declare const verifiedAutofix: VerifiedAutofixRunner;
export declare const runVerifiedAutofix: (options: AutofixOptions) => Promise<AutofixResult>;
//# sourceMappingURL=verified-autofix.d.ts.map