import path from "node:path";
import fs from "node:fs";
import { walkFiles } from "@guardrail-context/shared";
import { writeJson } from "./truthpack/write.js";
import { scanSymbols } from "./scan/symbols.js";
import { scanDeps } from "./scan/deps.js";
import { scanImportGraph } from "./scan/graph.js";
import { scanRisk } from "./scan/risk.js";
import { computeImportance } from "./scan/importance.js";
import { scanPatterns } from "./scan/patterns.js";
import { scanAntiPatterns } from "./scan/antipatterns.js";
import { scanRoutes } from "./scan/routes.js";
import type { TruthPack, DepsTruth } from "@guardrail-context/shared";

export async function buildTruthPack(repoRoot: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");
  const filesAbs = await walkFiles(repoRoot, {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".md"]
  });
  const filesRel = filesAbs.map(f => path.relative(repoRoot, f));

  console.log(`  Scanning ${filesAbs.length} files...`);

  const deps = await scanDeps(repoRoot);
  console.log(`  Found ${Object.keys(deps.packageJson?.dependencies || {}).length} dependencies`);

  const graph = await scanImportGraph(repoRoot, filesAbs);
  console.log(`  Built import graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  const symbols = scanSymbols(repoRoot, filesAbs);
  console.log(`  Found ${symbols.length} symbols`);

  const risk = scanRisk(filesRel);
  const importance = computeImportance(filesRel, graph, risk);
  const patterns = await scanPatterns(repoRoot, filesAbs);
  console.log(`  Found ${Object.keys(patterns).length} golden patterns`);

  const antipatterns = await scanAntiPatterns(repoRoot, filesAbs);
  console.log(`  Found ${antipatterns.summary.total} anti-patterns (${antipatterns.summary.critical} critical)`);

  const routes = await scanRoutes(repoRoot, filesAbs);
  console.log(`  Found ${routes.summary.total} API routes`);

  const pack: TruthPack = {
    version: "1",
    generatedAt: new Date().toISOString(),
    repoRoot,
    stack: {
      languages: inferLanguages(filesRel),
      frameworks: inferFrameworks(deps),
      pkgManager: deps.lockfile.type === "unknown" ? undefined : deps.lockfile.type
    },
    files: { total: filesRel.length }
  };

  await fs.promises.mkdir(outDir, { recursive: true });
  await writeJson(outDir, "truthpack.json", pack);
  await writeJson(outDir, "deps.json", deps);
  await writeJson(outDir, "graph.json", graph);
  await writeJson(outDir, "symbols.json", symbols);
  await writeJson(outDir, "risk.json", risk);
  await writeJson(outDir, "importance.json", importance);
  await writeJson(outDir, "patterns.json", patterns);
  await writeJson(outDir, "antipatterns.json", antipatterns);
  await writeJson(outDir, "routes.json", routes);

  return { outDir, pack, symbols, deps, graph, risk, importance, patterns, antipatterns, routes };
}

function inferLanguages(filesRel: string[]): string[] {
  const s = new Set<string>();
  if (filesRel.some(f => f.endsWith(".ts") || f.endsWith(".tsx"))) s.add("TypeScript");
  if (filesRel.some(f => f.endsWith(".js") || f.endsWith(".jsx"))) s.add("JavaScript");
  if (filesRel.some(f => f.endsWith(".py"))) s.add("Python");
  if (filesRel.some(f => f.endsWith(".go"))) s.add("Go");
  if (filesRel.some(f => f.endsWith(".rs"))) s.add("Rust");
  return [...s];
}

function inferFrameworks(deps: DepsTruth): string[] {
  const d = {
    ...(deps.packageJson?.dependencies ?? {}),
    ...(deps.packageJson?.devDependencies ?? {})
  };
  const s = new Set<string>();
  if (d["next"]) s.add("Next.js");
  if (d["react"]) s.add("React");
  if (d["vue"]) s.add("Vue");
  if (d["express"]) s.add("Express");
  if (d["fastify"]) s.add("Fastify");
  if (d["@nestjs/core"]) s.add("NestJS");
  if (d["prisma"] || d["@prisma/client"]) s.add("Prisma");
  if (d["drizzle-orm"]) s.add("Drizzle");
  if (d["tailwindcss"]) s.add("Tailwind");
  if (d["zustand"]) s.add("Zustand");
  return [...s];
}

export * from "./truthpack/write.js";
export * from "./truthpack/read.js";
export * from "./scan/symbols.js";
export * from "./scan/deps.js";
export * from "./scan/graph.js";
export * from "./scan/risk.js";
export * from "./scan/importance.js";
export * from "./scan/patterns.js";
export * from "./scan/antipatterns.js";
export * from "./scan/routes.js";
export * from "./scan/autopilot.js";
export * from "./scan/fuzzy-search.js";
export * from "./scan/vulnerabilities.js";
export * from "./scan/hallucination-tests.js";
export * from "./scan/ownership.js";
export * from "./scan/architecture.js";
export * from "./verify/fast.js";
