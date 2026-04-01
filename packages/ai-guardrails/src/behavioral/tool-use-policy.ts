import {
  ToolUsePolicy,
  ToolUseDecision,
} from '@guardrail/core';

/**
 * Tool Use Policy Engine — Behavioral Guardrail
 *
 * Controls which tools and APIs an agent is allowed to call.
 * Enforces allowlists/denylists, call limits, approval gates,
 * concurrency controls, and chain depth limits.
 */
export class ToolUsePolicyEngine {
  private policies: Map<string, ToolUsePolicy> = new Map();
  private callCounts: Map<string, Map<string, number>> = new Map();
  private activeCalls: Map<string, Set<string>> = new Map();
  private chainDepths: Map<string, number> = new Map();

  /**
   * Evaluate whether an agent can use a specific tool
   */
  async evaluate(
    agentId: string,
    toolName: string,
    options?: { isChained?: boolean; parentTool?: string }
  ): Promise<ToolUseDecision> {
    const policy = this.policies.get(agentId);

    if (!policy) {
      return {
        allowed: false,
        reason: `No tool use policy configured for agent ${agentId}`,
        toolName,
        requiresApproval: false,
        riskLevel: 'CRITICAL',
      };
    }

    // Check deny list first (explicit deny wins)
    if (this.isDenied(toolName, policy)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is explicitly denied for agent ${agentId}`,
        toolName,
        requiresApproval: false,
        riskLevel: 'HIGH',
        alternativeSuggestion: this.suggestAlternative(toolName, policy),
      };
    }

    // Check allow list (if specified, only allowed tools can be used)
    if (policy.allowedTools.length > 0 && !this.isAllowed(toolName, policy)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is not in the allow list for agent ${agentId}`,
        toolName,
        requiresApproval: false,
        riskLevel: 'MEDIUM',
        alternativeSuggestion: `Allowed tools: ${policy.allowedTools.join(', ')}`,
      };
    }

    // Check total tool call limit
    if (policy.toolCallLimit !== undefined) {
      const totalCalls = this.getTotalCallCount(agentId);
      if (totalCalls >= policy.toolCallLimit) {
        return {
          allowed: false,
          reason: `Agent ${agentId} has reached the tool call limit (${policy.toolCallLimit})`,
          toolName,
          requiresApproval: false,
          riskLevel: 'MEDIUM',
        };
      }
    }

    // Check concurrent call limit
    const activeCallCount = this.getActiveCallCount(agentId);
    if (activeCallCount >= policy.maxConcurrentToolCalls) {
      return {
        allowed: false,
        reason: `Agent ${agentId} has reached the concurrent tool call limit (${policy.maxConcurrentToolCalls})`,
        toolName,
        requiresApproval: false,
        riskLevel: 'LOW',
      };
    }

    // Check chain depth
    if (options?.isChained) {
      if (!policy.allowChainedCalls) {
        return {
          allowed: false,
          reason: `Chained tool calls are not allowed for agent ${agentId}`,
          toolName,
          requiresApproval: false,
          riskLevel: 'MEDIUM',
        };
      }

      const currentDepth = this.chainDepths.get(agentId) || 0;
      if (currentDepth >= policy.maxChainDepth) {
        return {
          allowed: false,
          reason: `Chain depth limit reached (${policy.maxChainDepth}) for agent ${agentId}`,
          toolName,
          requiresApproval: false,
          riskLevel: 'MEDIUM',
        };
      }
    }

    // Check API restrictions
    const apiEndpoint = this.extractAPIEndpoint(toolName);
    if (apiEndpoint) {
      if (policy.deniedAPIs.length > 0 && policy.deniedAPIs.some((api) => apiEndpoint.includes(api))) {
        return {
          allowed: false,
          reason: `API endpoint "${apiEndpoint}" is denied for agent ${agentId}`,
          toolName,
          requiresApproval: false,
          riskLevel: 'HIGH',
        };
      }

      if (policy.allowedAPIs.length > 0 && !policy.allowedAPIs.some((api) => apiEndpoint.includes(api))) {
        return {
          allowed: false,
          reason: `API endpoint "${apiEndpoint}" is not in the allow list for agent ${agentId}`,
          toolName,
          requiresApproval: false,
          riskLevel: 'MEDIUM',
        };
      }
    }

    // Check if approval is required
    const requiresApproval = policy.requireApprovalTools.some(
      (pattern) => this.matchesPattern(toolName, pattern)
    );

    const riskLevel = this.assessToolRisk(toolName, policy);

