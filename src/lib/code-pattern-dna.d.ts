/**
 * Code Pattern DNA
 *
 * Creates unique fingerprints for code patterns
 * Unique: DNA-like identification system for code patterns
 */
export interface PatternDNA {
    id: string;
    fingerprint: string;
    pattern: string;
    structure: {
        complexity: number;
        dependencies: string[];
        patterns: string[];
        conventions: Record<string, string>;
    };
    metadata: {
        firstSeen: string;
        lastSeen: string;
        frequency: number;
        projects: string[];
        variants: Array<{
            fingerprint: string;
            similarity: number;
        }>;
    };
    relationships: {
        parent?: string;
        children: string[];
        siblings: string[];
        evolution: Array<{
            timestamp: string;
            fingerprint: string;
            change: string;
        }>;
    };
}
export interface DNAMatch {
    dna: PatternDNA;
    similarity: number;
    differences: string[];
    confidence: number;
}
declare class CodePatternDNA {
    private dnaRegistry;
    private registryFile;
    constructor();
    /**
     * Generate DNA for a code pattern
     */
    generateDNA(code: string, metadata?: {
        project?: string;
        file?: string;
        context?: string;
    }): PatternDNA;
    /**
     * Find similar patterns by DNA
     */
    findSimilar(dna: PatternDNA, threshold?: number): DNAMatch[];
    /**
     * Track pattern evolution
     */
    trackEvolution(originalDNA: PatternDNA, newCode: string): PatternDNA;
    /**
     * Find pattern by fingerprint
     */
    findByFingerprint(fingerprint: string): PatternDNA | null;
    /**
     * Get DNA family tree
     */
    getFamilyTree(dnaId: string): {
        ancestors: PatternDNA[];
        descendants: PatternDNA[];
        siblings: PatternDNA[];
    };
    /**
     * Compute fingerprint (SHA-256 hash of normalized code)
     */
    private computeFingerprint;
    /**
     * Normalize code for fingerprinting
     */
    private normalizeCode;
    /**
     * Analyze code structure
     */
    private analyzeStructure;
    /**
     * Compute similarity between two DNAs
     */
    private computeSimilarity;
    private compareStructures;
    private comparePatterns;
    private intersection;
    private findRelationships;
    private findDifferences;
    private computeConfidence;
    private computeDiff;
    private extractDependencies;
    private extractPatterns;
    private extractConventions;
    private saveRegistry;
    private loadRegistry;
    private pathExists;
}
export declare const codePatternDNA: CodePatternDNA;
export {};
//# sourceMappingURL=code-pattern-dna.d.ts.map