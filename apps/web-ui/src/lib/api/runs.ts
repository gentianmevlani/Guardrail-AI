/**
 * Runs API - Run details and artifacts
 */
import { API_BASE, ApiResponse, logger } from "./core";

export interface RunDetailFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  rule: string;
  message: string;
  file: string;
  line: number;
  fixable: boolean;
}

export interface RunDetailArtifact {
  name: string;
  type: "report" | "replay" | "trace" | "sarif" | "badge";
  url: string;
  size: string;
}

export interface RunDetailGate {
  name: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  message?: string;
}

export interface RunDetailMockProofTrace {
  id: string;
  pattern: string;
  file: string;
  line: number;
  evidence: string;
}

export interface RunDetailAirlockResult {
  package: string;
  version: string;
  vulnerability?: string;
  severity?: "critical" | "high" | "medium" | "low";
  status: "safe" | "vulnerable" | "outdated";
}

export interface RunDetailReplayData {
  timeline: Array<{ action: string; timestamp?: string }>;
  network: Array<{ method: string; url: string; status: number }>;
  evidence?: string;
}

export interface RunDetail {
  id: string;
  timestamp: string;
  repo: string;
  branch: string;
  commit: string;
  pr?: number;
  trigger: "local" | "ci" | "mcp";
  profile: "quick" | "standard" | "strict";
  verdict: "SHIP" | "NO_SHIP" | "PENDING" | "ERROR";
  duration: number;
  tools: string[];
  author?: string;
  policyHash: string;
  findings: RunDetailFinding[];
  artifacts: RunDetailArtifact[];
  gates: RunDetailGate[];
  mockproofTraces: RunDetailMockProofTrace[];
  airlockResults: RunDetailAirlockResult[];
  replayData?: RunDetailReplayData;
}

interface SecurityDetection {
  secretType?: string;
  filePath?: string;
  line?: number;
  confidence?: number;
  recommendation?: string;
}

interface GuardrailFindingData {
  type?: string;
  file?: string;
  severity?: "error" | "warning" | "info";
}

interface SecurityResultData {
  verdict?: "pass" | "fail" | "skip";
  total?: number;
  detections?: SecurityDetection[];
}

interface RealityResultData {
  verdict?: "pass" | "fail" | "skip";
  duration?: number;
  message?: string;
}

interface GuardrailResultData {
  verdict?: "pass" | "fail" | "skip";
  score?: number;
  findings?: GuardrailFindingData[];
}

interface RawRunData {
  id: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: "pending" | "running" | "completed" | "failed";
  verdict?: "pass" | "fail";
  repo?: string;
  branch?: string;
  commitSha?: string;
  traceUrl?: string;
  videoUrl?: string;
  securityResult?: SecurityResultData;
  realityResult?: RealityResultData;
  guardrailResult?: GuardrailResultData;
}

