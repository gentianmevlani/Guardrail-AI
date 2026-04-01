/**
 * Express middleware (optional peer: `express`).
 * Install: `npm i express` alongside `@guardrail/llm-safety`.
 */
import type { Request, Response, NextFunction } from 'express';
import type { Guardrail } from '../sdk/guardrail.js';
import type { PipelineResult } from '../core/types.js';

export interface ExpressGuardOptions {
  /** Body field containing the user prompt (default: `input`) */
  bodyKey?: string;
  /** Attach pipeline result to `req` (see `RequestWithGuardrail`) */
  attachResult?: boolean;
}

/** Narrow with `req as RequestWithGuardrail` after input/output middleware. */
export type RequestWithGuardrail = Request & {
  guardrailInput?: PipelineResult;
  guardrailOutput?: PipelineResult;
};

/** Validate `req.body[bodyKey]` as model input before route handlers run. */
export function expressInputGuardMiddleware(
  g: Guardrail,
  options: ExpressGuardOptions = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const bodyKey = options.bodyKey ?? 'input';
  const attach = options.attachResult ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    const raw = (req.body as Record<string, unknown> | undefined)?.[bodyKey];
    if (typeof raw !== 'string') {
      next();
      return;
    }
    const result = await g.checkInput({ input: raw });
    if (result.verdict === 'fail') {
      res.status(400).json({
        error: 'guardrail_input_rejected',
        verdict: result.verdict,
        results: result.results,
      });
      return;
    }
    if (attach) {
      (req as RequestWithGuardrail).guardrailInput = result;
    }
    next();
  };
}

/** Validate model output (e.g. after proxying to an LLM). Pass `output` in `res.locals` or body. */
export function expressOutputGuardMiddleware(
  g: Guardrail,
  options: { outputKey?: string; source?: 'locals' | 'body' } = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const key = options.outputKey ?? 'output';
  const source = options.source ?? 'locals';

  return async (req: Request, res: Response, next: NextFunction) => {
    const output =
      source === 'locals'
        ? (res.locals as Record<string, unknown>)[key]
        : (req.body as Record<string, unknown> | undefined)?.[key];
    if (typeof output !== 'string') {
      next();
      return;
    }
    const result = await g.checkOutput({ output, input: typeof req.body === 'object' && req.body && 'input' in req.body ? String((req.body as { input?: unknown }).input ?? '') : undefined });
    if (result.verdict === 'fail') {
      res.status(400).json({
        error: 'guardrail_output_rejected',
        verdict: result.verdict,
        results: result.results,
      });
      return;
    }
    (req as RequestWithGuardrail).guardrailOutput = result;
    next();
  };
}
