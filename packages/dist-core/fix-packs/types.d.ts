/**
 * Fix Packs Types
 *
 * First-class objects that group findings into actionable batches.
 * Used by CLI, Autopilot, and Verified AutoFix.
 */
import { Tier } from '../tier-config';
export declare const FINDING_CATEGORIES: readonly ["secrets", "routes", "mocks", "auth", "placeholders", "deps", "types", "tests", "security", "performance"];
export type FindingCategory = typeof FINDING_CATEGORIES[number];
export declare const SEVERITY_LEVELS: readonly ["critical", "high", "medium", "low", "info"];
export type SeverityLevel = typeof SEVERITY_LEVELS[number];
export declare const SEVERITY_ORDER: Record<SeverityLevel, number>;
export declare const FIX_STRATEGIES: readonly ["auto", "guided", "manual", "ai-assisted"];
export type FixStrategy = typeof FIX_STRATEGIES[number];
export interface Finding {
    id: string;
    category: FindingCategory;
    severity: SeverityLevel;
    title: string;
    description: string;
    file: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    code?: string;
    suggestion?: string;
    rule?: string;
    metadata?: Record<string, unknown>;
}
export interface FixPack {
    id: string;
    title: string;
    severity: SeverityLevel;
    findings: Finding[];
    files: string[];
    strategy: FixStrategy;
    estimatedImpact: EstimatedImpact;
    requiresHumanReview: boolean;
    category: FindingCategory;
    createdAt: string;
    metadata?: FixPackMetadata;
}
export interface EstimatedImpact {
    filesAffected: number;
    linesChanged: number;
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
    timeEstimateMinutes: number;
}
export interface FixPackMetadata {
    repoFingerprint?: string;
    generatedBy?: string;
    version?: string;
    tags?: string[];
}
export interface RepoFingerprint {
    id: string;
    name: string;
    framework?: string;
    language?: string;
    hasTypeScript: boolean;
    hasTests: boolean;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    gitRemote?: string;
    hash: string;
}
export interface GenerateFixPacksOptions {
    findings: Finding[];
    repoFingerprint: RepoFingerprint;
    groupByCategory?: boolean;
    groupByFileProximity?: boolean;
    maxPackSize?: number;
    minPackSize?: number;
    requiredTier?: Tier;
}
export interface GenerateFixPacksResult {
    packs: FixPack[];
    ungrouped: Finding[];
    stats: {
        totalFindings: number;
        totalPacks: number;
        byCategory: Record<FindingCategory, number>;
        bySeverity: Record<SeverityLevel, number>;
    };
}
export interface FixPackExecutionOptions {
    pack: FixPack;
    projectPath: string;
    dryRun?: boolean;
    autoApply?: boolean;
    maxAttempts?: number;
    onProgress?: (stage: string, message: string) => void;
}
export interface FixPackExecutionResult {
    success: boolean;
    packId: string;
    appliedFixes: number;
    skippedFixes: number;
    errors: string[];
    duration: number;
    filesModified: string[];
    diffs: Array<{
        file: string;
        content: string;
    }>;
}
export declare function compareSeverity(a: SeverityLevel, b: SeverityLevel): number;
export declare function isHigherSeverity(a: SeverityLevel, b: SeverityLevel): boolean;
export declare function getHighestSeverity(severities: SeverityLevel[]): SeverityLevel;
export declare function generatePackId(category: FindingCategory, index: number, hash: string): string;
export declare function sortPacksBySeverity(packs: FixPack[]): FixPack[];
//# sourceMappingURL=types.d.ts.map