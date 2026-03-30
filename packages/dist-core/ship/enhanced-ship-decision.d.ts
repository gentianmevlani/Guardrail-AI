/**
 * Enhanced Ship Decision Engine
 *
 * Provides clear, reliable SHIP/NO SHIP decisions with:
 * - Detailed criteria breakdown
 * - Confidence scores
 * - Actionable blockers
 * - Context-aware recommendations
 * - Drift detection
 */
export interface ShipCriteria {
    name: string;
    weight: number;
    status: 'pass' | 'fail' | 'warning' | 'skip';
    score: number;
    confidence: number;
    blockers: string[];
    recommendations: string[];
    evidence: string[];
}
export interface EnhancedShipDecision {
    verdict: 'SHIP' | 'NO_SHIP' | 'REVIEW';
    confidence: number;
    score: number;
    criteria: ShipCriteria[];
    blockers: Array<{
        id: string;
        severity: 'critical' | 'high' | 'medium';
        category: string;
        message: string;
        fixable: boolean;
        fixSteps?: string[];
    }>;
    context: {
        projectPath: string;
        timestamp: string;
        gitCommit?: string;
        branch?: string;
    };
    recommendations: {
        immediate: string[];
        shortTerm: string[];
        longTerm: string[];
    };
    driftDetected: boolean;
    driftDetails?: {
        score: number;
        areas: string[];
        recommendations: string[];
    };
}
export declare class EnhancedShipDecisionEngine {
    private shipEngine;
    private decisionHistory;
    constructor();
    /**
     * Make enhanced ship decision with full context
     */
    decide(projectPath: string, options?: {
        includeReality?: boolean;
        includeSecurity?: boolean;
        includePerformance?: boolean;
        checkDrift?: boolean;
        baseUrl?: string;
    }): Promise<EnhancedShipDecision>;
    /**
     * Evaluate all ship criteria
     */
    private evaluateCriteria;
    /**
     * Check for hallucinations in the codebase
     */
    private checkHallucinations;
    /**
     * Detect drift from project standards
     */
    private detectDrift;
    /**
     * Calculate final verdict
     */
    private calculateVerdict;
    /**
     * Extract actionable blockers
     */
    private extractBlockers;
    /**
     * Generate recommendations
     */
    private generateRecommendations;
    /**
     * Get git context
     */
    private getGitContext;
    /**
     * Get recent changes for hallucination check
     */
    private getRecentChanges;
    /**
     * Get previous decision for drift detection
     */
    private getPreviousDecision;
    /**
     * Store decision in history
     */
    private storeDecision;
    /**
     * Generate human-readable report
     */
    generateReport(decision: EnhancedShipDecision): string;
}
export declare const enhancedShipDecisionEngine: EnhancedShipDecisionEngine;
//# sourceMappingURL=enhanced-ship-decision.d.ts.map