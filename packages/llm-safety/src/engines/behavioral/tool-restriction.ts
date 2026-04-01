import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

export class ToolRestrictionEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.tool-restriction',
    name: 'Tool restriction',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Allowlist tool names when toolCall present',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const allowed = ctx.extensions?.['allowedTools'] as string[] | undefined;
    if (!ctx.toolCall || !allowed?.length) {
      return mkResult(this.manifest.id, 'behavioral', 'pass', 'No tool restriction context', start);
    }
    const name = ctx.toolCall.name;
    if (!allowed.includes(name)) {
      return mkResult(this.manifest.id, 'behavioral', 'fail', `Tool not allowed: ${name}`, start);
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Tool allowed', start);
  }
}
