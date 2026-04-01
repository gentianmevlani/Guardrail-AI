/**
 * Verdict Formatter
 * 
 * Formats verdict output for human consumption.
 * Goal: screenshot-shareable, understood in 10 seconds.
 */

import { VerdictOutput, StandardFinding, EXIT_CODES } from './output-contract';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

export function formatVerdictHeader(verdict: VerdictOutput): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═'.repeat(70));
  
  const verdictEmoji = verdict.verdict === 'PASS' ? '✅' : verdict.verdict === 'FAIL' ? '❌' : '⚠️';
  const verdictColor = verdict.verdict === 'PASS' ? c.green : verdict.verdict === 'FAIL' ? c.red : c.yellow;
  
  lines.push(`${verdictColor}${c.bold}VERDICT: ${verdict.verdict}${c.reset}`);
  lines.push('');
  
  if (verdict.cached) {
    lines.push(`${c.dim}✓ Cached (${formatTime(verdict.timings.total)})${c.reset}`);
  } else {
    lines.push(`${c.dim}Discovery: ${formatTime(verdict.timings.discovery)} | Analysis: ${formatTime(verdict.timings.analysis)} | Verify: ${formatTime(verdict.timings.verification)}${c.reset}`);
    lines.push(`${c.dim}Total: ${formatTime(verdict.timings.total)}${c.reset}`);
  }
  
  lines.push('═'.repeat(70));
  lines.push('');
  
  return lines.join('\n');
}

export function formatBlockers(blockers: StandardFinding[]): string {
  if (blockers.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push(`${c.bold}🚨 BLOCKERS (${blockers.length}):${c.reset}`);
  lines.push('');
  
  for (let i = 0; i < Math.min(blockers.length, 3); i++) {
    const blocker = blockers[i];
    lines.push(formatFinding(blocker, i + 1, true));
    if (i < Math.min(blockers.length, 3) - 1) {
      lines.push('');
    }
  }
  
  if (blockers.length > 3) {
    lines.push('');
    lines.push(`${c.dim}... and ${blockers.length - 3} more blockers${c.reset}`);
  }
  
  lines.push('');
  lines.push('─'.repeat(70));
  lines.push('');
  
  return lines.join('\n');
}

export function formatWarnings(warnings: StandardFinding[], collapsed: boolean = true): string {
  if (warnings.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  
  if (collapsed) {
    lines.push(`${c.yellow}⚠️  WARNINGS (${warnings.length}) - Run with --verbose to see details${c.reset}`);
  } else {
    lines.push(`${c.bold}⚠️  WARNINGS (${warnings.length}):${c.reset}`);
    lines.push('');
    for (const warning of warnings.slice(0, 5)) {
      lines.push(formatFinding(warning, undefined, false));
      lines.push('');
    }
    if (warnings.length > 5) {
      lines.push(`${c.dim}... and ${warnings.length - 5} more warnings${c.reset}`);
    }
  }
  
  lines.push('');
  
  return lines.join('\n');
}

function formatFinding(finding: StandardFinding, index?: number, isBlocker: boolean = false): string {
  const lines: string[] = [];
  
  const prefix = index ? `${index}. ` : '  • ';
  const severityColor = finding.severity === 'critical' ? c.red : finding.severity === 'high' ? c.yellow : c.cyan;
  
  lines.push(`${prefix}${c.bold}${finding.id.full}${c.reset} ${severityColor}${finding.severity.toUpperCase()}${c.reset} ${c.bold}${finding.ruleName}${c.reset}`);
  lines.push(`    ${c.dim}${finding.message}${c.reset}`);
  
  if (finding.file) {
    const fileDisplay = finding.file.split('/').slice(-2).join('/');
    const location = finding.line ? `${fileDisplay}:${finding.line}` : fileDisplay;
    lines.push(`    ${c.cyan}${location}${c.reset}`);
  }
  
  if (isBlocker && finding.fixSuggestion) {
    lines.push(`    ${c.green}→ Fix: ${finding.fixSuggestion}${c.reset}`);
  }
  
  if (isBlocker && finding.autofixAvailable) {
    lines.push(`    ${c.cyan}→ Autofix: guardrail fix --id ${finding.id.full}${c.reset}`);
  }
  
  if (isBlocker && finding.verifyCommand) {
    lines.push(`    ${c.dim}→ Verify: ${finding.verifyCommand}${c.reset}`);
  }
  
  return lines.join('\n');
}

export function formatSummary(verdict: VerdictOutput): string {
  const lines: string[] = [];
  
  lines.push(`${c.bold}SUMMARY:${c.reset}`);
  lines.push(`  Total findings: ${verdict.summary.totalFindings}`);
  lines.push(`  Blockers: ${verdict.summary.blockers}`);
  lines.push(`  Warnings: ${verdict.summary.warnings}`);
  lines.push(`  Info: ${verdict.summary.info}`);
  lines.push('');
  
  return lines.join('\n');
}

export function formatNextSteps(verdict: VerdictOutput): string {
  const lines: string[] = [];
  
  if (verdict.verdict === 'FAIL') {
    lines.push(`${c.bold}NEXT STEPS:${c.reset}`);
    lines.push(`  1. Fix the blockers above`);
    lines.push(`  2. Run: ${c.cyan}guardrail scan${c.reset} to verify`);
    lines.push(`  3. Or use: ${c.cyan}guardrail fix --id <finding-id>${c.reset} for autofix`);
    lines.push('');
  } else if (verdict.verdict === 'WARN') {
    lines.push(`${c.bold}NEXT STEPS:${c.reset}`);
    lines.push(`  Review warnings with: ${c.cyan}guardrail scan --verbose${c.reset}`);
    lines.push('');
  } else {
    lines.push(`${c.green}${c.bold}✓ All clear! Ready to ship.${c.reset}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format complete verdict output
 */
export function formatVerdictOutput(
  verdict: VerdictOutput,
  options: { verbose?: boolean; json?: boolean } = {}
): string {
  if (options.json) {
    return JSON.stringify(verdict, null, 2);
  }
  
  const lines: string[] = [];
  
  lines.push(formatVerdictHeader(verdict));
  lines.push(formatBlockers(verdict.topBlockers));
  
  if (options.verbose || verdict.summary.blockers === 0) {
    lines.push(formatWarnings(verdict.warnings, !options.verbose));
  }
  
  lines.push(formatSummary(verdict));
  lines.push(formatNextSteps(verdict));
  
  return lines.join('\n');
}
