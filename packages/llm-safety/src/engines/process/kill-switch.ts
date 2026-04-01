import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class KillSwitchEngine extends Engine {
  readonly manifest = {
    id: 'process.kill-switch',
    name: 'Kill switch',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Global stop when extensions.killSwitch=true',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    if (ctx.extensions?.['killSwitch'] === true) {
      return mkResult(this.manifest.id, 'process', 'fail', 'Kill switch activated', start);
    }
    return mkResult(this.manifest.id, 'process', 'pass', 'Kill switch off', start);
  }
}
