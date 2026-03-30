/**
 * Polish Service Types
 * 
 * Shared types for the polish service system
 */

export interface PolishIssue {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion: string;
  autoFixable: boolean;
  fix?: () => Promise<void>;
}

export interface PolishReport {
  projectPath: string;
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: PolishIssue[];
  score: number; // 0-100
  recommendations: string[];
}

/**
 * Base interface for polish checkers
 */
export interface PolishChecker {
  /**
   * Check for polish issues in the project
   */
  check(projectPath: string): Promise<PolishIssue[]>;
  
  /**
   * Get the category name for this checker
   */
  getCategory(): string;
}


