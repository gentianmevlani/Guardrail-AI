/** Commander-parsed options for `guardrail reality`. */
export type RealityCliOptions = Record<string, string | boolean | undefined>;

export function strOpt(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
