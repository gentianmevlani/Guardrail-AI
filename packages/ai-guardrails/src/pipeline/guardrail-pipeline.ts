import { EventEmitter } from 'events';
import type {
  GuardrailPipelineConfig,
  GuardrailExecutionSummary,
  GuardrailCategory,
  ContentPolicyResult,
  PIIScanResult,
  InputSchemaResult,
  ToxicityScanResult,
  PIILeakageResult,
  PolicyComplianceResult,
  GroundingResult,
  RateLimitState,
  ToolUseDecision,
  BoundaryCheckResult,
  ChainOfThoughtAnalysis,
  GroundingSource,
  InjectionScanResult,
  InputSanitizationResult,
  TopicScopeResult,
  AuthorizationCheckResult,
  StructuredOutputValidationResult,
  ResourceLimitsCheckResult,
} from '@guardrail/core';

// Input guardrails
import { contentPolicyFilter, ContentPolicyFilter } from '../input/content-policy-filter';
import { piiDetector, PIIDetector } from '../input/pii-detector';
import { inputSchemaValidator, InputSchemaValidator } from '../input/input-schema-validator';
import { inputSanitizer, InputSanitizer } from '../input/input-sanitizer';
import { topicScopeFilter, TopicScopeFilter } from '../input/topic-scope-filter';

// Output guardrails
import { toxicityScanner, ToxicityScanner } from '../output/toxicity-scanner';
import { piiLeakageScanner, PIILeakageScanner } from '../output/pii-leakage-scanner';
import { policyComplianceChecker, PolicyComplianceChecker } from '../output/policy-compliance-checker';
import { factualGroundingVerifier, FactualGroundingVerifier } from '../output/factual-grounding-verifier';
import {
  structuredOutputValidator,
  StructuredOutputValidator,
} from '../output/structured-output-validator';

import { promptInjectionDetector, PromptInjectionDetector } from '../injection/detector';

// Behavioral guardrails
import { agentRateLimiter, AgentRateLimiter } from '../behavioral/rate-limiter';
import { toolUsePolicyEngine, ToolUsePolicyEngine } from '../behavioral/tool-use-policy';
import { conversationBoundaryEnforcer, ConversationBoundaryEnforcer } from '../behavioral/conversation-boundary';
import { chainOfThoughtMonitor, ChainOfThoughtMonitor } from '../behavioral/chain-of-thought-monitor';

// Process guardrails
import { humanReviewGate, HumanReviewGate } from '../process/human-review-gate';
import { killSwitch, KillSwitch } from '../process/kill-switch';
import { monitoringCollector, MonitoringCollector } from '../process/monitoring-collector';

/**
 * Internal result type that extends the public summary with stage-level detail.
 */
interface PipelineBuildPartial {
  inputResults?: ContentPolicyResult & {
    pii: PIIScanResult;
    schema: InputSchemaResult;
    injection?: InjectionScanResult;
    sanitization?: InputSanitizationResult;
    topicScope?: TopicScopeResult;
    authorization?: AuthorizationCheckResult;
  };
  outputResults?: ToxicityScanResult & {
    piiLeakage: PIILeakageResult;
    compliance: PolicyComplianceResult;
    grounding: GroundingResult;
    structuredOutput?: StructuredOutputValidationResult;
  };
  behavioralResults?: {
    rateLimit: RateLimitState;
    toolUse?: ToolUseDecision;
    boundary: BoundaryCheckResult;
    cot: ChainOfThoughtAnalysis;
    resourceLimits?: ResourceLimitsCheckResult;
  };
  processResults?: {
    reviewRequired: boolean;
    killSwitchActive: boolean;
    escalations: string[];
  };
}

/** Stage-level result tracked internally within the pipeline. */
interface StageResult {
  allowed: boolean;
  category: GuardrailCategory;
  stage: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  processingTimeMs: number;
  timestamp: Date;
}

/**
 * GuardrailPipeline — Unified Four-Strategy Orchestrator
 *
 * Wires all 17+ guardrail modules into a single request-processing pipeline:
 *
 *   1. INPUT:      Content policy filter → PII detection → Schema validation
 *   2. BEHAVIORAL: Rate limiting → Tool-use policy → Conversation boundary → Chain-of-thought monitor
 *   3. OUTPUT:     Toxicity scan → PII leakage scan → Policy compliance → Factual grounding
 *   4. PROCESS:    Human review gate → Kill switch check → Monitoring
 *
 * Each stage can independently block, modify, or flag a request. The pipeline
 * produces a unified `GuardrailExecutionSummary` that rolls up every result
 * into a single `allow | block | review | modify` decision.
 */
export class GuardrailPipeline extends EventEmitter {
  // --- Module instances (swappable for testing) ---
  private _contentPolicyFilter: ContentPolicyFilter;
  private _piiDetector: PIIDetector;
  private _inputSchemaValidator: InputSchemaValidator;

  private _toxicityScanner: ToxicityScanner;
  private _piiLeakageScanner: PIILeakageScanner;
  private _policyComplianceChecker: PolicyComplianceChecker;
  private _factualGroundingVerifier: FactualGroundingVerifier;

  private _rateLimiter: AgentRateLimiter;
  private _toolUsePolicyEngine: ToolUsePolicyEngine;
  private _conversationBoundary: ConversationBoundaryEnforcer;
  private _chainOfThoughtMonitor: ChainOfThoughtMonitor;

  private _humanReviewGate: HumanReviewGate;
  private _killSwitch: KillSwitch;
  private _monitoringCollector: MonitoringCollector;

