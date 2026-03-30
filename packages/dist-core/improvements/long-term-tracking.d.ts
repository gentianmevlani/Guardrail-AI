/**
 * Long-Term Improvement Tracking System
 *
 * Tracks and enforces:
 * - Best practices adoption
 * - Testing coverage and quality
 * - Code review processes
 * - Tool efficiency
 * - Continuous improvement
 */
export interface BestPractice {
    id: string;
    name: string;
    category: 'testing' | 'code_quality' | 'security' | 'performance' | 'documentation' | 'process';
    description: string;
    status: 'adopted' | 'partial' | 'not_adopted';
    adoptionDate?: string;
    evidence: string[];
    impact: 'high' | 'medium' | 'low';
}
export interface TestMetrics {
    coverage: number;
    unitTests: number;
    integrationTests: number;
    e2eTests: number;
    passing: number;
    failing: number;
    lastRun: string;
    trends: Array<{
        date: string;
        coverage: number;
        passing: number;
    }>;
}
export interface CodeReviewMetrics {
    reviewsCompleted: number;
    averageReviewTime: number;
    issuesFound: number;
    issuesResolved: number;
    reviewQuality: number;
    trends: Array<{
        date: string;
        reviews: number;
        quality: number;
    }>;
}
export interface ToolEfficiency {
    tool: string;
    usage: number;
    successRate: number;
    averageTime: number;
    improvements: Array<{
        date: string;
        change: string;
        impact: string;
    }>;
}
export interface ImprovementPlan {
    id: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    status: 'planned' | 'in_progress' | 'completed' | 'blocked';
    assignedTo?: string;
    dueDate?: string;
    progress: number;
    milestones: Array<{
        id: string;
        title: string;
        completed: boolean;
        completedDate?: string;
    }>;
    blockers: string[];
}
export interface LongTermTrackingReport {
    projectPath: string;
    timestamp: string;
    bestPractices: BestPractice[];
    testMetrics: TestMetrics;
    codeReviewMetrics: CodeReviewMetrics;
    toolEfficiency: ToolEfficiency[];
    improvementPlans: ImprovementPlan[];
    overallScore: number;
    recommendations: string[];
}
export declare class LongTermTrackingSystem {
    private projectPath;
    private dataPath;
    constructor(projectPath: string);
    /**
     * Generate comprehensive tracking report
     */
    generateReport(): Promise<LongTermTrackingReport>;
    /**
     * Track best practice adoption
     */
    trackBestPractice(practice: BestPractice): Promise<void>;
    /**
     * Record test run
     */
    recordTestRun(metrics: Partial<TestMetrics>): Promise<void>;
    /**
     * Record code review
     */
    recordCodeReview(review: {
        issuesFound: number;
        issuesResolved: number;
        reviewTime: number;
        quality: number;
    }): Promise<void>;
    /**
     * Track tool usage
     */
    trackToolUsage(tool: string, success: boolean, duration: number): Promise<void>;
    /**
     * Create improvement plan
     */
    createImprovementPlan(plan: ImprovementPlan): Promise<void>;
    /**
     * Update improvement plan progress
     */
    updateImprovementPlan(planId: string, updates: Partial<ImprovementPlan>): Promise<void>;
    private analyzeTestMetrics;
    private analyzeCodeReviewMetrics;
    private analyzeToolEfficiency;
    private loadBestPractices;
    private getDefaultBestPractices;
    private calculateOverallScore;
    private generateRecommendations;
    private findTestFiles;
    private walkDirectory;
    private ensureDataDir;
    private saveBestPractices;
    private loadTestMetrics;
    private saveTestMetrics;
    private loadCodeReviewMetrics;
    private saveCodeReviewMetrics;
    private loadToolEfficiency;
    private saveToolEfficiency;
    private loadImprovementPlans;
    private saveImprovementPlans;
}
export declare function createLongTermTracking(projectPath: string): LongTermTrackingSystem;
//# sourceMappingURL=long-term-tracking.d.ts.map