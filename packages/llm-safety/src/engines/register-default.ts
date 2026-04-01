import type { EngineRegistry } from '../core/registry.js';
import type { LlmGuardrailConfig } from '../core/config.js';
import { PromptInjectionEngine } from './input/prompt-injection.js';
import { SanitizationEngine } from './input/sanitization.js';
import { TopicFilterEngine } from './input/topic-filter.js';
import { AuthCheckEngine } from './input/auth-check.js';
import { RateLimiterEngine } from './input/rate-limiter.js';
import { HallucinationEngine } from './output/hallucination.js';
import { ToxicityEngine } from './output/toxicity.js';
import { PIILeakageEngine } from './output/pii-leakage.js';
import { FactualGroundingEngine } from './output/factual-grounding.js';
import { SchemaValidationEngine } from './output/schema-validation.js';
import { ContentPolicyEngine } from './output/content-policy.js';
import { TokenLimitEngine } from './behavioral/token-limit.js';
import { ToolRestrictionEngine } from './behavioral/tool-restriction.js';
import { SandboxEngine } from './behavioral/sandbox.js';
import { ActionGateEngine } from './behavioral/action-gate.js';
import { ScopeBoundaryEngine } from './behavioral/scope-boundary.js';
import { RetryPolicyEngine } from './behavioral/retry-policy.js';
import { CotMonitorEngine } from './behavioral/cot-monitor.js';
import { ConversationBoundaryEngine } from './behavioral/conversation-boundary.js';
import { HumanReviewEngine } from './process/human-review.js';
import { RedTeamEngine } from './process/red-team.js';
import { EvalSuiteEngine } from './process/eval-suite.js';
import { MonitoringEngine } from './process/monitoring.js';
import { KillSwitchEngine } from './process/kill-switch.js';
import { AuditTrailEngine } from './process/audit-trail.js';
import { IncidentResponseEngine } from './process/incident-response.js';
import { EscalationEngine } from './process/escalation.js';
import type { Engine } from '../core/engine.js';

const ALL: Engine[] = [
  new PromptInjectionEngine(),
  new SanitizationEngine(),
  new TopicFilterEngine(),
  new AuthCheckEngine(),
  new RateLimiterEngine(),
  new HallucinationEngine(),
  new ToxicityEngine(),
  new PIILeakageEngine(),
  new FactualGroundingEngine(),
  new SchemaValidationEngine(),
  new ContentPolicyEngine(),
  new TokenLimitEngine(),
  new ToolRestrictionEngine(),
  new SandboxEngine(),
  new ActionGateEngine(),
  new ScopeBoundaryEngine(),
  new RetryPolicyEngine(),
  new CotMonitorEngine(),
  new ConversationBoundaryEngine(),
  new HumanReviewEngine(),
  new RedTeamEngine(),
  new EvalSuiteEngine(),
  new MonitoringEngine(),
  new KillSwitchEngine(),
  new AuditTrailEngine(),
  new IncidentResponseEngine(),
  new EscalationEngine(),
];

/**
 * Registers all 27 built-in engines on the registry.
 */
export function registerDefaultEngines(registry: EngineRegistry, config?: LlmGuardrailConfig): void {
  const engCfg = config?.engines ?? {};
  for (const engine of ALL) {
    const id = engine.manifest.id;
    const c = engCfg[id];
    registry.register(engine, {
      enabled: c?.enabled ?? true,
      priority: c?.priority ?? 100,
    });
  }
}

export function listBuiltinEngineIds(): string[] {
  return ALL.map((e) => e.manifest.id);
}
