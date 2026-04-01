import fs from "node:fs";
import path from "node:path";

const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".guardrail-context",
  "coverage",
  ".cache"
]);

export type WalkOptions = {
  ignores?: Set<string>;
  extensions?: string[];
  maxDepth?: number;
};

export async function walkFiles(root: string, opts?: WalkOptions): Promise<string[]> {
  const ignores = opts?.ignores ?? DEFAULT_IGNORES;
  const extensions = opts?.extensions;
  const maxDepth = opts?.maxDepth ?? 20;
  const out: string[] = [];

  async function rec(dir: string, depth: number) {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (ignores.has(e.name) || e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        
        if (e.isDirectory()) {
          await rec(p, depth + 1);
        } else {
          if (extensions) {
            const ext = path.extname(e.name);
            if (extensions.includes(ext)) out.push(p);
          } else {
            out.push(p);
          }
        }
      }
    } catch {}
  }

  await rec(root, 0);
  return out;
}

export function walkFilesSync(root: string, opts?: WalkOptions): string[] {
  const ignores = opts?.ignores ?? DEFAULT_IGNORES;
  const extensions = opts?.extensions;
  const maxDepth = opts?.maxDepth ?? 20;
  const out: string[] = [];

  function rec(dir: string, depth: number) {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (ignores.has(e.name) || e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        
        if (e.isDirectory()) {
          rec(p, depth + 1);
        } else {
          if (extensions) {
            const ext = path.extname(e.name);
            if (extensions.includes(ext)) out.push(p);
          } else {
            out.push(p);
          }
        }
      }
    } catch {}
  }

  rec(root, 0);
  return out;
}
