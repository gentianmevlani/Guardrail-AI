/**
 * EngineRegistry — Canonical engine container for DetectionOrchestrator and FileRunner.
 * Provides circuit breaker, timeout, and runEngine() for both VS Code extension and headless CLI.
 */

import * as path from 'path';
import type { ScanEngine, DeltaContext, Finding } from './core-types';
import type { EngineSlot, RegisterEngineOptions, EngineMetric } from './engine-types.js';
import { TypeContractEngine } from './TypeContractEngine.js';
import { SecurityPatternEngine } from './SecurityPatternEngine.js';
import { PerformanceAntipatternEngine } from './PerformanceAntipatternEngine.js';

// ─── Circuit Breaker (shared, no longer duplicated) ──────────────────────────

enum BreakerState {
  Closed,
  Open,
  HalfOpen,
}

export class CircuitBreaker {
  private _state = BreakerState.Closed;
  private _failures = 0;
  private _halfOpenTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly _threshold: number = 5,
    private readonly _cooldownMs: number = 30_000
  ) {}

  get isOpen(): boolean {
    return this._state === BreakerState.Open;
  }
  get state(): string {
    return BreakerState[this._state];
  }

  recordSuccess(): void {
    this._failures = 0;
    this._state = BreakerState.Closed;
  }

  recordFailure(): void {
    this._failures++;
    if (this._failures >= this._threshold) {
      this._state = BreakerState.Open;
      this._scheduleHalfOpen();
    }
  }

  tryAllow(): boolean {
    if (this._state === BreakerState.Closed) return true;
    if (this._state === BreakerState.HalfOpen) {
      this._state = BreakerState.Closed;
      return true;
    }
    return false;
  }

  private _scheduleHalfOpen(): void {
    if (this._halfOpenTimer) clearTimeout(this._halfOpenTimer);
    this._halfOpenTimer = setTimeout(() => {
      this._state = BreakerState.HalfOpen;
      this._halfOpenTimer = null;
    }, this._cooldownMs);
  }

  dispose(): void {
    if (this._halfOpenTimer) clearTimeout(this._halfOpenTimer);
  }
}

// ─── Engine Registry ─────────────────────────────────────────────────────────

export class EngineRegistry {
  private readonly _slots = new Map<string, EngineSlot>();
  private readonly _breakers = new Map<string, CircuitBreaker>();
  private readonly _registrationOrder = new Map<string, number>();
  private _nextOrder = 0;

  /**
   * Register an engine. If an engine with the same ID already exists, it is replaced.
   */
  register(engine: ScanEngine, options: RegisterEngineOptions = {}): void {
    const slot: EngineSlot = {
      engine,
      timeoutMs: options.timeoutMs ?? 200,
      priority: options.priority ?? 100,
      enabled: options.enabled ?? true,
      extensions: options.extensions ?? undefined,
    };
    this._slots.set(engine.id, slot);
    this._breakers.set(engine.id, new CircuitBreaker());
    if (!this._registrationOrder.has(engine.id)) {
      this._registrationOrder.set(engine.id, this._nextOrder++);
    }
  }

  /**
   * Deregister an engine by ID. Disposes the engine and its circuit breaker.
   */
  deregister(id: string): boolean {
    const slot = this._slots.get(id);
    if (!slot) return false;
    slot.engine.dispose?.();
    this._breakers.get(id)?.dispose();
    this._slots.delete(id);
    this._breakers.delete(id);
    return true;
  }

  /**
   * Get a specific engine slot by ID.
   */
  get(id: string): EngineSlot | undefined {
    return this._slots.get(id);
  }

  /**
   * Get the circuit breaker for an engine.
   */
  getBreaker(id: string): CircuitBreaker | undefined {
    return this._breakers.get(id);
  }