  private _inputSanitizer: InputSanitizer;
  private _topicScopeFilter: TopicScopeFilter;
  private _structuredOutputValidator: StructuredOutputValidator;
  private _promptInjectionDetector: PromptInjectionDetector;

  private config: GuardrailPipelineConfig;
  private requestCounter = 0;

  constructor(config: GuardrailPipelineConfig) {
    super();
    this.config = config;

    // Default to singleton instances — callers can override via setters
    this._contentPolicyFilter = contentPolicyFilter;
    this._piiDetector = piiDetector;
    this._inputSchemaValidator = inputSchemaValidator;

    this._toxicityScanner = toxicityScanner;
    this._piiLeakageScanner = piiLeakageScanner;
    this._policyComplianceChecker = policyComplianceChecker;
    this._factualGroundingVerifier = factualGroundingVerifier;

    this._rateLimiter = agentRateLimiter;
    this._toolUsePolicyEngine = toolUsePolicyEngine;
    this._conversationBoundary = conversationBoundaryEnforcer;
    this._chainOfThoughtMonitor = chainOfThoughtMonitor;

    this._humanReviewGate = humanReviewGate;
    this._killSwitch = killSwitch;
    this._monitoringCollector = monitoringCollector;

    this._inputSanitizer = inputSanitizer;
    this._topicScopeFilter = topicScopeFilter;
    this._structuredOutputValidator = structuredOutputValidator;
    this._promptInjectionDetector = promptInjectionDetector;

    // Apply config to modules
    this.applyConfig(config);
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────

  /**
   * Process a full request through all four guardrail stages.
   *
   * @param input        User/agent input text
   * @param agentId      Identifier for the requesting agent
   * @param options      Optional overrides & additional context
   * @returns            Complete execution summary with per-stage results
   */
  async process(
    input: string,
    agentId: string,
    options?: ProcessOptions,
  ): Promise<GuardrailExecutionSummary> {
    const requestId = `gr_${++this.requestCounter}_${Date.now()}`;
    const startTime = Date.now();
    const stages: StageResult[] = [];

    this.emit('pipeline:start', { requestId, agentId, timestamp: new Date() });

    // ── 0. Kill switch pre-check ──────────────────────────────────
    if (this._killSwitch.isActive(agentId)) {
      const state = this._killSwitch.getState();
      this.recordMetric('requests_blocked', 1, agentId);
      return this.buildSummary(requestId, agentId, 'block', startTime, {
        processResults: {
          reviewRequired: false,
          killSwitchActive: true,
          escalations: [`Kill switch active: ${state.reason}`],
        },
      });
    }

    // ── 1. INPUT GUARDRAILS ───────────────────────────────────────
    let processedInput = input;
    let inputContentResult: ContentPolicyResult | undefined;
    let inputPIIResult: PIIScanResult | undefined;
    let inputSchemaResult: InputSchemaResult | undefined;
    let sanitizationResult: InputSanitizationResult | undefined;
    let injectionResult: InjectionScanResult | undefined;
    let topicScopeResult: TopicScopeResult | undefined;
    let authorizationResult: AuthorizationCheckResult | undefined;
    let resourceLimitsResult: ResourceLimitsCheckResult | undefined;

    // 1a. Sanitization — strip smuggling chars / HTML / normalize before scans
    if (this.config.input.sanitization.enabled) {
      sanitizationResult = this._inputSanitizer.sanitize(
        processedInput,
        this.config.input.sanitization,
      );
      processedInput = sanitizationResult.content;
      stages.push({
        allowed: true,
        category: 'input',
        stage: 'input_sanitization',
        processingTimeMs: sanitizationResult.processingTimeMs,
        timestamp: new Date(),
      });
    }

    // 1b. Resource limits — context / token ceilings (behavioral policy on input size)
    if (this.config.behavioral.resourceLimits.enabled) {
      resourceLimitsResult = this.checkInputResourceLimits(processedInput, options);
      stages.push({
        allowed: resourceLimitsResult.withinLimits,
        category: 'behavioral',
        stage: 'resource_limits',
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (!resourceLimitsResult.withinLimits) {
        this.recordMetric('requests_blocked', 1, agentId);
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: this.assembleInputResults(
            inputContentResult,
            inputPIIResult,
            inputSchemaResult,
            sanitizationResult,
            injectionResult,
            topicScopeResult,
            authorizationResult,
          ),
          behavioralResults: {
            rateLimit: this.emptyRateLimitState(agentId),
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // 1c. Prompt injection detection — direct & indirect patterns
    if (this.config.input.injectionDetection.enabled) {
      injectionResult = await this._promptInjectionDetector.scan({
        content: processedInput,
        contentType: 'user_input',
      });
      stages.push({
        allowed: injectionResult.recommendation.action === 'allow',
        category: 'input',
        stage: 'injection_detection',
        processingTimeMs: injectionResult.scanDuration,
        timestamp: new Date(),
      });

      const injDecision = this.applyInjectionDecision(
        injectionResult,
        this.config.input.injectionDetection.strictMode,
      );
      if (injDecision.block) {
        this.recordMetric('requests_blocked', 1, agentId);
        this.recordMetric('threat_events', 1, agentId);
        this.emit('pipeline:blocked', { requestId, stage: 'input.injection', result: injectionResult });
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: this.assembleInputResults(
            inputContentResult,
            inputPIIResult,
            inputSchemaResult,
            sanitizationResult,
            injectionResult,
            topicScopeResult,
            authorizationResult,
          ),
          behavioralResults: {
            rateLimit: this.emptyRateLimitState(agentId),
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
      if (injDecision.useSanitized && injectionResult.sanitizedContent) {
        processedInput = injectionResult.sanitizedContent;
      }
    }

    // 1d. Content policy filter
    if (this.config.input.contentPolicy.enabled) {
      inputContentResult = await this._contentPolicyFilter.evaluate(processedInput);
      stages.push({
        allowed: inputContentResult.allowed,
        category: 'input',
        stage: 'content_policy',
        processingTimeMs: inputContentResult.processingTimeMs,
        timestamp: new Date(),
      });

      if (!inputContentResult.allowed) {
        this.recordMetric('requests_blocked', 1, agentId);
        this.recordMetric('threat_events', 1, agentId);
        this.emit('pipeline:blocked', { requestId, stage: 'input.content_policy', result: inputContentResult });

        if (inputContentResult.sanitizedContent) {
          processedInput = inputContentResult.sanitizedContent;
        } else {
          return this.buildSummary(requestId, agentId, 'block', startTime, {
            inputResults: this.assembleInputResults(
              inputContentResult,
              inputPIIResult,
              inputSchemaResult,
              sanitizationResult,
              injectionResult,
              topicScopeResult,
              authorizationResult,
            ),
            behavioralResults: {
              rateLimit: this.emptyRateLimitState(agentId),
              boundary: this.emptyBoundaryResult(),
              cot: this.emptyCoTResult(),
              resourceLimits: resourceLimitsResult,
            },
          });
        }
      }
    }

    // 1e. Topic / scope filter
    if (this.config.input.topicScope.enabled) {
      topicScopeResult = this._topicScopeFilter.evaluate(
        processedInput,
        this.config.input.topicScope,
      );
      stages.push({
        allowed: topicScopeResult.inScope,
        category: 'input',
        stage: 'topic_scope',
        processingTimeMs: topicScopeResult.processingTimeMs,
        timestamp: new Date(),
      });

      if (!topicScopeResult.inScope) {
        this.recordMetric('requests_blocked', 1, agentId);
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: this.assembleInputResults(
            inputContentResult,
            inputPIIResult,
            inputSchemaResult,
            sanitizationResult,
            injectionResult,
            topicScopeResult,
            authorizationResult,
          ),
          behavioralResults: {
            rateLimit: this.emptyRateLimitState(agentId),
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // 1f. PII detection
    if (this.config.input.piiDetection.enabled) {
      inputPIIResult = await this._piiDetector.scan(processedInput, {
        redact: this.config.input.piiDetection.redactByDefault,
      });
      stages.push({
        allowed: true, // PII detection redacts but never blocks outright
        category: 'input',
        stage: 'pii_detection',
        processingTimeMs: inputPIIResult.processingTimeMs,
        timestamp: new Date(),
      });

      if (inputPIIResult.containsPII && this.config.input.piiDetection.redactByDefault) {
        processedInput = inputPIIResult.redactedContent;
        this.recordMetric('pii_detections', inputPIIResult.entities.length, agentId);
      }
    }

    // 1g. Input schema validation
    if (this.config.input.schemaValidation.enabled) {
      inputSchemaResult = await this._inputSchemaValidator.validate(processedInput);
      stages.push({
        allowed: inputSchemaResult.valid,
        category: 'input',
        stage: 'schema_validation',
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (!inputSchemaResult.valid) {
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: this.assembleInputResults(
            inputContentResult,
            inputPIIResult,
            inputSchemaResult,
            sanitizationResult,
            injectionResult,
            topicScopeResult,
            authorizationResult,
          ),
          behavioralResults: {
            rateLimit: this.emptyRateLimitState(agentId),
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // 1h. Authorization — app supplies `options.authorize` when enabled
    if (this.config.input.authorization.enabled) {
      if (options?.authorize) {
        authorizationResult = await options.authorize({
          requestId,
          agentId,
          input: processedInput,
        });
      } else {
        authorizationResult = {
          allowed: false,
          reason: 'Authorization required but no authorize() callback was provided',
        };
      }
      stages.push({
        allowed: authorizationResult.allowed,
        category: 'input',
        stage: 'authorization',
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (!authorizationResult.allowed) {
        this.recordMetric('requests_blocked', 1, agentId);
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: this.assembleInputResults(
            inputContentResult,
            inputPIIResult,
            inputSchemaResult,
            sanitizationResult,
            injectionResult,
            topicScopeResult,
            authorizationResult,
          ),
          behavioralResults: {
            rateLimit: this.emptyRateLimitState(agentId),
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    const inputResultsComplete = this.assembleInputResults(
      inputContentResult,
      inputPIIResult,
      inputSchemaResult,
      sanitizationResult,
      injectionResult,
      topicScopeResult,
      authorizationResult,
    );

    // ── 2. BEHAVIORAL GUARDRAILS ──────────────────────────────────
    let rateLimitResult: RateLimitState | undefined;
    let toolUseResult: ToolUseDecision | undefined;
    let boundaryResult: BoundaryCheckResult | undefined;
    let cotResult: ChainOfThoughtAnalysis | undefined;

    // 2a. Rate limiting
    if (this.config.behavioral.rateLimiting.enabled) {
      rateLimitResult = await this._rateLimiter.checkLimit(agentId, options?.tokenCount);
      stages.push({
        allowed: !rateLimitResult.isLimited,
        category: 'behavioral',
        stage: 'rate_limiting',
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (rateLimitResult.isLimited) {
        this.recordMetric('requests_blocked', 1, agentId);
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: inputResultsComplete,
          behavioralResults: {
            rateLimit: rateLimitResult,
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // 2b. Tool use policy (if applicable)
    if (this.config.behavioral.toolUsePolicy.enabled && options?.toolName) {
      toolUseResult = await this._toolUsePolicyEngine.evaluate(agentId, options.toolName, {
        isChained: options.isChainedCall,
        parentTool: options.parentTool,
      });
      stages.push({
        allowed: toolUseResult.allowed,
        category: 'behavioral',
        stage: 'tool_use_policy',
        riskLevel: toolUseResult.riskLevel,
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (!toolUseResult.allowed) {
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: inputResultsComplete,
          behavioralResults: {
            rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
            toolUse: toolUseResult,
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }

      if (toolUseResult.requiresApproval) {
        return this.buildSummary(requestId, agentId, 'review', startTime, {
          inputResults: inputResultsComplete,
          behavioralResults: {
            rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
            toolUse: toolUseResult,
            boundary: this.emptyBoundaryResult(),
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // 2c. Conversation boundary
    if (this.config.behavioral.conversationBoundary.enabled) {
      boundaryResult = await this._conversationBoundary.check(agentId, processedInput, {
        sessionId: options?.sessionId,
      });
      stages.push({
        allowed: boundaryResult.withinBounds,
        category: 'behavioral',
        stage: 'conversation_boundary',
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (!boundaryResult.withinBounds) {
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: inputResultsComplete,
          behavioralResults: {
            rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
            toolUse: toolUseResult,
            boundary: boundaryResult,
            cot: this.emptyCoTResult(),
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // 2d. Chain of thought monitoring (if reasoning step provided)
    if (this.config.behavioral.chainOfThoughtMonitoring.enabled && options?.reasoningStep) {
      cotResult = await this._chainOfThoughtMonitor.recordStep(agentId, options.reasoningStep);
      stages.push({
        allowed: cotResult.recommendation !== 'halt',
        category: 'behavioral',
        stage: 'chain_of_thought',
        processingTimeMs: 0,
        timestamp: new Date(),
      });

      if (cotResult.recommendation === 'halt') {
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: inputResultsComplete,
          behavioralResults: {
            rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
            toolUse: toolUseResult,
            boundary: boundaryResult || this.emptyBoundaryResult(),
            cot: cotResult,
            resourceLimits: resourceLimitsResult,
          },
        });
      }

      if (this.config.behavioral.chainOfThoughtMonitoring.haltOnDrift && cotResult.driftDetected) {
        return this.buildSummary(requestId, agentId, 'block', startTime, {
          inputResults: inputResultsComplete,
          behavioralResults: {
            rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
            toolUse: toolUseResult,
            boundary: boundaryResult || this.emptyBoundaryResult(),
            cot: cotResult,
            resourceLimits: resourceLimitsResult,
          },
        });
      }
    }

    // ── Record the request for rate limiting ──────────────────────
    if (this.config.behavioral.rateLimiting.enabled) {
      await this._rateLimiter.recordRequest(agentId, options?.tokenCount ?? 0, options?.estimatedCost);
    }

    // Record metric for successful input pass
    this.recordMetric('requests_total', 1, agentId);

    // ── At this point, input + behavioral checks have passed ──────
    // The caller would now send `processedInput` to the LLM.
    // Output guardrails run AFTER the LLM responds.
    // If `options.output` is provided, we also run output guardrails.

    let outputText = options?.output;
    let outputToxicityResult: ToxicityScanResult | undefined;
    let outputPIILeakageResult: PIILeakageResult | undefined;
    let outputComplianceResult: PolicyComplianceResult | undefined;
    let outputGroundingResult: GroundingResult | undefined;
    let outputStructuredResult: StructuredOutputValidationResult | undefined;

    if (outputText) {
      // ── 3. OUTPUT GUARDRAILS ──────────────────────────────────
      const behavioralPartial = {
        rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
        toolUse: toolUseResult,
        boundary: boundaryResult || this.emptyBoundaryResult(),
        cot: cotResult || this.emptyCoTResult(),
        resourceLimits: resourceLimitsResult,
      };

      // 3a. Output token ceiling (behavioral guardrail on generation size)
      if (
        this.config.behavioral.resourceLimits.enabled &&
        this.config.behavioral.resourceLimits.maxOutputTokens !== undefined
      ) {
        const outTok =
          options?.outputTokenCount ?? Math.max(1, Math.ceil(outputText.length / 4));
        if (outTok > this.config.behavioral.resourceLimits.maxOutputTokens) {
          this.recordMetric('requests_blocked', 1, agentId);
          return this.buildSummary(requestId, agentId, 'block', startTime, {
            inputResults: inputResultsComplete,
            behavioralResults: {
              ...behavioralPartial,
              resourceLimits: {
                withinLimits: false,
                reason: `Output size ~${outTok} tokens exceeds maxOutputTokens (${this.config.behavioral.resourceLimits.maxOutputTokens})`,
              },
            },
          });
        }
      }

      // 3b. Toxicity scanning
      if (this.config.output.toxicityScanning.enabled) {
        outputToxicityResult = await this._toxicityScanner.scan(outputText);
        stages.push({
          allowed: !outputToxicityResult.isToxic,
          category: 'output',
          stage: 'toxicity',
          processingTimeMs: outputToxicityResult.processingTimeMs,
          timestamp: new Date(),
        });

        if (outputToxicityResult.recommendation === 'block') {
          this.recordMetric('requests_blocked', 1, agentId);
          this._killSwitch.recordMetric('toxicity_score', outputToxicityResult.overallScore);
          return this.buildSummary(requestId, agentId, 'block', startTime, {
            inputResults: inputResultsComplete,
            outputResults: {
              ...outputToxicityResult,
              piiLeakage: this.emptyPIILeakageResult(),
              compliance: this.emptyComplianceResult(),
              grounding: this.emptyGroundingResult(),
            },
          });
        }

        // Feed toxicity score to kill switch for auto-trigger evaluation
        this._killSwitch.recordMetric('toxicity_score', outputToxicityResult.overallScore);
      }

      // 3b. PII leakage prevention
      if (this.config.output.piiLeakagePrevention.enabled) {
        outputPIILeakageResult = await this._piiLeakageScanner.scan(outputText, {
          originalInput: processedInput,
          scrub: this.config.output.piiLeakagePrevention.scrubByDefault,
        });
        stages.push({
          allowed: !outputPIILeakageResult.hasLeakage,
          category: 'output',
          stage: 'pii_leakage',
          processingTimeMs: 0,
          timestamp: new Date(),
        });

        if (outputPIILeakageResult.hasLeakage) {
          this.recordMetric('pii_detections', outputPIILeakageResult.leakedEntities.length, agentId);

          if (this.config.output.piiLeakagePrevention.scrubByDefault) {
            outputText = outputPIILeakageResult.scrubbed;
          } else if (outputPIILeakageResult.riskLevel === 'critical' || outputPIILeakageResult.riskLevel === 'high') {
            return this.buildSummary(requestId, agentId, 'block', startTime, {
              inputResults: inputResultsComplete,
              outputResults: {
                ...(outputToxicityResult || this.emptyToxicityResult()),
                piiLeakage: outputPIILeakageResult,
                compliance: this.emptyComplianceResult(),
                grounding: this.emptyGroundingResult(),
              },
              behavioralResults: behavioralPartial,
            });
          }
        }
      }

      // 3d. Policy compliance
      if (this.config.output.policyCompliance.enabled) {
        outputComplianceResult = await this._policyComplianceChecker.check(outputText);
        stages.push({
          allowed: outputComplianceResult.compliant,
          category: 'output',
          stage: 'policy_compliance',
          processingTimeMs: 0,
          timestamp: new Date(),
        });

        if (!outputComplianceResult.compliant) {
          this.recordMetric('policy_violations', outputComplianceResult.blockedReasons.length, agentId);

          if (outputComplianceResult.overallScore < 0.3) {
            return this.buildSummary(requestId, agentId, 'block', startTime, {
              inputResults: inputResultsComplete,
              outputResults: {
                ...(outputToxicityResult || this.emptyToxicityResult()),
                piiLeakage: outputPIILeakageResult || this.emptyPIILeakageResult(),
                compliance: outputComplianceResult,
                grounding: this.emptyGroundingResult(),
              },
              behavioralResults: behavioralPartial,
            });
          }
        }
      }

      // 3e. Structured output (JSON / required keys) — schema validation for agents
      if (this.config.output.structuredOutput.enabled) {
        outputStructuredResult = this._structuredOutputValidator.validate(
          outputText,
          this.config.output.structuredOutput,
        );
        stages.push({
          allowed: outputStructuredResult.valid,
          category: 'output',
          stage: 'structured_output',
          processingTimeMs: outputStructuredResult.processingTimeMs,
          timestamp: new Date(),
        });

        if (!outputStructuredResult.valid) {
          this.recordMetric('requests_blocked', 1, agentId);
          return this.buildSummary(requestId, agentId, 'block', startTime, {
            inputResults: inputResultsComplete,
            outputResults: {
              ...(outputToxicityResult || this.emptyToxicityResult()),
              piiLeakage: outputPIILeakageResult || this.emptyPIILeakageResult(),
              compliance: outputComplianceResult || this.emptyComplianceResult(),
              grounding: this.emptyGroundingResult(),
              structuredOutput: outputStructuredResult,
            },
            behavioralResults: behavioralPartial,
          });
        }
      }

      // 3f. Factual grounding verification
      const groundingSources =
        options?.groundingSources && options.groundingSources.length > 0
          ? options.groundingSources
          : this.config.output.factualGrounding.sources;

      if (this.config.output.factualGrounding.enabled && groundingSources.length > 0) {
        outputGroundingResult = await this._factualGroundingVerifier.verify(
          outputText,
          groundingSources,
          { threshold: this.config.output.factualGrounding.threshold },
        );
        stages.push({
          allowed: outputGroundingResult.isGrounded,
          category: 'output',
          stage: 'factual_grounding',
          processingTimeMs: outputGroundingResult.processingTimeMs,
          timestamp: new Date(),
        });

        if (outputGroundingResult.recommendation === 'reject') {
          return this.buildSummary(requestId, agentId, 'block', startTime, {
            inputResults: inputResultsComplete,
            outputResults: {
              ...(outputToxicityResult || this.emptyToxicityResult()),
              piiLeakage: outputPIILeakageResult || this.emptyPIILeakageResult(),
              compliance: outputComplianceResult || this.emptyComplianceResult(),
              grounding: outputGroundingResult,
              ...(outputStructuredResult ? { structuredOutput: outputStructuredResult } : {}),
            },
            behavioralResults: behavioralPartial,
          });
        }
      }
    }

    // ── 4. PROCESS GUARDRAILS ─────────────────────────────────────
    let reviewRequired = false;
    const escalations: string[] = [];

    // 4a. Determine if human review is needed
    if (this.config.process.humanReview.enabled) {
      const highestRisk = this.getHighestRiskLevel(stages);
      reviewRequired = this._humanReviewGate.requiresReview(
        highestRisk,
        this.config.process.humanReview.requiredForRiskLevel,
      );

      if (reviewRequired) {
        this.recordMetric('human_reviews_pending', 1, agentId);
      }
    }

    // 4b. Record latency metric
    const latencyMs = Date.now() - startTime;
    this.recordMetric('request_latency_ms', latencyMs, agentId);

    // ── Build final summary ──────────────────────────────────────
    const overallDecision = this.computeOverallDecision(
      reviewRequired,
      outputToxicityResult,
      outputComplianceResult,
      outputGroundingResult,
      cotResult,
    );

    return this.buildSummary(requestId, agentId, overallDecision, startTime, {
      inputResults: {
        ...(inputContentResult || this.emptyContentResult()),
        pii: inputPIIResult || this.emptyPIIScanResult(),
        schema: inputSchemaResult || this.emptySchemaResult(),
      },
      outputResults: outputText
        ? {
            ...(outputToxicityResult || this.emptyToxicityResult()),
            piiLeakage: outputPIILeakageResult || this.emptyPIILeakageResult(),
            compliance: outputComplianceResult || this.emptyComplianceResult(),
            grounding: outputGroundingResult || this.emptyGroundingResult(),
            ...(outputStructuredResult ? { structuredOutput: outputStructuredResult } : {}),
          }
        : undefined,
      behavioralResults: {
        rateLimit: rateLimitResult || this.emptyRateLimitState(agentId),
        toolUse: toolUseResult,
        boundary: boundaryResult || this.emptyBoundaryResult(),
        cot: cotResult || this.emptyCoTResult(),
        resourceLimits: resourceLimitsResult,
      },
      processResults: {
        reviewRequired,
        killSwitchActive: false,
        escalations,
      },
    });
  }

  /**
   * Process only output guardrails (for post-LLM response scanning).
   * Call this after your LLM returns a response.
   */
  async processOutput(
    output: string,
    _agentId: string,
    options?: {
      originalInput?: string;
      sources?: GroundingSource[];
    },
  ): Promise<{
    allowed: boolean;
    toxicity?: ToxicityScanResult;
    piiLeakage?: PIILeakageResult;
    compliance?: PolicyComplianceResult;
    grounding?: GroundingResult;
    decision: 'allow' | 'block' | 'review' | 'modify';
  }> {
    let toxicity: ToxicityScanResult | undefined;
    let piiLeakage: PIILeakageResult | undefined;
    let compliance: PolicyComplianceResult | undefined;
    let grounding: GroundingResult | undefined;

    if (this.config.output.toxicityScanning.enabled) {
      toxicity = await this._toxicityScanner.scan(output);
      if (toxicity.recommendation === 'block') {
        return { allowed: false, toxicity, decision: 'block' };
      }
    }

    if (this.config.output.piiLeakagePrevention.enabled && options?.originalInput) {
      piiLeakage = await this._piiLeakageScanner.scan(output, {
        originalInput: options.originalInput,
      });
      if (piiLeakage.hasLeakage && (piiLeakage.riskLevel === 'critical' || piiLeakage.riskLevel === 'high')) {
        return { allowed: false, toxicity, piiLeakage, decision: 'block' };
      }
    }

    if (this.config.output.policyCompliance.enabled) {
      compliance = await this._policyComplianceChecker.check(output);
    }

    if (this.config.output.factualGrounding.enabled && options?.sources) {
      grounding = await this._factualGroundingVerifier.verify(output, options.sources);
      if (grounding.recommendation === 'reject') {
        return { allowed: false, toxicity, piiLeakage, compliance, grounding, decision: 'block' };
      }
    }

    const needsReview = (toxicity?.recommendation === 'review') ||
                        (grounding?.recommendation === 'review') ||
                        (compliance && !compliance.compliant);

    return {
      allowed: true,
      toxicity,
      piiLeakage,
      compliance,
      grounding,
      decision: needsReview ? 'review' : 'allow',
    };
  }

  /**
   * Update pipeline configuration at runtime.
   */
  updateConfig(config: Partial<GuardrailPipelineConfig>): void {
    this.config = { ...this.config, ...config } as GuardrailPipelineConfig;
    this.applyConfig(this.config);
  }

  /**
   * Get current config.
   */
  getConfig(): GuardrailPipelineConfig {
    return { ...this.config };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────

  private assembleInputResults(
    content: ContentPolicyResult | undefined,
    pii: PIIScanResult | undefined,
    schema: InputSchemaResult | undefined,
    sanitization?: InputSanitizationResult,
    injection?: InjectionScanResult,
    topicScope?: TopicScopeResult,
    authorization?: AuthorizationCheckResult,
  ): GuardrailExecutionSummary['inputResults'] {
    return {
      ...(content || this.emptyContentResult()),
      pii: pii || this.emptyPIIScanResult(),
      schema: schema || this.emptySchemaResult(),
      ...(sanitization ? { sanitization } : {}),
      ...(injection ? { injection } : {}),
      ...(topicScope ? { topicScope } : {}),
      ...(authorization ? { authorization } : {}),
    };
  }

  private applyInjectionDecision(
    result: InjectionScanResult,
    strictMode: boolean,
  ): { block: boolean; useSanitized: boolean } {
    const { action } = result.recommendation;
    if (action === 'block') {
      return { block: true, useSanitized: false };
    }
    if (action === 'sanitize' && result.sanitizedContent) {
      return { block: false, useSanitized: true };
    }
    if (action === 'review') {
      if (strictMode) {
        return { block: true, useSanitized: false };
      }
      return { block: false, useSanitized: false };
    }
    return { block: false, useSanitized: false };
  }

  private checkInputResourceLimits(
    processedInput: string,
    options?: ProcessOptions,
  ): ResourceLimitsCheckResult {
    const cfg = this.config.behavioral.resourceLimits;
    if (!cfg.enabled) {
      return { withinLimits: true };
    }
    const chars = processedInput.length;
    if (cfg.maxContextChars !== undefined && chars > cfg.maxContextChars) {
      return {
        withinLimits: false,
        reason: `Input length ${chars} exceeds maxContextChars (${cfg.maxContextChars})`,
      };
    }
    const estTokens =
      options?.tokenCount ?? Math.max(1, Math.ceil(chars / 4));
    if (cfg.maxInputTokens !== undefined && estTokens > cfg.maxInputTokens) {
      return {
        withinLimits: false,
        reason: `Estimated input tokens ${estTokens} exceed maxInputTokens (${cfg.maxInputTokens})`,
      };
    }
    return { withinLimits: true };
  }

  private applyConfig(config: GuardrailPipelineConfig): void {
    // Apply tool use policy
    if (config.behavioral.toolUsePolicy.enabled) {
      this._toolUsePolicyEngine.setPolicy(
        config.behavioral.toolUsePolicy.policy.agentId,
        config.behavioral.toolUsePolicy.policy,
      );
    }

    // Apply conversation boundary
    if (config.behavioral.conversationBoundary.enabled) {
      this._conversationBoundary.setBoundary(
        config.behavioral.conversationBoundary.boundary.agentId,
        config.behavioral.conversationBoundary.boundary,
      );
    }

    // Apply kill switch config
    if (config.process.killSwitch.enabled) {
      this._killSwitch.updateConfig(config.process.killSwitch);
    }
  }

  private computeOverallDecision(
    reviewRequired: boolean,
    toxicity?: ToxicityScanResult,
    compliance?: PolicyComplianceResult,
    grounding?: GroundingResult,
    cot?: ChainOfThoughtAnalysis,
  ): 'allow' | 'block' | 'review' | 'modify' {
    if (toxicity?.recommendation === 'block') return 'block';
    if (compliance && !compliance.compliant && compliance.overallScore < 0.3) return 'block';
    if (grounding?.recommendation === 'reject') return 'block';
    if (cot?.recommendation === 'halt') return 'block';

    if (reviewRequired) return 'review';
    if (cot?.recommendation === 'review') return 'review';
    if (toxicity?.recommendation === 'review') return 'review';
    if (grounding?.recommendation === 'review') return 'review';

    if (toxicity?.recommendation === 'filter') return 'modify';
    if (grounding?.recommendation === 'flag') return 'modify';

    return 'allow';
  }

  private getHighestRiskLevel(
    results: StageResult[],
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let highest: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    const hierarchy: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    for (const result of results) {
      if (!result.allowed) {
        // Blocked results are at least HIGH risk
        if (hierarchy.indexOf('HIGH') > hierarchy.indexOf(highest)) highest = 'HIGH';
      }

      if (result.riskLevel && hierarchy.indexOf(result.riskLevel) > hierarchy.indexOf(highest)) {
        highest = result.riskLevel;
      }
    }

    return highest;
  }

  private buildSummary(
    requestId: string,
    agentId: string,
    overallDecision: 'allow' | 'block' | 'review' | 'modify',
    startTime: number,
    partial?: PipelineBuildPartial,
  ): GuardrailExecutionSummary {
    const summary: GuardrailExecutionSummary = {
      requestId,
      agentId,
      inputResults: partial?.inputResults || {
        ...this.emptyContentResult(),
        pii: this.emptyPIIScanResult(),
        schema: this.emptySchemaResult(),
      },
      outputResults: partial?.outputResults,
      behavioralResults: partial?.behavioralResults || {
        rateLimit: this.emptyRateLimitState(agentId),
        boundary: this.emptyBoundaryResult(),
        cot: this.emptyCoTResult(),
      },
      processResults: partial?.processResults || {
        reviewRequired: false,
        killSwitchActive: false,
        escalations: [],
      },
      overallDecision,
      totalProcessingTimeMs: Date.now() - startTime,
      timestamp: new Date(),
    };

    this.emit('pipeline:complete', summary);
    return summary;
  }

  private recordMetric(name: string, value: number, agentId: string): void {
    this._monitoringCollector.record({
      name,
      value,
      unit: name.includes('latency') || name.includes('duration') ? 'ms' : 'count',
      tags: {},
      agentId,
    });
  }

  // ─── EMPTY RESULT FACTORIES ──────────────────────────────────────

  private emptyContentResult(): ContentPolicyResult {
    return {
      allowed: true,
      violations: [],
      riskScore: 0,
      categories: [],
      processingTimeMs: 0,
    };
  }

  private emptyPIIScanResult(): PIIScanResult {
    return {
      containsPII: false,
      entities: [],
      redactedContent: '',
      riskLevel: 'none',
      processingTimeMs: 0,
    };
  }

  private emptySchemaResult(): InputSchemaResult {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  private emptyToxicityResult(): ToxicityScanResult {
    return {
      isToxic: false,
      overallScore: 0,
      categories: [],
      recommendation: 'allow',
      processingTimeMs: 0,
    };
  }

  private emptyPIILeakageResult(): PIILeakageResult {
    return {
      hasLeakage: false,
      leakedEntities: [],
      scrubbed: '',
      sourceCorrelation: [],
      riskLevel: 'none',
    };
  }

  private emptyComplianceResult(): PolicyComplianceResult {
    return {
      compliant: true,
      results: [],
      overallScore: 1.0,
      blockedReasons: [],
    };
  }

  private emptyGroundingResult(): GroundingResult {
    return {
      isGrounded: true,
      overallScore: 1.0,
      claims: [],
      ungroundedClaims: [],
      recommendation: 'accept',
      processingTimeMs: 0,
    };
  }

  private emptyRateLimitState(agentId: string): RateLimitState {
    return {
      agentId,
      windowStart: new Date(),
      requestCount: 0,
      tokenCount: 0,
      isLimited: false,
      remainingRequests: 0,
      remainingTokens: 0,
    };
  }

  private emptyBoundaryResult(): BoundaryCheckResult {
    return {
      withinBounds: true,
      violations: [],
      currentTurn: 0,
      topicAdherenceScore: 1.0,
    };
  }

  private emptyCoTResult(): ChainOfThoughtAnalysis {
    return {
      isCoherent: true,
      steps: [],
      driftDetected: false,
      driftScore: 0,
      loopDetected: false,
      manipulationDetected: false,
      recommendation: 'continue',
      flags: [],
    };
  }
}

// ─── TYPES ────────────────────────────────────────────────────────

export interface ProcessOptions {
  /** Optional LLM response to also run through output guardrails */
  output?: string;
  /** Token count for rate limiting */
  tokenCount?: number;
  /** Estimated cost for cost cap enforcement */
  estimatedCost?: number;
  /** Tool name if the request involves tool use */
  toolName?: string;
  /** Whether this is a chained tool call */
  isChainedCall?: boolean;
  /** Parent tool name for chain depth tracking */
  parentTool?: string;
  /** Session ID for conversation boundary tracking */
  sessionId?: string;
  /** Reasoning step for chain-of-thought monitoring */
  reasoningStep?: {
    reasoning: string;
    action?: string;
    confidence: number;
  };
  /** Grounding sources for factual verification (overrides config when set) */
  groundingSources?: GroundingSource[];
  /** Async authorization callback when config.input.authorization.enabled */
  authorize?: (ctx: {
    requestId: string;
    agentId: string;
    input: string;
  }) => Promise<AuthorizationCheckResult>;
  /** Measured or estimated output tokens for resourceLimits.maxOutputTokens */
  outputTokenCount?: number;
}

// ─── FACTORY ──────────────────────────────────────────────────────

/**
 * Create a new GuardrailPipeline with a full configuration.
 */
export function createGuardrailPipeline(config: GuardrailPipelineConfig): GuardrailPipeline {
  return new GuardrailPipeline(config);
}

/**
 * Create a GuardrailPipeline with sensible defaults (all modules enabled).
 */
export function createDefaultPipeline(agentId: string = 'default'): GuardrailPipeline {
  const defaultConfig: GuardrailPipelineConfig = {
    input: {
      contentPolicy: { enabled: true, rules: [] },
      piiDetection: { enabled: true, redactByDefault: true },
      schemaValidation: { enabled: true, rules: { maxLength: 100_000 } },
      injectionDetection: { enabled: true, strictMode: false },
      sanitization: {
        enabled: true,
        stripHtml: true,
        normalizeUnicode: true,
        maxLength: 100_000,
      },
      topicScope: {
        enabled: false,
        allowedTopics: [],
        blockedTopics: [],
        mode: 'lenient',
      },
      authorization: { enabled: false },
    },
    output: {
      toxicityScanning: { enabled: true, threshold: 0.5 },
      piiLeakagePrevention: { enabled: true, scrubByDefault: true },
      policyCompliance: { enabled: true, rules: [] },
      factualGrounding: { enabled: false, threshold: 0.6, sources: [] },
      structuredOutput: { enabled: false, expectJson: false },
    },
    behavioral: {
      rateLimiting: {
        enabled: true,
        config: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          requestsPerDay: 10000,
          tokensPerMinute: 100_000,
          tokensPerHour: 1_000_000,
          burstLimit: 20,
          burstWindowMs: 5000,
        },
      },
      toolUsePolicy: {
        enabled: false,
        policy: {
          agentId,
          allowedTools: [],
          deniedTools: [],
          requireApprovalTools: [],
          allowedAPIs: [],
          deniedAPIs: [],
          maxConcurrentToolCalls: 5,
          allowChainedCalls: true,
          maxChainDepth: 10,
        },
      },
      conversationBoundary: {
        enabled: false,
        boundary: {
          agentId,
          allowedTopics: [],
          blockedTopics: [],
          maxTurns: 100,
          maxContextLength: 500_000,
          requireTopicAdherence: false,
          topicDriftThreshold: 0.3,
          systemPromptLocked: true,
          allowedResponseTypes: ['text', 'code', 'data'],
        },
      },
      chainOfThoughtMonitoring: { enabled: false, haltOnDrift: false },
      resourceLimits: {
        enabled: false,
        maxInputTokens: 200_000,
        maxOutputTokens: 32_000,
        maxContextChars: 500_000,
      },
    },
    process: {
      humanReview: { enabled: true, requiredForRiskLevel: 'CRITICAL' },
      redTeaming: { enabled: false, scenarios: [] },
      evalSuites: { enabled: false, suites: [] },
      killSwitch: {
        enabled: true,
        triggers: [],
        notificationChannels: [],
        autoActivateOn: ['error_rate', 'toxicity_spike', 'cost_overrun'],
        cooldownPeriodMs: 60_000,
      },
      escalation: { enabled: true, rules: [] },
      monitoring: { enabled: true, metricsRetentionDays: 7 },
    },
  };

  return new GuardrailPipeline(defaultConfig);
}
