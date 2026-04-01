/**
 * MockProof Build Gate - Import Graph Scanner
 *
 * Scans the import graph from production entrypoints to detect
 * banned imports (MockProvider, useMock, mock-context, localhost, etc.)
 * that would ship to production.
 *
 * This is the "one rule, one red line" feature that vibecoders love.
 */
export interface BannedImport {
    pattern: string;
    message: string;
    isRegex: boolean;
    allowedIn: string[];
}
export interface ImportNode {
    file: string;
    imports: string[];
    importedBy: string[];
}
export interface ViolationPath {
    entrypoint: string;
    bannedImport: string;
    importChain: string[];
    pattern: string;
    message: string;
}
export interface MockProofResult {
    verdict: 'pass' | 'fail';
    violations: ViolationPath[];
    scannedFiles: number;
    entrypoints: string[];
    timestamp: string;
    summary: {
        totalViolations: number;
        uniqueBannedImports: number;
        affectedEntrypoints: number;
    };
}
export interface MockProofConfig {
    entrypoints: string[];
    bannedImports: BannedImport[];
    excludeDirs: string[];
    includeExtensions: string[];
}
export declare class ImportGraphScanner {
    private config;
    private importGraph;
    private fileContents;
    constructor(config?: Partial<MockProofConfig>);
    /**
     * Scan a project for banned imports reachable from production entrypoints
     */
    scan(projectPath: string): Promise<MockProofResult>;
    /**
     * Find all source files in the project
     */
    private findSourceFiles;
    /**
     * Parse a file and extract its imports
     */
    private parseFile;
    /**
     * Extract import statements from file content
     */
    private extractImports;
    /**
     * Resolve an import path to an absolute file path
     */
    private resolveImport;
    /**
     * Trace from an entrypoint to find all reachable files with violations
     */
    private traceFromEntrypoint;
    /**
     * Check if a file matches any allowed patterns
     */
    private isFileAllowed;
    /**
     * Simple glob matching
     */
    private matchGlob;
    /**
     * Escape special regex characters
     */
    private escapeRegex;
    /**
     * Generate a human-readable report
     */
    generateReport(result: MockProofResult): string;
}
export declare const importGraphScanner: ImportGraphScanner;
//# sourceMappingURL=import-graph-scanner.d.ts.map