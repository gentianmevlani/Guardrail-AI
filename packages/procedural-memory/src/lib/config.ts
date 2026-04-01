/**
 * Optional config.yaml — defaults for CLI (paths, report baselines).
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { parse as parseYaml } from 'yaml';

export interface ProcmemConfig {
  claudeDir: string;
  dataDir: string;
  reportBaselineSessions: number;
  reportSplitDate?: string;
  /** Default Anthropic model when `extract --deep` runs without `--deep-model` */
  deepModel?: string;
}

const DEFAULTS: ProcmemConfig = {
  claudeDir: join(homedir(), '.claude'),
  dataDir: join(homedir(), '.claude-conscious'),
  reportBaselineSessions: 20,
};

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(homedir(), p.slice(1).replace(/^\//, '') || '');
  }
  return p;
}

function readYamlFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const doc = parseYaml(raw) as Record<string, unknown>;
    return doc && typeof doc === 'object' ? doc : null;
  } catch {
    return null;
  }
}

/**
 * Load config from ./config.yaml, then ~/.engram/config.yaml.
 * Also checks legacy ~/.procedural-memory/config.yaml for migration.
 */
export function loadProcmemConfig(cwd: string = process.cwd()): ProcmemConfig {
  const merged: ProcmemConfig = { ...DEFAULTS };
  const paths = [
    join(cwd, 'config.yaml'),
    join(cwd, 'claude-conscious.config.yaml'),
    join(homedir(), '.claude-conscious', 'config.yaml'),
    // Legacy fallback
    join(homedir(), '.procedural-memory', 'config.yaml'),
  ];
  for (const p of paths) {
    const doc = readYamlFile(p);
    if (!doc) continue;
    if (typeof doc.claudeDir === 'string') merged.claudeDir = expandHome(resolve(doc.claudeDir));
    if (typeof doc.dataDir === 'string') merged.dataDir = expandHome(resolve(doc.dataDir));
    if (typeof doc.reportBaselineSessions === 'number') merged.reportBaselineSessions = doc.reportBaselineSessions;
    if (typeof doc.reportSplitDate === 'string') merged.reportSplitDate = doc.reportSplitDate;
    if (typeof doc.deepModel === 'string') merged.deepModel = doc.deepModel;
  }

  // If the new data dir doesn't exist but legacy does, use legacy
  if (!existsSync(merged.dataDir)) {
    const legacyDirs = [
      join(homedir(), '.engram'),
      join(homedir(), '.procedural-memory'),
    ];
    for (const legacyDir of legacyDirs) {
      if (existsSync(legacyDir)) {
        merged.dataDir = legacyDir;
        break;
      }
    }
  }

  return merged;
}
