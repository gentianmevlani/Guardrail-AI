import type { GuardrailResult, GuardrailVerdict, PipelineResult } from './types.js';

export function aggregateVerdict(results: GuardrailResult[]): GuardrailVerdict {
  if (results.some((r) => r.verdict === 'fail')) return 'fail';
  if (results.some((r) => r.verdict === 'warn')) return 'warn';
  return 'pass';
}

export function mergePipelineResult(
  base: Partial<PipelineResult> & { contextId: string; results: GuardrailResult[]; skipped: string[] }
): PipelineResult {
  const verdict = aggregateVerdict(base.results);
  return {
    verdict,
    results: base.results,
    totalLatencyMs: base.totalLatencyMs ?? 0,
    skipped: base.skipped,
    contextId: base.contextId,
    timestamp: base.timestamp ?? new Date().toISOString(),
  };
}
