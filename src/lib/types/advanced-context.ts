/**
 * Advanced Context Manager Type Definitions
 */

// Note: CodebaseKnowledge import removed to avoid build errors
// The type is defined locally to avoid cross-package dependencies
// import type { CodebaseKnowledge } from '../codebase-knowledge';

export interface CodebaseKnowledge {
  [key: string]: unknown;
}

export type KnowledgeBase = CodebaseKnowledge | Partial<CodebaseKnowledge>;


