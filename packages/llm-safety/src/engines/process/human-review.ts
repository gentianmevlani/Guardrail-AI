import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class HumanReviewEngine extends Engine {
  readonly manifest = {
    id: 'process.human-review',
    name: 'Human review',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Flags requests requiring human approval',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    if (ctx.extensions?.['requireHumanReview'] === true) {
      return mkResult(this.manifest.id, 'process', 'warn', 'Human review required before proceed', start);
    }
    return mkResult(this.manifest.id, 'process', 'pass', 'No human review gate', start);
  }
}
