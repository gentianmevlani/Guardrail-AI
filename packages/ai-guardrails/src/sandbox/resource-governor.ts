import { ResourceUsage, LimitCheck } from '@guardrail/core';
import { permissionManager } from './permission-manager';

/**
 * Tracks and enforces resource usage limits for agents
 */
export class ResourceGovernor {
  private usageCache: Map<string, ResourceUsage> = new Map();

  /**
   * Track resource usage for an agent/task
   */
  async trackUsage(
    agentId: string,
    taskId: string,
    usage: Partial<ResourceUsage>
  ): Promise<void> {
    const key = `${agentId}:${taskId}`;
    const current = this.usageCache.get(key) || {
      memoryMB: 0,
      cpuPercent: 0,
      tokensUsed: 0,
      executionTimeMs: 0,
      apiCalls: 0,
    };

    const updated: ResourceUsage = {
      memoryMB: usage.memoryMB ?? current.memoryMB,
      cpuPercent: usage.cpuPercent ?? current.cpuPercent,
      tokensUsed: current.tokensUsed + (usage.tokensUsed || 0),
      executionTimeMs: current.executionTimeMs + (usage.executionTimeMs || 0),
      apiCalls: current.apiCalls + (usage.apiCalls || 0),
    };

    this.usageCache.set(key, updated);
  }

  /**
   * Check if current usage is within limits
   */
  async checkLimits(agentId: string, taskId: string): Promise<LimitCheck> {
    const permissions = await permissionManager.getPermissions(agentId);
    if (!permissions) {
      throw new Error(`Agent ${agentId} permissions not found`);
    }

    const limits = permissions.resources;
    const usage = await this.getUsage(agentId, taskId);
    const violations: string[] = [];

    if (usage.memoryMB > limits.maxMemoryMB) {
      violations.push(
        `Memory usage (${usage.memoryMB}MB) exceeds limit (${limits.maxMemoryMB}MB)`
      );
    }

    if (usage.cpuPercent > limits.maxCpuPercent) {
      violations.push(
        `CPU usage (${usage.cpuPercent}%) exceeds limit (${limits.maxCpuPercent}%)`
      );
    }

    if (usage.tokensUsed > limits.maxTokens) {
      violations.push(
        `Token usage (${usage.tokensUsed}) exceeds limit (${limits.maxTokens})`
      );
    }

    if (usage.executionTimeMs > limits.maxExecutionTimeMs) {
      violations.push(
        `Execution time (${usage.executionTimeMs}ms) exceeds limit (${limits.maxExecutionTimeMs}ms)`
      );
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      current: usage,
      limits,
    };
  }

  /**
   * Get current resource usage for agent/task
   */
  async getUsage(agentId: string, taskId: string): Promise<ResourceUsage> {
    const key = `${agentId}:${taskId}`;
    return (
      this.usageCache.get(key) || {
        memoryMB: 0,
        cpuPercent: 0,
        tokensUsed: 0,
        executionTimeMs: 0,
        apiCalls: 0,
      }
    );
  }

  /**
   * Reset usage tracking for a task
   */
  async resetUsage(agentId: string, taskId: string): Promise<void> {
    const key = `${agentId}:${taskId}`;
    this.usageCache.delete(key);
  }

  /**
   * Get usage percentage for a resource
   */
  async getUsagePercentage(
    agentId: string,
    taskId: string
  ): Promise<{
    memory: number;
    cpu: number;
    tokens: number;
    time: number;
  }> {
    const { current, limits } = await this.checkLimits(agentId, taskId);

    return {
      memory: (current.memoryMB / limits.maxMemoryMB) * 100,
      cpu: (current.cpuPercent / limits.maxCpuPercent) * 100,
      tokens: (current.tokensUsed / limits.maxTokens) * 100,
      time: (current.executionTimeMs / limits.maxExecutionTimeMs) * 100,
    };
  }

  /**
   * Check if agent can perform an action based on resource limits
   */
  async canPerformAction(
    agentId: string,
    taskId: string,
    estimatedCost: Partial<ResourceUsage>
  ): Promise<{ allowed: boolean; reason?: string }> {
    const permissions = await permissionManager.getPermissions(agentId);
    if (!permissions) {
      return { allowed: false, reason: 'Agent permissions not found' };
    }

    const limits = permissions.resources;
    const current = await this.getUsage(agentId, taskId);

    // Check if adding estimated cost would exceed limits
    if (estimatedCost.memoryMB && current.memoryMB + estimatedCost.memoryMB > limits.maxMemoryMB) {
      return {
        allowed: false,
        reason: `Action would exceed memory limit (current: ${current.memoryMB}MB, estimated: ${estimatedCost.memoryMB}MB, limit: ${limits.maxMemoryMB}MB)`,
      };
    }

    if (estimatedCost.tokensUsed && current.tokensUsed + estimatedCost.tokensUsed > limits.maxTokens) {
      return {
        allowed: false,
        reason: `Action would exceed token limit (current: ${current.tokensUsed}, estimated: ${estimatedCost.tokensUsed}, limit: ${limits.maxTokens})`,
      };
    }

    if (
      estimatedCost.executionTimeMs &&
      current.executionTimeMs + estimatedCost.executionTimeMs > limits.maxExecutionTimeMs
    ) {
      return {
        allowed: false,
        reason: `Action would exceed execution time limit (current: ${current.executionTimeMs}ms, estimated: ${estimatedCost.executionTimeMs}ms, limit: ${limits.maxExecutionTimeMs}ms)`,
      };
    }

    return { allowed: true };
  }
}

// Export singleton instance
export const resourceGovernor = new ResourceGovernor();
