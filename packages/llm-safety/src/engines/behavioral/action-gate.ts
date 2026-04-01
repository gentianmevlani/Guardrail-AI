import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class ActionGateEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.action-gate',
    name: 'Action gate',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Requires explicit approval flag for destructive actions',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const destructive = ctx.extensions?.['destructiveAction'] === true;
    if (destructive && ctx.extensions?.['approved'] !== true) {
      return mkResult(this.manifest.id, 'behavioral', 'fail', 'Destructive action not approved', start);
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Action gate OK', start);
  }
}
