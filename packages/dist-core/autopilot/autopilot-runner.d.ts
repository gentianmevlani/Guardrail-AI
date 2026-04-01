/**
 * Autopilot Runner - PRO/COMPLIANCE+ Feature
 *
 * Batch remediation system that:
 * 1. Scans for issues using existing scanners
 * 2. Groups findings into Fix Packs
 * 3. Generates verified patches
 * 4. Applies in temp workspace
 * 5. Re-scans to verify
 * 6. Outputs final verdict
 */
import { AutopilotOptions, AutopilotResult, AutopilotFinding, AutopilotFixPack } from './types';
export declare class AutopilotRunner {
    private tempDir;
    private backupDir;
    constructor();
    run(options: AutopilotOptions): Promise<AutopilotResult>;
    private runPlan;
    private runApply;
    private runRollback;
    private runScan;
    groupIntoFixPacks(findings: AutopilotFinding[], maxFixes?: number): AutopilotFixPack[];
    private getCategoryName;
    private getCategoryDescription;
    private createTempWorkspace;
    private copyProject;
    private applyFixPack;
    private runVerification;
    private applyToProject;
    private cleanupWorkspace;
    private findSourceFiles;
    private isGitRepository;
    private createGitBranch;
    private gitBranchExists;
    private commitChanges;
    private createBackup;
    private restoreBackup;
    private confirmHighRiskPack;
}
export declare const autopilotRunner: AutopilotRunner;
export declare const runAutopilot: (options: AutopilotOptions) => Promise<AutopilotResult>;
//# sourceMappingURL=autopilot-runner.d.ts.map