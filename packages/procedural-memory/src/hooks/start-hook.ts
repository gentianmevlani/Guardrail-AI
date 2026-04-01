/**
 * Start Hook — Strategy Hit Tracking
 * ====================================
 * When a Claude Code session STARTS, this hook runs and records
 * which strategies were injected into CLAUDE_STRATEGIES.md.
 *
 * When the session ENDS, the Stop hook can compare:
 * - Which strategies were available at session start
 * - Which strategies' trigger patterns matched the session's actual files
 * - Whether sessions with matched strategies had better outcomes
 *
 * This closes the feedback loop: instead of proxy metrics (path overlap),
 * we get ground-truth data on strategy effectiveness.
 *
 * Hook stdin JSON: { session_id, cwd, ... }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadProcmemConfig } from '../lib/config';

export interface StrategySnapshot {
  /** When this snapshot was taken */
  timestamp: string;
  /** Session ID (from hook stdin) */
  sessionId: string;
  /** Working directory */
  cwd: string;
  /** Strategy IDs that were in the CLAUDE_STRATEGIES.md at session start */
  loadedStrategyIds: string[];
  /** Total number of strategies in the file */
  totalStrategies: number;
  /** Whether pre-mortem warnings were included */
  hadPreMortem: boolean;
  /** Whether somatic markers were included */
  hadSomaticMarkers: boolean;
  /** Whether user model was included */
  hadUserModel: boolean;
  /** MD5-like fingerprint of the strategies file for change detection */
  contentHash: string;
}

export interface StrategyHitLog {
  /** All snapshots, most recent last */
  snapshots: StrategySnapshot[];
}

const HIT_LOG_FILE = 'strategy-hits.json';

function hitLogPath(dataDir: string): string {
  return join(dataDir, HIT_LOG_FILE);
}

function loadHitLog(dataDir: string): StrategyHitLog {
  const p = hitLogPath(dataDir);
  if (!existsSync(p)) return { snapshots: [] };
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as StrategyHitLog;
  } catch {
    return { snapshots: [] };
  }
}

function saveHitLog(dataDir: string, log: StrategyHitLog): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  // Keep last 500 snapshots
  log.snapshots = log.snapshots.slice(-500);
  writeFileSync(hitLogPath(dataDir), JSON.stringify(log, null, 2));
}

/**
 * Simple hash for change detection (not cryptographic)
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Parse strategy IDs from CLAUDE_STRATEGIES.md content.
 * Looks for patterns like [95% ◆] or **[80%]** which precede strategy content.
 */
function extractLoadedStrategyIds(content: string): string[] {
  const ids: string[] = [];

  // Strategy sections have module headers (### module/name) followed by confidence markers
  // We extract module areas as proxy IDs since the actual strat_N IDs aren't in the markdown
  const moduleMatches = content.match(/^### .+$/gm);
  if (moduleMatches) {
    for (const match of moduleMatches) {
      ids.push(match.replace('### ', '').trim());
    }
  }

  return ids;
}

/**
 * Run the Start hook: snapshot which strategies are loaded for this session.
 */
export function runStartHook(stdinJson: string): number {
  let payload: { session_id?: string; cwd?: string };
  try {
    payload = JSON.parse(stdinJson) as { session_id?: string; cwd?: string };
  } catch {
    return 0;
  }

  const cwd = payload.cwd || '';
  const sessionId = payload.session_id || `unknown-${Date.now()}`;
  if (!cwd) return 0;

  const expandedCwd = cwd.startsWith('~/') ? join(homedir(), cwd.slice(2)) : cwd;
  if (!existsSync(expandedCwd)) return 0;

  const strategiesFile = join(expandedCwd, 'CLAUDE_STRATEGIES.md');
  if (!existsSync(strategiesFile)) return 0; // No strategies file = nothing to track

  const content = readFileSync(strategiesFile, 'utf-8');
  const cfg = loadProcmemConfig(expandedCwd);

  const snapshot: StrategySnapshot = {
    timestamp: new Date().toISOString(),
    sessionId,
    cwd: expandedCwd,
    loadedStrategyIds: extractLoadedStrategyIds(content),
    totalStrategies: (content.match(/^\*\*\[\d+%/gm) || []).length,
    hadPreMortem: content.includes('Pre-mortem: Predicted Risks'),
    hadSomaticMarkers: content.includes('Gut Check'),
    hadUserModel: content.includes('Collaborator Awareness'),
    contentHash: simpleHash(content),
  };

  const log = loadHitLog(cfg.dataDir);
  log.snapshots.push(snapshot);
  saveHitLog(cfg.dataDir, log);

  return 0;
}

/**
 * Get the most recent snapshot for a session (used by Stop hook for correlation).
 */
export function getSessionSnapshot(
  dataDir: string,
  sessionId: string
): StrategySnapshot | null {
  const log = loadHitLog(dataDir);
  // Find the most recent snapshot for this session
  return log.snapshots.find(s => s.sessionId === sessionId) || null;
}

/**
 * Get effectiveness data: correlate snapshots with session outcomes.
 */
export function computeHitEffectiveness(
  dataDir: string
): {
  totalTracked: number;
  withStrategies: number;
  withPreMortem: number;
  withSomatic: number;
  avgStrategiesLoaded: number;
} {
  const log = loadHitLog(dataDir);
  const snapshots = log.snapshots;

  if (snapshots.length === 0) {
    return { totalTracked: 0, withStrategies: 0, withPreMortem: 0, withSomatic: 0, avgStrategiesLoaded: 0 };
  }

  const withStrat = snapshots.filter(s => s.totalStrategies > 0).length;
  const withPM = snapshots.filter(s => s.hadPreMortem).length;
  const withSom = snapshots.filter(s => s.hadSomaticMarkers).length;
  const avgLoaded = snapshots.reduce((s, snap) => s + snap.totalStrategies, 0) / snapshots.length;

  return {
    totalTracked: snapshots.length,
    withStrategies: withStrat,
    withPreMortem: withPM,
    withSomatic: withSom,
    avgStrategiesLoaded: Math.round(avgLoaded * 10) / 10,
  };
}
