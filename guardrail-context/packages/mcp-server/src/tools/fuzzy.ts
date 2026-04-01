import path from "node:path";
import { readJsonSync, truthPackExists, fuzzySearchSymbols, suggestSimilarSymbols } from "@guardrail-context/engine";
import type { SymbolRecord } from "@guardrail-context/shared";

export async function symbolsFuzzyTool(repoRoot: string, query: string, kind?: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const symbols = readJsonSync<SymbolRecord[]>(outDir, "symbols.json");
  let filtered = symbols;
  
  if (kind) {
    filtered = symbols.filter(s => s.kind === kind);
  }

  const matches = fuzzySearchSymbols(filtered, query, 10);

  if (matches.length === 0) {
    return {
      found: false,
      query,
      message: `No symbols matching "${query}" found.`,
      suggestion: "Try a different search term or check available symbol kinds."
    };
  }

  return {
    found: true,
    query,
    matches: matches.map(m => ({
      name: m.symbol.name,
      kind: m.symbol.kind,
      file: m.symbol.file,
      line: m.symbol.startLine,
      matchType: m.matchType,
      confidence: Math.round(m.score * 100) + "%",
      proof: `${m.symbol.file}:${m.symbol.startLine}`
    })),
    bestMatch: matches[0] ? {
      name: matches[0].symbol.name,
      file: matches[0].symbol.file,
      confidence: Math.round(matches[0].score * 100) + "%"
    } : null,
    message: `Found ${matches.length} symbols matching "${query}". Best match: ${matches[0]?.symbol.name} (${Math.round(matches[0]?.score * 100)}% confident)`
  };
}
