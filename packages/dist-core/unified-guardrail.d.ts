/**
 * Unified Guardrail System
 *
 * Integrates all core systems:
 * - Enhanced Ship Decision Engine
 * - Advanced Prompt Firewall
 * - Enhanced Context Engine
 * - Long-Term Improvement Tracking
 */
import { EnhancedShipDecision } from './ship/enhanced-ship-decision';
import { PromptFirewallResult } from '../../ai-guardrails/src/firewall/advanced-prompt-firewall';
import { LongTermTrackingReport } from './improvements/long-term-tracking';
export interface UnifiedGuardrailOptions {
    projectPath: string;
    enableShipDecision?: boolean;
    enablePromptFirewall?: boolean;
    enableContextEngine?: boolean;
    enableLongTermTracking?: boolean;
}
export interface UnifiedGuardrailResult {
    shipDecision?: EnhancedShipDecision;
    promptFirewall?: PromptFirewallResult;
    contextValidation?: {
        valid: boolean;
        drift?: any;
    };
    longTermTracking?: LongTermTrackingReport;
    summary: {
        overallStatus: 'ready' | 'needs_attention' | 'blocked';
        score: number;
        blockers: string[];
        recommendations: string[];
    };
}
export declare class UnifiedGuardrail {
    private projectPath;
    private promptFirewall;
    private longTermTracking;
    constructor(options: UnifiedGuardrailOptions);
    /**
     * Run comprehensive guardrail check
     */
    runComprehensiveCheck(prompt?: string, options?: {
        checkShip?: boolean;
        checkContext?: boolean;
        checkLongTerm?: boolean;
    }): Promise<UnifiedGuardrailResult>;
    /**
     * Process prompt through firewall with full analysis
     */
    processPrompt(prompt: string): Promise<PromptFirewallResult>;
    /**
     * Get ship decision
     */
    getShipDecision(): Promise<EnhancedShipDecision>;
    /**
     * Get long-term tracking report
     */
    getLongTermReport(): Promise<LongTermTrackingReport>;
    /**
     * Generate comprehensive report
     */
    generateReport(prompt?: string): Promise<string>;
}
export declare function createUnifiedGuardrail(options: UnifiedGuardrailOptions): UnifiedGuardrail;
//# sourceMappingURL=unified-guardrail.d.ts.map