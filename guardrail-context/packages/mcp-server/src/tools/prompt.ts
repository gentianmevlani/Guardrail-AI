/**
 * Prompt Firewall MCP Tools
 *
 * Exposes prompt analysis, injection detection, and combined safety checks
 * through the MCP server.
 */

// ---------------------------------------------------------------------------
// Inline detectors (self-contained regex logic from @guardrail/llm-safety)
// Avoids adding a cross-workspace dependency for three small functions.
// ---------------------------------------------------------------------------

// --- Prompt injection ---
const INJECTION_PATTERNS: RegExp[] = [
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

interface InjectionMatch {
  patternIndex: number;
  snippet: string;
}

function detectPromptInjection(text: string): InjectionMatch | null {
  const t = text.slice(0, 50_000);
  for (let i = 0; i < INJECTION_PATTERNS.length; i++) {
    const m = INJECTION_PATTERNS[i]?.exec(t);
    if (m && m[0]) {
      const start = Math.max(0, (m.index ?? 0) - 20);
      const snippet = t.slice(start, start + 120);
      return { patternIndex: i, snippet };
    }
  }
  return null;
}

// --- PII ---
interface PIIMatch {
  type: "phone" | "email" | "ssn" | "credit-card";
  start: number;
  end: number;
  text: string;
}

function detectPII(text: string): PIIMatch[] {
  const out: PIIMatch[] = [];
  const t = text.slice(0, 200_000);
  const patterns: Array<{ re: RegExp; type: PIIMatch["type"] }> = [
    { re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, type: "phone" },
    { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, type: "email" },
    { re: /\b\d{3}-\d{2}-\d{4}\b/g, type: "ssn" },
    { re: /\b(?:\d[ -]*?){13,19}\b/g, type: "credit-card" },
  ];
  for (const { re, type } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      if (m[0]) {
        out.push({ type, start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    }
  }
  return out;
}

// --- Unicode anomalies ---
interface UnicodeAnomaly {
  kind: "invisible" | "mixed-script-suspicious";
  detail: string;
}

function detectUnicodeAnomalies(text: string): UnicodeAnomaly[] {
  const anomalies: UnicodeAnomaly[] = [];
  if (/[\u200B-\u200D\uFEFF\u2060\u180E]/.test(text)) {
    anomalies.push({ kind: "invisible", detail: "Zero-width or invisible characters detected" });
  }
  if (/[\u0400-\u04FF].*[\u0041-\u005A\u0061-\u007A]/.test(text)) {
    anomalies.push({ kind: "mixed-script-suspicious", detail: "Cyrillic + Latin mix — possible homoglyph attack" });
  }
  return anomalies;
}

// ---------------------------------------------------------------------------
// Tier gating (same pattern as security.ts — reads env; aligns with
// @guardrail/core unified-auth: free tier gets summary only)
// ---------------------------------------------------------------------------

const UPGRADE_HINT =
  "Upgrade for full firewall analysis (task breakdown, fixes, future plan): https://guardrailai.dev/billing";

function mcpShouldRedactDetails(): boolean {
  const t = (process.env.GUARDRAIL_TIER || process.env.GUARDRAIL_PLAN || "free").trim().toLowerCase();
  return t === "free" || t === "";
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

export async function promptFirewallAnalyzeTool(
  repoRoot: string,
  prompt: string,
  options?: {
    autoBreakdown?: boolean;
    autoVerify?: boolean;
    autoFix?: boolean;
    includeVersionControl?: boolean;
    generatePlan?: boolean;
  },
) {
  const start = Date.now();

  try {
    // Dynamic import — AdvancedPromptFirewall lives in ai-guardrails package
    const firewallMod = await import(
      "../../../../packages/ai-guardrails/src/firewall/advanced-prompt-firewall.js"
    );
    const createFirewall: typeof import("../../../../packages/ai-guardrails/src/firewall/advanced-prompt-firewall.js").createPromptFirewall =
      firewallMod.createPromptFirewall;

    const firewall = createFirewall(repoRoot);
    const result = await firewall.process(prompt, options ?? {});
    const latency = Date.now() - start;

    const hasHallucinationFail = result.verification.checks.some(
      (c: any) => c.name === "Hallucination Risk" && c.status === "fail",
    );

    const verdict = result.verification.passed ? "PASS" : result.verification.blockers.length > 0 ? "FAIL" : "WARN";

    // Free tier: return score and verdict only — redact detailed findings
    if (mcpShouldRedactDetails()) {
      return {
        verdict,
        proof: {
          score: result.verification.score,
          checksCount: result.verification.checks.length,
          passedCount: result.verification.checks.filter((c: any) => c.status === "pass").length,
          blockerCount: result.verification.blockers.length,
          taskCount: result.taskBreakdown.length,
          fixCount: result.immediateFixes.length,
        },
        nextAction: result.recommendations[0] ?? "Proceed with implementation",
        latency,
        blockedHallucination: hasHallucinationFail,
        issueDetailsRedacted: true,
        upgradeHint: UPGRADE_HINT,
      };
    }

    return {
      verdict,
      proof: {
        score: result.verification.score,
        checks: result.verification.checks,
        blockers: result.verification.blockers,
        taskBreakdown: result.taskBreakdown,
        immediateFixes: result.immediateFixes,
        recommendations: result.recommendations,
        futurePlan: result.futurePlan,
      },
      nextAction: result.recommendations[0] ?? "Proceed with implementation",
      latency,
      blockedHallucination: hasHallucinationFail,
    };
  } catch (e: any) {
    // Fallback: run just the inline detectors
    const injection = detectPromptInjection(prompt);
    const pii = detectPII(prompt);
    const unicode = detectUnicodeAnomalies(prompt);
    const latency = Date.now() - start;

    const hasSafetyIssue = injection !== null;
    return {
      verdict: hasSafetyIssue ? "FAIL" : pii.length > 0 || unicode.length > 0 ? "WARN" : "PASS",
      proof: {
        firewallError: e.message,
        fallbackAnalysis: true,
        injection,
        pii: pii.length,
        unicodeAnomalies: unicode,
      },
      nextAction: hasSafetyIssue
        ? "Reject or sanitize the prompt — injection pattern detected"
        : "Prompt firewall unavailable; inline safety checks completed",
      latency,
      blockedHallucination: false,
    };
  }
}

export async function promptInjectionDetectTool(text: string) {
  const start = Date.now();
  const hit = detectPromptInjection(text);
  const latency = Date.now() - start;

  if (hit) {
    return {
      verdict: "FAIL" as const,
      proof: { patternIndex: hit.patternIndex, snippet: hit.snippet },
      nextAction: "Reject or sanitize the prompt — injection pattern detected",
      latency,
      blockedHallucination: true,
      prevented: { type: "injection" as const, value: hit.snippet },
    };
  }

  return {
    verdict: "PASS" as const,
    proof: null,
    nextAction: "Prompt is clean — no injection patterns matched",
    latency,
    blockedHallucination: false,
  };
}

export async function promptSafetyCheckTool(text: string) {
  const start = Date.now();
  const injection = detectPromptInjection(text);
  const pii = detectPII(text);
  const unicode = detectUnicodeAnomalies(text);
  const latency = Date.now() - start;

  const hasInjection = injection !== null;
  const hasPII = pii.length > 0;
  const hasUnicode = unicode.length > 0;

  let verdict: "PASS" | "WARN" | "FAIL";
  let nextAction: string;

  if (hasInjection) {
    verdict = "FAIL";
    nextAction = "Reject prompt — injection pattern detected";
  } else if (hasPII || hasUnicode) {
    verdict = "WARN";
    const warnings: string[] = [];
    if (hasPII) warnings.push(`${pii.length} PII match(es) found`);
    if (hasUnicode) warnings.push(`${unicode.length} unicode anomaly/anomalies found`);
    nextAction = `Review prompt — ${warnings.join("; ")}`;
  } else {
    verdict = "PASS";
    nextAction = "Prompt is clean — all safety checks passed";
  }

  // Free tier: return verdict + counts only — redact PII text values
  if (mcpShouldRedactDetails()) {
    return {
      verdict,
      proof: {
        summary: {
          injectionDetected: hasInjection,
          piiDetected: hasPII,
          piiCount: pii.length,
          unicodeAnomaliesDetected: hasUnicode,
          unicodeAnomalyCount: unicode.length,
        },
      },
      nextAction,
      latency,
      blockedHallucination: hasInjection,
      issueDetailsRedacted: true,
      upgradeHint: UPGRADE_HINT,
    };
  }

  return {
    verdict,
    proof: {
      injection: injection ?? null,
      pii,
      piiCount: pii.length,
      unicodeAnomalies: unicode,
      summary: {
        injectionDetected: hasInjection,
        piiDetected: hasPII,
        unicodeAnomaliesDetected: hasUnicode,
      },
    },
    nextAction,
    latency,
    blockedHallucination: hasInjection,
  };
}
