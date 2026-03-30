"use strict";
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
exports.LongTermTrackingSystem = void 0;
exports.createLongTermTracking = createLongTermTracking;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
class LongTermTrackingSystem {
    projectPath;
    dataPath;
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.dataPath = path.join(projectPath, '.Guardrail', 'improvements');
    }
    /**
     * Generate comprehensive tracking report
     */
    async generateReport() {
        // Load or initialize data
        const bestPractices = await this.loadBestPractices();
        const testMetrics = await this.analyzeTestMetrics();
        const codeReviewMetrics = await this.analyzeCodeReviewMetrics();
        const toolEfficiency = await this.analyzeToolEfficiency();
        const improvementPlans = await this.loadImprovementPlans();
        // Calculate overall score
        const overallScore = this.calculateOverallScore(bestPractices, testMetrics, codeReviewMetrics, toolEfficiency);
        // Generate recommendations
        const recommendations = this.generateRecommendations(bestPractices, testMetrics, codeReviewMetrics, toolEfficiency, improvementPlans);
        return {
            projectPath: this.projectPath,
            timestamp: new Date().toISOString(),
            bestPractices,
            testMetrics,
            codeReviewMetrics,
            toolEfficiency,
            improvementPlans,
            overallScore,
            recommendations,
        };
    }
    /**
     * Track best practice adoption
     */
    async trackBestPractice(practice) {
        const practices = await this.loadBestPractices();
        const index = practices.findIndex(p => p.id === practice.id);
        if (index >= 0) {
            practices[index] = practice;
        }
        else {
            practices.push(practice);
        }
        await this.saveBestPractices(practices);
    }
    /**
     * Record test run
     */
    async recordTestRun(metrics) {
        const currentMetrics = await this.analyzeTestMetrics();
        // Update metrics
        const updated = {
            ...currentMetrics,
            ...metrics,
            lastRun: new Date().toISOString(),
        };
        // Add to trends
        updated.trends.push({
            date: new Date().toISOString(),
            coverage: updated.coverage,
            passing: updated.passing,
        });
        // Keep only last 30 trends
        if (updated.trends.length > 30) {
            updated.trends = updated.trends.slice(-30);
        }
        await this.saveTestMetrics(updated);
    }
    /**
     * Record code review
     */
    async recordCodeReview(review) {
        const metrics = await this.analyzeCodeReviewMetrics();
        metrics.reviewsCompleted++;
        metrics.issuesFound += review.issuesFound;
        metrics.issuesResolved += review.issuesResolved;
        // Update average review time
        const totalTime = metrics.averageReviewTime * (metrics.reviewsCompleted - 1) + review.reviewTime;
        metrics.averageReviewTime = totalTime / metrics.reviewsCompleted;
        // Update review quality
        const totalQuality = metrics.reviewQuality * (metrics.reviewsCompleted - 1) + review.quality;
        metrics.reviewQuality = totalQuality / metrics.reviewsCompleted;
        // Add to trends
        metrics.trends.push({
            date: new Date().toISOString(),
            reviews: metrics.reviewsCompleted,
            quality: metrics.reviewQuality,
        });
        // Keep only last 30 trends
        if (metrics.trends.length > 30) {
            metrics.trends = metrics.trends.slice(-30);
        }
        await this.saveCodeReviewMetrics(metrics);
    }
    /**
     * Track tool usage
     */
    async trackToolUsage(tool, success, duration // minutes
    ) {
        const efficiency = await this.analyzeToolEfficiency();
        let toolData = efficiency.find(t => t.tool === tool);
        if (!toolData) {
            toolData = {
                tool,
                usage: 0,
                successRate: 0,
                averageTime: 0,
                improvements: [],
            };
            efficiency.push(toolData);
        }
        toolData.usage++;
        const successCount = toolData.successRate * (toolData.usage - 1) / 100;
        const newSuccessCount = successCount + (success ? 1 : 0);
        toolData.successRate = (newSuccessCount / toolData.usage) * 100;
        const totalTime = toolData.averageTime * (toolData.usage - 1) + duration;
        toolData.averageTime = totalTime / toolData.usage;
        await this.saveToolEfficiency(efficiency);
    }
    /**
     * Create improvement plan
     */
    async createImprovementPlan(plan) {
        const plans = await this.loadImprovementPlans();
        plans.push(plan);
        await this.saveImprovementPlans(plans);
    }
    /**
     * Update improvement plan progress
     */
    async updateImprovementPlan(planId, updates) {
        const plans = await this.loadImprovementPlans();
        const index = plans.findIndex(p => p.id === planId);
        if (index >= 0) {
            plans[index] = { ...plans[index], ...updates };
            await this.saveImprovementPlans(plans);
        }
    }
    // Analysis methods
    async analyzeTestMetrics() {
        try {
            const saved = await this.loadTestMetrics();
            if (saved)
                return saved;
        }
        catch {
            // No saved data
        }
        // Analyze test files
        const testFiles = await this.findTestFiles();
        const unitTests = testFiles.filter(f => f.includes('.test.') || f.includes('.spec.')).length;
        const integrationTests = testFiles.filter(f => f.includes('integration')).length;
        const e2eTests = testFiles.filter(f => f.includes('e2e') || f.includes('playwright')).length;
        // Try to get coverage from test output
        let coverage = 0;
        try {
            const coverageFile = path.join(this.projectPath, 'coverage', 'coverage-summary.json');
            const coverageData = JSON.parse(await fs.readFile(coverageFile, 'utf8'));
            coverage = coverageData.total?.lines?.pct || 0;
        }
        catch {
            // Coverage file not found
        }
        return {
            coverage,
            unitTests,
            integrationTests,
            e2eTests,
            passing: 0, // Would be populated from test run
            failing: 0,
            lastRun: new Date().toISOString(),
            trends: [],
        };
    }
    async analyzeCodeReviewMetrics() {
        try {
            const saved = await this.loadCodeReviewMetrics();
            if (saved)
                return saved;
        }
        catch {
            // No saved data
        }
        return {
            reviewsCompleted: 0,
            averageReviewTime: 0,
            issuesFound: 0,
            issuesResolved: 0,
            reviewQuality: 0,
            trends: [],
        };
    }
    async analyzeToolEfficiency() {
        try {
            const saved = await this.loadToolEfficiency();
            if (saved)
                return saved;
        }
        catch {
            // No saved data
        }
        return [];
    }
    async loadBestPractices() {
        try {
            const filePath = path.join(this.dataPath, 'best-practices.json');
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return this.getDefaultBestPractices();
        }
    }
    getDefaultBestPractices() {
        return [
            {
                id: 'unit-testing',
                name: 'Unit Testing',
                category: 'testing',
                description: 'Write unit tests for all critical functions',
                status: 'not_adopted',
                evidence: [],
                impact: 'high',
            },
            {
                id: 'code-review',
                name: 'Code Review Process',
                category: 'process',
                description: 'All code changes require peer review',
                status: 'not_adopted',
                evidence: [],
                impact: 'high',
            },
            {
                id: 'ci-cd',
                name: 'CI/CD Pipeline',
                category: 'process',
                description: 'Automated testing and deployment',
                status: 'not_adopted',
                evidence: [],
                impact: 'high',
            },
            {
                id: 'documentation',
                name: 'Code Documentation',
                category: 'documentation',
                description: 'Document all public APIs and complex logic',
                status: 'not_adopted',
                evidence: [],
                impact: 'medium',
            },
            {
                id: 'security-scanning',
                name: 'Security Scanning',
                category: 'security',
                description: 'Regular security vulnerability scanning',
                status: 'not_adopted',
                evidence: [],
                impact: 'high',
            },
        ];
    }
    calculateOverallScore(practices, tests, reviews, tools) {
        let score = 0;
        let weight = 0;
        // Best practices (40%)
        const adoptedPractices = practices.filter(p => p.status === 'adopted').length;
        const practiceScore = (adoptedPractices / practices.length) * 100;
        score += practiceScore * 0.4;
        weight += 0.4;
        // Test coverage (30%)
        score += tests.coverage * 0.3;
        weight += 0.3;
        // Code reviews (20%)
        const reviewScore = reviews.reviewsCompleted > 0 ? reviews.reviewQuality : 0;
        score += reviewScore * 0.2;
        weight += 0.2;
        // Tool efficiency (10%)
        if (tools.length > 0) {
            const avgSuccessRate = tools.reduce((sum, t) => sum + t.successRate, 0) / tools.length;
            score += avgSuccessRate * 0.1;
            weight += 0.1;
        }
        return weight > 0 ? Math.round(score / weight) : 0;
    }
    generateRecommendations(practices, tests, reviews, tools, plans) {
        const recommendations = [];
        // Best practices
        const notAdopted = practices.filter(p => p.status === 'not_adopted' && p.impact === 'high');
        for (const practice of notAdopted.slice(0, 3)) {
            recommendations.push(`Adopt best practice: ${practice.name}`);
        }
        // Testing
        if (tests.coverage < 80) {
            recommendations.push(`Increase test coverage from ${tests.coverage}% to at least 80%`);
        }
        // Code reviews
        if (reviews.reviewsCompleted === 0) {
            recommendations.push('Establish code review process');
        }
        // Tools
        const inefficientTools = tools.filter(t => t.successRate < 70);
        for (const tool of inefficientTools) {
            recommendations.push(`Improve ${tool.tool} efficiency (current: ${tool.successRate.toFixed(0)}%)`);
        }
        return recommendations;
    }
    // File operations
    async findTestFiles() {
        const testFiles = [];
        const testDirs = ['tests', '__tests__', 'test', 'specs', 'e2e'];
        for (const dir of testDirs) {
            const dirPath = path.join(this.projectPath, dir);
            try {
                const files = await this.walkDirectory(dirPath);
                testFiles.push(...files.filter(f => f.includes('.test.') || f.includes('.spec.') || f.includes('test')));
            }
            catch {
                // Directory doesn't exist
            }
        }
        return testFiles;
    }
    async walkDirectory(dir) {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...await this.walkDirectory(fullPath));
                }
                else {
                    files.push(fullPath);
                }
            }
        }
        catch {
            // Ignore errors
        }
        return files;
    }
    async ensureDataDir() {
        await fs.mkdir(this.dataPath, { recursive: true });
    }
    async saveBestPractices(practices) {
        await this.ensureDataDir();
        await fs.writeFile(path.join(this.dataPath, 'best-practices.json'), JSON.stringify(practices, null, 2));
    }
    async loadTestMetrics() {
        try {
            const filePath = path.join(this.dataPath, 'test-metrics.json');
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async saveTestMetrics(metrics) {
        await this.ensureDataDir();
        await fs.writeFile(path.join(this.dataPath, 'test-metrics.json'), JSON.stringify(metrics, null, 2));
    }
    async loadCodeReviewMetrics() {
        try {
            const filePath = path.join(this.dataPath, 'code-review-metrics.json');
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async saveCodeReviewMetrics(metrics) {
        await this.ensureDataDir();
        await fs.writeFile(path.join(this.dataPath, 'code-review-metrics.json'), JSON.stringify(metrics, null, 2));
    }
    async loadToolEfficiency() {
        try {
            const filePath = path.join(this.dataPath, 'tool-efficiency.json');
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async saveToolEfficiency(efficiency) {
        await this.ensureDataDir();
        await fs.writeFile(path.join(this.dataPath, 'tool-efficiency.json'), JSON.stringify(efficiency, null, 2));
    }
    async loadImprovementPlans() {
        try {
            const filePath = path.join(this.dataPath, 'improvement-plans.json');
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch {
            return [];
        }
    }
    async saveImprovementPlans(plans) {
        await this.ensureDataDir();
        await fs.writeFile(path.join(this.dataPath, 'improvement-plans.json'), JSON.stringify(plans, null, 2));
    }
}
exports.LongTermTrackingSystem = LongTermTrackingSystem;
function createLongTermTracking(projectPath) {
    return new LongTermTrackingSystem(projectPath);
}
