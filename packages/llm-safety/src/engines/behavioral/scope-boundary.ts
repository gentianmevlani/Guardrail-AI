import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class ScopeBoundaryEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.scope-boundary',
    name: 'Scope boundary',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Ensures agent stays within allowed scope description',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const scope = (ctx.extensions?.['scope'] as string | undefined) ?? '';
    const input = ctx.input ?? '';
    if (scope && input.length > 0 && !input.toLowerCase().includes(scope.toLowerCase().slice(0, 20))) {
      return mkResult(this.manifest.id, 'behavioral', 'warn', 'Request may be outside declared scope', start, {
        confidence: 0.4,
      });
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Scope check OK', start);
  }
}
