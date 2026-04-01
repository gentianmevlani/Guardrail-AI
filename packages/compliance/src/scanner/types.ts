export interface PolicyRule {
  id: string;
  controlId: string;
  framework: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  evaluate: (context: EvaluationContext) => Promise<RuleResult>;
  remediation: string;
}

export interface EvaluationContext {
  projectPath: string;
  files: Map<string, string>;
  config: ProjectConfig;
  dependencies: Record<string, string>;
}

export interface ProjectConfig {
  hasAuth: boolean;
  hasEncryption: boolean;
  hasLogging: boolean;
  hasMonitoring: boolean;
  hasRBAC: boolean;
  hasVersionControl: boolean;
  hasCICD: boolean;
  hasSecrets: boolean;
  hasBackup: boolean;
  hasAuditLog: boolean;
}

export interface RuleResult {
  passed: boolean;
  controlId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  evidenceRefs: string[];
  remediation: string;
  metadata?: Record<string, any>;
}

export interface ComplianceScanResult {
  runId: string;
  timestamp: Date;
  projectPath: string;
  framework: string;
  summary: {
    totalRules: number;
    passed: number;
    failed: number;
    score: number;
  };
  results: RuleResult[];
  evidence: EvidenceCollection;
  drift?: DriftAnalysis;
}

export interface EvidenceCollection {
  runId: string;
  timestamp: Date;
  artifacts: EvidenceArtifact[];
}

export interface EvidenceArtifact {
  type: 'config' | 'file-check' | 'dependency' | 'scan-result';
  path: string;
  description: string;
  content?: string;
  metadata: Record<string, any>;
}

export interface DriftAnalysis {
  previousRunId?: string;
  scoreDelta: number;
  newFailures: string[];
  newPasses: string[];
  regressions: RegressionItem[];
}

export interface RegressionItem {
  controlId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  previousStatus: 'passed' | 'failed';
  currentStatus: 'passed' | 'failed';
}

export interface HistoryEntry {
  runId: string;
  timestamp: string;
  framework: string;
  score: number;
  passed: number;
  failed: number;
  totalRules: number;
}

export interface PolicyDefinition {
  version: string;
  framework: string;
  rules: PolicyRuleDefinition[];
}

export interface PolicyRuleDefinition {
  id: string;
  controlId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  checks: CheckDefinition[];
  remediation: string;
}

export interface CheckDefinition {
  type: 'file-exists' | 'dependency-present' | 'config-value' | 'pattern-match' | 'custom';
  target?: string;
  pattern?: string;
  expected?: any;
  customCheck?: string;
}
