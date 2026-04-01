import type { Engine } from './engine.js';
import type { EngineManifest, GuardrailCategory } from './types.js';
import { CircuitBreaker } from './circuit-breaker.js';

export interface RegisteredEngine {
  engine: Engine;
  enabled: boolean;
  priority: number;
}

/**
 * Central registry for engine discovery and lifecycle.
 */
export class EngineRegistry {
  private readonly _engines = new Map<string, RegisteredEngine>();
  private readonly _breakers = new Map<string, CircuitBreaker>();

  register(engine: Engine, options: { enabled?: boolean; priority?: number } = {}): void {
    const id = engine.manifest.id;
    this._engines.set(id, {
      engine,
      enabled: options.enabled ?? true,
      priority: options.priority ?? 100,
    });
    if (!this._breakers.has(id)) {
      this._breakers.set(id, new CircuitBreaker());
    }
  }

  unregister(id: string): void {
    this._engines.delete(id);
    this._breakers.get(id)?.dispose();
    this._breakers.delete(id);
  }

  get(id: string): RegisteredEngine | undefined {
    return this._engines.get(id);
  }

  getBreaker(id: string): CircuitBreaker | undefined {
    return this._breakers.get(id);
  }

  listManifests(): EngineManifest[] {
    return [...this._engines.values()]
      .filter((e) => e.enabled)
      .sort((a, b) => a.priority - b.priority)
      .map((e) => e.engine.manifest);
  }

  listByCategory(category: GuardrailCategory): RegisteredEngine[] {
    return [...this._engines.values()]
      .filter((e) => e.enabled && e.engine.manifest.category === category)
      .sort((a, b) => a.priority - b.priority);
  }

  setEnabled(id: string, enabled: boolean): void {
    const r = this._engines.get(id);
    if (r) r.enabled = enabled;
  }

  async shutdownAll(): Promise<void> {
    for (const { engine } of this._engines.values()) {
      await engine.shutdown?.();
    }
    for (const b of this._breakers.values()) {
      b.dispose();
    }
    this._engines.clear();
    this._breakers.clear();
  }
}
