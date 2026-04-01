import type { Engine } from './engine.js';
import type {
  GuardrailCategory,
  GuardrailContext,
  GuardrailResult,
  PipelineMode,
  PipelineResult,
} from './types.js';
import { EngineRegistry } from './registry.js';
import { mergePipelineResult } from './result.js';
import { GuardrailEventBus } from './event-bus.js';

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Runs an ordered chain of engines for a category.
 */
export class Pipeline {
  constructor(
    private readonly _registry: EngineRegistry,
    private readonly _category: GuardrailCategory,
    private readonly _mode: PipelineMode,
    private readonly _events?: GuardrailEventBus
  ) {}

  async run(context: GuardrailContext): Promise<PipelineResult> {
    const engines = this._registry.listByCategory(this._category).map((r) => r.engine);
    const results: GuardrailResult[] = [];
    const skipped: string[] = [];
    const t0 = nowMs();

    for (const engine of engines) {
      const reg = this._registry.get(engine.manifest.id);
      if (!reg?.enabled) {
        skipped.push(engine.manifest.id);
        continue;
      }

      const breaker = this._registry.getBreaker(engine.manifest.id);
      if (breaker && !breaker.tryAllow()) {
        skipped.push(engine.manifest.id);
        continue;
      }

      this._events?.emitTyped({
        type: 'engine:start',
        engineId: engine.manifest.id,
        contextId: context.id,
      });

      const start = nowMs();
      try {
        const ctx: GuardrailContext = { ...context, category: this._category };
        const result = await engine.analyze(ctx);
        results.push(result);
        breaker?.recordSuccess();

        this._events?.emitTyped({
          type: 'engine:complete',
          engineId: engine.manifest.id,
          contextId: context.id,
          verdict: result.verdict,
        });

        if (this._mode === 'fail-fast' && result.verdict === 'fail') {
          break;
        }
      } catch (err) {
        breaker?.recordFailure();
        const latencyMs = nowMs() - start;
        results.push({
          engineId: engine.manifest.id,
          category: this._category,
          verdict: 'fail',
          confidence: 1,
          message: err instanceof Error ? err.message : String(err),
          latencyMs,
          details: { error: true },
        });
        if (this._mode === 'fail-fast') {
          break;
        }
      }
    }

    const totalLatencyMs = nowMs() - t0;
    const merged = mergePipelineResult({
      contextId: context.id,
      results,
      skipped,
      totalLatencyMs,
    });

    this._events?.emitTyped({
      type: 'pipeline:complete',
      contextId: context.id,
      verdict: merged.verdict,
    });

    return merged;
  }
}

/** Build a one-off pipeline from explicit engine list (tests / custom stacks). */
export async function runEngineList(
  engines: Engine[],
  context: GuardrailContext,
  mode: PipelineMode
): Promise<PipelineResult> {
  const results: GuardrailResult[] = [];
  const skipped: string[] = [];
  const t0 = nowMs();

  for (const engine of engines) {
    const start = nowMs();
    try {
      const result = await engine.analyze(context);
      results.push(result);
      if (mode === 'fail-fast' && result.verdict === 'fail') break;
    } catch (err) {
      results.push({
        engineId: engine.manifest.id,
        category: engine.manifest.category,
        verdict: 'fail',
        confidence: 1,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: nowMs() - start,
      });
      if (mode === 'fail-fast') break;
    }
  }

  return mergePipelineResult({
    contextId: context.id,
    results,
    skipped,
    totalLatencyMs: nowMs() - t0,
  });
}
