/**
 * LogicGapEngine — Guardrail-exclusive
 *
 * Detects logical gaps and edge cases that AI code generators often miss:
 * - Missing null/undefined checks
 * - Unchecked array access
 * - Missing default cases in switch statements
 * - Off-by-one potential in loops
 * - Missing input validation
 * - Unreachable code
 */

import type { Finding, DeltaContext, ScanEngine } from '@vibecheck/core';

export class LogicGapEngine implements ScanEngine {
  readonly id = 'logic_gap' as const;
  readonly name = 'Logic Gap Engine';
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

      // Switch without default
      if (/switch\s*\(/.test(trimmed)) {
        const switchBody = this.extractBlock(lines, i);
        if (!switchBody.includes('default:') && !switchBody.includes('default :')) {
          findings.push(this.createFinding(uri, i + 1, 'switch-no-default', 'medium',
            'Switch statement without default case — unhandled values will silently pass',
            line, 'Add a default case to handle unexpected values'));
        }
      }

      // Array access without bounds check
      const arrayAccess = trimmed.match(/(\w+)\[(\w+)\]/);
      if (arrayAccess && !trimmed.includes('if') && !trimmed.includes('?.')
          && !trimmed.includes('length') && !/['"`\d]/.test(arrayAccess[2]!)) {
        // Check if there's a bounds check nearby
        const contextWindow = lines.slice(Math.max(0, i - 3), i).join('\n');
        if (!contextWindow.includes('.length') && !contextWindow.includes('Array.isArray')
            && !contextWindow.includes('in ') && !contextWindow.includes('of ')) {
          findings.push(this.createFinding(uri, i + 1, 'unchecked-array-access', 'medium',
            `Array access \`${arrayAccess[0]}\` without bounds validation`,
            line, 'Add bounds check or use optional chaining: arr[idx] → arr?.[idx]'));
        }
      }

      // Division without zero check
      const divisionMatch = trimmed.match(/\/\s*(\w+)(?!\s*\/)/);
      if (divisionMatch && !trimmed.startsWith('//') && !trimmed.startsWith('/*')
          && !trimmed.includes('regex') && divisionMatch[1] !== '2'
          && !/^\d+$/.test(divisionMatch[1]!)) {
        const contextWindow = lines.slice(Math.max(0, i - 5), i).join('\n');
        if (!contextWindow.includes(`${divisionMatch[1]} === 0`)
            && !contextWindow.includes(`${divisionMatch[1]} !== 0`)
            && !contextWindow.includes(`${divisionMatch[1]} > 0`)) {
          findings.push(this.createFinding(uri, i + 1, 'division-no-zero-check', 'medium',
            `Division by \`${divisionMatch[1]}\` without zero check`,
            line, `Add a zero check before division: if (${divisionMatch[1]} !== 0)`));
        }
      }

      // Return after return (unreachable code)
      if (/^\s*return\s/.test(trimmed) && !trimmed.includes('//')) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j]!.trim();
          if (nextLine === '' || nextLine === '}' || nextLine.startsWith('//')) continue;
          if (nextLine !== '}' && nextLine !== '' && !nextLine.startsWith('//') && !nextLine.startsWith('case ') && !nextLine.startsWith('default')) {
            findings.push(this.createFinding(uri, j + 1, 'unreachable-code', 'high',
              'Unreachable code after return statement',
              lines[j]!, 'Remove unreachable code or fix control flow'));
            break;
          }
          break;
        }
      }

      // Function parameters without validation (public API functions)
      if (/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]+)\)/.test(trimmed)) {
        const params = RegExp.$2.split(',').map(p => p.trim().split(':')[0]!.trim()).filter(p => p);
        if (params.length > 0) {
          const funcBody = this.extractBlock(lines, i);
          const uncheckedParams = params.filter(p => {
            const cleaned = p.replace('?', '');
            return !funcBody.includes(`if (!${cleaned}`) &&
                   !funcBody.includes(`if (${cleaned} ==`) &&
                   !funcBody.includes(`${cleaned} ??`) &&
                   !funcBody.includes(`typeof ${cleaned}`);
          });
          if (uncheckedParams.length > 0 && trimmed.includes('export')) {
            findings.push(this.createFinding(uri, i + 1, 'no-param-validation', 'low',
              `Exported function parameters [${uncheckedParams.join(', ')}] lack validation`,
              line, 'Add input validation for exported function parameters'));
          }
        }
      }

      // parseInt without radix
      if (/parseInt\s*\(\s*\w+\s*\)/.test(trimmed) && !trimmed.includes(',')) {
        findings.push(this.createFinding(uri, i + 1, 'parseint-no-radix', 'low',
          'parseInt() called without radix parameter — may produce unexpected results',
          line, 'Add radix parameter: parseInt(value, 10)'));
      }

      // == instead of === (type coercion)
      if (/[^!=<>]==[^=]/.test(trimmed) && !trimmed.includes('==null') && !trimmed.startsWith('//')) {
        findings.push(this.createFinding(uri, i + 1, 'loose-equality', 'low',
          'Loose equality (==) used — may cause type coercion bugs',
          line, 'Use strict equality (===) instead'));
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
      id: `logic_${ruleId}_${line}`,
      engine: 'logic_gap' as any,
      severity,
      category: 'logic-gap',
      file,
      line,
      column: 1,
      message,
      evidence: evidence.trim(),
      suggestion,
      confidence: 0.75,
      autoFixable: ruleId === 'parseint-no-radix' || ruleId === 'loose-equality',
    };
  }
}
