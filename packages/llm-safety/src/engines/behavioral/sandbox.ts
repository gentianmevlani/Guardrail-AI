import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class SandboxEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.sandbox',
    name: 'Sandbox',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Flags sandbox-required operations when extensions.sandbox=true',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const need = ctx.extensions?.['requireSandbox'] === true;
    if (need && ctx.extensions?.['inSandbox'] !== true) {
      return mkResult(this.manifest.id, 'behavioral', 'fail', 'Operation requires sandboxed execution', start);
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Sandbox policy OK', start);
  }
}
