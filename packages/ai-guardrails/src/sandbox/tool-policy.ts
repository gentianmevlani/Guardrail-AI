import type { ActionAttempt } from '@guardrail/core';
import { toolUsePolicyEngine } from '../behavioral/tool-use-policy';

export interface ToolPolicyEvaluation {
  allowed: boolean;
  reason: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Bridges declarative tool policies (behavioral layer) to sandbox action attempts.
 * When no policy is registered for an agent, evaluation passes through so permission
 * checks and later stages can decide.
 */
export class ToolPolicyEnforcer {
  async evaluate(action: ActionAttempt): Promise<ToolPolicyEvaluation> {
    const policy = toolUsePolicyEngine.getPolicy(action.agentId);
    if (!policy) {
      return {
        allowed: true,
        reason: 'No tool policy configured for agent — deferred to permission evaluation',
        riskLevel: 'LOW',
      };
    }

    const toolName =
      action.actionType.trim() !== '' ? action.actionType : `${action.category}:action`;

    const decision = await toolUsePolicyEngine.evaluate(action.agentId, toolName);

    return {
      allowed: decision.allowed,
      reason: decision.reason,
      riskLevel: decision.riskLevel,
    };
  }
}

export const toolPolicyEnforcer = new ToolPolicyEnforcer();
