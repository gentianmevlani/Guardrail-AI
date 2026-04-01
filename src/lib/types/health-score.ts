/**
 * Health Score Type Definitions
 */

export interface QualityReport {
  predictions: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  trends: Array<{
    trend: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface SmellReport {
  smells: Array<{
    type: string;
    severity: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}


