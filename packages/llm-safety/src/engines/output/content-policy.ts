import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class ContentPolicyEngine extends Engine {
  readonly manifest = {
    id: 'output.content-policy',
    name: 'Content policy',
    category: 'output' as const,
    version: '0.1.0',
    description: 'Organization policy blocklist for output',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const blocked = (ctx.extensions?.['blockedTerms'] as string[] | undefined) ?? [];
    const text = (ctx.output ?? '').toLowerCase();
    for (const t of blocked) {
      if (t && text.includes(t.toLowerCase())) {
        return mkResult(this.manifest.id, 'output', 'fail', `Blocked term in output: ${t}`, start);
      }
    }
    return mkResult(this.manifest.id, 'output', 'pass', 'Content policy OK', start);
  }
}
