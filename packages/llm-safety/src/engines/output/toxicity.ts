import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class ToxicityEngine extends Engine {
  readonly manifest = {
    id: 'output.toxicity',
    name: 'Toxicity',
    category: 'output' as const,
    version: '0.1.0',
    description: 'Keyword-based toxicity (set extensions.toxicityKeywords)',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const text = (ctx.output ?? '').toLowerCase();
    const raw = ctx.extensions?.['toxicityKeywords'];
    const list = Array.isArray(raw)
      ? raw.filter((w): w is string => typeof w === 'string' && w.length > 0)
      : [];
    if (list.length === 0) {
      return mkResult(
        this.manifest.id,
        'output',
        'pass',
        'Toxicity engine idle — supply extensions.toxicityKeywords (no default blocklist)',
        start,
        { confidence: 1, metadata: { skipped: true } }
      );
    }
    for (const w of list) {
      if (text.includes(w.toLowerCase())) {
        return mkResult(this.manifest.id, 'output', 'fail', `Toxicity keyword: ${w}`, start);
      }
    }
    return mkResult(this.manifest.id, 'output', 'pass', 'No toxicity keywords matched', start);
  }
}
