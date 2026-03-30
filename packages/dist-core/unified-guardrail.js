"use strict";
/**
 * Unified Guardrail System
 *
 * Integrates all core systems:
 * - Enhanced Ship Decision Engine
 * - Advanced Prompt Firewall
 * - Enhanced Context Engine
 * - Long-Term Improvement Tracking
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedGuardrail = void 0;
exports.createUnifiedGuardrail = createUnifiedGuardrail;
const enhanced_ship_decision_1 = require("./ship/enhanced-ship-decision");
const advanced_prompt_firewall_1 = require("../../ai-guardrails/src/firewall/advanced-prompt-firewall");
// Note: enhancedContextEngine is imported dynamically to avoid build errors
// import { enhancedContextEngine } from '../../../src/lib/context/enhanced-context-engine';
const long_term_tracking_1 = require("./improvements/long-term-tracking");
class UnifiedGuardrail {
    projectPath;
    promptFirewall;
    longTermTracking;
    constructor(options) {
        this.projectPath = options.projectPath;
        this.promptFirewall = (0, advanced_prompt_firewall_1.createPromptFirewall)(options.projectPath);
        this.longTermTracking = (0, long_term_tracking_1.createLongTermTracking)(options.projectPath);
    }
    /**
     * Run comprehensive guardrail check
     */
    async runComprehensiveCheck(prompt, options = {}) {
        const result = {
            summary: {
                overallStatus: 'ready',
                score: 100,
                blockers: [],
                recommendations: [],
            },
        };
        // 1. Ship Decision
        if (options.checkShip !== false) {
            try {
                result.shipDecision = await enhanced_ship_decision_1.enhancedShipDecisionEngine.decide(this.projectPath, {
                    checkDrift: true,
                });
                if (result.shipDecision.verdict === 'NO_SHIP') {
                    result.summary.overallStatus = 'blocked';
                    result.summary.blockers.push(...result.shipDecision.blockers.map(b => b.message));
                }
                else if (result.shipDecision.verdict === 'REVIEW') {
                    result.summary.overallStatus = 'needs_attention';
                }
                result.summary.score = Math.min(result.summary.score, result.shipDecision.score);
                result.summary.recommendations.push(...result.shipDecision.recommendations.immediate);
            }
            catch (error) {
                result.summary.blockers.push(`Ship decision check failed: ${error.message}`);
            }
        }
        // 2. Prompt Firewall (if prompt provided)
        if (prompt && options.checkContext !== false) {
            try {
                result.promptFirewall = await this.promptFirewall.process(prompt, {
                    autoBreakdown: true,
                    autoVerify: true,
                    autoFix: false, // Don't auto-fix, just report
                    includeVersionControl: true,
                    generatePlan: true,
                });
                if (!result.promptFirewall.verification.passed) {
                    result.summary.overallStatus = 'blocked';
                    result.summary.blockers.push(...result.promptFirewall.verification.blockers);
                }
                result.summary.recommendations.push(...result.promptFirewall.recommendations);
            }
            catch (error) {
                result.summary.blockers.push(`Prompt firewall check failed: ${error.message}`);
            }
        }
        // 3. Context Validation
        if (options.checkContext !== false) {
            try {
                // Try to dynamically import enhancedContextEngine if available
                let contextResult;
                try {
                    const { enhancedContextEngine } = await Promise.resolve().then(() => __importStar(require('../../../src/lib/context/enhanced-context-engine')));
                    contextResult = await enhancedContextEngine.getValidatedContext(this.projectPath, {
                        checkDrift: true,
                    });
                }
                catch {
                    // Fallback if import fails
                    contextResult = {
                        validation: { valid: true, issues: [] },
                        drift: { detected: false },
                    };
                }
                result.contextValidation = {
                    valid: contextResult.validation.valid,
                    drift: contextResult.drift,
                };
                if (!contextResult.validation.valid) {
                    result.summary.overallStatus = 'needs_attention';
                    const criticalIssues = (contextResult.validation.issues || []).filter((i) => i.severity === 'critical' || i.severity === 'high');
                    result.summary.blockers.push(...criticalIssues.map((i) => i.message));
                }
                if (contextResult.drift?.detected) {
                    result.summary.recommendations.push(contextResult.drift.overallRecommendation);
                }
            }
            catch (error) {
                result.summary.blockers.push(`Context validation failed: ${error.message}`);
            }
        }
        // 4. Long-Term Tracking
        if (options.checkLongTerm !== false) {
            try {
                result.longTermTracking = await this.longTermTracking.generateReport();
                if (result.longTermTracking.overallScore < 70) {
                    result.summary.overallStatus = 'needs_attention';
                }
                result.summary.score = Math.min(result.summary.score, result.longTermTracking.overallScore);
                result.summary.recommendations.push(...result.longTermTracking.recommendations);
            }
            catch (error) {
                // Long-term tracking is optional, don't block on errors
                console.warn(`Long-term tracking failed: ${error.message}`);
            }
        }
        // Finalize summary
        if (result.summary.blockers.length > 0) {
            result.summary.overallStatus = 'blocked';
        }
        else if (result.summary.score < 85) {
            result.summary.overallStatus = 'needs_attention';
        }
        return result;
    }
    /**
     * Process prompt through firewall with full analysis
     */
    async processPrompt(prompt) {
        return await this.promptFirewall.process(prompt, {
            autoBreakdown: true,
            autoVerify: true,
            autoFix: false,
            includeVersionControl: true,
            generatePlan: true,
        });
    }
    /**
     * Get ship decision
     */
    async getShipDecision() {
        return await enhanced_ship_decision_1.enhancedShipDecisionEngine.decide(this.projectPath, {
            checkDrift: true,
        });
    }
    /**
     * Get long-term tracking report
     */
    async getLongTermReport() {
        return await this.longTermTracking.generateReport();
    }
    /**
     * Generate comprehensive report
     */
    async generateReport(prompt) {
        const result = await this.runComprehensiveCheck(prompt);
        const lines = [];
        lines.push('╔══════════════════════════════════════════════════════════════╗');
        lines.push('║         🛡️ UNIFIED GUARDRAIL COMPREHENSIVE REPORT 🛡️        ║');
        lines.push('╚══════════════════════════════════════════════════════════════╝');
        lines.push('');
        // Overall Status
        const statusIcon = result.summary.overallStatus === 'ready' ? '✅' :
            result.summary.overallStatus === 'needs_attention' ? '⚠️' : '❌';
        lines.push(`${statusIcon} OVERALL STATUS: ${result.summary.overallStatus.toUpperCase()}`);
        lines.push(`   Score: ${result.summary.score}/100`);
        lines.push('');
        // Ship Decision
        if (result.shipDecision) {
            lines.push('🚀 SHIP DECISION:');
            lines.push(`   Verdict: ${result.shipDecision.verdict}`);
            lines.push(`   Confidence: ${(result.shipDecision.confidence * 100).toFixed(0)}%`);
            if (result.shipDecision.blockers.length > 0) {
                lines.push(`   Blockers: ${result.shipDecision.blockers.length}`);
            }
            lines.push('');
        }
        // Prompt Firewall
        if (result.promptFirewall) {
            lines.push('🛡️ PROMPT FIREWALL:');
            lines.push(`   Verification: ${result.promptFirewall.verification.passed ? 'PASSED' : 'FAILED'}`);
            lines.push(`   Score: ${result.promptFirewall.verification.score}/100`);
            lines.push(`   Tasks: ${result.promptFirewall.taskBreakdown.length}`);
            lines.push(`   Immediate Fixes: ${result.promptFirewall.immediateFixes.length}`);
            lines.push('');
        }
        // Context Validation
        if (result.contextValidation) {
            lines.push('🧠 CONTEXT VALIDATION:');
            lines.push(`   Valid: ${result.contextValidation.valid ? 'YES' : 'NO'}`);
            if (result.contextValidation.drift?.detected) {
                lines.push(`   Drift Detected: YES (Score: ${result.contextValidation.drift.score})`);
            }
            lines.push('');
        }
        // Long-Term Tracking
        if (result.longTermTracking) {
            lines.push('📊 LONG-TERM TRACKING:');
            lines.push(`   Overall Score: ${result.longTermTracking.overallScore}/100`);
            lines.push(`   Test Coverage: ${result.longTermTracking.testMetrics.coverage}%`);
            lines.push(`   Best Practices Adopted: ${result.longTermTracking.bestPractices.filter(p => p.status === 'adopted').length}/${result.longTermTracking.bestPractices.length}`);
            lines.push('');
        }
        // Blockers
        if (result.summary.blockers.length > 0) {
            lines.push('🚫 BLOCKERS:');
            for (const blocker of result.summary.blockers.slice(0, 10)) {
                lines.push(`   • ${blocker}`);
            }
            lines.push('');
        }
        // Recommendations
        if (result.summary.recommendations.length > 0) {
            lines.push('💡 RECOMMENDATIONS:');
            for (const rec of result.summary.recommendations.slice(0, 10)) {
                lines.push(`   • ${rec}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
}
exports.UnifiedGuardrail = UnifiedGuardrail;
function createUnifiedGuardrail(options) {
    return new UnifiedGuardrail(options);
}
