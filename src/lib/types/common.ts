/**
 * Common Type Definitions
 * 
 * Shared types used across multiple modules
 */

import type { CodebaseKnowledge } from '../codebase-knowledge';

/**
 * Knowledge base type - can be CodebaseKnowledge or a partial representation
 */
export type KnowledgeBase = CodebaseKnowledge | Partial<CodebaseKnowledge>;

/**
 * Search results from knowledge base
 */
export interface KnowledgeSearchResults {
  patterns: Array<{
    id: string;
    name: string;
    description: string;
    examples: string[];
    frequency: number;
  }>;
  decisions: Array<{
    id: string;
    question: string;
    decision: string;
    rationale: string;
    date: string;
  }>;
  files: string[];
  score: number;
}

/**
 * Generic API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Generic endpoint definition
 */
export interface EndpointDefinition {
  method: string;
  path: string;
  bodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  auth?: boolean;
}

/**
 * Package.json structure (partial)
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  bin?: Record<string, string> | string;
}

/**
 * Generic workflow/template data
 */
export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface TemplateData {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}


