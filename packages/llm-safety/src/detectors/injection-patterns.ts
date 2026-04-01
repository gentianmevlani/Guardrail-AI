/**
 * Prompt-injection pattern database (rule-based core).
 */

const PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)\b/i,
  /\bdisregard\s+(the\s+)?(system|developer)\s+message\b/i,
  /\byou\s+are\s+now\s+(a|an|in)\s+/i,
  /\bnew\s+instructions?\s*:/i,
  /\boverride\s+(the\s+)?(safety|policy|rules?)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\b.*\bmode\b/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>assistant/i,
];

export interface InjectionMatch {
  patternIndex: number;
  snippet: string;
}

export function detectPromptInjection(text: string): InjectionMatch | null {
  const t = text.slice(0, 50_000);
  for (let i = 0; i < PATTERNS.length; i++) {
    const m = PATTERNS[i]?.exec(t);
    if (m && m[0]) {
      const start = Math.max(0, (m.index ?? 0) - 20);
      const snippet = t.slice(start, start + 120);
      return { patternIndex: i, snippet };
    }
  }
  return null;
}
