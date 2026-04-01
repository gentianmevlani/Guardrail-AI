/**
 * Free tier: show severity counts only; redact file paths, finding lists, and snippets elsewhere.
 * Used by CLI, MCP integrations, and any tool that mirrors web UI entitlements.
 */

export const FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT =
  "Upgrade to a paid plan for full finding details (paths, rules, evidence). https://guardrailai.dev/billing";

export function shouldRedactIssueDetails(tier: string | undefined | null): boolean {
  const t = (tier ?? "free").toLowerCase();
  return t === "free";
}

export interface RedactableScanLike {
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalScore: number;
  };
  findings: unknown[];
  topBlockers: Array<Record<string, unknown>>;
  hotspots: Array<{ file: string; score: number; findings: number }>;
  nextActions: string[];
  truthPackContext?: unknown;
}

/**
 * Returns a new object: summary preserved; findings/blockers cleared; hotspots cleared;
 * nextActions filtered to remove finding-id placeholders; adds upgrade hint.
 */
export function redactCliScanOutputForFreeTier<T extends RedactableScanLike>(
  result: T,
): T & { issueDetailsRedacted: true; upgradeHint: string } {
  const nextActions = [
    FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT,
    ...result.nextActions.filter(
      (a) => typeof a === "string" && !a.includes("finding-id") && !a.includes("explain <finding"),
    ),
  ];

  return {
    ...result,
    findings: [],
    topBlockers: [],
    hotspots: [],
    nextActions: nextActions.length > 0 ? nextActions : [FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT],
    truthPackContext: undefined,
    issueDetailsRedacted: true,
    upgradeHint: FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT,
  };
}

/** Minimal proof graph for free tier (no file paths in nodes). */
export function redactProofGraphForFreeTier(proofGraph: {
  nodes: unknown[];
  edges: unknown[];
  evidenceStrength: number;
  verdict?: string;
  findings?: unknown[];
}): {
  redacted: true;
  nodeCount: number;
  edgeCount: number;
  evidenceStrength: number;
  verdict?: string;
  findingIdCount: number;
  message: string;
} {
  return {
    redacted: true,
    nodeCount: proofGraph.nodes.length,
    edgeCount: proofGraph.edges.length,
    evidenceStrength: proofGraph.evidenceStrength,
    verdict: proofGraph.verdict,
    findingIdCount: proofGraph.findings?.length ?? 0,
    message: FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT,
  };
}
