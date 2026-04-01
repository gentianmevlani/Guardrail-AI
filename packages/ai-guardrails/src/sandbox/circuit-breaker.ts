import { EventEmitter } from 'events';

/**
 * Circuit Breaker / Kill Switch
 *
 * Global emergency stop mechanism for all AI agent operations.
 * Provides three safety levels:
 *
 * 1. CLOSED  — Normal operation, all actions proceed through guardrails
 * 2. HALF_OPEN — Degraded mode: only LOW-risk actions are allowed
 * 3. OPEN    — Full kill switch: ALL agent actions are blocked immediately
 *
 * Triggers:
 * - Manual kill switch activation (operator override)
 * - Automatic trip on threshold violations (consecutive failures, risk escalation)
 * - Anomaly detection (sudden spike in blocked actions)
 */

export type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export interface CircuitBreakerConfig {
  /** Max consecutive denied actions before auto-trip to HALF_OPEN */
  maxConsecutiveFailures: number;
  /** Max denied actions in the sliding window before auto-trip to OPEN */
  maxFailuresInWindow: number;
  /** Sliding window duration in ms (default: 60_000 = 1 minute) */
  windowMs: number;
  /** How long OPEN state persists before auto-recovering to HALF_OPEN (ms). 0 = never auto-recover. */
  cooldownMs: number;
  /** Risk levels allowed during HALF_OPEN state */
  halfOpenAllowedRiskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>;
}

export interface CircuitEvent {
  timestamp: number;
  previousState: CircuitState;
  newState: CircuitState;
  reason: string;
  triggeredBy: 'manual' | 'auto' | 'cooldown';
  metadata?: Record<string, unknown>;
}

export interface CircuitStatus {
  state: CircuitState;
  consecutiveFailures: number;
  failuresInWindow: number;
  lastTripped: number | null;
  lastEvent: CircuitEvent | null;
  uptime: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveFailures: 5,
  maxFailuresInWindow: 15,
  windowMs: 60_000,
  cooldownMs: 300_000, // 5 minutes
  halfOpenAllowedRiskLevels: ['LOW'],
};

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private failureTimestamps: number[] = [];
  private lastTripped: number | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime = Date.now();
  private eventLog: CircuitEvent[] = [];
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an action should be allowed through the circuit breaker.
   * Call this BEFORE processing any agent action.
   */
  canProceed(riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'): {
    allowed: boolean;
    reason: string;
    state: CircuitState;
  } {
    switch (this.state) {
      case 'CLOSED':
        return { allowed: true, reason: 'Circuit closed — normal operation', state: 'CLOSED' };

      case 'HALF_OPEN':
        if (this.config.halfOpenAllowedRiskLevels.includes(riskLevel)) {
          return {
            allowed: true,
            reason: `Circuit half-open — ${riskLevel} risk allowed`,
            state: 'HALF_OPEN',
          };
        }
        return {
          allowed: false,
          reason: `Circuit half-open — ${riskLevel} risk blocked (only ${this.config.halfOpenAllowedRiskLevels.join(', ')} allowed)`,
          state: 'HALF_OPEN',
        };

      case 'OPEN':
        return {
          allowed: false,
          reason: 'KILL SWITCH ACTIVE — all agent actions are blocked',
          state: 'OPEN',
        };
    }
  }

  /**
   * Record a successful action — resets consecutive failure counter.
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;

    // If half-open and getting successes, recover to closed
    if (this.state === 'HALF_OPEN') {
      this.transition('CLOSED', 'Recovered after successful actions in half-open state', 'auto');
    }
  }

  /**
   * Record a denied/failed action — may trip the breaker.
   */
  recordFailure(reason?: string): void {
    this.consecutiveFailures++;
    const now = Date.now();
    this.failureTimestamps.push(now);

    // Prune old timestamps outside the window
    const windowStart = now - this.config.windowMs;
    this.failureTimestamps = this.failureTimestamps.filter((t) => t >= windowStart);

    // Check auto-trip thresholds
    if (this.state === 'CLOSED') {
      if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this.transition(
          'HALF_OPEN',
          `${this.consecutiveFailures} consecutive failures (threshold: ${this.config.maxConsecutiveFailures})`,
          'auto',
        );
      }
    }

    if (this.state !== 'OPEN') {
      if (this.failureTimestamps.length >= this.config.maxFailuresInWindow) {
        this.transition(
          'OPEN',
          reason || `${this.failureTimestamps.length} failures in ${this.config.windowMs}ms window (threshold: ${this.config.maxFailuresInWindow})`,
          'auto',
        );
      }
    }
  }

  // ─── Manual Controls ───────────────────────────────────────

  /**
   * KILL SWITCH — Immediately block all agent operations.
   */
  tripOpen(reason: string = 'Manual kill switch activated'): void {
    this.transition('OPEN', reason, 'manual');
  }

  /**
   * Degrade to half-open — only low-risk actions allowed.
   */
  tripHalfOpen(reason: string = 'Manual degradation to half-open'): void {
    this.transition('HALF_OPEN', reason, 'manual');
  }

  /**
   * Reset — restore normal operation.
   */
  reset(reason: string = 'Manual reset'): void {
    this.consecutiveFailures = 0;
    this.failureTimestamps = [];
    this.clearCooldown();
    this.transition('CLOSED', reason, 'manual');
  }

  // ─── Status ────────────────────────────────────────────────

  getState(): CircuitState {
    return this.state;
  }

  getStatus(): CircuitStatus {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failuresInWindow: this.failureTimestamps.filter((t) => t >= windowStart).length,
      lastTripped: this.lastTripped,
      lastEvent: this.eventLog[this.eventLog.length - 1] ?? null,
      uptime: now - this.startTime,
    };
  }

  getEventLog(): CircuitEvent[] {
    return [...this.eventLog];
  }

  // ─── Internal ──────────────────────────────────────────────

  private transition(
    newState: CircuitState,
    reason: string,
    triggeredBy: 'manual' | 'auto' | 'cooldown',
  ): void {
    const previous = this.state;
    if (previous === newState) return;

    this.state = newState;

    const event: CircuitEvent = {
      timestamp: Date.now(),
      previousState: previous,
      newState,
      reason,
      triggeredBy,
    };
    this.eventLog.push(event);

    // Cap event log at 1000 entries
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-500);
    }

    if (newState === 'OPEN') {
      this.lastTripped = Date.now();
      this.startCooldown();
    } else {
      this.clearCooldown();
    }

    this.emit('stateChange', event);

    if (newState === 'OPEN') {
      this.emit('killSwitch', event);
    }
  }

  private startCooldown(): void {
    this.clearCooldown();
    if (this.config.cooldownMs > 0) {
      this.cooldownTimer = setTimeout(() => {
        this.transition('HALF_OPEN', `Cooldown expired after ${this.config.cooldownMs}ms`, 'cooldown');
      }, this.config.cooldownMs);
    }
  }

  private clearCooldown(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }
}

// Global singleton
export const circuitBreaker = new CircuitBreaker();
