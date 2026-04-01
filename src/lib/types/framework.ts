/**
 * Framework Integration Type Definitions
 */

export interface FrameworkAdapter {
  analyze: (projectPath: string) => Promise<{
    components: Array<{
      name: string;
      hasMemo?: boolean;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  getOptimizations: (projectPath: string) => Promise<FrameworkOptimization[]>;
  getPatterns: (projectPath: string) => Promise<FrameworkPattern[]>;
  [key: string]: unknown;
}

export interface FrameworkOptimization {
  type: string;
  description: string;
  impact: string;
  [key: string]: unknown;
}

export interface FrameworkPattern {
  name: string;
  description: string;
  [key: string]: unknown;
}

export interface ProjectStructure {
  frameworks: Array<{
    name: string;
    detected: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}


