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
