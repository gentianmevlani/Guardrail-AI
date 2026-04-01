// ==========================================
// PERMISSION TYPES
// ==========================================

export interface FilesystemPermissions {
  allowedPaths: string[];
  deniedPaths: string[];
  operations: ('read' | 'write' | 'delete' | 'execute')[];
  maxFileSize: number; // in bytes
  [key: string]: unknown;
}

export interface NetworkPermissions {
  allowedDomains: string[];
  deniedDomains: string[];
  maxRequests: number; // per minute
  allowedProtocols: ('http' | 'https' | 'ws' | 'wss')[];
  [key: string]: unknown;
}

export interface ShellPermissions {
  allowedCommands: string[];
  deniedCommands: string[];
  requireConfirmation: string[]; // commands that need user approval
  allowEnvironmentVariables: boolean;
  [key: string]: unknown;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxTokens: number;
  maxExecutionTimeMs: number;
  [key: string]: unknown;
}

export interface AgentPermissionScope {
  filesystem: FilesystemPermissions;
  network: NetworkPermissions;
  shell: ShellPermissions;
  resources: ResourceLimits;
}

// ==========================================
// ACTION TYPES
// ==========================================

export interface FilesystemDetails {
  operation: 'read' | 'write' | 'delete' | 'execute';
  path: string;
  content?: string;
  size?: number;
}

