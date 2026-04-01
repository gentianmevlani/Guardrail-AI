import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class EvalSuiteEngine extends Engine {
  readonly manifest = {
    id: 'process.eval-suite',
    name: 'Eval suite',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Offline eval triggers (wire to your eval runner)',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    void ctx;
    return mkResult(this.manifest.id, 'process', 'pass', 'Eval suite not configured', start);
  }
}
