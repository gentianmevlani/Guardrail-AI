import {
  AgentRateLimitConfig,
  RateLimitState,
} from '@guardrail/core';

/**
 * Rate Limiter — Behavioral Guardrail
 *
 * Per-agent rate limiting with sliding window counters.
 * Enforces requests/minute, requests/hour, requests/day,
 * tokens/minute, tokens/hour, burst limits, and cost caps.
 */
export class AgentRateLimiter {
  private windows: Map<string, RateLimitWindow> = new Map();
  private configs: Map<string, AgentRateLimitConfig> = new Map();
  private defaultConfig: AgentRateLimitConfig;

  constructor(defaultConfig?: Partial<AgentRateLimitConfig>) {
    this.defaultConfig = {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      tokensPerMinute: 100_000,
      tokensPerHour: 1_000_000,
      burstLimit: 20,
      burstWindowMs: 5000,
      costLimitPerDay: undefined,
      ...defaultConfig,
    };
  }

  /**
   * Check if an agent request should be allowed
   */
  async checkLimit(agentId: string, tokenCount?: number): Promise<RateLimitState> {
    const config = this.configs.get(agentId) || this.defaultConfig;
    const window = this.getOrCreateWindow(agentId);
    const now = Date.now();

    // Clean expired entries
    this.cleanExpiredEntries(window, now);

    // Check burst limit
    const burstRequests = window.timestamps.filter(
      (t) => now - t < config.burstWindowMs
    ).length;
    if (burstRequests >= config.burstLimit) {
      return this.buildState(agentId, window, config, true, config.burstWindowMs);
    }

    // Check per-minute limit
    const minuteRequests = window.timestamps.filter(
      (t) => now - t < 60_000
    ).length;
    if (minuteRequests >= config.requestsPerMinute) {
      const oldestInMinute = window.timestamps.find((t) => now - t < 60_000);
      const retryAfter = oldestInMinute ? 60_000 - (now - oldestInMinute) : 60_000;
      return this.buildState(agentId, window, config, true, retryAfter);
    }

    // Check per-hour limit
    const hourRequests = window.timestamps.filter(
      (t) => now - t < 3_600_000
    ).length;
    if (hourRequests >= config.requestsPerHour) {
      const oldestInHour = window.timestamps.find((t) => now - t < 3_600_000);
      const retryAfter = oldestInHour ? 3_600_000 - (now - oldestInHour) : 3_600_000;
      return this.buildState(agentId, window, config, true, retryAfter);
    }

    // Check per-day limit
    const dayRequests = window.timestamps.filter(
      (t) => now - t < 86_400_000
    ).length;
    if (dayRequests >= config.requestsPerDay) {
      const oldestInDay = window.timestamps.find((t) => now - t < 86_400_000);
      const retryAfter = oldestInDay ? 86_400_000 - (now - oldestInDay) : 86_400_000;
      return this.buildState(agentId, window, config, true, retryAfter);
    }

    // Check token limits
    if (tokenCount) {
      const minuteTokens = this.getTokensInWindow(window, now, 60_000);
      if (minuteTokens + tokenCount > config.tokensPerMinute) {
        return this.buildState(agentId, window, config, true, 60_000);
      }

      const hourTokens = this.getTokensInWindow(window, now, 3_600_000);
      if (hourTokens + tokenCount > config.tokensPerHour) {
        return this.buildState(agentId, window, config, true, 3_600_000);
      }
    }

    // Check cost limit
    if (config.costLimitPerDay !== undefined) {
      const dayCost = this.getCostInWindow(window, now, 86_400_000);
      if (dayCost >= config.costLimitPerDay) {
        return this.buildState(agentId, window, config, true, 86_400_000);
      }
    }

    return this.buildState(agentId, window, config, false);
  }

  /**
   * Record a request (call after checkLimit returns allowed)
   */
  async recordRequest(
    agentId: string,
    tokenCount: number,
    cost?: number
  ): Promise<void> {
    const window = this.getOrCreateWindow(agentId);
    const now = Date.now();

    window.timestamps.push(now);
    window.tokenEntries.push({ timestamp: now, tokens: tokenCount });
    if (cost !== undefined) {
      window.costEntries.push({ timestamp: now, cost });
    }
    window.totalRequests++;
    window.totalTokens += tokenCount;
  }

  /**
   * Configure rate limits for a specific agent
   */
  setAgentConfig(agentId: string, config: Partial<AgentRateLimitConfig>): void {
    this.configs.set(agentId, { ...this.defaultConfig, ...config });
  }

  /**
   * Get current rate limit state for an agent
   */
  async getState(agentId: string): Promise<RateLimitState> {
    const config = this.configs.get(agentId) || this.defaultConfig;
    const window = this.getOrCreateWindow(agentId);
    return this.buildState(agentId, window, config, false);
  }

  /**
   * Reset rate limit counters for an agent
   */
  reset(agentId: string): void {
    this.windows.delete(agentId);
  }

  /**
   * Reset all rate limit counters
   */
  resetAll(): void {
    this.windows.clear();
  }

  private getOrCreateWindow(agentId: string): RateLimitWindow {
    let window = this.windows.get(agentId);
    if (!window) {
      window = {
        timestamps: [],
        tokenEntries: [],
        costEntries: [],
        totalRequests: 0,
        totalTokens: 0,
        createdAt: Date.now(),
      };
      this.windows.set(agentId, window);
    }
    return window;
  }

  private cleanExpiredEntries(window: RateLimitWindow, now: number): void {
    const dayAgo = now - 86_400_000;
    window.timestamps = window.timestamps.filter((t) => t > dayAgo);
    window.tokenEntries = window.tokenEntries.filter((e) => e.timestamp > dayAgo);
    window.costEntries = window.costEntries.filter((e) => e.timestamp > dayAgo);
  }

  private getTokensInWindow(
    window: RateLimitWindow,
    now: number,
    windowMs: number
  ): number {
    return window.tokenEntries
      .filter((e) => now - e.timestamp < windowMs)
      .reduce((sum, e) => sum + e.tokens, 0);
  }

  private getCostInWindow(
    window: RateLimitWindow,
    now: number,
    windowMs: number
  ): number {
    return window.costEntries
      .filter((e) => now - e.timestamp < windowMs)
      .reduce((sum, e) => sum + e.cost, 0);
  }

  private buildState(
    agentId: string,
    window: RateLimitWindow,
    config: AgentRateLimitConfig,
    isLimited: boolean,
    retryAfterMs?: number
  ): RateLimitState {
    const now = Date.now();
    const minuteRequests = window.timestamps.filter((t) => now - t < 60_000).length;
    const minuteTokens = this.getTokensInWindow(window, now, 60_000);

    return {
      agentId,
      windowStart: new Date(window.createdAt),
      requestCount: minuteRequests,
      tokenCount: minuteTokens,
      isLimited,
      retryAfterMs,
      remainingRequests: Math.max(0, config.requestsPerMinute - minuteRequests),
      remainingTokens: Math.max(0, config.tokensPerMinute - minuteTokens),
    };
  }
}

interface RateLimitWindow {
  timestamps: number[];
  tokenEntries: Array<{ timestamp: number; tokens: number }>;
  costEntries: Array<{ timestamp: number; cost: number }>;
  totalRequests: number;
  totalTokens: number;
  createdAt: number;
}

export const agentRateLimiter = new AgentRateLimiter();
