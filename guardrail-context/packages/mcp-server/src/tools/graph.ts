import path from "node:path";
import { readJsonSync, truthPackExists, relatedFiles, getImporters, getImports } from "@guardrail-context/engine";
import type { Graph } from "@guardrail-context/shared";

export async function graphRelatedTool(repoRoot: string, file: string, depth = 1) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const graph = readJsonSync<Graph>(outDir, "graph.json");
  
  // Normalize file path
  const normalizedFile = file.replace(/\\/g, "/");
  
  // Check if file exists in graph
  if (!graph.nodes.some(n => n.replace(/\\/g, "/") === normalizedFile)) {
    return {
      found: false,
      file,
      message: "File not found in import graph.",
      suggestion: "Check the file path or run 'guardrail-context index' to refresh."
    };
  }

  const related = relatedFiles(graph, file, depth);
  const imports = getImports(graph, file);
  const importedBy = getImporters(graph, file);

  return {
    found: true,
    file,
    depth,
    imports: imports.slice(0, 20),
    importedBy: importedBy.slice(0, 20),
    related: related.slice(0, 30),
    blastRadius: importedBy.length,
    message: importedBy.length > 10 
      ? `⚠️ HIGH IMPACT: This file is imported by ${importedBy.length} files. Changes may have wide effects.`
      : `This file is imported by ${importedBy.length} files.`
  };
}
