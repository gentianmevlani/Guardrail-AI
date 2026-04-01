import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class AuthCheckEngine extends Engine {
  readonly manifest = {
    id: 'input.auth-check',
    name: 'Auth check',
    category: 'input' as const,
    version: '0.1.0',
    description: 'Ensures authenticated user context when required',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const requireAuth = ctx.extensions?.['requireAuth'] === true;
    if (requireAuth && !ctx.user?.id) {
      return mkResult(this.manifest.id, 'input', 'fail', 'Authenticated user required', start);
    }
    return mkResult(this.manifest.id, 'input', 'pass', 'Auth context OK', start);
  }
}
