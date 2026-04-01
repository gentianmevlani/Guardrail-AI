import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import type { GuardrailEventBus } from '../../core/event-bus.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class IncidentResponseEngine extends Engine {
  readonly manifest = {
    id: 'process.incident-response',
    name: 'Incident response',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Escalates when extensions.incident=true',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const bus = ctx.extensions?.['eventBus'] as GuardrailEventBus | undefined;
    if (ctx.extensions?.['incident'] === true) {
      bus?.emitTyped({
        type: 'incident',
        severity: 'high',
        detail: { contextId: ctx.id, message: 'Incident flag set on context' },
      });
      return mkResult(this.manifest.id, 'process', 'warn', 'Incident response triggered', start);
    }
    return mkResult(this.manifest.id, 'process', 'pass', 'No incident flag', start);
  }
}
