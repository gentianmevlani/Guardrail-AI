/**
 * Autopilot Mode Types
 *
 * Type definitions for the Autopilot batch remediation system.
 * PRO/COMPLIANCE+ feature.
 */
export type AutopilotMode = 'plan' | 'apply' | 'rollback';
export type AutopilotFixPackCategory = 'security' | 'quality' | 'type-errors' | 'build-blockers' | 'test-failures' | 'placeholders' | 'route-integrity';
export interface AutopilotFinding {
    id: string;
    category: AutopilotFixPackCategory;
    severity: 'critical' | 'high' | 'medium' | 'low';
    file: string;
    line: number;
    message: string;
    fixable: boolean;
}
export interface AutopilotFixPack {
    id: string;
    category: AutopilotFixPackCategory;
    name: string;
    description: string;
    findings: AutopilotFinding[];
    estimatedRisk: 'low' | 'medium' | 'high';
    impactedFiles: string[];
    priority: number;
}
export interface AutopilotOptions {
    projectPath: string;
    mode: AutopilotMode;
    profile?: 'quick' | 'full' | 'ship' | 'ci';
    maxFixes?: number;
    verify?: boolean;
    branchStrategy?: 'none' | 'worktree' | 'copy';
    dryRun?: boolean;
    json?: boolean;
    onProgress?: (stage: string, message: string) => void;
    packIds?: string[];
    runId?: string;
    force?: boolean;
    interactive?: boolean;
}
export interface AutopilotVerificationResult {
    passed: boolean;
    typecheck: {
        passed: boolean;
        errors: string[];
    };
    build: {
        passed: boolean;
        errors: string[];
    };
    tests: {
        passed: boolean;
        errors: string[];
    };
    duration: number;
}
export interface AppliedFix {
    packId: string;
    findingId: string;
    file: string;
    success: boolean;
    error?: string;
}
export interface AutopilotPlanResult {
    mode: 'plan';
    projectPath: string;
    profile: string;
    timestamp: string;
    totalFindings: number;
    fixableFindings: number;
    packs: AutopilotFixPack[];
    estimatedDuration: string;
    riskAssessment: {
        low: number;
        medium: number;
        high: number;
    };
}
export interface AutopilotApplyResult {
    mode: 'apply';
    projectPath: string;
    profile: string;
    timestamp: string;
    startTime: string;
    endTime: string;
    duration: number;
    packsAttempted: number;
    packsSucceeded: number;
    packsFailed: number;
    appliedFixes: AppliedFix[];
    verification: AutopilotVerificationResult | null;
    remainingFindings: number;
    newScanVerdict: 'pass' | 'fail' | 'skipped';
    errors: string[];
    runId?: string;
    gitBranch?: string;
    gitCommit?: string;
}
export interface AutopilotRollbackResult {
    mode: 'rollback';
    projectPath: string;
    runId: string;
    timestamp: string;
    success: boolean;
    method: 'git-reset' | 'backup-restore';
    message: string;
}
export type AutopilotResult = AutopilotPlanResult | AutopilotApplyResult | AutopilotRollbackResult;
export interface AutopilotScanResult {
    findings: AutopilotFinding[];
    score: number;
    verdict: 'pass' | 'fail';
    duration: number;
}
export declare const AUTOPILOT_FIX_PACK_PRIORITY: Record<AutopilotFixPackCategory, number>;
//# sourceMappingURL=types.d.ts.map