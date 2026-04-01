/**
 * Procedural + verified context for Guardrail monorepos:
 * - CLAUDE_STRATEGIES.md (engram / @guardrail/procedural-memory)
 * - Truthpack JSON (tiers, routes, copy, monorepo) — never invent what lives here
 * - Compact monorepo layout hint (pnpm / apps / packages)
 */

import * as fs from 'fs';
import * as path from 'path';

/** Prefer the same dirs the repo documents in CLAUDE.md / .cursorrules */
const TRUTHPACK_REL_DIRS = ['.vibecheck/truthpack', '.guardrail/truthpack'] as const;

/**
 * High-signal truthpack files for AI context (order matters for truncation budget).
 * See TRUTHPACK-FIRST protocol in .cursor/rules.
 */
const TRUTHPACK_FILES = [
  'product.json',
  'monorepo.json',
  'routes.json',
  'copy.json',
  'error-codes.json',
  'env.json',
  'cli-commands.json',
  'schemas.json',
] as const;

const MAX_STRATEGIES_CHARS = 12000;
const MAX_TRUTHPACK_FILE_CHARS = 4500;
const MAX_LAYOUT_HINT_CHARS = 1200;

export type ProceduralMemoryKind = 'layout' | 'truthpack' | 'strategies';

export interface ProceduralMemorySlice {
  content: string;
  /** Display path relative to project root */
  source: string;
  mtimeMs: number;
  kind: ProceduralMemoryKind;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveTruthpackDir(projectPath: string): Promise<string | null> {
  for (const dir of TRUTHPACK_REL_DIRS) {
    const full = path.join(projectPath, dir);
    try {
      const st = await fs.promises.stat(full);
      if (st.isDirectory()) {
        return full;
      }
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Detect Guardrail-style monorepo (this repo and similar layouts).
 */
export async function detectGuardrailMonorepoLayout(
  projectPath: string
): Promise<{
  isMonorepo: boolean;
  hasTurbo: boolean;
  workspaceHint: string;
}> {
  const hasPnpmWorkspace = await pathExists(path.join(projectPath, 'pnpm-workspace.yaml'));
  const hasTurbo = await pathExists(path.join(projectPath, 'turbo.json'));
  const hasApps = await pathExists(path.join(projectPath, 'apps'));
  const hasPackages = await pathExists(path.join(projectPath, 'packages'));
  const isMonorepo =
    hasPnpmWorkspace || ((hasApps || hasPackages) && (hasTurbo || hasPnpmWorkspace));

  const bits: string[] = [];
  if (hasPnpmWorkspace) {
    bits.push('pnpm workspaces');
  }
  if (hasTurbo) {
    bits.push('Turbo');
  }
  if (hasApps) {
    bits.push('apps/*');
  }
  if (hasPackages) {
    bits.push('packages/*');
  }

  return {
    isMonorepo,
    hasTurbo,
    workspaceHint: bits.length > 0 ? bits.join(', ') : 'single package',
  };
}

/** Max mtime of root workspace markers so cache invalidates when layout changes. */
async function workspaceLayoutMtime(projectPath: string): Promise<number> {
  const files = ['pnpm-workspace.yaml', 'turbo.json', 'package.json'];
  let max = 0;
  for (const f of files) {
    try {
      const st = await fs.promises.stat(path.join(projectPath, f));
      max = Math.max(max, st.mtimeMs);
    } catch {
      /* skip */
    }
  }
  return max;
}

async function buildLayoutHintSlice(projectPath: string): Promise<ProceduralMemorySlice | null> {
  const { isMonorepo, workspaceHint } = await detectGuardrailMonorepoLayout(projectPath);
  if (!isMonorepo) {
    return null;
  }

  const truthpackWhere = TRUTHPACK_REL_DIRS.map((d) => `\`${d}/\``).join(' or ');
  const lines = [
    '## Guardrail / monorepo context (auto-detected)',
    '',
    `- Workspace: ${workspaceHint}`,
    `- Verified facts for tiers, routes, env vars, and CLI flags live in truthpack JSON under ${truthpackWhere} when present.`,
    '- Do not invent subscription tiers, API routes, error codes, or environment variable names; read truthpack slices below or run `vibecheck truthpack` / regenerate context if your team uses that workflow.',
    '- Main app packages in this repo: typically `apps/api`, `apps/web-ui`; shared code under `packages/*`.',
    '- Optional: `guardrail-context/` may ship additional truthpack CLI tooling in some checkouts.',
    '- `@guardrail/procedural-memory` (engram) writes `CLAUDE_STRATEGIES.md` at the repo root; keep it in sync with real session outcomes.',
    '',
  ];

  const content = lines.join('\n').slice(0, MAX_LAYOUT_HINT_CHARS);
  const mtimeMs = await workspaceLayoutMtime(projectPath);
  return {
    content,
    source: 'guardrail:monorepo-hint',
    mtimeMs,
    kind: 'layout',
  };
}

async function readTruthpackSlices(projectPath: string): Promise<ProceduralMemorySlice[]> {
  const dir = await resolveTruthpackDir(projectPath);
  if (!dir) {
    return [];
  }

  const out: ProceduralMemorySlice[] = [];
  for (const name of TRUTHPACK_FILES) {
    const full = path.join(dir, name);
    try {
      const raw = await fs.promises.readFile(full, 'utf8');
      const st = await fs.promises.stat(full);
      const rel = path.relative(projectPath, full);
      const truncated =
        raw.length > MAX_TRUTHPACK_FILE_CHARS
          ? `${raw.slice(0, MAX_TRUTHPACK_FILE_CHARS)}\n\n[… truncated — see ${rel} in repo]`
          : raw;
      out.push({
        content: truncated,
        source: rel.replace(/\\/g, '/'),
        mtimeMs: st.mtimeMs,
        kind: 'truthpack',
      });
    } catch {
      /* missing file */
    }
  }

  return out;
}

async function readStrategiesSlice(projectPath: string): Promise<ProceduralMemorySlice | null> {
  const rootFile = path.join(projectPath, 'CLAUDE_STRATEGIES.md');
  try {
    const raw = await fs.promises.readFile(rootFile, 'utf8');
    const st = await fs.promises.stat(rootFile);
    const content =
      raw.length > MAX_STRATEGIES_CHARS
        ? `${raw.slice(0, MAX_STRATEGIES_CHARS)}\n\n[… truncated for context budget]`
        : raw;
    return {
      content,
      source: 'CLAUDE_STRATEGIES.md',
      mtimeMs: st.mtimeMs,
      kind: 'strategies',
    };
  } catch {
    return null;
  }
}

/**
 * Load layout hint, truthpack JSON (if present), then CLAUDE_STRATEGIES.md.
 */
export async function loadProceduralMemorySlices(
  projectPath: string
): Promise<ProceduralMemorySlice[]> {
  const slices: ProceduralMemorySlice[] = [];

  const layout = await buildLayoutHintSlice(projectPath);
  if (layout) {
    slices.push(layout);
  }

  slices.push(...(await readTruthpackSlices(projectPath)));

  const strategies = await readStrategiesSlice(projectPath);
  if (strategies) {
    slices.push(strategies);
  }

  return slices;
}

/**
 * Cache key fragment: invalidates when any loaded slice would change.
 */
export async function proceduralMemoryCacheKey(projectPath: string): Promise<string> {
  const slices = await loadProceduralMemorySlices(projectPath);
  if (slices.length === 0) {
    return 'pm:none';
  }
  return `pm:${slices.map((s) => `${s.source}:${s.mtimeMs}`).join('|')}`;
}
