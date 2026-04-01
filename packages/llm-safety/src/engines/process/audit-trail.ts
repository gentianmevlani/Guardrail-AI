import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import type { GuardrailEventBus } from '../../core/event-bus.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class AuditTrailEngine extends Engine {
  readonly manifest = {
    id: 'process.audit-trail',
    name: 'Audit trail',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Structured audit event on event bus',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const bus = ctx.extensions?.['eventBus'] as GuardrailEventBus | undefined;
    bus?.emitTyped({
      type: 'audit',
      record: { engine: this.manifest.id, contextId: ctx.id, category: ctx.category },
    });
    return mkResult(this.manifest.id, 'process', 'pass', 'Audit record emitted', start);
  }
}
