import { EventEmitter } from 'events';
import {
  EscalationRule,
  MonitoringMetric,
} from '@guardrail/core';

/**
 * Escalation Policy Engine — Process Guardrail
 *
 * Rules-based escalation engine that monitors metrics and triggers
 * actions when thresholds are breached: notifications, agent pausing,
 * mandatory human review, kill switch activation, or human escalation.
 */
export class EscalationPolicyEngine extends EventEmitter {
  private rules: Map<string, EscalationRule> = new Map();
  private lastTriggered: Map<string, number> = new Map();
  private metricHistory: Map<string, MonitoringMetric[]> = new Map();
  private readonly maxHistoryPerMetric: number;

  constructor(options?: { maxHistoryPerMetric?: number }) {
    super();
    this.maxHistoryPerMetric = options?.maxHistoryPerMetric ?? 1000;
    this.registerDefaultRules();
  }

  /**
   * Evaluate a metric against all escalation rules
   */
  async evaluate(metric: MonitoringMetric): Promise<EscalationAction[]> {
    // Store metric in history
    this.storeMetric(metric);

    const actions: EscalationAction[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTrigger = this.lastTriggered.get(rule.id);
      if (lastTrigger && Date.now() - lastTrigger < rule.cooldownMs) {
        continue;
      }

      // Evaluate conditions
      const triggered = this.evaluateConditions(rule, metric);
      if (triggered) {
        this.lastTriggered.set(rule.id, Date.now());

        const action: EscalationAction = {
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          target: rule.target,
          triggeringMetric: metric,
          timestamp: new Date(),
        };

        actions.push(action);
        this.emit('escalation', action);
      }
    }

    return actions;
  }

  /**
   * Evaluate a batch of metrics
   */
  async evaluateBatch(metrics: MonitoringMetric[]): Promise<EscalationAction[]> {
    const allActions: EscalationAction[] = [];
    for (const metric of metrics) {
      const actions = await this.evaluate(metric);
      allActions.push(...actions);
    }
    return allActions;
  }

  /**
   * Add an escalation rule
   */
  addRule(rule: EscalationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an escalation rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) rule.enabled = enabled;
  }

  /**
   * Get all rules
   */
  getRules(): EscalationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get metric history
   */
  getMetricHistory(metricName: string, limit?: number): MonitoringMetric[] {
    const history = this.metricHistory.get(metricName) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get escalation statistics
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    recentEscalations: number;
    cooldownActive: number;
  } {
    const now = Date.now();
    let cooldownActive = 0;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      const lastTrigger = this.lastTriggered.get(rule.id);
      if (lastTrigger && now - lastTrigger < rule.cooldownMs) {
        cooldownActive++;
      }
    }

    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter((r) => r.enabled).length,
      recentEscalations: this.lastTriggered.size,
      cooldownActive,
    };
  }

  /**
   * Reset cooldown for a specific rule
   */
  resetCooldown(ruleId: string): void {
    this.lastTriggered.delete(ruleId);
  }

  /**
   * Reset all cooldowns
   */
  resetAllCooldowns(): void {
    this.lastTriggered.clear();
  }

  private storeMetric(metric: MonitoringMetric): void {
    const history = this.metricHistory.get(metric.name) || [];
    history.push(metric);

    if (history.length > this.maxHistoryPerMetric) {
      history.shift();
    }

    this.metricHistory.set(metric.name, history);
  }

  private evaluateConditions(rule: EscalationRule, metric: MonitoringMetric): boolean {
    return rule.conditions.every((condition) => {
      if (condition.metric !== metric.name) return false;

      switch (condition.operator) {
        case 'gt': return metric.value > condition.value;
        case 'lt': return metric.value < condition.value;
        case 'eq': return metric.value === condition.value;
        case 'gte': return metric.value >= condition.value;
        case 'lte': return metric.value <= condition.value;
        default: return false;
      }
    });
  }

  private registerDefaultRules(): void {
    this.addRule({
      id: 'ESC-001',
      name: 'High Error Rate Alert',
      conditions: [
        { metric: 'error_rate', operator: 'gt', value: 0.1 },
      ],
      action: 'notify',
      target: 'ops-team',
      cooldownMs: 300_000, // 5 minutes
      enabled: true,
    });

    this.addRule({
      id: 'ESC-002',
      name: 'Critical Error Rate — Pause Agent',
      conditions: [
        { metric: 'error_rate', operator: 'gt', value: 0.3 },
      ],
      action: 'pause_agent',
      target: 'all',
      cooldownMs: 600_000, // 10 minutes
      enabled: true,
    });

    this.addRule({
      id: 'ESC-003',
      name: 'Toxicity Detection — Require Review',
      conditions: [
        { metric: 'toxicity_score', operator: 'gt', value: 0.7 },
      ],
      action: 'require_review',
      target: 'content-review-team',
      cooldownMs: 60_000,
      enabled: true,
    });

    this.addRule({
      id: 'ESC-004',
      name: 'Cost Spike — Escalate to Human',
      conditions: [
        { metric: 'cost_per_hour', operator: 'gt', value: 500 },
      ],
      action: 'escalate_to_human',
      target: 'finance-team',
      cooldownMs: 1_800_000, // 30 minutes
      enabled: true,
    });

    this.addRule({
      id: 'ESC-005',
      name: 'PII Leakage — Kill Switch',
      conditions: [
        { metric: 'pii_leakage_count', operator: 'gt', value: 5 },
      ],
      action: 'kill_switch',
      target: 'security-team',
      cooldownMs: 3_600_000, // 1 hour
      enabled: true,
    });
  }
}

interface EscalationAction {
  ruleId: string;
  ruleName: string;
  action: EscalationRule['action'];
  target: string;
  triggeringMetric: MonitoringMetric;
  timestamp: Date;
}

export const escalationPolicyEngine = new EscalationPolicyEngine();
