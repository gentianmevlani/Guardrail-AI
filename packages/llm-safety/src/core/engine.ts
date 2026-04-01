import type { EngineManifest, GuardrailContext, GuardrailResult } from './types.js';

/**
 * Abstract base for all guardrail engines.
 */
export abstract class Engine {
  abstract readonly manifest: EngineManifest;

  abstract analyze(context: GuardrailContext): Promise<GuardrailResult>;

  async initialize(_config: Record<string, unknown>): Promise<void> {
    /* optional override */
  }

  async shutdown(): Promise<void> {
    /* optional override */
  }
}
