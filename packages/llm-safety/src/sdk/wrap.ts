import type { Guardrail } from './guardrail.js';
import type { PipelineResult } from '../core/types.js';

/**
 * Wrap an async LLM call with input + output guardrails.
 */
export async function withGuardrails<T>(
  g: Guardrail,
  input: string,
  fn: () => Promise<{ output: string } & Record<string, unknown>>
): Promise<{ result: T; input: PipelineResult; output: PipelineResult }> {
  const inputRes = await g.checkInput({ input });
  if (inputRes.verdict === 'fail') {
    throw new Error(`Input guardrail failed: ${inputRes.results.map((r) => r.message).join('; ')}`);
  }
  const raw = await fn();
  const outputRes = await g.checkOutput({ input, output: raw.output });
  if (outputRes.verdict === 'fail') {
    throw new Error(`Output guardrail failed: ${outputRes.results.map((r) => r.message).join('; ')}`);
  }
  return { result: raw as T, input: inputRes, output: outputRes };
}
