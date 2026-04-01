import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

/** Simple in-memory rate map (production should use Redis). */
const buckets = new Map<string, { count: number; windowStart: number }>();

export class RateLimiterEngine extends Engine {
  readonly manifest = {
    id: 'input.rate-limiter',
    name: 'Rate limiter',
    category: 'input' as const,
    version: '0.1.0',
    description: 'Token-bucket style rate limiting per user/ip key',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const key = (ctx.user?.id as string | undefined) ?? 'anonymous';
    const max = (ctx.extensions?.['rateLimitMax'] as number | undefined) ?? 1000;
    const windowMs = (ctx.extensions?.['rateLimitWindowMs'] as number | undefined) ?? 60_000;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.windowStart > windowMs) {
      b = { count: 0, windowStart: now };
    }
    b.count++;
    buckets.set(key, b);
    if (b.count > max) {
      return mkResult(this.manifest.id, 'input', 'fail', 'Rate limit exceeded', start);
    }
    return mkResult(this.manifest.id, 'input', 'pass', 'Within rate limit', start, {
      metadata: { count: b.count },
    });
  }
}
