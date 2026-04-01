/**
 * Diff Preview Generator
 *
 * Generates git diff-style previews of proposed fixes with color output.
 * Part of the AI Feedback Loop — shows exactly what guardrail fix will change.
 */

import { readFileSync } from 'fs';
import { relative } from 'path';

export interface DiffHunk {
  file: string;
  startLine: number;
  endLine: number;
  oldLines: string[];
  newLines: string[];
  context: string[];
}

export interface DiffPreviewEntry {
  findingId: string;
  file: string;
  line: number;
  severity: string;
  confidence: number;
  risk: string;
  explanation: string;
  hunks: DiffHunk[];
}

// ANSI color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';
const WHITE = '\x1b[37m';

/**
 * Generate a unified diff from old/new code strings
 */
export function generateUnifiedDiff(
  oldCode: string,
  newCode: string,
  filePath: string,
  startLine: number,
  contextLines: number = 3,
): DiffHunk {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');

  return {
    file: filePath,
    startLine,
    endLine: startLine + Math.max(oldLines.length, newLines.length) - 1,
    oldLines,
    newLines,
    context: [],
  };
}

/**
 * Read surrounding context lines from a file
 */
function getFileContext(
  filePath: string,
  targetLine: number,
  contextSize: number = 3,
): { before: string[]; after: string[] } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n');
    const before = allLines.slice(
      Math.max(0, targetLine - 1 - contextSize),
      targetLine - 1,
    );
    const after = allLines.slice(
      targetLine + contextSize - 1,
      targetLine + contextSize * 2 - 1,
    );
    return { before, after };
  } catch {
    return { before: [], after: [] };
  }
}

/**
 * Format a single diff preview entry for terminal output
 */
export function formatDiffPreview(entry: DiffPreviewEntry, projectPath: string): string {
  const lines: string[] = [];
  const relPath = relative(projectPath, entry.file) || entry.file;

  // Header
  const severityColor = entry.severity === 'critical' ? RED
    : entry.severity === 'high' ? YELLOW
    : CYAN;
  const confidenceBar = renderConfidenceBar(entry.confidence);
  const riskBadge = entry.risk === 'low' ? `${GREEN}LOW RISK${RESET}`
    : entry.risk === 'medium' ? `${YELLOW}MED RISK${RESET}`
    : `${RED}HIGH RISK${RESET}`;

  lines.push('');
  lines.push(`${BOLD}${severityColor}━━━ ${entry.findingId} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  lines.push(`${DIM}File:${RESET}       ${CYAN}${relPath}:${entry.line}${RESET}`);
  lines.push(`${DIM}Confidence:${RESET} ${confidenceBar} ${entry.confidence}%`);
  lines.push(`${DIM}Risk:${RESET}       ${riskBadge}`);
  lines.push(`${DIM}Fix:${RESET}        ${entry.explanation}`);
  lines.push('');

  // Diff hunks
  for (const hunk of entry.hunks) {
    const { before, after } = getFileContext(hunk.file, hunk.startLine);

    // File header (git diff style)
    lines.push(`${BOLD}--- a/${relPath}${RESET}`);
    lines.push(`${BOLD}+++ b/${relPath}${RESET}`);
    lines.push(`${CYAN}@@ -${hunk.startLine},${hunk.oldLines.length} +${hunk.startLine},${hunk.newLines.length} @@${RESET}`);

    // Context before
    for (const ctx of before) {
      lines.push(`${DIM} ${ctx}${RESET}`);
    }

    // Removed lines
    for (const old of hunk.oldLines) {
      lines.push(`${RED}-${old}${RESET}`);
    }

    // Added lines
    for (const newLine of hunk.newLines) {
      lines.push(`${GREEN}+${newLine}${RESET}`);
    }

    // Context after
    for (const ctx of after) {
      lines.push(`${DIM} ${ctx}${RESET}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format all fix previews as a complete diff report
 */
export function formatDiffReport(
  entries: DiffPreviewEntry[],
  projectPath: string,
): string {
  const lines: string[] = [];

  // Summary header
  lines.push('');
  lines.push(`${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}GUARDRAIL FIX — Diff Preview${RESET}                               ${BOLD}${CYAN}║${RESET}`);
  lines.push(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${RESET}`);
  lines.push('');

  // Stats
  const safeCount = entries.filter(e => e.risk === 'low').length;
  const medCount = entries.filter(e => e.risk === 'medium').length;
  const highCount = entries.filter(e => e.risk === 'high').length;
  const files = new Set(entries.map(e => e.file));

  lines.push(`  ${GREEN}●${RESET} ${safeCount} safe fixes   ${YELLOW}●${RESET} ${medCount} moderate   ${RED}●${RESET} ${highCount} high-risk`);
  lines.push(`  ${DIM}${files.size} file(s) affected${RESET}`);
  lines.push('');

  // Each entry
  for (const entry of entries) {
    lines.push(formatDiffPreview(entry, projectPath));
  }

  // Footer
  lines.push('');
  lines.push(`${DIM}─────────────────────────────────────────────────────────────────${RESET}`);
  lines.push(`  ${BOLD}Apply these fixes:${RESET}  ${CYAN}guardrail fix --apply${RESET}`);
  lines.push(`  ${BOLD}Apply safe only:${RESET}    ${CYAN}guardrail fix --apply --risk=safe${RESET}`);
  lines.push(`  ${BOLD}Fix specific:${RESET}       ${CYAN}guardrail fix --apply --id=<finding-id>${RESET}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render a confidence bar [████████░░] 80%
 */
function renderConfidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  const color = confidence >= 80 ? GREEN : confidence >= 50 ? YELLOW : RED;
  return `${color}[${'█'.repeat(filled)}${'░'.repeat(empty)}]${RESET}`;
}

/**
 * Convert Fix objects from the FixEngine into DiffPreviewEntry objects
 */
export function fixesToDiffPreviews(
  fixes: Array<{
    findingId: string;
    file: string;
    line: number;
    oldCode: string;
    newCode: string;
    confidence: number;
    risk: string;
    explanation: string;
  }>,
  findings: Array<{
    id: string;
    severity: string;
  }>,
): DiffPreviewEntry[] {
  return fixes.map(fix => {
    const finding = findings.find(f => f.id === fix.findingId);
    const hunk = generateUnifiedDiff(
      fix.oldCode,
      fix.newCode,
      fix.file,
      fix.line,
    );

    return {
      findingId: fix.findingId,
      file: fix.file,
      line: fix.line,
      severity: finding?.severity || 'medium',
      confidence: fix.confidence,
      risk: fix.risk,
      explanation: fix.explanation,
      hunks: [hunk],
    };
  });
}
