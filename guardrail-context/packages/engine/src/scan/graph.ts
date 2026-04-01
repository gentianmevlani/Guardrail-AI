import fs from "node:fs";
import path from "node:path";
import type { Graph } from "@guardrail-context/shared";

const IMPORT_RE = /^\s*import\s+.*from\s+["'](.+)["']/gm;
const REQUIRE_RE = /require\(["'](.+)["']\)/g;
const DYNAMIC_IMPORT_RE = /import\(["'](.+)["']\)/g;

export async function scanImportGraph(repoRoot: string, files: string[]): Promise<Graph> {
  const tsFiles = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  const nodes = tsFiles.map(f => path.relative(repoRoot, f));
  const nodeSet = new Set(nodes);
  const edges: Graph["edges"] = [];

  for (const abs of tsFiles) {
    const from = path.relative(repoRoot, abs);
    
    try {
      const text = await fs.promises.readFile(abs, "utf8");
      const imports = new Set<string>();

      for (const re of [IMPORT_RE, REQUIRE_RE, DYNAMIC_IMPORT_RE]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          imports.add(m[1]);
        }
      }

      for (const spec of imports) {
        if (!spec.startsWith(".") && !spec.startsWith("@/") && !spec.startsWith("~/")) continue;
        
        const resolved = resolveRelativeImport(repoRoot, abs, spec);
        if (resolved && nodeSet.has(resolved)) {
          edges.push({ from, to: resolved });
        }
      }
    } catch {}
  }

  return { nodes, edges };
}

function resolveRelativeImport(repoRoot: string, fromAbs: string, spec: string): string | null {
  // Handle alias imports
  let resolvedSpec = spec;
  if (spec.startsWith("@/") || spec.startsWith("~/")) {
    resolvedSpec = "./" + spec.slice(2);
  }

  const base = path.resolve(path.dirname(fromAbs), resolvedSpec);
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".js",
    base + ".jsx",
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(base, "index.jsx")
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return path.relative(repoRoot, c);
      }
    } catch {}
  }
  
  return null;
}

export function relatedFiles(graph: Graph, file: string, depth = 1): string[] {
  const out = new Set<string>();
  let frontier = new Set<string>([file]);

  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const f of frontier) {
      for (const e of graph.edges) {
        if (e.from === f && !out.has(e.to)) next.add(e.to);
        if (e.to === f && !out.has(e.from)) next.add(e.from);
      }
    }
    for (const n of next) out.add(n);
    frontier = next;
  }

  return [...out];
}

export function getImporters(graph: Graph, file: string): string[] {
  return graph.edges.filter(e => e.to === file).map(e => e.from);
}

export function getImports(graph: Graph, file: string): string[] {
  return graph.edges.filter(e => e.from === file).map(e => e.to);
}
