/**
 * Fix Packs Types
 * 
 * First-class objects that group findings into actionable batches.
 * Used by CLI, Autopilot, and Verified AutoFix.
 */

import { Tier } from '../tier-config';

// ============================================================================
// FINDING CATEGORY ENUM
// ============================================================================

export const FINDING_CATEGORIES = [
  'secrets',
  'routes',
  'mocks',
  'auth',
  'placeholders',
  'deps',
  'types',
  'tests',
  'security',
  'performance',
] as const;

export type FindingCategory = typeof FINDING_CATEGORIES[number];

// ============================================================================
// SEVERITY LEVELS
// ============================================================================

export const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type SeverityLevel = typeof SEVERITY_LEVELS[number];

export const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// ============================================================================
// FIX STRATEGY
// ============================================================================

export const FIX_STRATEGIES = [
  'auto',           // Fully automated fix
  'guided',         // AI-guided with human review
  'manual',         // Requires manual intervention
  'ai-assisted',    // AI generates suggestions
] as const;

export type FixStrategy = typeof FIX_STRATEGIES[number];

// ============================================================================
// FINDING INTERFACE
// ============================================================================

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: SeverityLevel;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  suggestion?: string;
  rule?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// FIX PACK INTERFACE
// ============================================================================

export interface FixPack {
  id: string;
  title: string;
  severity: SeverityLevel;
  findings: Finding[];
  files: string[];
  strategy: FixStrategy;
  estimatedImpact: EstimatedImpact;
  requiresHumanReview: boolean;
  category: FindingCategory;
  createdAt: string;
  metadata?: FixPackMetadata;
}

export interface EstimatedImpact {
  filesAffected: number;
  linesChanged: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  timeEstimateMinutes: number;
}

export interface FixPackMetadata {
  repoFingerprint?: string;
  generatedBy?: string;
  version?: string;
  tags?: string[];
}

// ============================================================================
// REPO FINGERPRINT
// ============================================================================

export interface RepoFingerprint {
  id: string;
  name: string;
  framework?: string;
  language?: string;
  hasTypeScript: boolean;
  hasTests: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  gitRemote?: string;
  hash: string;
}

// ============================================================================
// GENERATOR OPTIONS
// ============================================================================

export interface GenerateFixPacksOptions {
  findings: Finding[];
  repoFingerprint: RepoFingerprint;
  groupByCategory?: boolean;
  groupByFileProximity?: boolean;
  maxPackSize?: number;
  minPackSize?: number;
  requiredTier?: Tier;
}

export interface GenerateFixPacksResult {
  packs: FixPack[];
  ungrouped: Finding[];
  stats: {
    totalFindings: number;
    totalPacks: number;
    byCategory: Record<FindingCategory, number>;
    bySeverity: Record<SeverityLevel, number>;
  };
}

// ============================================================================
// FIX PACK EXECUTION
// ============================================================================

export interface FixPackExecutionOptions {
  pack: FixPack;
  projectPath: string;
  dryRun?: boolean;
  autoApply?: boolean;
  maxAttempts?: number;
  onProgress?: (stage: string, message: string) => void;
}

export interface FixPackExecutionResult {
  success: boolean;
  packId: string;
  appliedFixes: number;
  skippedFixes: number;
  errors: string[];
  duration: number;
  filesModified: string[];
  diffs: Array<{
    file: string;
    content: string;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function compareSeverity(a: SeverityLevel, b: SeverityLevel): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

export function isHigherSeverity(a: SeverityLevel, b: SeverityLevel): boolean {
  return compareSeverity(a, b) < 0;
}

export function getHighestSeverity(severities: SeverityLevel[]): SeverityLevel {
  if (severities.length === 0) return 'info';
  return severities.reduce((highest, current) => 
    isHigherSeverity(current, highest) ? current : highest
  );
}

export function generatePackId(category: FindingCategory, index: number, hash: string): string {
  const categoryPrefix = category.slice(0, 3).toUpperCase();
  const hashSuffix = hash.slice(0, 6);
  return `FP-${categoryPrefix}-${String(index).padStart(3, '0')}-${hashSuffix}`;
}

export function sortPacksBySeverity(packs: FixPack[]): FixPack[] {
  return [...packs].sort((a, b) => compareSeverity(a.severity, b.severity));
}
