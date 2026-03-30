import * as vscode from "vscode";
import { RealityCheckService, Finding } from "./reality-check-service";

export class RealityCheckCodeLensProvider implements vscode.CodeLensProvider {
  private findingsCache: Map<string, Finding[]> = new Map();
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor(private realityCheckService: RealityCheckService) {}

  updateFindings(uri: vscode.Uri, findings: Finding[]): void {
    this.findingsCache.set(uri.toString(), findings);
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration("guardrail");
    if (!config.get("enabled")) return [];

    const codeLenses: vscode.CodeLens[] = [];
    const findings = this.findingsCache.get(document.uri.toString()) || [];

    // Add file-level CodeLens at the top
    const topRange = new vscode.Range(0, 0, 0, 0);

    if (findings.length > 0) {
      const critical = findings.filter((f) => f.type === "critical").length;
      const warnings = findings.filter((f) => f.type === "warning").length;

      codeLenses.push(
        new vscode.CodeLens(topRange, {
          title: `🔮 Reality Check: ${critical} critical, ${warnings} warnings`,
          command: "guardrail.showFindings",
          tooltip: "View all Reality Check findings",
        }),
      );
    } else {
      codeLenses.push(
        new vscode.CodeLens(topRange, {
          title: "🔮 Reality Check: ✅ No issues",
          command: "guardrail.realityCheckFile",
          tooltip: "Re-run Reality Check",
        }),
      );
    }

    // Add CodeLens for each function with findings
    const functionMatches = document
      .getText()
      .matchAll(
        /(async\s+)?function\s+(\w+)\s*\([^)]*\)|(\w+)\s*[=:]\s*(async\s+)?\([^)]*\)\s*=>/g,
      );

    for (const match of functionMatches) {
      const fnName = match[2] || match[3];
      if (!fnName) continue;

      const startPos = document.positionAt(match.index || 0);
      const range = new vscode.Range(startPos, startPos);

      // Find findings related to this function
      const fnFindings = findings.filter(
        (f) =>
          f.code.includes(fnName) ||
          (f.line && Math.abs(f.line - startPos.line - 1) < 5),
      );

      if (fnFindings.length > 0) {
        const worstType = fnFindings.some((f) => f.type === "critical")
          ? "critical"
          : fnFindings.some((f) => f.type === "warning")
            ? "warning"
            : "suggestion";
        const icon =
          worstType === "critical"
            ? "❌"
            : worstType === "warning"
              ? "⚠️"
              : "💡";

        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `${icon} ${fnFindings.length} reality gap${fnFindings.length > 1 ? "s" : ""}`,
            command: "guardrail.showFindings",
            tooltip: fnFindings.map((f) => f.category).join(", "),
          }),
        );

        // Add quick action for AI verification
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "🤖 Verify Intent",
            command: "guardrail.verifyIntent",
            tooltip: "Use AI to verify what this code actually does",
          }),
        );
      }
    }

    // Add CodeLens for class definitions
    const classMatches = document.getText().matchAll(/class\s+(\w+)/g);
    for (const match of classMatches) {
      const className = match[1];
      const startPos = document.positionAt(match.index || 0);
      const range = new vscode.Range(startPos, startPos);

      const classFindings = findings.filter((f) => f.code.includes(className));
      if (classFindings.length > 0) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `🔮 ${classFindings.length} issue${classFindings.length > 1 ? "s" : ""} in class`,
            command: "guardrail.showFindings",
          }),
        );
      }
    }

    return codeLenses;
  }

  resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ): vscode.CodeLens {
    return codeLens;
  }
}
