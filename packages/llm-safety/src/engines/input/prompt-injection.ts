import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { detectPromptInjection } from '../../detectors/injection-patterns.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class PromptInjectionEngine extends Engine {
  readonly manifest = {
    id: 'input.prompt-injection',
    name: 'Prompt injection',
    category: 'input' as const,
    version: '0.1.0',
    description: 'Detects common jailbreak / instruction-override patterns',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const text = ctx.input ?? '';
    const hit = detectPromptInjection(text);
    if (hit) {
      return mkResult(this.manifest.id, 'input', 'fail', 'Prompt injection pattern detected', start, {
        confidence: 0.92,
        details: { patternIndex: hit.patternIndex, snippet: hit.snippet },
      });
    }
    return mkResult(this.manifest.id, 'input', 'pass', 'No injection patterns matched', start);
  }
}
