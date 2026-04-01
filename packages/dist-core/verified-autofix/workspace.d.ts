/**
 * Temp Workspace Manager - Isolated Verification Environment
 *
 * Creates isolated workspaces for testing patches:
 * 1. Prefers git worktree when available
 * 2. Falls back to directory copy
 * 3. Applies diffs with git apply --check validation
 * 4. Runs verification commands (typecheck, build, tests)
 */
import type { ParsedHunk } from './format-validator';
import type { RepoFingerprint } from './repo-fingerprint';
export interface WorkspaceOptions {
    projectPath: string;
    useWorktree?: boolean;
    installDeps?: boolean;
    timeout?: number;
}
export interface WorkspaceInfo {
    id: string;
    path: string;
    type: 'worktree' | 'copy';
    projectPath: string;
    createdAt: Date;
}
export interface ApplyResult {
    success: boolean;
    applied: number;
    failed: number;
    errors: string[];
}
export interface VerifyResult {
    passed: boolean;
    checks: CheckResult[];
    duration: number;
    failureContext: string[];
}
export interface CheckResult {
    name: string;
    command: string;
    passed: boolean;
    output: string;
    duration: number;
}
export declare class TempWorkspace {
    private workspaces;
    /**
     * Create an isolated workspace for verification
     */
    create(options: WorkspaceOptions): Promise<WorkspaceInfo>;
    /**
     * Apply a unified diff to the workspace
     */
    applyDiff(workspacePath: string, diff: string, hunks: ParsedHunk[]): Promise<ApplyResult>;
    /**
     * Run verification checks in the workspace
     */
    verify(workspacePath: string, fingerprint: RepoFingerprint, options?: {
        skipTests?: boolean;
        timeout?: number;
    }): Promise<VerifyResult>;
    /**
     * Copy changes back to the original project
     */
    copyBack(workspacePath: string, projectPath: string, files: string[]): Promise<void>;
    /**
     * Cleanup a workspace
     */
    cleanup(workspaceId: string): Promise<void>;
    /**
     * Cleanup all workspaces
     */
    cleanupAll(): Promise<void>;
    private tryCreateWorktree;
    private copyProject;
    private installDependencies;
    private tryGitApply;
    private applyHunk;
    private getVerificationCommands;
    private truncateOutput;
    private extractFailureContext;
}
export declare const tempWorkspace: TempWorkspace;
//# sourceMappingURL=workspace.d.ts.map