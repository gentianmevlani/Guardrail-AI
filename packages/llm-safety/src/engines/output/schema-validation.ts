import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class SchemaValidationEngine extends Engine {
  readonly manifest = {
    id: 'output.schema-validation',
    name: 'Schema validation',
    category: 'output' as const,
    version: '0.1.0',
    description: 'Validates JSON output when extensions.outputSchema is set',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const expectJson = ctx.extensions?.['expectJson'] === true;
    if (!expectJson) {
      return mkResult(this.manifest.id, 'output', 'pass', 'JSON output not required', start);
    }
    const out = ctx.output?.trim() ?? '';
    try {
      JSON.parse(out);
      return mkResult(this.manifest.id, 'output', 'pass', 'Valid JSON', start);
    } catch {
      return mkResult(this.manifest.id, 'output', 'fail', 'Output is not valid JSON', start);
    }
  }
}
