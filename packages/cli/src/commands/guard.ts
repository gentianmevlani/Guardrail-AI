/**
 * Guard Command — Scan + enforce enterprise policy (block on violations)
 *
 * Like `scan`, but exits with non-zero code when policy violations
 * are found. Designed for CI/CD gates.
 */

import { ScanCommand } from './scan.js';
import type { GuardrailScanResult } from '../lib/guardrail-scan-adapter.js';

export class GuardCommand {
  private scanCommand = new ScanCommand();

  /**
   * Execute guard scan — returns exit code
   * 0 = pass, 1 = violations found
   */
  async execute(
    targetPath: string,
    options: Record<string, string | boolean> = {}
  ): Promise<number> {
    // Default block threshold: 1 critical/high finding
    const blockThreshold = typeof options['block-threshold'] === 'string'
      ? parseInt(options['block-threshold'], 10)
      : 1;

    const results = await this.scanCommand.execute(targetPath, {
      ...options,
      blockThreshold: String(blockThreshold),
    });

    const totalViolations = results.reduce((sum, r) => sum + r.policyViolations.length, 0);
    const blocked = results.some(r => r.blocked);

    if (blocked || totalViolations > 0) {
      console.log('\n\x1b[31m✗ GUARD FAILED\x1b[0m — Policy violations detected');
      console.log(`  ${totalViolations} policy violation(s)`);
      console.log(`  ${results.filter(r => r.blocked).length} file(s) blocked\n`);
      this.printViolationDetails(results);
      return 1;
    }

    console.log('\n\x1b[32m✓ GUARD PASSED\x1b[0m — No policy violations\n');
    return 0;
  }

  private printViolationDetails(results: GuardrailScanResult[]): void {
    const allViolations = results.flatMap(r => r.policyViolations);
    if (allViolations.length === 0) return;

    console.log('\x1b[1mViolation Details:\x1b[0m');
    for (const v of allViolations) {
      const color = v.severity === 'critical' ? '\x1b[31m' : '\x1b[33m';
      console.log(`  ${color}[${v.ruleId}] ${v.severity.toUpperCase()}\x1b[0m ${v.message}`);
      console.log(`    Engine: ${v.engine} | Auto-fix: ${v.autoRemediable ? 'yes' : 'no'}`);
    }
    console.log('');
  }
}
