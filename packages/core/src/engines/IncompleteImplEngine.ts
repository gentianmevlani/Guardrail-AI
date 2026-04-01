/**
 * IncompleteImplEngine — Guardrail-exclusive
 *
 * Detects incomplete implementations commonly left by AI code generators:
 * - TODO/FIXME/HACK/XXX comments
 * - Placeholder return values
 * - Stub functions
 * - NotImplementedError throws
 * - Ellipsis or pass-through patterns
 */

import type { Finding, DeltaContext, ScanEngine } from '@vibecheck/core';

export class IncompleteImplEngine implements ScanEngine {
  readonly id = 'incomplete_impl' as const;
  readonly name = 'Incomplete Implementation Engine';
  readonly version = '1.0.0';
  readonly supportedExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java',
  ]);

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = delta.fullText.split('\n');
    const uri = delta.documentUri;

    for (let i = 0; i < lines.length; i++) {
      if (signal.aborted) break;
      const line = lines[i]!;
      const trimmed = line.trim();

      // TODO/FIXME/HACK/XXX comments
      const todoMatch = trimmed.match(/\/\/\s*(TODO|FIXME|HACK|XXX|TEMP|PLACEHOLDER)\s*[:\-]?\s*(.*)/i);
      if (todoMatch) {
        const tag = todoMatch[1]!.toUpperCase();
        const severity = tag === 'FIXME' || tag === 'HACK' ? 'high' : 'medium';
        findings.push(this.createFinding(uri, i + 1, `${tag.toLowerCase()}-comment`, severity,
          `${tag} comment found: "${todoMatch[2]?.trim() || 'no description'}"`,
          line, `Implement the ${tag} before shipping`));
      }

      // Placeholder return values
      if (/return\s+(?:null|undefined|void 0|\[\]|\{\}|''|""|0|false|-1)\s*;?\s*\/\//.test(trimmed) ||
          /return\s+(?:null|undefined)\s*;?\s*$/.test(trimmed)) {
        // Check if this is inside a function that should return something meaningful
        const contextLine = this.findEnclosingFunction(lines, i);
        if (contextLine && !contextLine.includes('void') && !contextLine.includes('cleanup')) {
          findings.push(this.createFinding(uri, i + 1, 'placeholder-return', 'medium',
            'Placeholder return value — likely needs real implementation',
            line, 'Replace with actual implementation logic'));
        }
      }

      // Stub function bodies
      if (/(?:function|=>)\s*\{?\s*$/.test(trimmed)) {
        const nextLine = lines[i + 1]?.trim() ?? '';
        if (nextLine === '}' || nextLine === '};' || nextLine === '') {
          findings.push(this.createFinding(uri, i + 1, 'stub-function', 'high',
            'Empty function body — likely a stub that needs implementation',
            line, 'Add implementation logic'));
        }
      }

      // NotImplementedError / "not implemented" throws
      if (/throw\s+new\s+(?:Error|NotImplementedError)\s*\(\s*['"`].*(?:not implemented|todo|placeholder|stub)/i.test(trimmed)) {
        findings.push(this.createFinding(uri, i + 1, 'not-implemented-throw', 'high',
          'Function throws "not implemented" error — needs real implementation',
          line, 'Implement the function body'));
      }

      // Python-style pass
      if (trimmed === 'pass' && delta.documentLanguage === 'python') {
        findings.push(this.createFinding(uri, i + 1, 'python-pass', 'medium',
          'Python `pass` statement — likely a placeholder',
          line, 'Add implementation logic'));
      }

      // "..." or "// ..." placeholder
      if (trimmed === '...' || trimmed === '// ...' || trimmed === '/* ... */') {
        findings.push(this.createFinding(uri, i + 1, 'ellipsis-placeholder', 'high',
          'Ellipsis placeholder — incomplete implementation',
          line, 'Replace with actual implementation'));
      }

      // "Add your code here" type comments
      if (/\/\/\s*(?:add|put|insert|write|implement|your)\s+(?:code|logic|implementation)\s+here/i.test(trimmed)) {
        findings.push(this.createFinding(uri, i + 1, 'placeholder-comment', 'high',
          'Placeholder comment indicating missing implementation',
          line, 'Implement the required logic'));
      }

      // console.log as the only statement in a function
      if (/console\.log\s*\(\s*['"`](?:todo|implement|placeholder|stub|fixme)/i.test(trimmed)) {
        findings.push(this.createFinding(uri, i + 1, 'console-placeholder', 'medium',
          'Console.log used as placeholder for unimplemented logic',
          line, 'Replace with actual implementation'));
      }
    }

    return findings;
  }

  private findEnclosingFunction(lines: string[], lineIndex: number): string | null {
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 20); i--) {
      const line = lines[i]!.trim();
      if (/(?:function|async|const|let|var)\s+\w+\s*[=(]/.test(line) ||
          /(?:public|private|protected|static)?\s*(?:async\s+)?\w+\s*\(/.test(line)) {
        return line;
      }
    }
    return null;
  }

  private createFinding(
    file: string, line: number, ruleId: string,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    message: string, evidence: string, suggestion: string
  ): Finding {
    return {
      id: `impl_${ruleId}_${line}`,
      engine: 'incomplete_impl' as any,
      severity,
      category: 'incomplete-implementation',
      file,
      line,
      column: 1,
      message,
      evidence: evidence.trim(),
      suggestion,
      confidence: 0.8,
      autoFixable: false,
    };
  }
}
