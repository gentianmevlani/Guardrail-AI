import * as vscode from "vscode";
import type { Finding } from "./reality-check-service";

type SeverityKey = "error" | "warning" | "hint" | "off";

const DEFAULT_RULE_MAP: Record<string, string> = {
  "silent-failure": "CG004",
  "naming-mismatch": "CG006",
  "async-timing-illusion": "CG007",
  "type-coercion-trap": "CG008",
  "dependency-assumption": "CG005",
  "error-handling-illusion": "CG004",
  "boundary-blindness": "CG002",
  "incomplete-implementation": "CG002",
  "debug-code": "CG010",
  "hardcoded-secret": "CG009",
  "api-key-leak": "CG009",
  "exposed-credentials": "CG009",
  "mock-data": "CG001",
  "test-data-leak": "CG001",
  "fake-domain": "CG001",
  "missing-auth": "CG002",
  "unprotected-endpoint": "CG002",
  "auth-bypass": "CG002",
  "dead-route": "CG002",
  "placeholder-handler": "CG002",
  "ghost-route": "CG002",
  "contract-drift": "CG003",
  "api-mismatch": "CG003",
};

function categoryToRuleId(category: string): string | undefined {
  return DEFAULT_RULE_MAP[category];
}

function configSeverityToVs(
  level: SeverityKey | undefined,
): vscode.DiagnosticSeverity | null {
  if (!level || level === "off") return null;
  switch (level) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "hint":
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function fallbackSeverity(
  finding: Finding,
): vscode.DiagnosticSeverity {
  if (finding.type === "critical") {
    return vscode.DiagnosticSeverity.Error;
  }
  if (finding.type === "warning") {
    return vscode.DiagnosticSeverity.Warning;
  }
  return vscode.DiagnosticSeverity.Hint;
}

/**
 * Resolves VS Code diagnostic severity from `guardrail.severity` when a rule
 * id can be inferred from the finding category; otherwise uses finding.type.
 * Returns `null` when the rule is configured as `off`.
 */
export function getSeverityForFinding(finding: Finding): vscode.DiagnosticSeverity | null {
  const config = vscode.workspace.getConfiguration("guardrail");
  const severityMap = config.get<Record<string, SeverityKey>>("severity") || {};

  const ruleId = categoryToRuleId(finding.category);
  if (ruleId) {
    const level = severityMap[ruleId];
    if (level === "off") {
      return null;
    }
    if (level !== undefined) {
      const vs = configSeverityToVs(level);
      return vs !== null ? vs : fallbackSeverity(finding);
    }
  }

  return fallbackSeverity(finding);
}
