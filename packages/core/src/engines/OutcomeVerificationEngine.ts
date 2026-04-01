/**
 * OutcomeVerificationEngine — Guardrail-exclusive
 *
 * Verifies that AI-generated code actually achieves its stated intent:
 * - Function names vs actual behavior mismatch
 * - JSDoc/comment claims vs implementation gaps
 * - Test assertions that don't actually test anything
 * - Dead code paths that can never execute
 * - Misleading variable names
 */

import type { Finding, DeltaContext, ScanEngine } from './types';

export class OutcomeVerificationEngine implements ScanEngine {
  readonly id = 'outcome_verification' as const;
  readonly name = 'Outcome Verification Engine';
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

      // Test that doesn't assert anything
      if (/(?:it|test)\s*\(\s*['"`]/.test(trimmed)) {
        const testBody = this.extractBlock(lines, i);
        if (!testBody.includes('expect(') && !testBody.includes('assert')
            && !testBody.includes('should') && !testBody.includes('toBe')
            && !testBody.includes('toEqual') && !testBody.includes('toThrow')
            && !testBody.includes('rejects') && !testBody.includes('resolves')) {
          findings.push(this.createFinding(uri, i + 1, 'assertionless-test', 'high',
            'Test case has no assertions — it will always pass',
            line, 'Add expect() assertions to verify the expected behavior'));
        }
      }

      // Function name implies return but doesn't return
      const funcMatch = trimmed.match(/(?:function|const|let)\s+(get|fetch|find|compute|calculate|is|has|can|should|check|validate)\w*\s*[=(]/);
      if (funcMatch) {
        const funcBody = this.extractBlock(lines, i);
        const prefix = funcMatch[1]!;

        if ((prefix === 'get' || prefix === 'fetch' || prefix === 'find' || prefix === 'compute' || prefix === 'calculate')
            && !funcBody.includes('return ') && !funcBody.includes('=>')) {
          findings.push(this.createFinding(uri, i + 1, 'name-return-mismatch', 'high',
            `Function name starts with "${prefix}" but has no return statement`,
            line, 'Add a return statement or rename the function'));
        }

        if ((prefix === 'is' || prefix === 'has' || prefix === 'can' || prefix === 'should' || prefix === 'check' || prefix === 'validate')
            && funcBody.includes('return ') && !funcBody.includes('return true') && !funcBody.includes('return false')
            && !funcBody.includes('boolean') && !funcBody.includes('Boolean')) {
          // Check if it returns a boolean-like value
          const returnStatements = funcBody.match(/return\s+[^;]+/g) || [];
          const nonBoolReturns = returnStatements.filter(r =>
            !r.includes('true') && !r.includes('false') && !r.includes('===') && !r.includes('!==')
            && !r.includes('>') && !r.includes('<') && !r.includes('&&') && !r.includes('||'));
          if (nonBoolReturns.length > 0) {
            findings.push(this.createFinding(uri, i + 1, 'name-type-mismatch', 'medium',
              `Function name "${prefix}..." implies boolean return but returns non-boolean`,
              line, 'Ensure the function returns a boolean value'));
          }
        }
      }

      // JSDoc @returns but function doesn't return
      if (trimmed.startsWith('* @returns') || trimmed.startsWith('* @return')) {
        // Find the function this documents
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const funcLine = lines[j]!.trim();
          if (/(?:function|async|const|let|=>\s*\{)/.test(funcLine)) {
            const funcBody = this.extractBlock(lines, j);
            if (!funcBody.includes('return ')) {
              findings.push(this.createFinding(uri, i + 1, 'jsdoc-return-mismatch', 'medium',
                'JSDoc claims @returns but the function has no return statement',
                trimmed, 'Either add a return statement or remove the @returns tag'));
            }
            break;
          }
        }
      }

      // Conditional that's always true/false
      if (/if\s*\(\s*(true|false|1|0|''|"")\s*\)/.test(trimmed)) {
        findings.push(this.createFinding(uri, i + 1, 'constant-condition', 'high',
          'Conditional expression is always the same value — dead or unreachable code',
          line, 'Remove the conditional or fix the logic'));
      }

      // Variable named "result" or "data" that's never used after assignment
      if (/(?:const|let|var)\s+(result|data|response|output|value)\s*=/.test(trimmed)) {
        const varName = RegExp.$1;
        // Check if the variable is used later in the function
        let usedLater = false;
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
          const laterLine = lines[j]!;
          if (laterLine.includes(varName) && !laterLine.trim().startsWith('//')) {
            usedLater = true;
            break;
          }
          if (laterLine.trim() === '}') break; // End of scope
        }
        if (!usedLater) {
          findings.push(this.createFinding(uri, i + 1, 'unused-assignment', 'medium',
            `Variable "${varName}" is assigned but never used in scope`,
            line, 'Use the variable or remove the assignment'));
        }
      }

      // Async function that never awaits
      if (/async\s+(?:function\s+)?(\w+)/.test(trimmed)) {
        const funcBody = this.extractBlock(lines, i);
        if (!funcBody.includes('await ') && !funcBody.includes('yield')) {
          findings.push(this.createFinding(uri, i + 1, 'unnecessary-async', 'low',
            'Function is marked async but never uses await',
            line, 'Remove the async keyword or add await calls'));
        }
      }
    }

    return findings;
  }

  private extractBlock(lines: string[], startLine: number): string {
    let braceCount = 0;
    let started = false;
    const blockLines: string[] = [];

    for (let i = startLine; i < Math.min(startLine + 100, lines.length); i++) {
      const line = lines[i]!;
      blockLines.push(line);
      for (const ch of line) {
        if (ch === '{') { braceCount++; started = true; }
        if (ch === '}') braceCount--;
      }
      if (started && braceCount === 0) break;
    }

    return blockLines.join('\n');
  }

  private createFinding(
    file: string, line: number, ruleId: string,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    message: string, evidence: string, suggestion: string
  ): Finding {
    return {
      id: `ov_${ruleId}_${line}`,
      engine: 'outcome_verification' as any,
      severity,
      category: 'outcome-verification',
      file,
      line,
      column: 1,
      message,
      evidence: evidence.trim(),
      suggestion,
      confidence: 0.8,
      autoFixable: ruleId === 'unnecessary-async',
    };
  }
}
