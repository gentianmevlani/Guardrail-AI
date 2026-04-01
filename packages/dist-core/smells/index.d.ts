/**
 * Code Smell Predictor
 *
 * Predicts technical debt and code smells before they become problems
 */
export interface CodeSmell {
    type: 'long-method' | 'large-class' | 'duplication' | 'complexity' | 'coupling' | 'cohesion';
    severity: 'critical' | 'high' | 'medium' | 'low';
    file: string;
    line?: number;
    description: string;
    metrics: {
        current: number;
        threshold: number;
        trend?: 'increasing' | 'decreasing' | 'stable';
    };
    prediction: {
        when: 'immediate' | '1-month' | '3-months' | '6-months';
        impact: string;
        cost: 'low' | 'medium' | 'high';
    };
    recommendation: string[];
    remediation?: string;
}
export interface TechnicalDebtReport {
    totalSmells: number;
    critical: number;
    estimatedDebt: number;
    smells: CodeSmell[];
    trends: Array<{
        type: string;
        trend: 'improving' | 'worsening' | 'stable';
        change: number;
    }>;
}
export declare class CodeSmellPredictor {
    /**
     * Predict code smells and technical debt
     */
    predict(projectPath: string): Promise<TechnicalDebtReport>;
    /**
     * Predict long methods
     */
    private predictLongMethods;
    /**
     * Predict large classes
     */
    private predictLargeClasses;
    private calculateDebt;
    private analyzeTrends;
    private extractFunctions;
    private extractClasses;
    private estimateFunctionLength;
    private estimateClassSize;
    private findCodeFiles;
    private shouldIgnore;
}
export declare const codeSmellPredictor: CodeSmellPredictor;
//# sourceMappingURL=index.d.ts.map