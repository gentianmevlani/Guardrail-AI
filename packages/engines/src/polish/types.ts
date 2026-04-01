/**
 * Polish Scanner Type Definitions
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface PolishIssue {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
  autoFixable: boolean;
  confidence?: number;
  aiPrompt?: string;
}

export interface PolishReport {
  projectPath: string;
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: PolishIssue[];
  score: number;
  recommendations: string[];
}

export type PolishEngine = (projectPath: string) => Promise<PolishIssue[]>;

export interface ProjectType {
  isNextJs: boolean;
  isRemix: boolean;
  isVite: boolean;
  isAstro: boolean;
  isLibrary: boolean;
  isCli: boolean;
  isApi: boolean;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
  hasSrc: boolean;
  uiLibrary: string | null;
  skipFrontend: boolean;
}
