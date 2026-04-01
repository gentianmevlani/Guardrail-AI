import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class TokenLimitEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.token-limit',
    name: 'Token limit',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Enforces max estimated tokens for request',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const max = (ctx.extensions?.['maxInputTokens'] as number | undefined) ?? 100_000;
    const text = ctx.input ?? '';
    const est = Math.ceil(text.length / 4);
    if (est > max) {
      return mkResult(this.manifest.id, 'behavioral', 'fail', `Input exceeds token budget (${est} > ${max})`, start);
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Within token budget', start, {
      metadata: { estimatedTokens: est },
    });
  }
}
