import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { detectPII } from '../../detectors/pii-detector.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class PIILeakageEngine extends Engine {
  readonly manifest = {
    id: 'output.pii-leakage',
    name: 'PII leakage',
    category: 'output' as const,
    version: '0.1.0',
    description: 'Detects phone, email, SSN-like patterns in model output',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const text = ctx.output ?? '';
    const hits = detectPII(text);
    if (hits.length > 0) {
      return mkResult(this.manifest.id, 'output', 'fail', 'PII pattern detected in output', start, {
        details: { matches: hits.slice(0, 10) },
      });
    }
    return mkResult(this.manifest.id, 'output', 'pass', 'No PII patterns in output', start);
  }
}
