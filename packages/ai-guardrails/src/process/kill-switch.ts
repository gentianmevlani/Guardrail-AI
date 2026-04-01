import { EventEmitter } from 'events';
import {
  KillSwitchConfig,
  KillSwitchTrigger,
  KillSwitchState,
} from '@guardrail/core';

/**
 * Kill Switch — Process Guardrail
 *
 * Emergency stop mechanism for AI agents. Supports manual activation,
 * automatic trigger-based activation (error rate, toxicity spikes,
 * cost overruns, anomalies), cooldown periods, and selective agent stopping.
 */
export class KillSwitch extends EventEmitter {
  private state: KillSwitchState;
  private config: KillSwitchConfig;
  private metricBuffer: Map<string, number[]> = new Map();
  private cooldownTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<KillSwitchConfig>) {
    super();
    this.config = {
      enabled: true,
      triggers: [],
      notificationChannels: [],
      autoActivateOn: ['error_rate', 'toxicity_spike', 'cost_overrun'],
      cooldownPeriodMs: 60_000,
      ...config,
    };

    this.state = {
      active: false,
      activatedBy: 'system',
      reason: '',
      affectedAgents: [],
      resumable: true,
    };

    this.registerDefaultTriggers();
  }

  /**
   * Manually activate the kill switch
   */
  activate(
    reason: string,
    options?: {
      affectedAgents?: string[];
      resumable?: boolean;
    }
  ): KillSwitchState {
    if (!this.config.enabled) {
      throw new Error('Kill switch is disabled in configuration');
    }

    this.state = {
      active: true,
      activatedAt: new Date(),
      activatedBy: 'human',
      reason,
      affectedAgents: options?.affectedAgents || [],
      resumable: options?.resumable ?? true,
    };

    this.emit('activated', this.state);
    this.notifyChannels(`KILL SWITCH ACTIVATED: ${reason}`);

    return { ...this.state };
  }

  /**
   * Deactivate the kill switch (resume operations)
   */
  deactivate(reason: string): KillSwitchState {
    if (!this.state.active) {
      return { ...this.state };
    }

    if (!this.state.resumable) {
      throw new Error('Kill switch is not resumable — requires manual reset');
    }

    this.state = {
      active: false,
      activatedBy: 'system',
      reason: `Deactivated: ${reason}`,
      affectedAgents: [],
      resumable: true,
    };

    this.emit('deactivated', this.state);
    this.notifyChannels(`Kill switch deactivated: ${reason}`);

    // Start cooldown timer
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.cooldownTimer = setTimeout(() => {
      this.emit('cooldown-complete');
    }, this.config.cooldownPeriodMs);

    return { ...this.state };
  }

  /**
   * Check if the kill switch is active (optionally for a specific agent)
   */
  isActive(agentId?: string): boolean {
    if (!this.state.active) return false;
    if (!agentId) return true;
    if (this.state.affectedAgents.length === 0) return true; // All agents affected
    return this.state.affectedAgents.includes(agentId);
  }

  /**
   * Get current state
   */
  getState(): KillSwitchState {
    return { ...this.state };
  }

  /**
   * Record a metric value for trigger evaluation
   */
  recordMetric(metricName: string, value: number): void {
    if (!this.config.enabled) return;

    const buffer = this.metricBuffer.get(metricName) || [];
    buffer.push(value);

    // Keep only last 1000 values
    if (buffer.length > 1000) buffer.shift();
    this.metricBuffer.set(metricName, buffer);

    // Evaluate triggers
    this.evaluateTriggers(metricName, value);
  }

  /**
   * Add a trigger
   */
  addTrigger(trigger: KillSwitchTrigger): void {
    this.config.triggers.push(trigger);
  }

  /**
   * Remove a trigger
   */
  removeTrigger(triggerId: string): boolean {
    const idx = this.config.triggers.findIndex((t) => t.id === triggerId);
    if (idx >= 0) {
      this.config.triggers.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<KillSwitchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Force reset (bypasses resumable check)
   */
  forceReset(): void {
    this.state = {
      active: false,
      activatedBy: 'system',
      reason: 'Force reset',
      affectedAgents: [],
      resumable: true,
    };
    this.metricBuffer.clear();
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.emit('force-reset');
  }

  private evaluateTriggers(metricName: string, _currentValue: number): void {
    if (this.state.active) return; // Already activated

    for (const trigger of this.config.triggers) {
      if (!trigger.condition.includes(metricName)) continue;

      const buffer = this.metricBuffer.get(metricName) || [];
      const windowValues = this.getValuesInWindow(buffer, trigger.windowMs);

      if (windowValues.length === 0) continue;

      const avgValue = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;

      if (avgValue >= trigger.threshold) {
        this.triggerActivation(trigger, avgValue);
        break;
      }
    }
  }

  private triggerActivation(trigger: KillSwitchTrigger, value: number): void {
    const reason = `Auto-triggered: ${trigger.name} (value: ${value.toFixed(2)}, threshold: ${trigger.threshold})`;

    switch (trigger.action) {
      case 'stop':
        this.state = {
          active: true,
          activatedAt: new Date(),
          activatedBy: 'trigger',
          triggerId: trigger.id,
          reason,
          affectedAgents: [],
          resumable: false,
        };
        break;

      case 'pause':
        this.state = {
          active: true,
          activatedAt: new Date(),
          activatedBy: 'trigger',
          triggerId: trigger.id,
          reason,
          affectedAgents: [],
          resumable: true,
        };
        break;

      case 'alert':
        this.notifyChannels(`ALERT: ${reason}`);
        this.emit('alert', { trigger, value, reason });
        return; // Don't activate kill switch

      case 'rollback':
        this.state = {
          active: true,
          activatedAt: new Date(),
          activatedBy: 'trigger',
          triggerId: trigger.id,
          reason: `${reason} — rollback requested`,
          affectedAgents: [],
          resumable: true,
        };
        this.emit('rollback-requested', { trigger, value });
        break;
    }

    this.emit('activated', this.state);
    this.notifyChannels(`KILL SWITCH ACTIVATED: ${reason}`);
  }

  private getValuesInWindow(buffer: number[], _windowMs: number): number[] {
    // Since we don't store timestamps in the metric buffer for simplicity,
    // use the last N values proportional to the window
    const count = Math.min(buffer.length, Math.ceil(buffer.length * 0.3));
    return buffer.slice(-count);
  }

  private notifyChannels(message: string): void {
    for (const channel of this.config.notificationChannels) {
      this.emit('notification', { channel, message, timestamp: new Date() });
    }
  }

  private registerDefaultTriggers(): void {
    this.addTrigger({
      id: 'ks-error-rate',
      name: 'High Error Rate',
      condition: 'error_rate',
      threshold: 0.5,
      windowMs: 60_000,
      action: 'pause',
    });

    this.addTrigger({
      id: 'ks-toxicity-spike',
      name: 'Toxicity Spike',
      condition: 'toxicity_score',
      threshold: 0.8,
      windowMs: 30_000,
      action: 'stop',
    });

    this.addTrigger({
      id: 'ks-cost-overrun',
      name: 'Cost Overrun',
      condition: 'cost_per_minute',
      threshold: 100,
      windowMs: 60_000,
      action: 'pause',
    });

    this.addTrigger({
      id: 'ks-anomaly',
      name: 'Anomaly Detection',
      condition: 'anomaly_score',
      threshold: 0.9,
      windowMs: 120_000,
      action: 'alert',
    });
  }
}

export const killSwitch = new KillSwitch();
