import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class TopicFilterEngine extends Engine {
  readonly manifest = {
    id: 'input.topic-filter',
    name: 'Topic filter',
    category: 'input' as const,
    version: '0.1.0',
    description: 'Keyword-based topic allowlist/blocklist',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const blocked = (ctx.extensions?.['blockedTopics'] as string[] | undefined) ?? [];
    const text = (ctx.input ?? '').toLowerCase();
    for (const t of blocked) {
      if (t && text.includes(t.toLowerCase())) {
        return mkResult(this.manifest.id, 'input', 'fail', `Blocked topic: ${t}`, start);
      }
    }
    return mkResult(this.manifest.id, 'input', 'pass', 'No blocked topics', start);
  }
}
