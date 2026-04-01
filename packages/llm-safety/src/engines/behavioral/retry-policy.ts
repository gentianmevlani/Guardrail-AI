import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class RetryPolicyEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.retry-policy',
    name: 'Retry policy',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Caps retry count in extensions',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const attempt = (ctx.extensions?.['retryAttempt'] as number | undefined) ?? 0;
    const max = (ctx.extensions?.['maxRetries'] as number | undefined) ?? 5;
    if (attempt > max) {
      return mkResult(this.manifest.id, 'behavioral', 'fail', 'Max retries exceeded', start);
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Retries within policy', start);
  }
}
