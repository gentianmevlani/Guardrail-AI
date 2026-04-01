/**
 * Pattern Learner Type Definitions
 */

export interface PatternSuggestion {
  pattern: string;
  description: string;
  examples: string[];
  confidence: number;
  [key: string]: unknown;
}


