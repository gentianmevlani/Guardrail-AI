import type { Graph, RiskMap, Importance } from "@guardrail-context/shared";

export function computeImportance(filesRel: string[], graph: Graph, risk: RiskMap): Importance {
  // v1: degree centrality + risk score
  const degree: Record<string, number> = {};
  for (const f of filesRel) degree[f] = 0;

  for (const e of graph.edges) {
    degree[e.from] = (degree[e.from] ?? 0) + 1;
    degree[e.to] = (degree[e.to] ?? 0) + 1;
  }

  const maxDeg = Math.max(1, ...Object.values(degree));
  const out: Importance = {};

  for (const f of filesRel) {
    const centrality = (degree[f] ?? 0) / maxDeg;   // 0..1
    const riskScore = risk[f]?.score ?? 0;
    
    // Formula: Risk dominates, centrality adds
    out[f] = (3.0 * riskScore) + (1.5 * centrality);
  }

  return out;
}

export function getTopFiles(importance: Importance, n = 20): Array<{ file: string; score: number }> {
  return Object.entries(importance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([file, score]) => ({ file, score: Math.round(score * 100) / 100 }));
}

export function getCriticalFiles(importance: Importance, threshold = 2.0): string[] {
  return Object.entries(importance)
    .filter(([_, score]) => score >= threshold)
    .map(([f, _]) => f);
}
