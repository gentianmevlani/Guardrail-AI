/**
 * Guardrail Pipeline — Unified Four-Strategy Orchestrator
 *
 * The central entry point for processing requests through all guardrail strategies:
 * - Input guardrails (content policy, PII detection, schema validation, injection detection)
 * - Behavioral guardrails (rate limiting, tool use, conversation boundary, CoT monitoring)
 * - Output guardrails (toxicity, PII leakage, policy compliance, factual grounding)
 * - Process guardrails (human review, kill switch, escalation, monitoring)
 */

export {
  GuardrailPipeline,
  createGuardrailPipeline,
  createDefaultPipeline,
} from './guardrail-pipeline';

export type { ProcessOptions } from './guardrail-pipeline';
