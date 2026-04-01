/**
 * Guardrail Configuration System
 *
 * Centralized configuration for all Guardrail systems:
 * - Ship decision thresholds
 * - Context engine settings
 * - Prompt firewall rules
 * - Long-term tracking preferences
 */
export interface ShipDecisionConfig {
    thresholds: {
        ship: number;
        review: number;
        noShip: number;
    };
    weights: {
        mockproof: number;
        badge: number;
        hallucination: number;
        security: number;
        performance: number;
    };
    requireAllCritical: boolean;
}
export interface ContextEngineConfig {
    driftThreshold: number;
    freshnessThreshold: number;
    confidenceThreshold: number;
    maxSnapshots: number;
    cacheTTL: number;
}
export interface PromptFirewallConfig {
    autoBreakdown: boolean;
    autoVerify: boolean;
    autoFix: boolean;
    includeVersionControl: boolean;
    generatePlan: boolean;
    maxTasks: number;
    verificationThreshold: number;
}
export interface LongTermTrackingConfig {
    trackBestPractices: boolean;
    trackTestMetrics: boolean;
    trackCodeReviews: boolean;
    trackToolEfficiency: boolean;
    minTestCoverage: number;
    minReviewQuality: number;
}
export interface GuardrailConfig {
    projectPath: string;
    shipDecision: ShipDecisionConfig;
    contextEngine: ContextEngineConfig;
    promptFirewall: PromptFirewallConfig;
    longTermTracking: LongTermTrackingConfig;
    version: string;
}
export declare class GuardrailConfigManager {
    private configPath;
    private config;
    constructor(projectPath: string);
    /**
     * Load configuration from file or return defaults
     */
    load(): Promise<GuardrailConfig>;
    /**
     * Save configuration to file
     */
    save(config: Partial<GuardrailConfig>): Promise<void>;
    /**
     * Get ship decision config
     */
    getShipDecisionConfig(): Promise<ShipDecisionConfig>;
    /**
     * Get context engine config
     */
    getContextEngineConfig(): Promise<ContextEngineConfig>;
    /**
     * Get prompt firewall config
     */
    getPromptFirewallConfig(): Promise<PromptFirewallConfig>;
    /**
     * Get long-term tracking config
     */
    getLongTermTrackingConfig(): Promise<LongTermTrackingConfig>;
    /**
     * Reset to defaults
     */
    reset(): Promise<void>;
}
export declare function createConfigManager(projectPath: string): GuardrailConfigManager;
//# sourceMappingURL=guardrail-config.d.ts.map