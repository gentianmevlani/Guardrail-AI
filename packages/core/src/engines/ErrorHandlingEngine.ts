/**
 * ErrorHandlingEngine — Guardrail-exclusive
 *
 * Detects missing or inadequate error handling in AI-generated code:
 * - Unhandled promise rejections
 * - Empty catch blocks
 * - Missing try/catch around async operations
 * - Swallowed errors
 * - Missing error boundaries in React components
 */

import type { Finding, DeltaContext, ScanEngine } from '@vibecheck/core';

export class ErrorHandlingEngine implements ScanEngine {
  readonly id = 'error_handling' as const;
  readonly name = 'Error Handling Engine';
  readonly version = '1.0.0';
  readonly supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = delta.fullText.split('\n');
    const uri = delta.documentUri;

    for (let i = 0; i < lines.length; i++) {
      if (signal.aborted) break;
      const line = lines[i]!;
      const trimmed = line.trim();

      // Empty catch blocks
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(trimmed) ||
          (trimmed === '}' && i > 0 && /catch\s*\([^)]*\)\s*\{\s*$/.test(lines[i - 1]!.trim()))) {
        findings.push(this.createFinding(uri, i + 1, 'empty-catch', 'high',
          'Empty catch block swallows errors silently',
          line, 'Add error logging or re-throw the error'));
      }

      // catch with only console.log (no re-throw or proper handling)
      if (/catch\s*\([^)]*\)\s*\{/.test(trimmed)) {
        const nextLine = lines[i + 1]?.trim() ?? '';
        const lineAfter = lines[i + 2]?.trim() ?? '';
        if (/^\s*console\.(log|warn)\(/.test(nextLine) && lineAfter === '}') {
          findings.push(this.createFinding(uri, i + 1, 'weak-catch', 'medium',
            'Catch block only logs error without proper handling or re-throwing',
            line, 'Consider re-throwing, returning an error result, or using console.error'));
        }
      }

      // Unhandled async function (no try/catch wrapping)
      if (/async\s+(?:function\s+\w+|[\w]+)\s*\(/.test(trimmed) && !trimmed.includes('test') && !trimmed.includes('spec')) {
        const functionBody = this.extractFunctionBody(lines, i);
        if (functionBody.hasAwait && !functionBody.hasTryCatch && !functionBody.hasErrorCallback) {
          findings.push(this.createFinding(uri, i + 1, 'unhandled-async', 'medium',
            'Async function contains await but no try/catch for error handling',
            line, 'Wrap await calls in try/catch or add .catch() handler'));
        }
      }

      // .then() without .catch()
      if (/\.then\s*\(/.test(trimmed) && !trimmed.includes('.catch') && !trimmed.includes('await')) {
        // Check next few lines for .catch
        let hasCatch = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j]!.includes('.catch')) { hasCatch = true; break; }
        }
        if (!hasCatch) {
          findings.push(this.createFinding(uri, i + 1, 'promise-no-catch', 'high',
            'Promise chain uses .then() without .catch() — unhandled rejection risk',
            line, 'Add .catch() handler or use async/await with try/catch'));
        }
      }

      // React component without ErrorBoundary check
      if (/export\s+(?:default\s+)?(?:function|class)\s+\w+.*(?:React\.Component|extends Component)/.test(trimmed)) {
        if (!delta.fullText.includes('ErrorBoundary') && !delta.fullText.includes('componentDidCatch')) {
          findings.push(this.createFinding(uri, i + 1, 'no-error-boundary', 'low',
            'React class component without ErrorBoundary or componentDidCatch',
            line, 'Consider wrapping with an ErrorBoundary component'));
        }
      }

      // throw without Error object
      if (/throw\s+['"`]/.test(trimmed) || /throw\s+\d/.test(trimmed)) {
        findings.push(this.createFinding(uri, i + 1, 'throw-non-error', 'medium',
          'Throwing a non-Error value — stack trace will be lost',
          line, 'Use throw new Error("message") instead'));
      }
    }

    return findings;
  }

  private extractFunctionBody(lines: string[], startLine: number): {
    hasAwait: boolean;
    hasTryCatch: boolean;
    hasErrorCallback: boolean;
  } {
    let braceCount = 0;
    let started = false;
    let hasAwait = false;
    let hasTryCatch = false;
    let hasErrorCallback = false;

    for (let i = startLine; i < Math.min(startLine + 50, lines.length); i++) {
      const line = lines[i]!;
      for (const ch of line) {
        if (ch === '{') { braceCount++; started = true; }
        if (ch === '}') braceCount--;
      }
      if (line.includes('await ')) hasAwait = true;
      if (/try\s*\{/.test(line)) hasTryCatch = true;
      if (line.includes('.catch(') || line.includes('onError') || line.includes('onRejected')) {
        hasErrorCallback = true;
      }
      if (started && braceCount === 0) break;
    }

    return { hasAwait, hasTryCatch, hasErrorCallback };
  }

  private createFinding(
    file: string, line: number, ruleId: string,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    message: string, evidence: string, suggestion: string
  ): Finding {
    return {
      id: `err_${ruleId}_${line}`,
      engine: 'error_handling' as any,
      severity,
      category: 'error-handling',
      file,
      line,
      column: 1,
      message,
      evidence: evidence.trim(),
      suggestion,
      confidence: 0.85,
      autoFixable: ruleId === 'throw-non-error',
    };
  }
}
