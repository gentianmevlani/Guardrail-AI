import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

interface CotStep {
  stepNumber: number;
  reasoning: string;
  confidence: number;
}

/**
 * Chain-of-thought monitor — detects reasoning drift, loops, and manipulation
 * in multi-step LLM reasoning chains.
 */
export class CotMonitorEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.cot-monitor',
    name: 'Chain-of-thought monitor',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Detects reasoning drift, loops, and manipulation in chain-of-thought',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const steps: CotStep[] = (ctx.extensions?.['cotSteps'] as CotStep[] | undefined) ?? [];
    const flags: string[] = [];

    if (steps.length === 0) {
      return mkResult(this.manifest.id, 'behavioral', 'pass', 'No CoT steps to evaluate', start);
    }

    if (steps.length > 20) flags.push('excessive_steps');

    if (this.detectLoop(steps)) flags.push('reasoning_loop');
    if (this.detectDrift(steps)) flags.push('reasoning_drift');
    if (this.detectManipulation(steps)) flags.push('manipulation_attempt');

    const avgConfidence = steps.reduce((s, st) => s + st.confidence, 0) / steps.length;
    if (avgConfidence < 0.3) flags.push('low_confidence');

    if (flags.includes('manipulation_attempt')) {
      return mkResult(this.manifest.id, 'behavioral', 'fail',
        `CoT manipulation detected: ${flags.join(', ')}`, start, { details: { flags } });
    }
    if (flags.length > 0) {
      return mkResult(this.manifest.id, 'behavioral', 'warn',
        `CoT issues: ${flags.join(', ')}`, start, { details: { flags } });
    }
    return mkResult(this.manifest.id, 'behavioral', 'pass', 'CoT reasoning coherent', start);
  }

  private detectLoop(steps: CotStep[]): boolean {
    if (steps.length < 4) return false;
    const recent = steps.slice(-4).map(s => s.reasoning.trim().toLowerCase());
    return new Set(recent).size <= 2;
  }

  private detectDrift(steps: CotStep[]): boolean {
    if (steps.length < 3) return false;
    const firstWords = new Set(steps[0]!.reasoning.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    const recentWords = new Set(
      steps.slice(-3).flatMap(s => s.reasoning.toLowerCase().split(/\s+/).filter(w => w.length > 4))
    );
    const overlap = [...firstWords].filter(w => recentWords.has(w)).length;
    return firstWords.size > 0 && overlap / firstWords.size < 0.1;
  }

  private detectManipulation(steps: CotStep[]): boolean {
    const patterns = [
      /ignore\s+(?:previous|prior|all)\s+(?:instructions|rules)/i,
      /pretend\s+(?:you|that)/i,
      /you\s+are\s+now\s+(?:a|an|in)/i,
      /override\s+(?:your|the)\s+(?:safety|rules)/i,
    ];
    return steps.some(s => patterns.some(p => p.test(s.reasoning)));
  }
}
