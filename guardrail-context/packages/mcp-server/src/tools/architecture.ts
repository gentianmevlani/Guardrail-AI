import path from "node:path";
import { readJsonSync, truthPackExists, checkArchitectureBoundaries, DEFAULT_BOUNDARIES } from "@guardrail-context/engine";
import type { Graph } from "@guardrail-context/shared";

export async function architectureCheckTool(repoRoot: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const graph = readJsonSync<Graph>(outDir, "graph.json");
  const report = checkArchitectureBoundaries(graph, { boundaries: DEFAULT_BOUNDARIES });

  if (report.violations.length === 0) {
    return {
      clean: true,
      summary: report.summary,
      message: `✅ Architecture is clean! All ${report.summary.cleanBoundaries.length} boundaries respected.`
    };
  }

  return {
    clean: false,
    summary: report.summary,
    violations: report.violations.slice(0, 20).map(v => ({
      file: v.file,
      boundary: v.boundary,
      imports: v.importedFrom,
      message: v.message
    })),
    message: `❌ ${report.summary.totalViolations} architecture violations found. Fix cross-boundary imports.`
  };
}

export async function boundaryCheckTool(repoRoot: string, file: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const graph = readJsonSync<Graph>(outDir, "graph.json");
  const report = checkArchitectureBoundaries(graph, { boundaries: DEFAULT_BOUNDARIES });
  
  const fileViolations = report.violations.filter(v => 
    v.file === file || v.file.endsWith(file)
  );

  if (fileViolations.length === 0) {
    return {
      file,
      clean: true,
      message: `✅ ${file} respects all architecture boundaries.`
    };
  }

  return {
    file,
    clean: false,
    violations: fileViolations.map(v => ({
      boundary: v.boundary,
      imports: v.importedFrom,
      fix: `Move shared code to shared/ or remove import of ${v.importedFrom}`
    })),
    message: `❌ ${file} violates ${fileViolations.length} architecture boundaries.`
  };
}
