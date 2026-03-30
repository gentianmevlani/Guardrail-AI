/**
 * BaseEngine — Shared helpers for detection engines.
 * New engines (TypeContract, SecurityPattern, PerformanceAntipattern) extend this.
 * Existing engines (APITruth, EnvVar, PhantomDep, GhostRoute) implement ScanEngine directly.
 */

import type { ScanEngine, Finding, DeltaContext } from './core-types';

export abstract class BaseEngine implements ScanEngine {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supportedExtensions: Set<string> | null;

  abstract scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]>;

  /**
   * Helper: check if the AbortSignal has fired. Call this in hot loops.
   * Throws if aborted so the engine exits immediately.
   */
  protected checkAbort(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new DOMException('Engine scan aborted', 'AbortError');
    }
  }

  /**
   * Helper: create a Finding with defaults filled in.
   */
  protected createFinding(
    partial: Omit<Finding, 'engine' | 'category'> &
      Partial<Pick<Finding, 'engine' | 'category'>>
  ): Finding {
    return {
      ...partial,
      engine: (partial.engine ?? this.id) as Finding['engine'],
      category: partial.category ?? 'hallucination',
      severity: partial.severity ?? 'medium',
      autoFixable: partial.autoFixable ?? false,
      confidence: partial.confidence ?? 0.8,
    };
  }

  /**
   * Helper: deterministic finding ID using FNV-1a hash.
   * Stable across re-scans so diagnostics don't flicker.
   */
  protected deterministicId(
    uri: string,
    line: number,
    col: number,
    ruleId: string,
    evidence: string
  ): string {
    const input = `${uri}::${line}::${col}::${ruleId}::${evidence}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Helper: extract all import specifiers from source text.
   * Handles static imports, dynamic imports, require().
   */
  protected extractImports(source: string): string[] {
    const imports: string[] = [];
    const staticRe = /(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const dynamicRe = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = staticRe.exec(source))) imports.push(m[1]!);
    while ((m = dynamicRe.exec(source))) imports.push(m[1]!);
    return imports;
  }

  /** Override for async initialization. */
  async activate(): Promise<void> {}

  /** Override for cleanup. */
  dispose(): void {}

  /** Override for stats. */
  getStats(): Record<string, unknown> {
    return {};
  }
}
