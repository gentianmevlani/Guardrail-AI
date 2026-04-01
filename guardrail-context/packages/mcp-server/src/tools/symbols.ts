import path from "node:path";
import { readJsonSync, truthPackExists } from "@guardrail-context/engine";
import type { SymbolRecord } from "@guardrail-context/shared";

export async function symbolsExistsTool(repoRoot: string, name: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const symbols = readJsonSync<SymbolRecord[]>(outDir, "symbols.json");
  const found = symbols.find(s => s.name === name);

  if (found) {
    return {
      exists: true,
      name,
      kind: found.kind,
      file: found.file,
      line: found.startLine,
      proof: `${found.file}:${found.startLine}`,
      isExported: found.isExported
    };
  }

  return {
    exists: false,
    name,
    message: "Symbol not found. DO NOT use this symbol - it may be hallucinated.",
    suggestion: "Check spelling or search for similar symbols."
  };
}

export async function symbolsFindTool(repoRoot: string, name: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const symbols = readJsonSync<SymbolRecord[]>(outDir, "symbols.json");
  const matches = symbols.filter(s => s.name === name || s.name.toLowerCase().includes(name.toLowerCase()));

  if (matches.length === 0) {
    return {
      found: false,
      name,
      message: "No matching symbols found.",
      suggestion: "Try a different search term."
    };
  }

  return {
    found: true,
    name,
    matches: matches.slice(0, 10).map(m => ({
      name: m.name,
      kind: m.kind,
      file: m.file,
      startLine: m.startLine,
      endLine: m.endLine,
      isExported: m.isExported,
      proof: `${m.file}:${m.startLine}`
    }))
  };
}
