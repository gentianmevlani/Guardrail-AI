/**
 * Verified AutoFix Pipeline - Orchestration Layer
 *
 * Pipeline order:
 * 1. format → validate JSON shape + strip markdown
 * 2. diff/path safety → validate unified diff + paths within project
 * 3. command safety → warn on risky commands
 * 4. stub detection → block TODO/placeholder in production
 * 5. apply diff → git apply --check then git apply
 * 6. typecheck → tsc --noEmit
 * 7. build (ship) → npm run build
 * 8. tests → npm test
 */
import { type FullValidationResult, type GuardrailV1Output } from './format-validator';
import { type VerifyResult } from './workspace';
import { type RepoFingerprint } from './repo-fingerprint';
export interface PipelineOptions {
    projectPath: string;
    agentOutputFile?: string;
    agentOutputRaw?: string;
    dryRun?: boolean;
    skipTests?: boolean;
    verbose?: boolean;
    timeout?: number;
    skipEntitlements?: boolean;
    strictMarkdown?: boolean;
    onProgress?: (stage: PipelineStage, message: string, data?: unknown) => void;
}
export type PipelineStage = 'init' | 'validate' | 'fingerprint' | 'workspace' | 'apply' | 'typecheck' | 'build' | 'test' | 'commit' | 'done' | 'error';
export interface PipelineResult {
    success: boolean;
    stage: PipelineStage;
    duration: number;
    validation?: FullValidationResult;
    fingerprint?: RepoFingerprint;
    verification?: VerifyResult;
    filesModified: string[];
    errors: string[];
    warnings: string[];
    failureContext: string[];
    output?: GuardrailV1Output;
}
export declare class VerifiedAutofixPipeline {
    private workspace;
    constructor();
    /**
     * Run the full verification pipeline
     */
    run(options: PipelineOptions): Promise<PipelineResult>;
    /**
     * Run from a file (CLI convenience method)
     */
    runFromFile(agentOutputFile: string, projectPath: string, options?: Partial<PipelineOptions>): Promise<PipelineResult>;
    /**
     * Validate only (no apply) - for checking output format
     */
    validateOnly(raw: string, projectPath: string): FullValidationResult;
}
/**
 * Format pipeline result for CLI output
 */
export declare function formatPipelineResult(result: PipelineResult): string;
/**
 * Format result as JSON for machine consumption
 */
export declare function formatPipelineResultJson(result: PipelineResult): string;
export declare const verifiedAutofixPipeline: VerifiedAutofixPipeline;
//# sourceMappingURL=pipeline.d.ts.map