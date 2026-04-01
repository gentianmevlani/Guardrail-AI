import type { DecisionGraph } from '../types/decision-graph';

/** Unique graph.project values with session counts, most sessions first. */
export function projectSessionCounts(graphs: DecisionGraph[]): Array<{ project: string; sessions: number }> {
  const map = new Map<string, number>();
  for (const g of graphs) {
    map.set(g.project, (map.get(g.project) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([project, sessions]) => ({ project, sessions }));
}
