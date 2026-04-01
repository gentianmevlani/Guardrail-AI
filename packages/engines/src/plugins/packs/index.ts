/**
 * Built-in framework rule packs — shipped with Guardrail.
 * Auto-selected based on framework detection or explicit config.
 */

export { nextjsPack } from './nextjs';
export { expressPack } from './express';
export { pythonPack } from './python';

import type { PluginManifest } from '../types';
import { nextjsPack } from './nextjs';
import { expressPack } from './express';
import { pythonPack } from './python';

/** All built-in packs indexed by framework name. */
export const BUILTIN_PACKS: Record<string, PluginManifest> = {
  nextjs: nextjsPack,
  express: expressPack,
  python: pythonPack,
  fastapi: pythonPack,
  django: pythonPack,
  flask: pythonPack,
};

/** Get the builtin pack for a detected framework, or null. */
export function getBuiltinPack(framework: string): PluginManifest | null {
  return BUILTIN_PACKS[framework.toLowerCase()] ?? null;
}

/** List all available builtin packs. */
export function listBuiltinPacks(): Array<{ framework: string; manifest: PluginManifest }> {
  const seen = new Set<string>();
  const result: Array<{ framework: string; manifest: PluginManifest }> = [];

  for (const [framework, manifest] of Object.entries(BUILTIN_PACKS)) {
    if (seen.has(manifest.name)) continue;
    seen.add(manifest.name);
    result.push({ framework, manifest });
  }

  return result;
}
