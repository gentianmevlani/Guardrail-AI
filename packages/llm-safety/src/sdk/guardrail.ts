import { randomUUID } from 'node:crypto';
import { EngineRegistry } from '../core/registry.js';
import { Pipeline } from '../core/pipeline.js';
import { GuardrailEventBus } from '../core/event-bus.js';
import { buildContext } from '../core/context.js';
import { loadConfig, type LlmGuardrailConfig } from '../core/config.js';
import { registerDefaultEngines } from '../engines/register-default.js';
import type { GuardrailContext, PipelineResult, PipelineMode } from '../core/types.js';

export interface GuardrailOptions {
  /** YAML file path. If omitted, loads bundled `config/default.yaml` when present, else in-memory defaults. */
  configPath?: string;
  config?: LlmGuardrailConfig;
}

/**
 * Fluent SDK entrypoint for runtime LLM guardrails.
 */
export class Guardrail {
  private constructor(
    private readonly _registry: EngineRegistry,
    private readonly _mode: PipelineMode,
    readonly events: GuardrailEventBus,
    readonly config: LlmGuardrailConfig
  ) {}

  static async create(options: GuardrailOptions = {}): Promise<Guardrail> {
    const config = options.config ?? loadConfig(options.configPath);
    const registry = new EngineRegistry();
    registerDefaultEngines(registry, config);
    const mode: PipelineMode = config.pipelineMode === 'fail-fast' ? 'fail-fast' : 'collect-all';
    return new Guardrail(registry, mode, new GuardrailEventBus(), config);
  }

  private _ctx(
    partial: Partial<GuardrailContext> & { category: GuardrailContext['category'] }
  ): GuardrailContext {
    return buildContext({
      ...partial,
      id: partial.id ?? randomUUID(),
      extensions: { ...partial.extensions, eventBus: this.events },
    });
  }

  checkInput(
    partial: Partial<GuardrailContext> & { input: string }
  ): Promise<PipelineResult> {
    const ctx = this._ctx({ ...partial, category: 'input' });
    return new Pipeline(this._registry, 'input', this._mode, this.events).run(ctx);
  }

  checkOutput(
    partial: Partial<GuardrailContext> & { output: string }
  ): Promise<PipelineResult> {
    const ctx = this._ctx({ ...partial, category: 'output' });
    return new Pipeline(this._registry, 'output', this._mode, this.events).run(ctx);
  }

  checkBehavior(partial: Partial<GuardrailContext>): Promise<PipelineResult> {
    const ctx = this._ctx({ ...partial, category: 'behavioral' });
    return new Pipeline(this._registry, 'behavioral', this._mode, this.events).run(ctx);
  }

  checkProcess(partial: Partial<GuardrailContext>): Promise<PipelineResult> {
    const ctx = this._ctx({ ...partial, category: 'process' });
    return new Pipeline(this._registry, 'process', this._mode, this.events).run(ctx);
  }

  getRegistry(): EngineRegistry {
    return this._registry;
  }

  async shutdown(): Promise<void> {
    await this._registry.shutdownAll();
  }
}
