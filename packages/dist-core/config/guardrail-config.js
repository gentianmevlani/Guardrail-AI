"use strict";
/**
 * Guardrail Configuration System
 *
 * Centralized configuration for all Guardrail systems:
 * - Ship decision thresholds
 * - Context engine settings
 * - Prompt firewall rules
 * - Long-term tracking preferences
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
exports.GuardrailConfigManager = void 0;
exports.createConfigManager = createConfigManager;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const DEFAULT_CONFIG = {
    shipDecision: {
        thresholds: {
            ship: 85,
            review: 70,
            noShip: 70,
        },
        weights: {
            mockproof: 0.3,
            badge: 0.25,
            hallucination: 0.2,
            security: 0.15,
            performance: 0.1,
        },
        requireAllCritical: false,
    },
    contextEngine: {
        driftThreshold: 0.15,
        freshnessThreshold: 0.5,
        confidenceThreshold: 0.7,
        maxSnapshots: 20,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
    },
    promptFirewall: {
        autoBreakdown: true,
        autoVerify: true,
        autoFix: false,
        includeVersionControl: true,
        generatePlan: true,
        maxTasks: 20,
        verificationThreshold: 75,
    },
    longTermTracking: {
        trackBestPractices: true,
        trackTestMetrics: true,
        trackCodeReviews: true,
        trackToolEfficiency: true,
        minTestCoverage: 80,
        minReviewQuality: 80,
    },
    version: "1.0.0",
};
class GuardrailConfigManager {
    configPath;
    config = null;
    constructor(projectPath) {
        this.configPath = path.join(projectPath, ".Guardrail", "config.json");
    }
    /**
     * Load configuration from file or return defaults
     */
    async load() {
        if (this.config) {
            return this.config;
        }
        try {
            const content = await fs.readFile(this.configPath, "utf8");
            const fileConfig = JSON.parse(content);
            this.config = {
                ...DEFAULT_CONFIG,
                ...fileConfig,
                shipDecision: { ...DEFAULT_CONFIG.shipDecision, ...fileConfig.shipDecision },
                contextEngine: { ...DEFAULT_CONFIG.contextEngine, ...fileConfig.contextEngine },
                promptFirewall: { ...DEFAULT_CONFIG.promptFirewall, ...fileConfig.promptFirewall },
                longTermTracking: { ...DEFAULT_CONFIG.longTermTracking, ...fileConfig.longTermTracking },
                projectPath: fileConfig.projectPath || path.dirname(this.configPath),
            };
        }
        catch {
            // File doesn't exist, use defaults
            this.config = {
                ...DEFAULT_CONFIG,
                projectPath: path.dirname(this.configPath),
            };
        }
        return this.config;
    }
    /**
     * Save configuration to file
     */
    async save(config) {
        const current = await this.load();
        this.config = {
            ...current,
            ...config,
            shipDecision: { ...current.shipDecision, ...config.shipDecision },
            contextEngine: { ...current.contextEngine, ...config.contextEngine },
            promptFirewall: { ...current.promptFirewall, ...config.promptFirewall },
            longTermTracking: { ...current.longTermTracking, ...config.longTermTracking },
        };
        await fs.mkdir(path.dirname(this.configPath), { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    }
    /**
     * Get ship decision config
     */
    async getShipDecisionConfig() {
        const config = await this.load();
        return config.shipDecision;
    }
    /**
     * Get context engine config
     */
    async getContextEngineConfig() {
        const config = await this.load();
        return config.contextEngine;
    }
    /**
     * Get prompt firewall config
     */
    async getPromptFirewallConfig() {
        const config = await this.load();
        return config.promptFirewall;
    }
    /**
     * Get long-term tracking config
     */
    async getLongTermTrackingConfig() {
        const config = await this.load();
        return config.longTermTracking;
    }
    /**
     * Reset to defaults
     */
    async reset() {
        this.config = {
            ...DEFAULT_CONFIG,
            projectPath: path.dirname(this.configPath),
        };
        await this.save({});
    }
}
exports.GuardrailConfigManager = GuardrailConfigManager;
function createConfigManager(projectPath) {
    return new GuardrailConfigManager(projectPath);
}
