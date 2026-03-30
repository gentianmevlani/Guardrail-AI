/**
 * Upload a completed run to the Guardrail API so the web dashboard can show findings.
 * Uses POST /api/runs/save with X-API-Key authentication.
 */

export interface SaveRunToCloudPayload {
  repo: string;
  branch?: string;
  commitSha?: string;
  verdict: string;
  score: number;
  securityResult?: unknown;
  realityResult?: unknown;
  guardrailResult?: unknown;
  traceUrl?: string;
  videoUrl?: string;
  source?: "cli" | "mcp" | "vscode" | "github" | "ci";
  findings?: unknown[];
}

export interface UploadRunToCloudOptions {
  baseUrl: string;
  apiKey: string;
  payload: SaveRunToCloudPayload;
}

export interface UploadRunToCloudResult {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

/** True when `GUARDRAIL_API_KEY` and `GUARDRAIL_API_URL` are both set. */
export function isCloudSyncConfiguredFromEnv(): boolean {
  return getCloudSyncEnvFromEnv() !== null;
}

export function getCloudSyncEnvFromEnv(): {
  baseUrl: string;
  apiKey: string;
} | null {
  const apiKey = process.env["GUARDRAIL_API_KEY"]?.trim();
  let baseUrl =
    process.env["GUARDRAIL_API_URL"]?.trim() ||
    process.env["GUARDRAIL_API_BASE_URL"]?.trim();
  if (!baseUrl && apiKey && process.env["CI"]) {
    baseUrl = "https://api.guardrail.dev";
  }
  if (!apiKey || !baseUrl) {
    return null;
  }
  return { baseUrl, apiKey };
}

export async function uploadRunToCloud(
  options: UploadRunToCloudOptions,
): Promise<UploadRunToCloudResult> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/api/runs/save`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": options.apiKey,
      },
      body: JSON.stringify(options.payload),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { raw: text };
    }
    if (!res.ok) {
      const err =
        typeof parsed === "object" && parsed !== null && "error" in parsed
          ? String((parsed as { error?: string }).error)
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: err };
    }
    return { ok: true, status: res.status, data: parsed };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/** Map CLI ship verdicts to API list filters (pass / fail / review). */
export function shipVerdictToApi(verdict: string): { verdict: string; score: number } {
  const v = verdict.toUpperCase();
  if (v === "GO" || v === "PASS" || v === "SHIP") {
    return { verdict: "pass", score: 100 };
  }
  if (v === "NO-GO" || v === "NO_GO" || v === "FAIL") {
    return { verdict: "fail", score: 0 };
  }
  if (v === "WARN" || v === "REVIEW") {
    return { verdict: "review", score: 70 };
  }
  return { verdict: "review", score: 50 };
}
