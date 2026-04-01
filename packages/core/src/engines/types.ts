/**
 * Engine types — formerly from @vibecheck/core, now local to @guardrail/core.
 */

export interface DeltaContext {
  /** Full text content of the document being scanned */
  fullText: string;
  /** URI / file path of the document */
  documentUri: string;
  /** Language identifier (e.g. 'typescript', 'python') */
  documentLanguage?: string;
}

export interface ScanEngine {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedExtensions: Set<string>;
  scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]>;
}

export interface Finding {
  id: string;
  engine: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  file: string;
  line: number;
  column: number;
  message: string;
  evidence: string;
  suggestion: string;
  confidence: number;
  autoFixable: boolean;
}
