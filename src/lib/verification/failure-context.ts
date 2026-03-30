/**
 * Failure Context Builder
 * Builds concise retry prompts for failed verifications
 */

import { CheckResult, VerificationResult } from './types';

const MAX_BLOCKERS = 3;

/**
 * Build failure context for retry prompt
 */
export function buildFailureContext(result: VerificationResult): string {
  if (result.success) {
    return '';
  }

  const blockers = result.blockers.slice(0, MAX_BLOCKERS);
  const hasMore = result.blockers.length > MAX_BLOCKERS;

  const lines: string[] = [
    '## Verification Failed',
    '',
    'Your previous response did not pass verification. Fix ONLY the issues below.',
    'Do NOT refactor unrelated code. Return the corrected diff in guardrail-v1 JSON format.',
    '',
    '### Issues to Fix:',
    '',
  ];

  for (let i = 0; i < blockers.length; i++) {
    lines.push(`${i + 1}. ${blockers[i]}`);
  }

  if (hasMore) {
    lines.push(`... and ${result.blockers.length - MAX_BLOCKERS} more issue(s)`);
  }

  // Add specific fix suggestions from check results
  const suggestions = result.checks
    .filter(c => c.status === 'fail' && c.suggestedFix)
    .slice(0, MAX_BLOCKERS);

  if (suggestions.length > 0) {
    lines.push('');
    lines.push('### Suggested Fixes:');
    lines.push('');
    for (const s of suggestions) {
      if (s.file && s.line) {
        lines.push(`- **${s.file}:${s.line}**: ${s.suggestedFix}`);
      } else if (s.file) {
        lines.push(`- **${s.file}**: ${s.suggestedFix}`);
      } else {
        lines.push(`- ${s.suggestedFix}`);
      }
    }
  }

  lines.push('');
  lines.push('Respond with corrected guardrail-v1 JSON only.');

  return lines.join('\n');
}

/**
 * Build a compact single-line summary for UI display
 */
export function buildFailureSummary(result: VerificationResult): string {
  if (result.success) {
    return 'Verification passed';
  }

  const failedChecks = result.checks.filter(c => c.status === 'fail');
  if (failedChecks.length === 0) {
    return 'Unknown verification failure';
  }

  if (failedChecks.length === 1) {
    return failedChecks[0].message;
  }

  return `${failedChecks.length} checks failed: ${failedChecks.map(c => c.check).join(', ')}`;
}

/**
 * Format check results for human-readable output
 */
export function formatCheckResults(checks: CheckResult[]): string {
  const lines: string[] = [];

  const passed = checks.filter(c => c.status === 'pass');
  const failed = checks.filter(c => c.status === 'fail');
  const warned = checks.filter(c => c.status === 'warn');
  const skipped = checks.filter(c => c.status === 'skip');

  if (failed.length > 0) {
    lines.push('❌ FAILED:');
    for (const check of failed) {
      lines.push(`  • [${check.check}] ${check.message}`);
      if (check.details) {
        const detailLines = check.details.split('\n').slice(0, 3);
        for (const detail of detailLines) {
          lines.push(`      ${detail}`);
        }
      }
      if (check.suggestedFix) {
        lines.push(`    💡 Fix: ${check.suggestedFix}`);
      }
    }
    lines.push('');
  }

  if (warned.length > 0) {
    lines.push('⚠️  WARNINGS:');
    for (const check of warned) {
      lines.push(`  • [${check.check}] ${check.message}`);
    }
    lines.push('');
  }

  if (passed.length > 0) {
    lines.push('✅ PASSED:');
    for (const check of passed) {
      lines.push(`  • [${check.check}] ${check.message}`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('⏭️  SKIPPED:');
    for (const check of skipped) {
      lines.push(`  • [${check.check}] ${check.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build JSON report for machine consumption
 */
export function buildJsonReport(result: VerificationResult): object {
  return {
    success: result.success,
    summary: buildFailureSummary(result),
    blockers: result.blockers,
    warnings: result.warnings,
    checks: result.checks.map(c => ({
      name: c.check,
      status: c.status,
      message: c.message,
      file: c.file,
      line: c.line,
      suggestedFix: c.suggestedFix,
    })),
  };
}

/**
 * Get file locations from check results
 */
export function getFailureLocations(
  checks: CheckResult[]
): Array<{ file: string; line?: number; message: string }> {
  const locations: Array<{ file: string; line?: number; message: string }> = [];

  for (const check of checks) {
    if (check.status === 'fail' && check.file) {
      locations.push({
        file: check.file,
        line: check.line,
        message: check.message,
      });
    }
  }

  return locations;
}
