import { EventEmitter } from 'node:events';

export type GuardrailProcessEvent =
  | { type: 'engine:start'; engineId: string; contextId: string }
  | { type: 'engine:complete'; engineId: string; contextId: string; verdict: string }
  | { type: 'pipeline:complete'; contextId: string; verdict: string }
  | { type: 'audit'; record: Record<string, unknown> }
  | { type: 'incident'; severity: 'low' | 'medium' | 'high'; detail: Record<string, unknown> }
  | { type: 'monitoring'; metric: string; value: number; tags?: Record<string, string> };

/**
 * Typed event bus for process guardrails (audit, monitoring, incidents).
 */
export class GuardrailEventBus extends EventEmitter {
  emitTyped(event: GuardrailProcessEvent): boolean {
    return this.emit(event.type, event);
  }

  onTyped<K extends GuardrailProcessEvent['type']>(
    type: K,
    listener: (payload: Extract<GuardrailProcessEvent, { type: K }>) => void
  ): this {
    return this.on(type, listener as (...args: unknown[]) => void);
  }
}
