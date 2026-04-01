import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class HallucinationEngine extends Engine {
  readonly manifest = {
    id: 'output.hallucination',
    name: 'Hallucination heuristic',
    category: 'output' as const,
    version: '0.1.0',
    description: 'Lightweight heuristics for unsupported claims (extend with ML)',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const text = ctx.output ?? '';
    const hedges = /\b(I'?m not sure|might be|possibly|could be|unclear)\b/i.test(text);
    if (hedges) {
      return mkResult(this.manifest.id, 'output', 'warn', 'Output contains uncertainty hedges', start, {
        confidence: 0.55,
      });
    }
    return mkResult(this.manifest.id, 'output', 'pass', 'No hallucination heuristics triggered', start);
  }
}
