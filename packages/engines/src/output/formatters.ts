/**
 * Consolidated output formatters for Guardrail scan results.
 * JSON, text summary, SARIF, and compact formats.
 */

import * as path from 'path';
import type { Finding } from '../core-types';
import { toSarif, type SarifInput } from './sarif.js';

/** Summary structure compatible with RunSummary from FileRunner. */
export interface RunSummaryLike {
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  findingsByEngine: Record<string, number>;
  findingsByRule: Record<string, number>;
  totalDurationMs: number;
  engineHealth: Array<{ id: string; totalMs: number; errorCount: number }>;
  engineTiming?: Array<{
    id: string;
    totalMs: number;
    p50: number;
    p95: number;
    p99: number;
    errorCount: number;
  }>;
}

/** Input compatible with RunResult from FileRunner. */
export interface RunResultLike {
  files: SarifInput['files'];
  summary: RunSummaryLike;
}

export type OutputFormat = 'json' | 'text' | 'sarif' | 'compact';

export interface FormatOptions {
  workspaceRoot: string;
  toolVersion?: string;
  /** For JSON: include timing data when available. */
  includeTiming?: boolean;
  /** For JSON: exit code to include in meta. */
  exitCode?: number;
}

/**
 * Format scan results for the given output format.
 */
export function formatFindings(
  result: RunResultLike,
  format: OutputFormat,
  options: FormatOptions
): string {
  switch (format) {
    case 'json':
      return formatJson(result, options);
    case 'text':
      return formatText(result.summary);
    case 'sarif':
      return formatSarif(result, options);
    case 'compact':
      return formatCompact(result.summary);
    default: {
      const _: never = format;
      return formatText(result.summary);
    }
  }
}

function formatJson(result: RunResultLike, options: FormatOptions): string {
  const allFindings = result.files.flatMap((fr) =>
    fr.findings.map((f) => ({
      ...f,
      filePath: fr.file,
      relativePath: fr.relativePath ?? path.relative(options.workspaceRoot, fr.file).replace(/\\/g, '/'),
    }))
  );

  const meta = {
    filesScanned: result.summary.filesScanned,
    totalFindings: result.summary.totalFindings,
    criticalCount: result.summary.findingsBySeverity['critical'] ?? 0,
    highCount: result.summary.findingsBySeverity['high'] ?? 0,
    durationMs: result.summary.totalDurationMs,
    exitCode: options.exitCode ?? 0,
    ...(options.includeTiming &&
      result.summary.engineTiming &&
      result.summary.engineTiming.length > 0 && {
        timing: result.summary.engineTiming,
      }),
  };

  return JSON.stringify(
    { command: 'scan', findings: allFindings, meta },
    null,
    2
  );
}

function formatText(summary: RunSummaryLike): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  Guardrail Scan Complete`);
  lines.push(`  ${'─'.repeat(44)}`);
  lines.push(`  Files scanned:  ${summary.filesScanned} / ${summary.filesDiscovered}`);
  if (summary.filesSkipped > 0) {
    lines.push(`  Files skipped:  ${summary.filesSkipped}`);
  }
  lines.push(`  Total findings: ${summary.totalFindings}`);
  lines.push(`  Duration:       ${summary.totalDurationMs}ms`);

  if (summary.totalFindings > 0) {
    lines.push('');
    lines.push('  By severity:');
    for (const [sev, count] of Object.entries(summary.findingsBySeverity).sort(
      (a, b) => b[1] - a[1]
    )) {
      const icon =
        sev === 'critical'
          ? '●'
          : sev === 'high'
            ? '▲'
            : sev === 'medium'
              ? '■'
              : '○';
      lines.push(`    ${icon} ${sev}: ${count}`);
    }

    lines.push('');
    lines.push('  By engine:');
    for (const [eng, count] of Object.entries(summary.findingsByEngine).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`    ${eng}: ${count}`);
    }
  }

  const unhealthy = summary.engineHealth.filter((e) => e.errorCount > 0);
  if (unhealthy.length > 0) {
    lines.push('');
    lines.push('  Engine warnings:');
    for (const e of unhealthy) {
      lines.push(`    ⚠ ${e.id}: ${e.errorCount} errors (${e.totalMs}ms total)`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatSarif(result: RunResultLike, options: FormatOptions): string {
  const sarif = toSarif(
    { files: result.files },
    options.workspaceRoot,
    { toolVersion: options.toolVersion }
  );
  return JSON.stringify(sarif, null, 2);
}

function formatCompact(summary: RunSummaryLike): string {
  const parts: string[] = [
    `${summary.filesScanned} files`,
    `${summary.totalFindings} findings`,
    `${summary.totalDurationMs}ms`,
  ];
  if (summary.totalFindings > 0) {
    const sev = summary.findingsBySeverity;
    const crit = sev['critical'] ?? 0;
    const high = sev['high'] ?? 0;
    if (crit > 0) parts.push(`${crit} critical`);
    if (high > 0) parts.push(`${high} high`);
  }
  return `Guardrail: ${parts.join(' · ')}`;
}

/** Format summary block only (for CLI display). */
export function formatSummary(summary: RunSummaryLike): string {
  return formatText(summary);
}
