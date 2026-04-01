/**
 * Split decision graphs into baseline vs enhanced cohorts for reports.
 */

import type { DecisionGraph } from '../types/decision-graph';

export interface CohortSplit {
  baseline: DecisionGraph[];
  enhanced?: DecisionGraph[];
  cohortNote: string;
}

export function partitionCohorts(
  graphs: DecisionGraph[],
  opts: { splitDate?: string; baselineCount: number }
): CohortSplit {
  const sorted = [...graphs].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  if (opts.splitDate) {
    const t = Date.parse(opts.splitDate);
    if (Number.isNaN(t)) {
      throw new Error(`Invalid --split-date (expected ISO 8601): ${opts.splitDate}`);
    }
    const baseline = sorted.filter((g) => new Date(g.endTime).getTime() < t);
    const enhanced = sorted.filter((g) => new Date(g.startTime).getTime() >= t);
    return {
      baseline,
      enhanced: enhanced.length > 0 ? enhanced : undefined,
      cohortNote: `date split at ${opts.splitDate}: baseline = sessions ended before; enhanced = sessions started on/after`,
    };
  }

  const n = Math.min(Math.max(0, opts.baselineCount), sorted.length);
  const baseline = sorted.slice(0, n);
  const enhanced = sorted.length > n ? sorted.slice(n) : undefined;
  return {
    baseline,
    enhanced,
    cohortNote: `chronological: first ${n} session(s) = baseline, remainder = enhanced cohort`,
  };
}
