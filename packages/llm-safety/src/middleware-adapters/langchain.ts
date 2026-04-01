/**
 * LangChain Runnable helpers (optional peer: `@langchain/core`).
 * Install: `npm i @langchain/core` alongside `@guardrail/llm-safety`.
 */
import { RunnableLambda } from '@langchain/core/runnables';
import type { Guardrail } from '../sdk/guardrail.js';
import type { PipelineResult } from '../core/types.js';

export type InputGuardInput = { input: string; [key: string]: unknown };
export type InputGuardOutput = InputGuardInput & { guardrailInput: PipelineResult };

export type OutputGuardInput = { output: string; input?: string; [key: string]: unknown };
export type OutputGuardOutput = OutputGuardInput & { guardrailOutput: PipelineResult };

/** Runnable that runs `checkInput`; throws if verdict is `fail`. */
export function createInputGuardRunnable(g: Guardrail) {
  return RunnableLambda.from(async (input: InputGuardInput): Promise<InputGuardOutput> => {
    const r = await g.checkInput({ input: input.input });
    if (r.verdict === 'fail') {
      throw new Error(
        `Guardrail input rejected: ${r.results.map((x) => x.message).join('; ')}`
      );
    }
    return { ...input, guardrailInput: r };
  });
}

/** Runnable that runs `checkOutput`; throws if verdict is `fail`. */
export function createOutputGuardRunnable(g: Guardrail) {
  return RunnableLambda.from(async (input: OutputGuardInput): Promise<OutputGuardOutput> => {
    const r = await g.checkOutput({
      output: input.output,
      input: input.input,
    });
    if (r.verdict === 'fail') {
      throw new Error(
        `Guardrail output rejected: ${r.results.map((x) => x.message).join('; ')}`
      );
    }
    return { ...input, guardrailOutput: r };
  });
}
