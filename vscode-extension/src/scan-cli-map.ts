/**
 * Map `guardrail scan --json` output into extension panel shapes.
 * Aligns with packages/cli scan-consolidated ScanResult shape.
 */

import { scoreFromSeverityBuckets } from "@guardrail/core";

export function extractJsonObject(stdout: string): unknown | null {
  const t = stdout.trim();
  if (!t) {
    return null;
  }
  try {
    if (t.startsWith("{")) {
      return JSON.parse(t);
    }
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * `bin/guardrail.js` may emit shapes other than `packages/cli` scan-consolidated:
 * - Runner "lightweight" JSON: root `totalFindings`, `severity`, and `findings` as a string on free tier
 * - `StandardScanOutput`: `schemaVersion` + nested `verdict.summary`
 * Panels expect `summary.totalFindings` and `findings` as an array — normalize here.
 */
export function normalizeScanJsonData(data: Record<string, unknown>): Record<string, unknown> {
  // output-contract StandardScanOutput
  if (
    data.schemaVersion === "1.0.0" &&
    data.verdict &&
    typeof data.verdict === "object" &&
    !Array.isArray(data.verdict) &&
    Array.isArray(data.findings)
  ) {
    const nested = data.verdict as Record<string, unknown>;
    const nestedSummary = nested.summary as Record<string, unknown> | undefined;
    if (
      nestedSummary &&
      typeof nestedSummary.totalFindings === "number"
    ) {
      const findings = data.findings as Array<Record<string, unknown>>;
      let critical = 0;
      let high = 0;
      let medium = 0;
      let low = 0;
      let info = 0;
      for (const f of findings) {
        const s = String(f.severity ?? "info").toLowerCase();
        if (s === "critical") {
          critical++;
        } else if (s === "high") {
          high++;
        } else if (s === "medium") {
          medium++;
        } else if (s === "low") {
          low++;
        } else {
          info++;
        }
      }
      const totalScore = scoreFromSeverityBuckets(
        critical,
        high,
        medium,
        low,
        info,
      );
      const v = String(nested.verdict ?? "PASS");
      const scanVerdict: "PASS" | "FAIL" | "WARN" =
        v === "PASS" ? "PASS" : v === "WARN" ? "WARN" : "FAIL";
      const mappedFindings = findings.map((f, i) => {
        const idObj = f.id as { full?: string } | undefined;
        const idStr =
          idObj && typeof idObj.full === "string"
            ? idObj.full
            : String(f.id ?? `finding-${i}`);
        return {
          ...f,
          id: idStr,
          type: String(f.ruleName ?? f.ruleId ?? f.type ?? "finding"),
        };
      });
      return {
        ...data,
        verdict: scanVerdict,
        summary: {
          totalFindings: nestedSummary.totalFindings,
          critical,
          high,
          medium,
          low,
          totalScore,
        },
        findings: mappedFindings,
      };
    }
  }

  const hasConsolidatedSummary =
    data.summary &&
    typeof data.summary === "object" &&
    typeof (data.summary as Record<string, unknown>).totalFindings ===
      "number";

  if (hasConsolidatedSummary) {
    const out = { ...data };
    if (typeof out.findings === "string") {
      out.findings = [];
    }
    return out;
  }

  const rootTotal = data.totalFindings;
  const sev = data.severity;
  if (
    typeof rootTotal === "number" &&
    sev &&
    typeof sev === "object" &&
    !Array.isArray(sev)
  ) {
    const sevObj = sev as Record<string, unknown>;
    const critical = Number(sevObj.critical ?? 0);
    const high = Number(sevObj.high ?? 0);
    const medium = Number(sevObj.medium ?? 0);
    const low = Number(sevObj.low ?? 0);
    const info = Number(sevObj.info ?? 0);
    const totalScore = scoreFromSeverityBuckets(
      critical,
      high,
      medium,
      low,
      info,
    );
    let findings: unknown = data.findings;
    if (typeof findings === "string") {
      findings = [];
    } else if (!Array.isArray(findings)) {
      findings = [];
    }
    const verdict: "PASS" | "FAIL" | "WARN" =
      rootTotal === 0 ? "PASS" : "FAIL";
    return {
      ...data,
      summary: {
        totalFindings: rootTotal,
        critical,
        high,
        medium,
        low,
        totalScore,
      },
      findings,
      verdict,
    };
  }

  if (typeof data.findings === "string") {
    return { ...data, findings: [] };
  }

  return data;
}

function sevBucket(
  sev: string,
): "critical" | "high" | "medium" | "low" {
  const s = (sev || "").toLowerCase();
  if (s === "critical") {
    return "critical";
  }
  if (s === "high") {
    return "high";
  }
  if (s === "medium") {
    return "medium";
  }
  return "low";
}

/** Generic finding row from scan JSON */
export function scanFindingsFromData(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const findings = data.findings;
  if (!Array.isArray(findings)) {
    return [];
  }
  return findings as Array<Record<string, unknown>>;
}

export function scanSummaryFromData(data: Record<string, unknown>): {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalScore: number | null;
} {
  const s = data.summary as Record<string, unknown> | undefined;
  if (s && typeof s.totalFindings === "number") {
    const ts = s.totalScore;
    return {
      totalFindings: Number(s.totalFindings),
      critical: Number(s.critical ?? 0),
      high: Number(s.high ?? 0),
      medium: Number(s.medium ?? 0),
      low: Number(s.low ?? 0),
      totalScore: typeof ts === "number" ? ts : null,
    };
  }
  return {
    totalFindings: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    totalScore: null,
  };
}

export function mapFindingToSecurityIssue(
  f: Record<string, unknown>,
  index: number,
): {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  autoFixable: boolean;
} {
  const sevRaw = String(f.severity ?? "medium");
  const file = typeof f.file === "string" ? f.file : undefined;
  const line = typeof f.line === "number" ? f.line : undefined;
  const typ = String(f.type ?? "finding");
  return {
    id: String(f.id ?? `scan-${index}`),
    severity: sevBucket(sevRaw),
    category: typ,
    title: `${typ} (${sevRaw})`,
    description: file
      ? `${typ} in ${file}${line != null ? `:${line}` : ""}`
      : typ,
    file,
    line,
    autoFixable: false,
  };
}

/** Map scan findings to generic compliance rows (OSS: same scan, labeled per framework). */
export function mapScanToComplianceChecks(
  data: Record<string, unknown>,
  frameworks: string[],
): Array<{
  id: string;
  framework: "SOC2" | "HIPAA" | "GDPR" | "PCI-DSS";
  control: string;
  title: string;
  description: string;
  status: "passed" | "failed" | "warning" | "not-applicable";
  severity: "critical" | "high" | "medium" | "low";
}> {
  const findings = scanFindingsFromData(data);
  const checks: Array<{
    id: string;
    framework: "SOC2" | "HIPAA" | "GDPR" | "PCI-DSS";
    control: string;
    title: string;
    description: string;
    status: "passed" | "failed" | "warning" | "not-applicable";
    severity: "critical" | "high" | "medium" | "low";
  }> = [];

  const fwList = frameworks.filter((f): f is "SOC2" | "HIPAA" | "GDPR" | "PCI-DSS" =>
    ["SOC2", "HIPAA", "GDPR", "PCI-DSS"].includes(f),
  );

  for (const fw of fwList.length ? fwList : (["SOC2"] as const)) {
    findings.forEach((f, i) => {
      const sev = sevBucket(String(f.severity ?? "medium"));
      const failed = sev === "critical" || sev === "high";
      checks.push({
        id: `${fw}-${String(f.id ?? i)}`,
        framework: fw,
        control: String(f.type ?? "finding"),
        title: String(f.type ?? "Finding"),
        description:
          typeof f.file === "string"
            ? `${f.file}${typeof f.line === "number" ? `:${f.line}` : ""}`
            : "From guardrail scan",
        status: failed ? "failed" : sev === "medium" ? "warning" : "passed",
        severity: sev,
      });
    });
  }

  return checks;
}

/** Build change-impact style summary from scan hotspots + nextActions. */
export function buildImpactAnalysisFromScan(
  data: Record<string, unknown>,
): {
  timestamp: string;
  changes: Array<{
    file: string;
    type: "modified";
    impact: "high" | "medium" | "low";
    dependencies: string[];
    dependents: string[];
    affectedTests: string[];
    affectedDocs: string[];
    breakingChanges: unknown[];
    riskFactors: Array<{
      category: "complexity";
      score: number;
      description: string;
    }>;
  }>;
  summary: {
    totalFiles: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    affectedComponents: string[];
    riskScore: number;
  };
  recommendations: string[];
} {
  const hotspots = data.hotspots as
    | Array<{ file: string; score?: number; findings?: number }>
    | undefined;
  const nextActions = Array.isArray(data.nextActions)
    ? (data.nextActions as string[])
    : [];
  const sum = scanSummaryFromData(data);

  const changes = (hotspots ?? []).map((h) => {
    const sc = typeof h.score === "number" ? h.score : 0;
    const impact: "high" | "medium" | "low" =
      sc > 70 ? "high" : sc > 40 ? "medium" : "low";
    return {
      file: h.file,
      type: "modified" as const,
      impact,
      dependencies: [] as string[],
      dependents: [] as string[],
      affectedTests: [] as string[],
      affectedDocs: [] as string[],
      breakingChanges: [] as unknown[],
      riskFactors: [
        {
          category: "complexity" as const,
          score: Math.min(100, sc),
          description:
            typeof h.findings === "number"
              ? `Hotspot · ${h.findings} finding(s)`
              : "Hotspot from guardrail scan",
        },
      ],
    };
  });

  return {
    timestamp: new Date().toISOString(),
    changes,
    summary: {
      totalFiles: changes.length,
      highImpact: changes.filter((c) => c.impact === "high").length,
      mediumImpact: changes.filter((c) => c.impact === "medium").length,
      lowImpact: changes.filter((c) => c.impact === "low").length,
      affectedComponents: [],
      riskScore: sum.totalScore ?? 0,
    },
    recommendations:
      nextActions.length > 0
        ? nextActions
        : ["Run guardrail scan after edits to refresh hotspots."],
  };
}

/** Scan-derived proxy metrics (not OS telemetry). Labels match the performance panel UI. */
export function buildPerformanceMetricsFromScan(data: Record<string, unknown>): Array<{
  type: "cpu" | "memory" | "io" | "network" | "render";
  value: number;
  unit: string;
  threshold: number;
  status: "good" | "warning" | "critical";
  timestamp: string;
}> {
  const now = new Date().toISOString();
  const sum = scanSummaryFromData(data);
  const findings = scanFindingsFromData(data).length;
  const hotspots = Array.isArray(data.hotspots)
    ? (data.hotspots as unknown[]).length
    : 0;
  const score = Math.min(100, sum.totalScore ?? 0);
  const sevLoad = Math.min(
    100,
    (sum.critical + sum.high) * 12 + sum.medium * 4,
  );
  const ioProxy = Math.min(1000, findings * 20 + hotspots * 15);

  const rows = [
    {
      type: "cpu" as const,
      value: score,
      unit: "%",
      threshold: 80,
    },
    {
      type: "memory" as const,
      value: sevLoad,
      unit: "%",
      threshold: 85,
    },
    {
      type: "io" as const,
      value: ioProxy,
      unit: "MB/s",
      threshold: 500,
    },
  ];

  return rows.map((m) => {
    let status: "good" | "warning" | "critical" = "good";
    if (m.value > m.threshold) {
      status = "critical";
    } else if (m.value > m.threshold * 0.8) {
      status = "warning";
    }
    return { ...m, status, timestamp: now };
  });
}

/** Map `guardrail context --json --stdout` payload into MDC panel rows (deterministic). */
export function mapContextJsonToMdcResults(data: Record<string, unknown>): Array<{
  fileName: string;
  title: string;
  category: string;
  importanceScore: number;
  confidence: number;
  riskScore: number;
  components: Array<{
    name: string;
    type: string;
    path: string;
    verificationScore: number;
  }>;
  patterns: Array<{
    name: string;
    type: string;
    confidence: number;
  }>;
}> {
  const project = String(data.projectName ?? "project");
  const framework = String(data.framework ?? "unknown");
  const routes = Array.isArray(data.routes) ? data.routes : [];
  const envVars = Array.isArray(data.envVars) ? data.envVars : [];
  const schemas = Array.isArray(data.schemas) ? data.schemas : [];
  const deps =
    data.dependencies && typeof data.dependencies === "object"
      ? (data.dependencies as Record<string, string>)
      : {};
  const depEntries = Object.entries(deps).filter(
    ([n]) => !n.startsWith("@types/"),
  );

  const out: Array<{
    fileName: string;
    title: string;
    category: string;
    importanceScore: number;
    confidence: number;
    riskScore: number;
    components: Array<{
      name: string;
      type: string;
      path: string;
      verificationScore: number;
    }>;
    patterns: Array<{
      name: string;
      type: string;
      confidence: number;
    }>;
  }> = [];

  const routeComponents = routes
    .slice(0, 40)
    .map((r: Record<string, unknown>) => ({
      name: `${String(r.method ?? "GET")} ${String(r.path ?? "")}`,
      type: "route",
      path: String(r.file ?? ""),
      verificationScore: 0.9,
    }));
  out.push({
    fileName: "context-routes.mdc",
    title: `API routes — ${project}`,
    category: "integration",
    importanceScore: Math.min(100, 35 + routes.length * 2),
    confidence: routes.length > 0 ? 0.9 : 0.45,
    riskScore: Math.min(100, routes.length),
    components: routeComponents,
    patterns: [{ name: "stack", type: framework, confidence: 0.85 }],
  });

  const envComponents = envVars.slice(0, 40).map((v: Record<string, unknown>) => ({
    name: String(v.name ?? ""),
    type: "env",
    path: ".env.example",
    verificationScore: v.required ? 0.95 : 0.75,
  }));
  out.push({
    fileName: "context-env.mdc",
    title: `Environment — ${project}`,
    category: "security",
    importanceScore: Math.min(100, 30 + envVars.length * 2),
    confidence: envVars.length > 0 ? 0.88 : 0.4,
    riskScore: Math.min(
      100,
      envVars.filter((v: Record<string, unknown>) => v.required).length * 8,
    ),
    components: envComponents,
    patterns: [],
  });

  const schemaComponents = schemas
    .slice(0, 40)
    .map((s: Record<string, unknown>) => ({
      name: String(s.name ?? ""),
      type: String(s.type ?? "schema"),
      path: String(s.file ?? ""),
      verificationScore: 0.88,
    }));
  out.push({
    fileName: "context-schemas.mdc",
    title: `Schemas — ${project}`,
    category: "architecture",
    importanceScore: Math.min(100, 32 + schemas.length * 3),
    confidence: schemas.length > 0 ? 0.87 : 0.4,
    riskScore: Math.min(100, schemas.length * 5),
    components: schemaComponents,
    patterns: [],
  });

  const depComponents = depEntries.slice(0, 30).map(([name, ver]) => ({
    name,
    type: "dependency",
    path: String(ver),
    verificationScore: 0.82,
  }));
  out.push({
    fileName: "context-dependencies.mdc",
    title: `Dependencies — ${project}`,
    category: "architecture",
    importanceScore: Math.min(100, 28 + Math.min(depEntries.length, 30)),
    confidence: depEntries.length > 0 ? 0.86 : 0.35,
    riskScore: 0,
    components: depComponents,
    patterns: [],
  });

  return out;
}
