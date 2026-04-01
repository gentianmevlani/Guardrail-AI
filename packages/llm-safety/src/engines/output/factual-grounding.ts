import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class FactualGroundingEngine extends Engine {
  readonly manifest = {
    id: 'output.factual-grounding',
    name: 'Factual grounding',
    category: 'output' as const,
    version: '0.1.0',
    description: 'Compares output to sourceDocuments when provided',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const docs = ctx.sourceDocuments ?? [];
    if (docs.length === 0) {
      return mkResult(this.manifest.id, 'output', 'pass', 'No source documents to verify against', start);
    }
    const out = ctx.output ?? '';
    const combined = docs.join('\n').slice(0, 20_000);
    if (out.length > 50 && combined.length > 0 && !combined.includes(out.slice(0, 40))) {
      return mkResult(this.manifest.id, 'output', 'warn', 'Output may not be grounded in provided sources', start, {
        confidence: 0.5,
      });
    }
    return mkResult(this.manifest.id, 'output', 'pass', 'Basic grounding check passed', start);
  }
}
