/**
 * Guardrail Scan Summary Card
 *
 * Beautiful, dense scan result display.
 * Renders a framed summary card with verdict, severity bars,
 * top findings, timing, and next actions.
 */

import { frameLines, isNoColor, frameStyles } from './frame';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanSummaryData {
  verdict: 'PASS' | 'FAIL' | 'WARN' | 'GO' | 'NO-GO';
  score: number;
  findings: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Top findings to display (max 5) */
  topFindings?: Array<{
    file: string;
    line: number;
    type: string;
    severity: string;
  }>;
  /** Elapsed time in milliseconds */
  elapsedMs?: number;
  /** Suggested next actions */
  nextActions?: string[];
  /** Whether issue details are redacted (free tier) */
  redacted?: boolean;
  /** Upgrade hint for free tier */
  upgradeHint?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function verdictBadge(verdict: string): string {
  const noColor = isNoColor();
  const badges: Record<string, { label: string; color: string }> = {
    PASS: { label: ' PASS ', color: frameStyles.brightGreen },
    FAIL: { label: ' FAIL ', color: '\x1b[91m' },
    WARN: { label: ' WARN ', color: frameStyles.brightYellow },
    GO: { label: '  GO  ', color: frameStyles.brightGreen },
    'NO-GO': { label: 'NO-GO ', color: '\x1b[91m' },
  };
  const b = badges[verdict] ?? { label: verdict, color: frameStyles.dim };
  if (noColor) return `[${b.label.trim()}]`;
  return `${b.color}\x1b[1m ${b.label} ${frameStyles.reset}`;
}

function severityBar(count: number, maxWidth: number): string {
  if (count === 0) return '—';
  const width = Math.min(count, maxWidth);
  return '█'.repeat(width) + (count > maxWidth ? `+${count - maxWidth}` : '');
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = ((ms % 60_000) / 1000).toFixed(0);
  return `${min}m ${sec}s`;
}

function truncateFile(filePath: string, maxLen = 45): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split('/');
  if (parts.length <= 2) return '...' + filePath.slice(-(maxLen - 3));
  // Keep first dir + filename, collapse middle
  const first = parts[0] || parts[1];
  const last = parts.slice(-2).join('/');
  return `${first}/.../${last}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a beautiful scan summary card.
 */
export function renderScanSummary(data: ScanSummaryData): string {
  const noColor = isNoColor();
  const r = noColor ? '' : frameStyles.reset;
  const b = noColor ? '' : '\x1b[1m';
  const d = noColor ? '' : frameStyles.dim;
  const cyan = noColor ? '' : frameStyles.brightCyan;
  const red = noColor ? '' : '\x1b[91m';
  const yellow = noColor ? '' : frameStyles.brightYellow;
  const green = noColor ? '' : frameStyles.brightGreen;
  const magenta = noColor ? '' : frameStyles.brightMagenta;

  const lines: string[] = [];

  // ── Verdict + Score ──
  lines.push(`${verdictBadge(data.verdict)}  ${d}Score:${r} ${b}${data.score}${r}/100`);
  lines.push('');

  // ── Severity breakdown ──
  const maxBar = 12;
  const { critical, high, medium, low } = data.findings;

  if (data.findings.total === 0) {
    lines.push(`${green}No issues found${r}`);
  } else {
    lines.push(`${b}Findings: ${data.findings.total}${r}`);
    if (critical > 0) lines.push(`  ${red}Critical${r}  ${critical.toString().padStart(3)}  ${red}${severityBar(critical, maxBar)}${r}`);
    if (high > 0)     lines.push(`  ${magenta}High${r}      ${high.toString().padStart(3)}  ${magenta}${severityBar(high, maxBar)}${r}`);
    if (medium > 0)   lines.push(`  ${yellow}Medium${r}    ${medium.toString().padStart(3)}  ${yellow}${severityBar(medium, maxBar)}${r}`);
    if (low > 0)      lines.push(`  ${d}Low${r}       ${low.toString().padStart(3)}  ${d}${severityBar(low, maxBar)}${r}`);
  }

  // ── Top findings ──
  if (data.topFindings && data.topFindings.length > 0 && !data.redacted) {
    lines.push('');
    lines.push(`${b}Top Issues:${r}`);
    for (const f of data.topFindings.slice(0, 5)) {
      const sev = f.severity === 'critical' ? `${red}CRIT${r}` :
                  f.severity === 'high' ? `${magenta}HIGH${r}` :
                  f.severity === 'medium' ? `${yellow}MED ${r}` :
                  `${d}LOW ${r}`;
      const loc = `${truncateFile(f.file)}:${f.line}`;
      lines.push(`  ${sev}  ${d}${loc}${r}`);
      lines.push(`        ${f.type}`);
    }
  }

  // ── Redacted hint ──
  if (data.redacted) {
    lines.push('');
    lines.push(`${yellow}${b}!${r} ${d}Free plan: severity counts only${r}`);
    if (data.upgradeHint) {
      lines.push(`  ${d}${data.upgradeHint}${r}`);
    }
  }

  // ── Timing ──
  if (data.elapsedMs != null) {
    lines.push('');
    lines.push(`${d}Completed in ${formatElapsed(data.elapsedMs)}${r}`);
  }

  // ── Next actions ──
  if (data.nextActions && data.nextActions.length > 0) {
    lines.push('');
    lines.push(`${b}Next:${r}`);
    for (const action of data.nextActions.slice(0, 4)) {
      lines.push(`  ${cyan}›${r} ${action}`);
    }
  }

  const framed = frameLines(lines, { padding: 2, title: `${cyan}${b}🛡️  GUARDRAIL RESULTS${r}` });
  return framed.join('\n');
}

/**
 * Print scan summary to console.
 */
export function printScanSummary(data: ScanSummaryData): void {
  console.log('');
  console.log(renderScanSummary(data));
  console.log('');
}

/**
 * Render a compact one-line verdict for watch mode.
 */
export function renderCompactVerdict(
  verdict: string,
  score: number,
  findingCount: number,
  elapsedMs: number,
): string {
  const noColor = isNoColor();
  const r = noColor ? '' : frameStyles.reset;
  const d = noColor ? '' : frameStyles.dim;

  const badge = verdictBadge(verdict);
  const time = formatElapsed(elapsedMs);
  const issues = findingCount === 0
    ? (noColor ? 'no issues' : `${frameStyles.brightGreen}no issues${r}`)
    : (noColor ? `${findingCount} issues` : `\x1b[91m${findingCount} issues${r}`);

  return `  ${badge} ${d}score:${r} ${score} ${d}|${r} ${issues} ${d}|${r} ${d}${time}${r}`;
}