export interface NetworkDetails {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ShellDetails {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export type ActionDetails = FilesystemDetails | NetworkDetails | ShellDetails;

export interface ActionAttempt {
  agentId: string;
  taskId: string;
  actionType: string;
  category: 'code' | 'file' | 'network' | 'shell';
  details: ActionDetails;
  reasoning?: string;
}

export interface ActionDecision {
  allowed: boolean;
  reason: string;
  alternativeSuggestion?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresApproval: boolean;
}

// ==========================================
// EVALUATION TYPES
// ==========================================

export interface Evaluation {
  passed: boolean;
  reason: string;
  violatedRules: string[];
  suggestions: string[];
}

export interface SimpleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==========================================
// CHECKPOINT TYPES
// ==========================================

export interface FileSnapshot {
  path: string;
  originalContent: string;
  originalHash: string;
  [key: string]: unknown;
}

export interface Checkpoint {
  id: string;
  agentId: string;
  taskId: string;
  modifiedFiles: FileSnapshot[];
  resourcesUsed: ResourceUsage;
  createdAt: Date;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  tokensUsed: number;
  executionTimeMs: number;
  apiCalls: number;
  [key: string]: unknown;
}

export interface LimitCheck {
  withinLimits: boolean;
  violations: string[];
  current: ResourceUsage;
  limits: ResourceLimits;
}

export interface RollbackResult {
  success: boolean;
  filesRestored: number;
  errors: string[];
}

// ==========================================
// INJECTION DETECTION TYPES
// ==========================================

export interface InjectionScanRequest {
  content: string;
  contentType: 'user_input' | 'code' | 'data_source';
  context?: {
    source: string;
    metadata?: Record<string, unknown>;
  };
}

export interface Detection {
  type: string;
  pattern: string;
  location: {
    start: number;
    end: number;
    line?: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
}

export interface InjectionScanResult {
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS' | 'BLOCKED';
  confidence: number;
  detections: Detection[];
  sanitizedContent?: string;
  recommendation: {
    action: 'allow' | 'sanitize' | 'block' | 'review';
    reason: string;
  };
  scanDuration: number;
}

export interface ProcessedInput {
  original: string;
  processed: string;
  wasSanitized: boolean;
  detections: Detection[];
}

// ==========================================
// OUTPUT VALIDATION TYPES
// ==========================================

export interface CodeOutput {
  code: string;
  language: string;
  outputType: 'code' | 'config' | 'documentation';
  metadata?: Record<string, unknown>;
}

export interface Context {
  projectPath?: string;
  existingFiles?: string[];
  dependencies?: Record<string, string>;
  framework?: string;
}

export interface StageResult {
  stageName: string;
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  warnings: string[];
  duration: number;
}

export interface ValidationIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface ValidationRequest {
  output: CodeOutput;
  context?: Context;
  request?: string; // original user request
}

export interface DetailedValidationResult {
  verdict: 'ACCEPT' | 'MODIFY' | 'REJECT' | 'HUMAN_REVIEW';
  confidence: number;
  stages: StageResult[];
  overallScore: number;
  modifiedOutput?: string;
  recommendation: string;
}

// ==========================================
// HALLUCINATION DETECTION TYPES
// ==========================================

export interface PackageCheck {
  exists: boolean;
  name: string;
  version?: string;
  registry: string;
  alternativeSuggestions?: string[];
}

export interface APICheck {
  exists: boolean;
  package: string;
  method: string;
  signature?: string;
  documentation?: string;
  alternativeSuggestions?: string[];
}

export interface CodeIntent {
  primary: string;
  secondary: string[];
  entities: string[]; // packages, functions, variables involved
  operations: string[]; // what the code does
}

export interface RequestIntent {
  goal: string;
  constraints: string[];
  expectedEntities: string[];
  expectedOperations: string[];
}

export interface IntentComparison {
  alignmentScore: number;
  matches: string[];
  mismatches: string[];
  recommendation: string;
}

// ==========================================
// AUDIT TYPES
// ==========================================

export interface AuditEvent {
  agentId: string;
  taskId: string;
  correlationId: string;
  sequenceNumber: number;
  actionType: string;
  category: string;
  input?: unknown;
  output?: unknown;
  target?: {
    type: string;
    path?: string;
    url?: string;
  };
  reasoning: {
    summary: string;
    considerations: string[];
    confidence: number;
  };
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'PENDING_APPROVAL' | 'ROLLED_BACK';
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
  impact?: {
    filesModified?: string[];
    linesAdded?: number;
    linesDeleted?: number;
  };
  diff?: {
    before: string;
    after: string;
    unified: string;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  sensitiveData: boolean;
  piiInvolved: boolean;
  duration?: number;
  timestamp: Date;
  previousHash?: string;
  /** Optional structured payload for persistence / hashing (e.g. agent action records). */
  metadata?: Record<string, unknown>;
}

export interface Diff {
  before: string;
  after: string;
  unified: string;
}

export interface CodeGenParams {
  taskId: string;
  agentId: string;
  prompt: string;
  generatedCode: string;
  language: string;
  reasoning: string;
}

export interface CodeModParams {
  taskId: string;
  agentId: string;
  filePath: string;
  originalCode: string;
  modifiedCode: string;
  reasoning: string;
}

export interface ShellParams {
  taskId: string;
  agentId: string;
  command: string;
  args: string[];
  output: string;
  exitCode: number;
}

export interface AuditQuery {
  agentId?: string;
  taskId?: string;
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  actionType?: string;
  status?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  events: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Timeline {
  taskId: string;
  events: AuditEvent[];
  summary: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    blockedActions: number;
    duration: number;
  };
}

export interface Changes {
  filePath: string;
  timestamp: Date;
  diff: Diff;
  agent: string;
  reasoning: string;
}

export interface Attribution {
  projectId: string;
  period: DateRange;
  aiGenerated: {
    lines: number;
    files: number;
    percentage: number;
  };
  humanWritten: {
    lines: number;
    files: number;
    percentage: number;
  };
  breakdown: {
    agent: string;
    lines: number;
    files: number;
  }[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export type ReportType = 'audit' | 'compliance' | 'security' | 'attribution';

export interface Report {
  type: ReportType;
  period: DateRange;
  summary: Record<string, unknown>;
  details: unknown[];
  generatedAt: Date;
}

// ==========================================
// INPUT GUARDRAIL TYPES
// ==========================================

export type ContentCategory =
  | 'prompt_injection'
  | 'jailbreak'
  | 'malicious_query'
  | 'pii_exposure'
  | 'harmful_content'
  | 'off_topic'
  | 'policy_violation';

export interface ContentPolicyRule {
  id: string;
  name: string;
  description: string;
  category: ContentCategory;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns?: string[];
  keywords?: string[];
  customCheck?: (content: string) => boolean;
}

export interface ContentPolicyResult {
  allowed: boolean;
  violations: ContentPolicyViolation[];
  sanitizedContent?: string;
  riskScore: number;
  categories: ContentCategory[];
  processingTimeMs: number;
}

export interface ContentPolicyViolation {
  ruleId: string;
  ruleName: string;
  category: ContentCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  matchedContent?: string;
  location?: { start: number; end: number };
  recommendation: 'allow' | 'sanitize' | 'block' | 'review';
}

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'name'
  | 'ip_address'
  | 'date_of_birth'
  | 'passport'
  | 'driver_license'
  | 'api_key'
  | 'password'
  | 'custom';

export interface PIIEntity {
  type: PIIType;
  value: string;
  redactedValue: string;
  location: { start: number; end: number };
  confidence: number;
}

export interface PIIScanResult {
  containsPII: boolean;
  entities: PIIEntity[];
  redactedContent: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  processingTimeMs: number;
}

export interface InputSchemaRule {
  maxLength?: number;
  minLength?: number;
  allowedLanguages?: string[];
  blockedPatterns?: RegExp[];
  requiredFields?: string[];
  customValidators?: Array<(input: string) => { valid: boolean; reason?: string }>;
}

export interface InputSchemaResult {
  valid: boolean;
  errors: Array<{ field: string; message: string; code: string }>;
  warnings: Array<{ field: string; message: string }>;
  normalizedInput?: string;
}

/** Input sanitization — strip smuggling chars, HTML, normalize whitespace, truncate */
export interface InputSanitizationConfig {
  enabled: boolean;
  stripHtml: boolean;
  normalizeUnicode: boolean;
  /** Hard cap on characters after sanitization */
  maxLength: number;
}

export interface InputSanitizationResult {
  applied: boolean;
  originalLength: number;
  resultLength: number;
  strippedInvisibleCount: number;
  strippedHtmlTags: boolean;
  truncated: boolean;
  content: string;
  processingTimeMs: number;
}

/** Topic / scope gate before the main model (domain allow/block lists) */
export interface TopicScopeConfig {
  enabled: boolean;
  allowedTopics: string[];
  blockedTopics: string[];
  mode: 'strict' | 'lenient';
}

export interface TopicScopeResult {
  inScope: boolean;
  mode: 'strict' | 'lenient';
  matchedAllowed?: string;
  matchedBlocked?: string;
  reason: string;
  processingTimeMs: number;
}

/** App-level authz hook — pipeline calls `options.authorize` when enabled */
export interface AuthorizationCheckResult {
  allowed: boolean;
  reason?: string;
}

/** JSON / schema validation for agentic structured outputs */
export interface StructuredOutputConfig {
  enabled: boolean;
  expectJson: boolean;
  requiredKeys?: string[];
}

export interface StructuredOutputValidationResult {
  valid: boolean;
  errors: string[];
  parsed?: unknown;
  processingTimeMs: number;
}

/** Token and context ceilings (behavioral) */
export interface ResourceLimitsConfig {
  enabled: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxContextChars?: number;
}

export interface ResourceLimitsCheckResult {
  withinLimits: boolean;
  reason?: string;
}

// ==========================================
// OUTPUT GUARDRAIL TYPES
// ==========================================

export type ToxicityCategory =
  | 'hate_speech'
  | 'harassment'
  | 'sexual_content'
  | 'violence'
  | 'self_harm'
  | 'profanity'
  | 'discrimination'
  | 'misinformation';

export interface ToxicityScanResult {
  isToxic: boolean;
  overallScore: number;
  categories: Array<{
    category: ToxicityCategory;
    score: number;
    flagged: boolean;
    evidence: string[];
  }>;
  recommendation: 'allow' | 'filter' | 'block' | 'review';
  processingTimeMs: number;
}

export interface PIILeakageResult {
  hasLeakage: boolean;
  leakedEntities: PIIEntity[];
  scrubbed: string;
  sourceCorrelation: Array<{
    outputEntity: PIIEntity;
    possibleSource: 'user_input' | 'training_data' | 'context' | 'unknown';
  }>;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface PolicyComplianceRule {
  id: string;
  name: string;
  description: string;
  type: 'content' | 'format' | 'scope' | 'attribution' | 'legal';
  check: (output: string, context?: Record<string, unknown>) => PolicyCheckResult;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PolicyCheckResult {
  compliant: boolean;
  violations: string[];
  suggestions: string[];
  confidence: number;
}

export interface PolicyComplianceResult {
  compliant: boolean;
  results: Array<{
    ruleId: string;
    ruleName: string;
    result: PolicyCheckResult;
  }>;
  overallScore: number;
  blockedReasons: string[];
}

export interface GroundingSource {
  id: string;
  type: 'document' | 'context' | 'knowledge_base' | 'user_input';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GroundingClaim {
  claim: string;
  location: { start: number; end: number };
  grounded: boolean;
  confidence: number;
  sources: string[];
  category: 'factual' | 'opinion' | 'instruction' | 'code' | 'unknown';
}

export interface GroundingResult {
  isGrounded: boolean;
  overallScore: number;
  claims: GroundingClaim[];
  ungroundedClaims: GroundingClaim[];
  recommendation: 'accept' | 'flag' | 'reject' | 'review';
  processingTimeMs: number;
}

// ==========================================
// BEHAVIORAL GUARDRAIL TYPES
// ==========================================

export interface AgentRateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerMinute: number;
  tokensPerHour: number;
  burstLimit: number;
  burstWindowMs: number;
  costLimitPerDay?: number;
}

export interface RateLimitState {
  agentId: string;
  windowStart: Date;
  requestCount: number;
  tokenCount: number;
  isLimited: boolean;
  retryAfterMs?: number;
  remainingRequests: number;
  remainingTokens: number;
}

export interface ToolUsePolicy {
  agentId: string;
  allowedTools: string[];
  deniedTools: string[];
  toolCallLimit?: number;
  requireApprovalTools: string[];
  allowedAPIs: string[];
  deniedAPIs: string[];
  maxConcurrentToolCalls: number;
  allowChainedCalls: boolean;
  maxChainDepth: number;
}

export interface ToolUseDecision {
  allowed: boolean;
  reason: string;
  toolName: string;
  requiresApproval: boolean;
  alternativeSuggestion?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ConversationBoundary {
  agentId: string;
  allowedTopics: string[];
  blockedTopics: string[];
  maxTurns: number;
  maxContextLength: number;
  requireTopicAdherence: boolean;
  topicDriftThreshold: number;
  systemPromptLocked: boolean;
  allowedResponseTypes: ('text' | 'code' | 'data' | 'image')[];
}

export interface BoundaryCheckResult {
  withinBounds: boolean;
  violations: Array<{
    type: 'topic_drift' | 'turn_limit' | 'context_overflow' | 'blocked_topic' | 'response_type';
    description: string;
    severity: 'warning' | 'error';
  }>;
  currentTurn: number;
  topicAdherenceScore: number;
}

export interface ChainOfThoughtStep {
  stepNumber: number;
  reasoning: string;
  action?: string;
  confidence: number;
  timestamp: Date;
}

export interface ChainOfThoughtAnalysis {
  isCoherent: boolean;
  steps: ChainOfThoughtStep[];
  driftDetected: boolean;
  driftScore: number;
  loopDetected: boolean;
  manipulationDetected: boolean;
  recommendation: 'continue' | 'redirect' | 'halt' | 'review';
  flags: string[];
}

// ==========================================
// PROCESS GUARDRAIL TYPES
// ==========================================

export type ReviewDecision = 'approve' | 'reject' | 'modify' | 'escalate';

export interface HumanReviewRequest {
  id: string;
  agentId: string;
  taskId: string;
  type: 'action' | 'output' | 'decision' | 'escalation';
  content: unknown;
  context: Record<string, unknown>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  createdAt: Date;
  expiresAt?: Date;
  assignedTo?: string;
  status: 'pending' | 'in_review' | 'decided' | 'expired';
}

export interface HumanReviewResponse {
  requestId: string;
  decision: ReviewDecision;
  reviewerId: string;
  reasoning: string;
  modifications?: unknown;
  timestamp: Date;
}

export interface RedTeamScenario {
  id: string;
  name: string;
  description: string;
  category: 'injection' | 'jailbreak' | 'data_extraction' | 'manipulation' | 'evasion' | 'privilege_escalation';
  inputs: string[];
  expectedBehavior: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RedTeamResult {
  scenarioId: string;
  passed: boolean;
  actualBehavior: string;
  vulnerabilities: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reproducible: boolean;
  }>;
  duration: number;
  timestamp: Date;
}

export interface EvalCase {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string;
  expectedBehavior: string;
  tags: string[];
  category: string;
}

export interface EvalSuiteConfig {
  id: string;
  name: string;
  cases: EvalCase[];
  passThreshold: number;
  parallelExecution: boolean;
  timeout: number;
}

export interface EvalResult {
  caseId: string;
  passed: boolean;
  score: number;
  actualOutput: string;
  reasoning: string;
  duration: number;
  metrics: Record<string, number>;
}

export interface EvalSuiteResult {
  suiteId: string;
  suiteName: string;
  totalCases: number;
  passed: number;
  failed: number;
  skipped: number;
  overallScore: number;
  passRate: number;
  results: EvalResult[];
  duration: number;
  timestamp: Date;
}

export interface KillSwitchConfig {
  enabled: boolean;
  triggers: KillSwitchTrigger[];
  notificationChannels: string[];
  autoActivateOn: Array<'error_rate' | 'toxicity_spike' | 'cost_overrun' | 'manual' | 'anomaly'>;
  cooldownPeriodMs: number;
}

export interface KillSwitchTrigger {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  windowMs: number;
  action: 'pause' | 'stop' | 'rollback' | 'alert';
}

export interface KillSwitchState {
  active: boolean;
  activatedAt?: Date;
  activatedBy: 'system' | 'human' | 'trigger';
  triggerId?: string;
  reason: string;
  affectedAgents: string[];
  resumable: boolean;
}

export interface EscalationRule {
  id: string;
  name: string;
  conditions: Array<{
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    value: number;
  }>;
  action: 'notify' | 'pause_agent' | 'require_review' | 'kill_switch' | 'escalate_to_human';
  target: string;
  cooldownMs: number;
  enabled: boolean;
}

export interface MonitoringMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
  agentId?: string;
}

export interface MonitoringDashboardData {
  timeRange: DateRange;
  metrics: {
    totalRequests: number;
    blockedRequests: number;
    averageLatencyMs: number;
    errorRate: number;
    tokenUsage: number;
    costEstimate: number;
    activeAgents: number;
    threatEvents: number;
    piiDetections: number;
    policyViolations: number;
    humanReviewsPending: number;
    killSwitchActivations: number;
  };
  timeSeries: Array<{
    timestamp: Date;
    requestCount: number;
    blockedCount: number;
    latencyP50: number;
    latencyP99: number;
    errorCount: number;
  }>;
  topViolations: Array<{
    category: string;
    count: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  agentHealth: Array<{
    agentId: string;
    status: 'healthy' | 'degraded' | 'critical' | 'stopped';
    requestCount: number;
    errorRate: number;
    lastActive: Date;
  }>;
}

// ==========================================
// UNIFIED GUARDRAIL PIPELINE TYPES
// ==========================================

export type GuardrailCategory = 'input' | 'output' | 'behavioral' | 'process';

export interface GuardrailPipelineConfig {
  input: {
    contentPolicy: { enabled: boolean; rules: ContentPolicyRule[] };
    piiDetection: { enabled: boolean; redactByDefault: boolean; allowedTypes?: PIIType[] };
    schemaValidation: { enabled: boolean; rules: InputSchemaRule };
    injectionDetection: { enabled: boolean; strictMode: boolean };
    sanitization: InputSanitizationConfig;
    topicScope: TopicScopeConfig;
    authorization: { enabled: boolean };
  };
  output: {
    toxicityScanning: { enabled: boolean; threshold: number };
    piiLeakagePrevention: { enabled: boolean; scrubByDefault: boolean };
    policyCompliance: { enabled: boolean; rules: PolicyComplianceRule[] };
    factualGrounding: { enabled: boolean; threshold: number; sources: GroundingSource[] };
    structuredOutput: StructuredOutputConfig;
  };
  behavioral: {
    rateLimiting: { enabled: boolean; config: AgentRateLimitConfig };
    toolUsePolicy: { enabled: boolean; policy: ToolUsePolicy };
    conversationBoundary: { enabled: boolean; boundary: ConversationBoundary };
    chainOfThoughtMonitoring: { enabled: boolean; haltOnDrift: boolean };
    resourceLimits: ResourceLimitsConfig;
  };
  process: {
    humanReview: { enabled: boolean; requiredForRiskLevel: 'HIGH' | 'CRITICAL' };
    redTeaming: { enabled: boolean; scenarios: RedTeamScenario[] };
    evalSuites: { enabled: boolean; suites: EvalSuiteConfig[] };
    killSwitch: KillSwitchConfig;
    escalation: { enabled: boolean; rules: EscalationRule[] };
    monitoring: { enabled: boolean; metricsRetentionDays: number };
  };
}

export interface GuardrailPipelineResult {
  allowed: boolean;
  category: GuardrailCategory;
  stage: string;
  details: Record<string, unknown>;
  processingTimeMs: number;
  timestamp: Date;
}

export interface GuardrailExecutionSummary {
  requestId: string;
  agentId: string;
  inputResults: ContentPolicyResult & {
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
  behavioralResults: {
    rateLimit: RateLimitState;
    toolUse?: ToolUseDecision;
    boundary: BoundaryCheckResult;
    cot: ChainOfThoughtAnalysis;
    resourceLimits?: ResourceLimitsCheckResult;
  };
  processResults: { reviewRequired: boolean; killSwitchActive: boolean; escalations: string[] };
  overallDecision: 'allow' | 'block' | 'review' | 'modify';
  totalProcessingTimeMs: number;
  timestamp: Date;
}
