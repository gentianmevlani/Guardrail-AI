/**
 * Learning Loop — Violation Pattern Tracker
 *
 * Tracks which violations repeat across scans and commits.
 * When a pattern repeats 3+ times, it gets injected into the AI context
 * as a "known bad pattern" warning so the AI won't generate it again.
 *
 * This is the memory that makes the AI Feedback Loop actually learn.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

export interface ViolationPattern {
  /** Unique key: `${type}::${file}` */
  key: string;
  /** Finding type (e.g., "empty-catch", "hardcoded-secret", "ghost-route") */
  type: string;
  /** File where the violation occurs */
  file: string;
  /** Line number of most recent occurrence */
  line: number;
  /** Number of times this violation has been seen */
  count: number;
  /** ISO timestamp of first occurrence */
  firstSeen: string;
  /** ISO timestamp of most recent occurrence */
  lastSeen: string;
  /** Severity of the violation */
  severity: string;
  /** Was this fixed then re-introduced? */
  wasFixedThenReintroduced: boolean;
  /** Scan IDs where this was seen */
  scanIds: string[];
  /** Git author (from blame) if available */
  author?: string;
  /** Description of the violation */
  description?: string;
}

export interface ViolationHistory {
  version: string;
  projectPath: string;
  lastUpdated: string;
  totalScans: number;
  patterns: ViolationPattern[];
  /** Summary stats */
  stats: {
    totalPatterns: number;
    repeatOffenders: number; // count >= 3
    fixedThenReintroduced: number;
    topTypes: Array<{ type: string; count: number }>;
  };
}

// ============================================================================
// CORE
// ============================================================================

const HISTORY_FILE = 'violation-history.json';
const GUARDRAIL_DIR = '.guardrail';

/**
 * Load existing violation history from disk
 */
export function loadViolationHistory(projectPath: string): ViolationHistory {
  const filePath = join(projectPath, GUARDRAIL_DIR, HISTORY_FILE);

  if (!existsSync(filePath)) {
    return createEmptyHistory(projectPath);
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return createEmptyHistory(projectPath);
  }
}

function createEmptyHistory(projectPath: string): ViolationHistory {
  return {
    version: '1.0.0',
    projectPath,
    lastUpdated: new Date().toISOString(),
    totalScans: 0,
    patterns: [],
    stats: {
      totalPatterns: 0,
      repeatOffenders: 0,
      fixedThenReintroduced: 0,
      topTypes: [],
    },
  };
}

/**
 * Record findings from a scan into the violation history.
 * This is called after every `guardrail scan`.
 */
export function recordFindings(
  projectPath: string,
  findings: Array<{
    id: string;
    type: string;
    file: string;
    line: number;
    severity: string;
    description?: string;
  }>,
  scanId?: string,
): ViolationHistory {
  const history = loadViolationHistory(projectPath);
  const now = new Date().toISOString();
  const currentScanId = scanId || `scan-${Date.now()}`;

  history.totalScans++;
  history.lastUpdated = now;

  // Build a set of current finding keys
  const currentKeys = new Set<string>();

  for (const finding of findings) {
    const key = `${finding.type}::${finding.file}`;
    currentKeys.add(key);

    const existing = history.patterns.find(p => p.key === key);

    if (existing) {
      // Update existing pattern
      existing.count++;
      existing.lastSeen = now;
      existing.line = finding.line;
      existing.severity = finding.severity;
      if (!existing.scanIds.includes(currentScanId)) {
        existing.scanIds.push(currentScanId);
      }
      // Keep only last 20 scan IDs
      if (existing.scanIds.length > 20) {
        existing.scanIds = existing.scanIds.slice(-20);
      }
    } else {
      // New pattern
      const author = getGitBlameAuthor(projectPath, finding.file, finding.line);
      history.patterns.push({
        key,
        type: finding.type,
        file: finding.file,
        line: finding.line,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        severity: finding.severity,
        wasFixedThenReintroduced: false,
        scanIds: [currentScanId],
        author: author || undefined,
        description: finding.description,
      });
    }
  }

  // Detect "fixed then reintroduced" patterns
  for (const pattern of history.patterns) {
    if (!currentKeys.has(pattern.key) && pattern.count > 0) {
      // This pattern was not found in the current scan — it may have been fixed
      // Mark it so that if it reappears, we flag it
      pattern._wasAbsent = true;
    } else if ((pattern as any)._wasAbsent && currentKeys.has(pattern.key)) {
      // It was absent in a previous scan but is back now
      pattern.wasFixedThenReintroduced = true;
      delete (pattern as any)._wasAbsent;
    }
  }

  // Update stats
  history.stats = computeStats(history.patterns);

  // Save
  saveViolationHistory(projectPath, history);

  return history;
}

/**
 * Get repeat offender patterns (count >= threshold)
 */
export function getRepeatViolations(
  projectPath: string,
  threshold: number = 3,
): ViolationPattern[] {
  const history = loadViolationHistory(projectPath);
  return history.patterns
    .filter(p => p.count >= threshold)
    .sort((a, b) => b.count - a.count);
}

/**
 * Get patterns that were fixed then reintroduced
 */
export function getReintroducedViolations(projectPath: string): ViolationPattern[] {
  const history = loadViolationHistory(projectPath);
  return history.patterns.filter(p => p.wasFixedThenReintroduced);
}

/**
 * Generate a warning prompt from violation history for AI injection
 */
export function generateViolationWarnings(projectPath: string): string {
  const repeats = getRepeatViolations(projectPath, 3);
  const reintroduced = getReintroducedViolations(projectPath);

  if (repeats.length === 0 && reintroduced.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('## REPEAT VIOLATION WARNINGS');
  lines.push('');
  lines.push('The following patterns have been flagged multiple times in this project.');
  lines.push('Do NOT generate code that includes these patterns:');
  lines.push('');

  for (const v of repeats.slice(0, 15)) {
    const emoji = v.wasFixedThenReintroduced ? '⚡' : '🔴';
    lines.push(`${emoji} **${v.type}** in \`${v.file}:${v.line}\``);
    lines.push(`   Seen ${v.count}x | Severity: ${v.severity} | First: ${v.firstSeen.split('T')[0]}`);
    if (v.wasFixedThenReintroduced) {
      lines.push(`   ⚠️ This was FIXED then RE-INTRODUCED — do not repeat this mistake.`);
    }
    if (v.description) {
      lines.push(`   ${v.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function saveViolationHistory(projectPath: string, history: ViolationHistory): void {
  const dirPath = join(projectPath, GUARDRAIL_DIR);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  writeFileSync(join(dirPath, HISTORY_FILE), JSON.stringify(history, null, 2));
}

function computeStats(patterns: ViolationPattern[]): ViolationHistory['stats'] {
  const repeatOffenders = patterns.filter(p => p.count >= 3).length;
  const fixedThenReintroduced = patterns.filter(p => p.wasFixedThenReintroduced).length;

  // Top types
  const typeCounts: Record<string, number> = {};
  for (const p of patterns) {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + p.count;
  }
  const topTypes = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }));

  return {
    totalPatterns: patterns.length,
    repeatOffenders,
    fixedThenReintroduced,
    topTypes,
  };
}

function getGitBlameAuthor(
  projectPath: string,
  file: string,
  line: number,
): string | null {
  try {
    const result = execSync(
      `git blame -L ${line},${line} --porcelain "${file}" 2>/dev/null | grep "^author " | sed 's/^author //'`,
      { cwd: projectPath, encoding: 'utf-8', timeout: 5000 },
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}
