/**
 * Guardrails API Client
 *
 * Full API integration for guardrails, validation, achievements, and team features
 */

import { logger } from './logger';

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api/guardrails`;

// ============ Types ============

export interface GuardrailRule {
  id: string;
  naturalLanguage: string;
  pattern: string;
  category: "security" | "quality" | "behavior" | "custom";
  severity: "block" | "warn" | "info";
  enabled: boolean;
  createdAt: string;
  userId?: string;
}

export interface ParsedRuleResponse {
  rule: GuardrailRule;
  parsedKeywords: string[];
  confidence: number;
}

export interface ValidationStage {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed" | "warning";
  duration: number;
  message?: string;
}

export interface ValidationFinding {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  line?: number;
  column?: number;
  code?: string;
  suggestedFix?: string;
  confidence: number;
  ruleId: string;
  // Extended properties for UI
  explanation?: string;
  codeSnippet?: {
    before: string;
    after?: string;
    language: string;
    lineNumber?: number;
  };
}

export interface ValidationResult {
  id: string;
  passed: boolean;
  score: number;
  stages: ValidationStage[];
  findings: ValidationFinding[];
  timestamp: string;
  userStats?: UserStats;
  newAchievements?: Achievement[];
}

export interface UserStats {
  userId: string;
  securityScore: number;
  totalValidations: number;
  issuesBlocked: number;
  issuesFixed: number;
  streak: number;
  lastValidation: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  threshold: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
}

export interface PresetGuardrail {
  id: string;
  name: string;
  description: string;
  rules: number;
  category: string;
  enabled: boolean;
  patterns?: Array<{ name: string; pattern: string }>;
}

export interface TeamStats {
  totalMembers: number;
  avgScore: number;
  totalValidations: number;
  issuesBlocked: number;
  leaderboard: Array<UserStats & { rank: number }>;
}

// ============ API Functions ============

/**
 * Parse natural language into a guardrail rule
 */
export async function parseNaturalLanguageRule(
  naturalLanguage: string,
  options?: { severity?: "block" | "warn" | "info"; category?: string },
): Promise<ParsedRuleResponse> {
  const res = await fetch(`${BASE_URL}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ naturalLanguage, ...options }),
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: "Failed to parse rule" }));
    logger.error('Error parsing natural language rule:', error);
    throw new Error(error.error || "Failed to parse rule");
  }

  const json = await res.json();
  return json.data;
}

/**
 * Get all custom rules
 */
export async function getRules(): Promise<GuardrailRule[]> {
  const res = await fetch(`${BASE_URL}/rules`, {
    credentials: "include",
  });

  if (!res.ok) {
    logger.error('Error fetching rules:');
    return [];
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Toggle a rule on/off
 */
export async function toggleRule(
  ruleId: string,
): Promise<GuardrailRule | null> {
  const res = await fetch(`${BASE_URL}/rules/${ruleId}/toggle`, {
    method: "PATCH",
    credentials: "include",
  });

  if (!res.ok) {
    logger.error('Error toggling rule:');
    return null;
  }

  const json = await res.json();
  return json.data;
}

/**
 * Delete a rule
 */
export async function deleteRule(ruleId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/rules/${ruleId}`, {
    method: "DELETE",
    credentials: "include",
  });

  return res.ok;
}

/**
 * Validate code against guardrails
 */
export async function validateCode(
  code: string,
  language: string = "typescript",
  ruleIds?: string[],
): Promise<ValidationResult> {
  const res = await fetch(`${BASE_URL}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code, language, ruleIds }),
  });

  if (!res.ok) {
    throw new Error("Validation failed");
  }

  const json = await res.json();
  return json.data;
}

/**
 * Stream validation (for live UI updates)
 * Returns an async generator that yields stage updates
 */
export async function* streamValidation(
  code: string,
  language: string = "typescript",
): AsyncGenerator<{ stage: string; status: string; progress: number }> {
  // Start validation
  const startRes = await fetch(`${BASE_URL}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code, language }),
  });

  if (!startRes.ok) {
    throw new Error("Validation failed");
  }

  const result = await startRes.json();

  // Simulate streaming by yielding stage results with delays
  const stages = result.data.stages || [];
  for (let i = 0; i < stages.length; i++) {
    yield {
      stage: stages[i].id,
      status: stages[i].status,
      progress: ((i + 1) / stages.length) * 100,
    };

    // Small delay between stages for UI effect
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Get validation history
 */
export async function getValidationHistory(
  limit: number = 20,
): Promise<ValidationResult[]> {
  const res = await fetch(`${BASE_URL}/history?limit=${limit}`, {
    credentials: "include",
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Get user stats
 */
export async function getUserStats(): Promise<UserStats | null> {
  const res = await fetch(`${BASE_URL}/stats`, {
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  return json.data;
}

/**
 * Get achievements
 */
export async function getAchievements(): Promise<Achievement[]> {
  const res = await fetch(`${BASE_URL}/achievements`, {
    credentials: "include",
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Get preset guardrails
 */
export async function getPresets(): Promise<PresetGuardrail[]> {
  const res = await fetch(`${BASE_URL}/presets`, {
    credentials: "include",
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Toggle a preset guardrail on/off
 */
export async function togglePreset(
  presetId: string,
  enabled: boolean,
): Promise<PresetGuardrail | null> {
  const res = await fetch(`${BASE_URL}/presets/${presetId}/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ enabled }),
  });

  if (!res.ok) {
    logger.debug('Failed to toggle preset');
    return null;
  }

  const json = await res.json();
  return json.data;
}

/**
 * Get team stats
 */
export async function getTeamStats(): Promise<TeamStats | null> {
  const res = await fetch(`${BASE_URL}/team/stats`, {
    credentials: "include",
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  return json.data;
}

// ============ Real-time Validation Hook ============

export interface UseValidationOptions {
  onStageUpdate?: (stage: ValidationStage) => void;
  onComplete?: (result: ValidationResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook-friendly validation function that provides callbacks for UI updates
 */
export async function runValidationWithCallbacks(
  code: string,
  language: string,
  callbacks: UseValidationOptions,
): Promise<ValidationResult | null> {
  try {
    const result = await validateCode(code, language);

    // Emit stage updates for UI
    if (callbacks.onStageUpdate) {
      for (const stage of result.stages) {
        callbacks.onStageUpdate(stage);
        await new Promise((r) => setTimeout(r, 150)); // Small delay for animation
      }
    }

    callbacks.onComplete?.(result);
    return result;
  } catch (error) {
    callbacks.onError?.(error as Error);
    return null;
  }
}
