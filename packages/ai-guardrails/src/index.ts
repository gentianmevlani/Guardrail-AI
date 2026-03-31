/**
 * guardrail AI Guardrails Package
 *
 * World-class guardrails for AI agent behavior across four strategies:
 *
 * INPUT GUARDRAILS — filter & validate what goes into a model
 * - Content policy filtering (prompt injections, jailbreaks, malicious queries)
 * - PII detection and redaction
 * - Input schema validation
 *
 * OUTPUT GUARDRAILS — check what comes out of a model
 * - Toxicity scanning (hate speech, harassment, violence, misinformation)
 * - PII leakage prevention
 * - Policy compliance checking
 * - Factual grounding verification (hallucination detection)
 *
 * BEHAVIORAL GUARDRAILS — constrain how the model acts
 * - Rate limiting (sliding window, burst, token, cost caps)
 * - Tool use policies (allow/deny lists, chain depth, approval gates)
 * - Conversation boundaries (topic adherence, turn limits)
 * - Chain of thought monitoring (drift, loops, manipulation)
 *
 * PROCESS GUARDRAILS — organizational controls
 * - Human-in-the-loop review gates
 * - Kill switch (emergency stop with auto-triggers)
 * - Escalation policies
 * - Red team harness (adversarial testing)
 * - Eval suite runner
 * - Monitoring collector (dashboards & metrics)
 *
 * PIPELINE — unified four-strategy orchestrator
 * - GuardrailPipeline processes requests through all stages
 */

// Four-strategy guardrail modules
export * from './input';
export * from './output';
export * from './behavioral';
export * from './process';

// Unified pipeline orchestrator
export * from './pipeline';

// Legacy / foundational modules
export * from './sandbox';
export * from './injection';
export * from './validation';
export * from './audit';
export * from './firewall';
