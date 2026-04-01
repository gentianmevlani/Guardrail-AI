/**
 * Single source of truth for CLI/extension scan scores and ship eligibility.
 * Aligns ship threshold with TrustScoreService defaults (SHIP ≥ 85).
 */

/** Minimum integrity score required to treat a scan as ship-eligible (with PASS verdict). */
export const GUARDRAIL_SHIP_SCORE_THRESHOLD = 85;

export type GuardrailScanVerdict = "PASS" | "FAIL" | "WARN";

/**
 * Penalty weights — keep in sync with `bin/runners/runScan.js` lightweight scan.
 */
export function scoreFromSeverityBuckets(
  critical: number,
  high: number,
  medium: number,
  low: number,
  info: number,
): number {
  const penalty =
    critical * 15 + high * 8 + medium * 3 + low * 1 + info * 0;
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function gradeFromScanScore(score: number | null): string {
  if (score === null) {
    return "?";
  }
  if (score >= 90) {
    return "A";
  }
  if (score >= 80) {
    return "B";
  }
  if (score >= 70) {
    return "C";
  }
  if (score >= 60) {
    return "D";
  }
  return "F";
}

/**
 * Ship eligibility from a **scan** (`guardrail scan --json`): unknown score → not ship;
 * FAIL/WARN → not ship; PASS requires score ≥ {@link GUARDRAIL_SHIP_SCORE_THRESHOLD}.
 */
export function canShipFromScanState(
  score: number | null,
  verdict: GuardrailScanVerdict | string | undefined,
): boolean {
  if (score === null) {
    return false;
  }
  if (verdict === "FAIL" || verdict === "WARN") {
    return false;
  }
  if (verdict === "PASS") {
    return score >= GUARDRAIL_SHIP_SCORE_THRESHOLD;
  }
  return score >= GUARDRAIL_SHIP_SCORE_THRESHOLD;
}
