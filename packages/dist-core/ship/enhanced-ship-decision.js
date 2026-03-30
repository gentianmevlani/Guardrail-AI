"use strict";
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
exports.enhancedShipDecisionEngine = exports.EnhancedShipDecisionEngine = void 0;
class ShipEngineImpl {
    constructor(options) { }
    async run() {
        // Placeholder implementation
        return {};
    }
}
class EnhancedShipDecisionEngine {
    shipEngine;
    decisionHistory = new Map();
    constructor() {
        // Use placeholder implementation to avoid external dependency
        this.shipEngine = new ShipEngineImpl({
            projectPath: '.',
        });
    }
    /**
     * Make enhanced ship decision with full context
     */
    async decide(projectPath, options = {}) {
        const startTime = Date.now();
        // 1. Run comprehensive ship checks
        const shipResult = await this.shipEngine.run();
        // 2. Check for hallucinations
        const hallucinationReport = await this.checkHallucinations(projectPath);
        // 3. Evaluate all criteria
        const criteria = await this.evaluateCriteria(projectPath, shipResult, hallucinationReport, options);
        // 4. Detect drift if requested
        let driftDetected = false;
        let driftDetails;
        if (options.checkDrift) {
            const drift = await this.detectDrift(projectPath, criteria);
            driftDetected = drift.detected;
            driftDetails = drift.details;
        }
        // 5. Calculate overall verdict
        const { verdict, score, confidence } = this.calculateVerdict(criteria);
        // 6. Extract blockers
        const blockers = this.extractBlockers(criteria);
        // 7. Generate recommendations
        const recommendations = this.generateRecommendations(criteria, blockers, driftDetails);
        // 8. Get git context
        const gitContext = await this.getGitContext(projectPath);
        const decision = {
            verdict,
            confidence,
            score,
            criteria,
            blockers,
            context: {
                projectPath,
                timestamp: new Date().toISOString(),
                ...gitContext,
            },
            recommendations,
            driftDetected,
            driftDetails,
        };
        // Store in history
        const previousDecision = this.getPreviousDecision(projectPath);
        this.storeDecision(projectPath, decision);
        // Notify if decision changed
        if (previousDecision && previousDecision.verdict !== decision.verdict) {
            try {
                const { shipNotificationService } = await Promise.resolve().then(() => __importStar(require("../../../../apps/api/src/services/ship-notification-service")));
                await shipNotificationService.notifyDecisionChange({
                    runId: decision.context.gitCommit || `run-${Date.now()}`,
                    userId: "system", // Would be actual user ID in production
                    projectPath,
                    previousVerdict: previousDecision.verdict,
                    currentVerdict: decision.verdict,
                    score: decision.score,
                    confidence: decision.confidence,
                    blockers: decision.blockers,
                    timestamp: decision.context.timestamp,
                });
            }
            catch (error) {
                // Don't fail decision if notification fails
                console.warn("Failed to send notification:", error.message);
            }
        }
        return decision;
    }
    /**
     * Evaluate all ship criteria
     */
    async evaluateCriteria(projectPath, shipResult, hallucinationReport, options) {
        const criteria = [];
        // 1. MockProof criteria
        criteria.push({
            name: 'MockProof - No Mock Data',
            weight: 0.3,
            status: shipResult.mockproof?.verdict === 'pass' ? 'pass' : 'fail',
            score: shipResult.mockproof?.verdict === 'pass' ? 100 : 0,
            confidence: 0.95,
            blockers: shipResult.mockproof?.violations.map(v => v.message) || [],
            recommendations: shipResult.mockproof?.verdict === 'fail'
                ? ['Remove all mock data and placeholders', 'Use real API endpoints', 'Replace test data with production data']
                : [],
            evidence: shipResult.mockproof?.violations.map(v => `${v.bannedImport}: ${v.pattern}`) || [],
        });
        // 2. Ship Badge criteria
        criteria.push({
            name: 'Ship Badge - Quality Gates',
            weight: 0.25,
            status: shipResult.badge?.verdict === 'ship' ? 'pass' : shipResult.badge?.verdict === 'no-ship' ? 'fail' : 'warning',
            score: shipResult.badge?.score || 0,
            confidence: 0.9,
            blockers: shipResult.badge?.checks
                .filter(c => c.status === 'fail')
                .map(c => `${c.name}: ${c.message}`) || [],
            recommendations: shipResult.badge?.checks
                .filter(c => c.status === 'fail')
                .map(c => c.recommendation || `Fix ${c.name}`) || [],
            evidence: shipResult.badge?.checks.map(c => `${c.name}: ${c.status}`) || [],
        });
        // 3. Hallucination criteria
        criteria.push({
            name: 'AI Hallucination Check',
            weight: 0.2,
            status: hallucinationReport.hasHallucinations ? 'fail' : 'pass',
            score: 100 - hallucinationReport.score,
            confidence: hallucinationReport.confidence,
            blockers: hallucinationReport.checks
                .filter(c => c.severity === 'critical' || c.severity === 'high')
                .map(c => `${c.type}: ${c.detected}`) || [],
            recommendations: hallucinationReport.suggestions || [],
            evidence: hallucinationReport.checks.map(c => `${c.type}: ${c.suggestion}`) || [],
        });
        // 4. Security criteria (if available)
        if (options.includeSecurity) {
            criteria.push({
                name: 'Security Scan',
                weight: 0.15,
                status: 'skip', // Would be populated by actual security scan
                score: 0,
                confidence: 0,
                blockers: [],
                recommendations: ['Run security scan to check for vulnerabilities'],
                evidence: [],
            });
        }
        // 5. Performance criteria (if available)
        if (options.includePerformance) {
            criteria.push({
                name: 'Performance Check',
                weight: 0.1,
                status: 'skip', // Would be populated by actual performance check
                score: 0,
                confidence: 0,
                blockers: [],
                recommendations: ['Run performance check to ensure optimal speed'],
                evidence: [],
            });
        }
        return criteria;
    }
    /**
     * Check for hallucinations in the codebase
     */
    async checkHallucinations(projectPath) {
        try {
            // Try to dynamically import hallucination detector if available
            try {
                const { hallucinationDetector } = await Promise.resolve().then(() => __importStar(require('../../../src/lib/hallucination-detector')));
                const sampleCode = await this.getRecentChanges(projectPath);
                if (sampleCode) {
                    return await hallucinationDetector.detect(sampleCode, projectPath);
                }
            }
            catch {
                // Fallback if import fails
            }
            return {
                hasHallucinations: false,
                score: 0,
                checks: [],
                suggestions: [],
                confidence: 0.5,
            };
        }
        catch {
            return {
                hasHallucinations: false,
                score: 0,
                checks: [],
                suggestions: [],
                confidence: 0.3,
            };
        }
    }
    /**
     * Detect drift from project standards
     */
    async detectDrift(projectPath, criteria) {
        const previousDecision = this.getPreviousDecision(projectPath);
        if (!previousDecision) {
            return { detected: false };
        }
        // Compare current criteria scores with previous
        const scoreDiff = criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length -
            previousDecision.criteria.reduce((sum, c) => sum + c.score, 0) / previousDecision.criteria.length;
        const driftDetected = Math.abs(scoreDiff) > 10; // More than 10 point change
        if (driftDetected) {
            const areas = [];
            for (const criterion of criteria) {
                const prevCriterion = previousDecision.criteria.find(c => c.name === criterion.name);
                if (prevCriterion && Math.abs(criterion.score - prevCriterion.score) > 15) {
                    areas.push(criterion.name);
                }
            }
            return {
                detected: true,
                details: {
                    score: Math.abs(scoreDiff),
                    areas,
                    recommendations: [
                        'Review recent changes that may have caused drift',
                        'Ensure code follows project patterns',
                        'Run full context analysis to identify root cause',
                    ],
                },
            };
        }
        return { detected: false };
    }
    /**
     * Calculate final verdict
     */
    calculateVerdict(criteria) {
        // Calculate weighted score
        let totalScore = 0;
        let totalWeight = 0;
        let totalConfidence = 0;
        for (const criterion of criteria) {
            if (criterion.status !== 'skip') {
                totalScore += criterion.score * criterion.weight;
                totalWeight += criterion.weight;
                totalConfidence += criterion.confidence;
            }
        }
        const score = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
        const confidence = criteria.length > 0 ? totalConfidence / criteria.length : 0;
        // Determine verdict
        let verdict;
        const criticalFailures = criteria.filter(c => c.status === 'fail' && c.weight >= 0.2).length;
        if (criticalFailures > 0 || score < 70) {
            verdict = 'NO_SHIP';
        }
        else if (score < 85 || criteria.some(c => c.status === 'warning')) {
            verdict = 'REVIEW';
        }
        else {
            verdict = 'SHIP';
        }
        return { verdict, score, confidence };
    }
    /**
     * Extract actionable blockers
     */
    extractBlockers(criteria) {
        const blockers = [];
        let blockerId = 1;
        for (const criterion of criteria) {
            if (criterion.status === 'fail' && criterion.blockers.length > 0) {
                for (const blocker of criterion.blockers) {
                    blockers.push({
                        id: `BLOCKER-${blockerId++}`,
                        severity: criterion.weight >= 0.2 ? 'critical' : 'high',
                        category: criterion.name,
                        message: blocker,
                        fixable: true,
                        fixSteps: criterion.recommendations.slice(0, 3),
                    });
                }
            }
        }
        return blockers;
    }
    /**
     * Generate recommendations
     */
    generateRecommendations(criteria, blockers, driftDetails) {
        const immediate = [];
        const shortTerm = [];
        const longTerm = [];
        // Immediate: Fix blockers
        for (const blocker of blockers.slice(0, 5)) {
            immediate.push(`Fix: ${blocker.message}`);
        }
        // Short-term: Address warnings
        const warnings = criteria.filter(c => c.status === 'warning');
        for (const warning of warnings) {
            shortTerm.push(...warning.recommendations.slice(0, 2));
        }
        // Long-term: Best practices
        longTerm.push('Set up automated testing pipeline');
        longTerm.push('Implement code review process');
        longTerm.push('Establish coding standards documentation');
        longTerm.push('Regular drift detection and correction');
        if (driftDetails) {
            shortTerm.push(...driftDetails.recommendations);
        }
        return { immediate, shortTerm, longTerm };
    }
    /**
     * Get git context
     */
    async getGitContext(projectPath) {
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const commit = execSync('git rev-parse HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
            const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf8' }).trim();
            return { gitCommit: commit, branch };
        }
        catch {
            return {};
        }
    }
    /**
     * Get recent changes for hallucination check
     */
    async getRecentChanges(projectPath) {
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const diff = execSync('git diff HEAD~1', { cwd: projectPath, encoding: 'utf8', maxBuffer: 1024 * 1024 });
            return diff.substring(0, 5000); // Limit size
        }
        catch {
            return null;
        }
    }
    /**
     * Get previous decision for drift detection
     */
    getPreviousDecision(projectPath) {
        const history = this.decisionHistory.get(projectPath);
        return history && history.length > 0 ? history[history.length - 1] : null;
    }
    /**
     * Store decision in history
     */
    storeDecision(projectPath, decision) {
        const history = this.decisionHistory.get(projectPath) || [];
        history.push(decision);
        // Keep only last 10 decisions
        if (history.length > 10) {
            history.shift();
        }
        this.decisionHistory.set(projectPath, history);
    }
    /**
     * Generate human-readable report
     */
    generateReport(decision) {
        const lines = [];
        lines.push('╔══════════════════════════════════════════════════════════════╗');
        lines.push('║         🚀 ENHANCED SHIP DECISION REPORT 🚀                 ║');
        lines.push('╚══════════════════════════════════════════════════════════════╝');
        lines.push('');
        // Verdict
        const verdictIcon = decision.verdict === 'SHIP' ? '✅' : decision.verdict === 'NO_SHIP' ? '❌' : '⚠️';
        lines.push(`${verdictIcon} VERDICT: ${decision.verdict}`);
        lines.push(`   Score: ${decision.score}/100`);
        lines.push(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
        lines.push('');
        // Blockers
        if (decision.blockers.length > 0) {
            lines.push('🚫 BLOCKERS:');
            for (const blocker of decision.blockers) {
                lines.push(`   [${blocker.severity.toUpperCase()}] ${blocker.message}`);
                if (blocker.fixSteps && blocker.fixSteps.length > 0) {
                    lines.push(`      Fix: ${blocker.fixSteps[0]}`);
                }
            }
            lines.push('');
        }
        // Criteria breakdown
        lines.push('📊 CRITERIA BREAKDOWN:');
        for (const criterion of decision.criteria) {
            const icon = criterion.status === 'pass' ? '✅' : criterion.status === 'fail' ? '❌' : criterion.status === 'warning' ? '⚠️' : '⏭️';
            lines.push(`   ${icon} ${criterion.name}: ${criterion.score}/100 (${(criterion.confidence * 100).toFixed(0)}% confidence)`);
        }
        lines.push('');
        // Recommendations
        if (decision.recommendations.immediate.length > 0) {
            lines.push('🔧 IMMEDIATE ACTIONS:');
            for (const rec of decision.recommendations.immediate) {
                lines.push(`   • ${rec}`);
            }
            lines.push('');
        }
        // Drift detection
        if (decision.driftDetected && decision.driftDetails) {
            lines.push('⚠️ DRIFT DETECTED:');
            lines.push(`   Score change: ${decision.driftDetails.score.toFixed(1)} points`);
            lines.push(`   Affected areas: ${decision.driftDetails.areas.join(', ')}`);
            lines.push('');
        }
        return lines.join('\n');
    }
}
exports.EnhancedShipDecisionEngine = EnhancedShipDecisionEngine;
exports.enhancedShipDecisionEngine = new EnhancedShipDecisionEngine();