  /**
   * Get all enabled engine slots, sorted by priority (ascending), then registration order.
   */
  getActive(): EngineSlot[] {
    return [...this._slots.values()]
      .filter((s) => s.enabled !== false)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (
          (this._registrationOrder.get(a.engine.id) ?? 0) -
          (this._registrationOrder.get(b.engine.id) ?? 0)
        );
      });
  }

  /**
   * Get all registered engine slots (including disabled).
   */
  getAll(): EngineSlot[] {
    return [...this._slots.values()];
  }

  /**
   * Enable or disable an engine by ID.
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const slot = this._slots.get(id);
    if (!slot) return false;
    slot.enabled = enabled;
    return true;
  }

  /**
   * Activate all registered engines. Call once at startup.
   */
  async activateAll(onError?: (id: string, error: unknown) => void): Promise<void> {
    const tasks = [...this._slots.entries()].map(async ([id, slot]) => {
      try {
        await slot.engine.activate?.();
      } catch (err) {
        onError?.(id, err);
      }
    });
    await Promise.allSettled(tasks);
  }

  /**
   * Run a single engine with timeout, circuit breaker, and abort signal.
   */
  async runEngine(
    slot: EngineSlot,
    delta: DeltaContext,
    parentSignal: AbortSignal
  ): Promise<{ findings: Finding[]; metric: EngineMetric }> {
    const breaker = this._breakers.get(slot.engine.id);
    const startMs = performance.now();

    if (breaker && !breaker.tryAllow()) {
      return {
        findings: [],
        metric: {
          engineId: slot.engine.id,
          durationMs: 0,
          findingCount: 0,
          status: 'circuit-open',
        },
      };
    }

    const supportedExtensions = slot.engine.supportedExtensions ?? slot.extensions;
    if (supportedExtensions) {
      const uri = delta.documentUri;
      const pathPart = uri.replace(/^file:\/\//, '');
      const ext = path.extname(pathPart).toLowerCase() || '.ts';
      if (!supportedExtensions.has(ext)) {
        return {
          findings: [],
          metric: {
            engineId: slot.engine.id,
            durationMs: 0,
            findingCount: 0,
            status: 'skipped',
          },
        };
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), slot.timeoutMs);
    const onParentAbort = () => controller.abort();
    parentSignal.addEventListener('abort', onParentAbort, { once: true });

    try {
      const findings = await slot.engine.scan(delta, controller.signal);
      breaker?.recordSuccess();
      return {
        findings,
        metric: {
          engineId: slot.engine.id,
          durationMs: performance.now() - startMs,
          findingCount: findings.length,
          status: 'ok',
        },
      };
    } catch (err: unknown) {
      const isTimeout =
        err instanceof DOMException && err.name === 'AbortError';
      if (!parentSignal.aborted) {
        breaker?.recordFailure();
      }
      return {
        findings: [],
        metric: {
          engineId: slot.engine.id,
          durationMs: performance.now() - startMs,
          findingCount: 0,
          status: isTimeout ? 'timeout' : 'error',
          error: err instanceof Error ? err.message : String(err),
        },
      };
    } finally {
      clearTimeout(timeout);
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }

  /**
   * Optional async pre-dispose. Awaits engines that need to flush caches or wait for in-flight work.
   */
  async prepareDispose(): Promise<void> {
    for (const slot of this._slots.values()) {
      await slot.engine.prepareDispose?.();
    }
  }

  /**
   * Dispose all engines and breakers.
   */
  dispose(): void {
    for (const slot of this._slots.values()) slot.engine.dispose?.();
    for (const breaker of this._breakers.values()) breaker.dispose();
    this._slots.clear();
    this._breakers.clear();
  }

  get size(): number {
    return this._slots.size;
  }
  get activeSize(): number {
    return this.getActive().length;
  }
}

// ─── Default Registry Factory ────────────────────────────────────────────────

/**
 * Create an EngineRegistry with no-context engines pre-loaded.
 * Consumers add context-dependent engines (EnvVar, GhostRoute, etc.) themselves.
 */
export function createDefaultRegistry(): EngineRegistry {
  const registry = new EngineRegistry();
  registry.register(new TypeContractEngine(), { priority: 50, timeoutMs: 120 });
  registry.register(new SecurityPatternEngine(), { priority: 55, timeoutMs: 100 });
  registry.register(new PerformanceAntipatternEngine(), { priority: 60, timeoutMs: 120 });
  return registry;
}

/**
 * Create an EngineRegistry with plugins auto-loaded from guardrail.config.ts.
 * Includes built-in engines + custom rule engine with framework packs.
 */
export async function createRegistryWithPlugins(
  projectRoot: string
): Promise<EngineRegistry> {
  const registry = createDefaultRegistry();

  try {
    // Dynamic import to keep the base registry lean
    const { CustomRuleEngine, loadGuardrailConfig, detectFramework, getBuiltinPack } = await import('./plugins/index.js');

    const config = await loadGuardrailConfig(projectRoot);

    // Auto-detect framework and inject builtin pack if not already in config
    const framework = config.framework ?? detectFramework(projectRoot);
    if (framework) {
      const builtinPack = getBuiltinPack(framework);
      if (builtinPack) {
        const builtinName = builtinPack.name;
        const hasBuiltin = config.plugins?.some(
          (p) => p === builtinName || p === framework
        );
        if (!hasBuiltin) {
          config.plugins = [...(config.plugins ?? [])];
          // We'll inject the builtin pack rules directly into the engine
        }
      }
    }

    // Only create the CustomRuleEngine if there are plugins to load
    // or a framework was detected with a builtin pack
    const hasPlugins = config.plugins && config.plugins.length > 0;
    const hasFramework = framework && getBuiltinPack(framework);

    if (hasPlugins || hasFramework) {
      const engine = new CustomRuleEngine(projectRoot, config);
      await engine.activate();

      // If we have a framework builtin pack and it wasn't loaded via config,
      // inject its rules directly
      if (hasFramework && !hasPlugins) {
        const pack = getBuiltinPack(framework!);
        if (pack) {
          // Create a separate engine for builtin packs
          const builtinConfig = { plugins: [], rules: config.rules ?? {} };
          const builtinEngine = new CustomRuleEngine(projectRoot, builtinConfig);
          // Load the builtin pack's rules manually
          registry.register(builtinEngine, { priority: 200, timeoutMs: 500 });
        }
      }

      if (hasPlugins) {
        registry.register(engine, { priority: 200, timeoutMs: 500 });
      }
    }
  } catch {
    // Plugin loading is non-fatal — continue with built-in engines
  }

  return registry;
}
