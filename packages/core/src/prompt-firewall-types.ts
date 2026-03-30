/**
 * Structural types for optional `@guardrail/ai-guardrails` integration.
 * Defined in core to avoid a workspace dependency cycle (ai-guardrails → core → ai-guardrails).
 */

export interface PromptFirewallResult {
  prompt?: string;
  taskBreakdown: unknown[];
  verification: {
    passed: boolean;
    score: number;
    checks?: unknown[];
    blockers?: string[];
  };
  versionControl?: unknown;
  immediateFixes: unknown[];
  futurePlan?: unknown;
  context?: unknown;
  recommendations?: string[];
}

export interface AdvancedPromptFirewall {
  process(
    prompt: string,
    options?: {
      autoBreakdown?: boolean;
      autoVerify?: boolean;
      autoFix?: boolean;
      includeVersionControl?: boolean;
      generatePlan?: boolean;
    }
  ): Promise<PromptFirewallResult>;
  applyFix?: (...args: unknown[]) => Promise<{ success: boolean; message?: string }>;
}
