/**
 * Fix Packs Generator
 *
 * Generates deterministic Fix Packs from findings and repo fingerprint.
 * Groups findings by category, file proximity, and risk level.
 */
import { Finding, RepoFingerprint, GenerateFixPacksOptions, GenerateFixPacksResult } from './types';
export declare function generateFixPacks(options: GenerateFixPacksOptions): GenerateFixPacksResult;
export declare function generateRepoFingerprint(projectPath: string, options?: {
    name?: string;
    framework?: string;
    language?: string;
}): RepoFingerprint;
export declare function parseFindingsFromScanOutput(scanOutput: string): Finding[];
//# sourceMappingURL=generate-fix-packs.d.ts.map