export async function fetchRunDetail(id: string): Promise<RunDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/runs/${id}`, {
      credentials: "include",
    });
    if (!res.ok) return null;

    const json: ApiResponse<{
      run: RawRunData;
      reportJson?: Record<string, unknown>;
    }> = await res.json();

    if (!json.data?.run) return null;

    const run = json.data.run;
    const securityResult = run.securityResult || {};
    const realityResult = run.realityResult || {};
    const guardrailResult = run.guardrailResult || {};

    const findings: RunDetailFinding[] = [];
    if (securityResult.detections) {
      securityResult.detections.forEach((d: SecurityDetection, i: number) => {
        findings.push({
          id: `sec-${i}`,
          severity:
            (d.confidence ?? 0) > 0.8
              ? "high"
              : (d.confidence ?? 0) > 0.5
                ? "medium"
                : "low",
          rule: d.secretType || "secret-detected",
          message: d.recommendation || "Potential secret detected",
          file: d.filePath || "unknown",
          line: d.line || 1,
          fixable: true,
        });
      });
    }
    if (guardrailResult.findings) {
      guardrailResult.findings.forEach((f: GuardrailFindingData, i: number) => {
        findings.push({
          id: `guard-${i}`,
          severity:
            f.severity === "error"
              ? "high"
              : f.severity === "warning"
                ? "medium"
                : "low",
          rule: f.type || "guardrail-violation",
          message: f.type?.replace(/_/g, " ") || "guardrail violation",
          file: f.file || "unknown",
          line: 1,
          fixable: f.type === "console_log",
        });
      });
    }

    const gates: RunDetailGate[] = [];
    if (securityResult) {
      gates.push({
        name: "Security",
        status:
          securityResult.verdict === "pass"
            ? "pass"
            : securityResult.verdict === "fail"
              ? "fail"
              : "skip",
        duration: 0,
        message:
          securityResult.verdict === "pass"
            ? "No security issues"
            : `${securityResult.total || 0} issues found`,
      });
    }
    if (realityResult) {
      gates.push({
        name: "Reality",
        status:
          realityResult.verdict === "pass"
            ? "pass"
            : realityResult.verdict === "fail"
              ? "fail"
              : "skip",
        duration: realityResult.duration || 0,
        message:
          realityResult.verdict === "pass"
            ? "All tests passed"
            : realityResult.message || "Tests completed",
      });
    }
    if (guardrailResult) {
      gates.push({
        name: "Guardrails",
        status:
          guardrailResult.verdict === "pass"
            ? "pass"
            : guardrailResult.verdict === "fail"
              ? "fail"
              : "skip",
        duration: 0,
        message:
          guardrailResult.verdict === "pass"
            ? "All checks passed"
            : `Score: ${guardrailResult.score || 0}`,
      });
    }

    const artifacts: RunDetailArtifact[] = [];
    if (run.traceUrl) {
      artifacts.push({
        name: "trace.zip",
        type: "trace",
        url: run.traceUrl,
        size: "N/A",
      });
    }
    if (run.videoUrl) {
      artifacts.push({
        name: "recording.webm",
        type: "replay",
        url: run.videoUrl,
        size: "N/A",
      });
    }

    const tools: string[] = [];
    if (securityResult.verdict) tools.push("security");
    if (realityResult.verdict) tools.push("reality");
    if (guardrailResult.verdict) tools.push("guardrails");

    let verdict: "SHIP" | "NO_SHIP" | "PENDING" | "ERROR" = "PENDING";
    if (run.status === "completed") {
      verdict = run.verdict === "pass" ? "SHIP" : "NO_SHIP";
    } else if (run.status === "failed") {
      verdict = "ERROR";
    }

    const startTime = run.startedAt ? new Date(run.startedAt).getTime() : 0;
    const endTime = run.completedAt
      ? new Date(run.completedAt).getTime()
      : Date.now();
    const duration = startTime ? Math.round((endTime - startTime) / 1000) : 0;

    return {
      id: run.id,
      timestamp: run.createdAt || new Date().toISOString(),
      repo: run.repo || "unknown",
      branch: run.branch || "main",
      commit: run.commitSha || "unknown",
      trigger: "ci",
      profile: "standard",
      verdict,
      duration,
      tools,
      policyHash: `pol_${run.id?.slice(0, 12) || "unknown"}`,
      findings,
      artifacts,
      gates,
      mockproofTraces: [],
      airlockResults: [],
    };
  } catch (error) {
    logger.debug("API unavailable for run detail:", error);
    return null;
  }
}

export interface FixDiff {
  file: string;
  oldContent: string;
  newContent: string;
  changes: Array<{
    line: number;
    oldCode: string;
    newCode: string;
  }>;
}

export interface ApplyFixResult {
  success: boolean;
  applied: number;
  failed: number;
  skipped: number;
  diffs: FixDiff[];
  errors?: string[];
}

/**
 * Preview diff for a fix pack
 */
export async function previewFixDiff(
  runId: string,
  packId: string,
): Promise<ApplyFixResult | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/runs/${runId}/fixes/${packId}/diff`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to preview diff");
    }

    const json: ApiResponse<ApplyFixResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.error("Failed to preview fix diff:", error);
    return null;
  }
}

/**
 * Apply fixes for a pack
 */
export async function applyFixPack(
  runId: string,
  packId: string,
  options: { dryRun?: boolean } = {},
): Promise<ApplyFixResult | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/runs/${runId}/fixes/${packId}/apply`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dryRun: options.dryRun || false }),
      },
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to apply fixes");
    }

    const json: ApiResponse<ApplyFixResult> = await res.json();
    return json.data || null;
  } catch (error) {
    logger.error("Failed to apply fix pack:", error);
    return null;
  }
}
