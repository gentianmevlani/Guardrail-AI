import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

interface EscalationRule {
  metric: string;
  threshold: number;
  action: 'notify' | 'pause' | 'review' | 'kill';
}

/**
 * Escalation policy engine — evaluates runtime metrics against escalation
 * rules and triggers appropriate actions (notify, pause, review, kill).
 */
export class EscalationEngine extends Engine {
  readonly manifest = {
    id: 'process.escalation',
    name: 'Escalation policy',
    category: 'process' as const,
    version: '0.1.0',
    description: 'Evaluates runtime metrics against escalation thresholds',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const rules = (ctx.extensions?.['escalationRules'] as EscalationRule[] | undefined) ?? [];
    const metrics = (ctx.extensions?.['runtimeMetrics'] as Record<string, number> | undefined) ?? {};
    const triggered: Array<{ rule: EscalationRule; value: number }> = [];

    for (const rule of rules) {
      const value = metrics[rule.metric];
      if (value !== undefined && value >= rule.threshold) {
        triggered.push({ rule, value });
      }
    }

    if (triggered.length === 0) {
      return mkResult(this.manifest.id, 'process', 'pass', 'No escalation thresholds breached', start);
    }

    const hasKill = triggered.some(t => t.rule.action === 'kill');
    const hasPause = triggered.some(t => t.rule.action === 'pause');

    const summary = triggered
      .map(t => `${t.rule.metric}=${t.value} (threshold ${t.rule.threshold}, action: ${t.rule.action})`)
      .join('; ');

    if (hasKill) {
      return mkResult(this.manifest.id, 'process', 'fail',
        `Kill-level escalation: ${summary}`, start, { details: { triggered } });
    }
    if (hasPause) {
      return mkResult(this.manifest.id, 'process', 'fail',
        `Pause-level escalation: ${summary}`, start, { details: { triggered } });
    }
    return mkResult(this.manifest.id, 'process', 'warn',
      `Escalation triggered: ${summary}`, start, { details: { triggered } });
  }
}
