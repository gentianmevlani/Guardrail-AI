/**
 * Shared types for the LLM guardrail runtime framework.
 */

export type GuardrailVerdict = 'pass' | 'fail' | 'warn';

export type GuardrailCategory = 'input' | 'output' | 'behavioral' | 'process';

export interface GuardrailResult {
  engineId: string;
  category: GuardrailCategory;
  verdict: GuardrailVerdict;
  confidence: number;
  message: string;
  details?: Record<string, unknown>;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface PipelineResult {
  verdict: GuardrailVerdict;
  results: GuardrailResult[];
  totalLatencyMs: number;
  skipped: string[];
  contextId: string;
  timestamp: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface GuardrailContext {
  id: string;
  category: GuardrailCategory;
  input?: string;
  output?: string;
  systemPrompt?: string;
  conversationHistory?: ChatMessage[];
  sourceDocuments?: string[];
  toolCall?: { name: string; args: unknown };
  user?: { id: string; [key: string]: unknown };
  model?: { id: string; [key: string]: unknown };
  /** Arbitrary extensions (e.g. expected JSON schema id, token counts) */
  extensions?: Record<string, unknown>;
}

export interface EngineManifest {
  id: string;
  name: string;
  category: GuardrailCategory;
  version: string;
  description: string;
}

export interface ClassifierResult {
  label: string;
  score: number;
  span?: { start: number; end: number };
}

export type PipelineMode = 'fail-fast' | 'collect-all';
