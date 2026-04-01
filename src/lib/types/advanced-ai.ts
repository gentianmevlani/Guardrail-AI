/**
 * Advanced AI Type Definitions
 */

export interface CodeContext {
  file?: string;
  projectPath?: string;
  language?: string;
  framework?: string;
  [key: string]: unknown;
}

export interface ProjectMap {
  architecture?: {
    type: 'monolith' | 'microservices' | 'modular' | 'unknown';
    [key: string]: unknown;
  };
  metadata?: {
    totalFiles?: number;
    [key: string]: unknown;
  };
  endpoints?: Array<{
    path: string;
    method: string;
    auth?: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}


