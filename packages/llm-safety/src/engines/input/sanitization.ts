import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

const SCRIPT = /<script\b[^>]*>/i;

export class SanitizationEngine extends Engine {
  readonly manifest = {
    id: 'input.sanitization',
    name: 'Sanitization',
    category: 'input' as const,
    version: '0.1.0',
    description: 'Blocks obvious HTML/script injection in user input',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const text = ctx.input ?? '';
    if (SCRIPT.test(text)) {
      return mkResult(this.manifest.id, 'input', 'fail', 'Script tag detected in input', start, {
        details: { reason: 'script_tag' },
      });
    }
    return mkResult(this.manifest.id, 'input', 'pass', 'No disallowed markup detected', start);
  }
}
