import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import type { GuardrailEventBus } from '../../core/event-bus.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class MonitoringEngine extends Engine {
  readonly manifest = {
    id: 'process.monitoring',
    name: 'Monitoring',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Emits monitoring metrics on event bus when present',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const bus = ctx.extensions?.['eventBus'] as GuardrailEventBus | undefined;
    bus?.emitTyped({
      type: 'monitoring',
      metric: 'guardrail.process.run',
      value: 1,
      tags: { contextId: ctx.id },
    });
    return mkResult(this.manifest.id, 'process', 'pass', 'Monitoring tick', start);
  }
}
