/**
 * @guardrail/llm-safety — Runtime LLM guardrails (SDK + engines + API server).
 */

export * from './core/types.js';
export * from './core/errors.js';
export { Engine } from './core/engine.js';
export { EngineRegistry } from './core/registry.js';
export { Pipeline, runEngineList } from './core/pipeline.js';
export { CircuitBreaker } from './core/circuit-breaker.js';
export { GuardrailEventBus } from './core/event-bus.js';
export { buildContext } from './core/context.js';
export { aggregateVerdict, mergePipelineResult } from './core/result.js';
export {
  loadConfig,
  bundledDefaultConfigPath,
  defaultConfigPath,
  type LlmGuardrailConfig,
} from './core/config.js';

export { Guardrail } from './sdk/guardrail.js';
export { withGuardrails } from './sdk/wrap.js';

export { registerDefaultEngines, listBuiltinEngineIds } from './engines/register-default.js';

// New enterprise engines (v2)
export { CotMonitorEngine } from './engines/behavioral/cot-monitor.js';
export { ConversationBoundaryEngine } from './engines/behavioral/conversation-boundary.js';
export { EscalationEngine } from './engines/process/escalation.js';

export { detectPromptInjection } from './detectors/injection-patterns.js';
export { detectPII } from './detectors/pii-detector.js';
export { detectUnicodeAnomalies } from './detectors/unicode-detector.js';

export { createServer, listenServer } from './server/app.js';
