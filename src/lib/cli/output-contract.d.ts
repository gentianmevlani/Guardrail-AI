/**
 * CLI Output Contract
 *
 * Defines the stable, deterministic output format for all guardrail commands.
 * This is the "contract" that makes guardrail feel enterprise-grade.
 */
export type ExitCode = 0 | 1 | 2 | 3;
export type Verdict = 'PASS' | 'FAIL' | 'WARN' | 'ERROR';
export declare const EXIT_CODES: {
    readonly PASS: 0;
    readonly FAIL: 1;
    readonly MISCONFIG: 2;
    readonly INTERNAL: 3;
};
export interface FindingID {
    prefix: string;
    number: number;
    full: string;
}
export interface Evidence {
    type: 'lexical' | 'structural' | 'runtime';
    description: string;
    file?: string;
    line?: number;
    code?: string;
    strength: number;
    metadata?: Record<string, any>;
}
export interface StandardFinding {
    id: FindingID;
    ruleId: string;
    ruleName: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    verdict: Verdict;
    evidenceLevel: 'lexical' | 'structural' | 'runtime';
    confidence: number;
    file: string;
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    message: string;
    codeSnippet: string;
    evidence: Evidence[];
    reachable: boolean;
    inProdPath: boolean;
    score: number;
    fixSuggestion: string;
    autofixAvailable: boolean;
    verifyCommand: string;
    explainUrl?: string;
}
export interface VerdictOutput {
    verdict: Verdict;
    exitCode: ExitCode;
    summary: {
        totalFindings: number;
        blockers: number;
        warnings: number;
        info: number;
    };
    topBlockers: StandardFinding[];
    warnings: StandardFinding[];
    info: StandardFinding[];
    timings: {
        total: number;
        discovery: number;
        analysis: number;
        verification: number;
    };
    cached: boolean;
}
export interface StandardScanOutput {
    schemaVersion: string;
    timestamp: string;
    scanId: string;
    projectPath: string;
    verdict: VerdictOutput;
    findings: StandardFinding[];
    metadata: {
        version: string;
        nodeVersion: string;
        platform: string;
        cacheHit: boolean;
    };
}
/**
 * Generate stable finding ID
 */
export declare function generateFindingID(category: string, index: number, existingIDs?: Set<string>): FindingID;
/**
 * Normalize finding to standard format
 */
export declare function normalizeFinding(finding: any, category: string, index: number, existingIDs: Set<string>): StandardFinding;
/**
 * Sort findings deterministically
 */
export declare function sortFindings(findings: StandardFinding[]): StandardFinding[];
/**
 * Build verdict output
 */
export declare function buildVerdictOutput(findings: StandardFinding[], timings: {
    total: number;
    discovery: number;
    analysis: number;
    verification: number;
}, cached?: boolean): VerdictOutput;
/**
 * Format standard scan output
 */
export declare function formatStandardOutput(verdict: VerdictOutput, findings: StandardFinding[], scanId: string, projectPath: string, metadata: {
    version: string;
    nodeVersion: string;
    platform: string;
}): StandardScanOutput;
