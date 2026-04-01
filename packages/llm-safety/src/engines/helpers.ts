import type { GuardrailCategory, GuardrailResult, GuardrailVerdict } from '../core/types.js';
import { elapsedMs } from '../utils/timer.js';

export function mkResult(
  engineId: string,
  category: GuardrailCategory,
  verdict: GuardrailVerdict,
  message: string,
  start: number,
  opts: { confidence?: number; details?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}
): GuardrailResult {
  return {
    engineId,
    category,
    verdict,
    confidence: opts.confidence ?? (verdict === 'pass' ? 0.9 : 0.99),
    message,
    latencyMs: elapsedMs(start),
    details: opts.details,
    metadata: opts.metadata,
  };
}