    return {
      allowed: true,
      reason: requiresApproval
        ? `Tool "${toolName}" requires human approval before execution`
        : `Tool "${toolName}" is allowed for agent ${agentId}`,
      toolName,
      requiresApproval,
      riskLevel,
    };
  }

  /**
   * Record a tool call (call after evaluate returns allowed)
   */
  recordCall(agentId: string, toolName: string): string {
    const callId = `${agentId}:${toolName}:${Date.now()}`;

    // Update call counts
    if (!this.callCounts.has(agentId)) {
      this.callCounts.set(agentId, new Map());
    }
    const agentCounts = this.callCounts.get(agentId)!;
    agentCounts.set(toolName, (agentCounts.get(toolName) || 0) + 1);

    // Track active calls
    if (!this.activeCalls.has(agentId)) {
      this.activeCalls.set(agentId, new Set());
    }
    this.activeCalls.get(agentId)!.add(callId);

    return callId;
  }

  /**
   * Mark a tool call as completed
   */
  completeCall(agentId: string, callId: string): void {
    this.activeCalls.get(agentId)?.delete(callId);
  }

  /**
   * Increment chain depth for an agent
   */
  incrementChainDepth(agentId: string): number {
    const current = this.chainDepths.get(agentId) || 0;
    const next = current + 1;
    this.chainDepths.set(agentId, next);
    return next;
  }

  /**
   * Reset chain depth for an agent
   */
  resetChainDepth(agentId: string): void {
    this.chainDepths.delete(agentId);
  }

  /**
   * Set tool use policy for an agent
   */
  setPolicy(agentId: string, policy: ToolUsePolicy): void {
    this.policies.set(agentId, policy);
  }

  /**
   * Get policy for an agent
   */
  getPolicy(agentId: string): ToolUsePolicy | undefined {
    return this.policies.get(agentId);
  }

  /**
   * Reset all call counters for an agent
   */
  resetCounters(agentId: string): void {
    this.callCounts.delete(agentId);
    this.activeCalls.delete(agentId);
    this.chainDepths.delete(agentId);
  }

  private isDenied(toolName: string, policy: ToolUsePolicy): boolean {
    return policy.deniedTools.some((pattern) => this.matchesPattern(toolName, pattern));
  }

  private isAllowed(toolName: string, policy: ToolUsePolicy): boolean {
    return policy.allowedTools.some((pattern) => this.matchesPattern(toolName, pattern));
  }

  private matchesPattern(toolName: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return toolName.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return toolName.endsWith(pattern.slice(1));
    }
    return toolName === pattern;
  }

  private getTotalCallCount(agentId: string): number {
    const counts = this.callCounts.get(agentId);
    if (!counts) return 0;
    let total = 0;
    for (const count of counts.values()) {
      total += count;
    }
    return total;
  }

  private getActiveCallCount(agentId: string): number {
    return this.activeCalls.get(agentId)?.size || 0;
  }

  private extractAPIEndpoint(toolName: string): string | null {
    // Extract API endpoint from tool name conventions like "api:users:get"
    if (toolName.startsWith('api:') || toolName.startsWith('http')) {
      return toolName;
    }
    return null;
  }

  private suggestAlternative(toolName: string, policy: ToolUsePolicy): string | undefined {
    // Simple suggestion: find the most similar allowed tool
    const allowed = policy.allowedTools;
    if (allowed.length === 0) return undefined;

    const toolLower = toolName.toLowerCase();
    const best = allowed.reduce((closest, current) => {
      const currentSimilarity = this.stringSimilarity(toolLower, current.toLowerCase());
      const closestSimilarity = this.stringSimilarity(toolLower, closest.toLowerCase());
      return currentSimilarity > closestSimilarity ? current : closest;
    });

    return `Consider using "${best}" instead`;
  }

  private stringSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i]!)) matches++;
    }
    return matches / longer.length;
  }

  private assessToolRisk(
    toolName: string,
    _policy: ToolUsePolicy
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const highRiskPatterns = ['delete', 'remove', 'drop', 'destroy', 'execute', 'eval', 'exec'];
    const mediumRiskPatterns = ['write', 'update', 'modify', 'create', 'post', 'put', 'patch'];

    const lower = toolName.toLowerCase();

    if (highRiskPatterns.some((p) => lower.includes(p))) return 'HIGH';
    if (mediumRiskPatterns.some((p) => lower.includes(p))) return 'MEDIUM';
    return 'LOW';
  }
}

export const toolUsePolicyEngine = new ToolUsePolicyEngine();
