/**
 * Reality Sniff Scanner - Advanced AI Artifact Detection
 *
 * A three-layer verifier that detects AI-generated fake logic with receipts:
 * - Layer 1: Lexical evidence (fast regex sweep)
 * - Layer 2: Structural evidence (AST analysis)
 * - Layer 3: Runtime witness (proof traces)
 *
 * FAIL only when reachability/impact can be proven in prod paths.
 * Everything else WARN/INFO.
 */
export type EvidenceLevel = 'lexical' | 'structural' | 'runtime';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Verdict = 'FAIL' | 'WARN' | 'INFO' | 'PASS';
export interface RealityFinding {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: Severity;
    verdict: Verdict;
    evidenceLevel: EvidenceLevel;
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
    fixSuggestion?: string;
    replayCommand?: string;
}
export interface Evidence {
    type: 'lexical' | 'structural' | 'runtime';
    description: string;
    file?: string;
    line?: number;
    code?: string;
    metadata?: Record<string, any>;
}
export interface RealitySniffResult {
    id?: string;
    timestamp?: string;
    verdict: Verdict;
    score: number;
    findings: RealityFinding[];
    blockers: RealityFinding[];
    warnings: RealityFinding[];
    info: RealityFinding[];
    summary: {
        totalFindings: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        infoCount: number;
        byEvidenceLevel: {
            lexical: number;
            structural: number;
            runtime: number;
        };
    };
    executionTime: number;
    filesScanned: number;
    layersExecuted: {
        lexical: boolean;
        structural: boolean;
        runtime: boolean;
    };
}
export interface ScanOptions {
    projectPath: string;
    layers?: {
        lexical?: boolean;
        structural?: boolean;
        runtime?: boolean;
    };
    excludePatterns?: string[];
    nonProdPaths?: string[];
    verbose?: boolean;
}
export declare class RealitySniffScanner {
    private options;
    private findings;
    private filesScanned;
    private findingIDs;
    private findingIDCounter;
    constructor(options: ScanOptions);
    scan(): Promise<RealitySniffResult>;
    private runLexicalPass;
    private scanPattern;
    private runStructuralPass;
    private runRuntimePass;
    private calculateVerdicts;
    private findSourceFiles;
    private walkDirectory;
    private shouldExclude;
    private isNonProdPath;
    private isProdPath;
    private getLineNumber;
    private getCodeSnippet;
    private scoreToVerdict;
    private generateMessage;
    private generateFixSuggestion;
    private getCategoryFromRuleId;
    private isAutofixAvailable;
}
export declare function scanRealitySniff(options: ScanOptions): Promise<RealitySniffResult>;
