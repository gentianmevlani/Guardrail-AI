/**
 * guardrail Configuration System
 * 
 * Centralized configuration for all guardrail systems:
 * - Ship decision thresholds
 * - Context engine settings
 * - Prompt firewall rules
 * - Long-term tracking preferences
 */

import * as path from "path";
import * as fs from "fs/promises";

export interface ShipDecisionConfig {
  thresholds: {
    ship: number; // Minimum score for SHIP (default: 85)
    review: number; // Minimum score for REVIEW (default: 70)
    noShip: number; // Maximum score for NO_SHIP (default: 70)
  };
  weights: {
    mockproof: number; // Weight for MockProof (default: 0.3)
    badge: number; // Weight for Ship Badge (default: 0.25)
    hallucination: number; // Weight for Hallucination Check (default: 0.2)
    security: number; // Weight for Security Scan (default: 0.15)
    performance: number; // Weight for Performance (default: 0.1)
  };
  requireAllCritical: boolean; // Require all critical criteria to pass (default: false)
}

export interface ContextEngineConfig {
  driftThreshold: number; // Percentage change that indicates drift (default: 0.15)
  freshnessThreshold: number; // Minimum freshness score (default: 0.5)
  confidenceThreshold: number; // Minimum confidence score (default: 0.7)
  maxSnapshots: number; // Maximum snapshots to keep (default: 20)
  cacheTTL: number; // Cache TTL in milliseconds (default: 5 minutes)
}

export interface PromptFirewallConfig {
  autoBreakdown: boolean; // Auto-breakdown tasks (default: true)
  autoVerify: boolean; // Auto-verify prompts (default: true)
  autoFix: boolean; // Auto-apply fixes (default: false)
  includeVersionControl: boolean; // Include git info (default: true)
  generatePlan: boolean; // Generate future plan (default: true)
  maxTasks: number; // Maximum tasks in breakdown (default: 20)
  verificationThreshold: number; // Minimum verification score (default: 75)
}

export interface LongTermTrackingConfig {
  trackBestPractices: boolean; // Track best practices (default: true)
  trackTestMetrics: boolean; // Track test metrics (default: true)
  trackCodeReviews: boolean; // Track code reviews (default: true)
  trackToolEfficiency: boolean; // Track tool efficiency (default: true)
  minTestCoverage: number; // Minimum test coverage target (default: 80)
  minReviewQuality: number; // Minimum review quality target (default: 80)
}

export interface GuardrailConfig {
  projectPath: string;
  shipDecision: ShipDecisionConfig;
  contextEngine: ContextEngineConfig;
  promptFirewall: PromptFirewallConfig;
  longTermTracking: LongTermTrackingConfig;
  version: string;
}

const DEFAULT_CONFIG: Omit<GuardrailConfig, "projectPath"> = {
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

export class GuardrailConfigManager {
  private configPath: string;
  private config: GuardrailConfig | null = null;

  constructor(projectPath: string) {
    this.configPath = path.join(projectPath, ".guardrail", "config.json");
  }

  /**
   * Load configuration from file or return defaults
   */
  async load(): Promise<GuardrailConfig> {
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
    } catch {
      // File doesn't exist, use defaults
      this.config = {
        ...DEFAULT_CONFIG,
        projectPath: path.dirname(this.configPath),
      };
    }

    // Config is always set above, but TypeScript doesn't know that
    if (!this.config) {
      throw new Error('Failed to load config');
    }
    return this.config;
  }

  /**
   * Save configuration to file
   */
  async save(config: Partial<GuardrailConfig>): Promise<void> {
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
  async getShipDecisionConfig(): Promise<ShipDecisionConfig> {
    const config = await this.load();
    return config.shipDecision;
  }

  /**
   * Get context engine config
   */
  async getContextEngineConfig(): Promise<ContextEngineConfig> {
    const config = await this.load();
    return config.contextEngine;
  }

  /**
   * Get prompt firewall config
   */
  async getPromptFirewallConfig(): Promise<PromptFirewallConfig> {
    const config = await this.load();
    return config.promptFirewall;
  }

  /**
   * Get long-term tracking config
   */
  async getLongTermTrackingConfig(): Promise<LongTermTrackingConfig> {
    const config = await this.load();
    return config.longTermTracking;
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    this.config = {
      ...DEFAULT_CONFIG,
      projectPath: path.dirname(this.configPath),
    };
    await this.save({});
  }
}

export function createConfigManager(projectPath: string): GuardrailConfigManager {
  return new GuardrailConfigManager(projectPath);
}
