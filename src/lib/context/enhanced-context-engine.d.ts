/**
 * Enhanced Context Engine
 *
 * Prevents AI hallucinations and drift by:
 * - Real-time context validation
 * - Drift detection and correction
 * - Pattern enforcement
 * - Continuous learning from corrections
 */
interface EnhancedContext {
    [key: string]: unknown;
}
export interface DriftDetection {
    detected: boolean;
    score: number;
    areas: Array<{
        area: string;
        driftScore: number;
        before: string;
        after: string;
        recommendation: string;
    }>;
    overallRecommendation: string;
}
export interface ContextValidation {
    valid: boolean;
    issues: Array<{
        type: 'missing_context' | 'outdated_context' | 'conflicting_context' | 'hallucination_risk';
        severity: 'critical' | 'high' | 'medium' | 'low';
        message: string;
        suggestion: string;
        evidence: string[];
    }>;
    confidence: number;
}
export interface ContextSnapshot {
    timestamp: string;
    context: EnhancedContext;
    patterns: string[];
    conventions: Record<string, string>;
    checksum: string;
}
export declare class EnhancedContextEngine {
    private snapshots;
    private driftThreshold;
    /**
     * Get validated context with drift detection
     */
    getValidatedContext(projectPath: string, request?: {
        file?: string;
        purpose?: string;
        checkDrift?: boolean;
    }): Promise<{
        context: EnhancedContext;
        validation: ContextValidation;
        drift?: DriftDetection;
    }>;
    const validation: any;
}
export declare const enhancedContextEngine: EnhancedContextEngine;
export {};
//# sourceMappingURL=enhanced-context-engine.d.ts.map