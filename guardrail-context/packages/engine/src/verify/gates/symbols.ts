import type { SymbolRecord } from "@guardrail-context/shared";
import type { GateResult } from "./scope.js";

export function symbolsGate(referencedSymbols: string[], symbols: SymbolRecord[]): GateResult {
  const symbolSet = new Set(symbols.map(s => s.name));
  const missing: string[] = [];

  for (const ref of referencedSymbols) {
    if (!symbolSet.has(ref)) {
      missing.push(ref);
    }
  }

  if (missing.length) {
    return {
      ok: false,
      details: `Missing symbols (likely hallucinated):\n${missing.slice(0, 30).join(", ")}`
    };
  }

  return { ok: true, details: "All referenced symbols exist" };
}

export function findMissingSymbols(referencedSymbols: string[], symbols: SymbolRecord[]): string[] {
  const symbolSet = new Set(symbols.map(s => s.name));
  return referencedSymbols.filter(ref => !symbolSet.has(ref));
}
