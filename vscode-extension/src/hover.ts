import * as vscode from "vscode";
import { RealityCheckService, Finding } from "./reality-check-service";

export class RealityCheckHoverProvider implements vscode.HoverProvider {
  private findingsCache: Map<string, Finding[]> = new Map();

  constructor(private realityCheckService: RealityCheckService) {}

  updateFindings(uri: vscode.Uri, findings: Finding[]): void {
    this.findingsCache.set(uri.toString(), findings);
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    const config = vscode.workspace.getConfiguration("guardrail");
    if (!config.get("enabled") || !config.get("showInlineHints")) return null;

    const findings = this.findingsCache.get(document.uri.toString()) || [];
    if (findings.length === 0) return null;

    // Find findings at or near this position
    const line = position.line + 1; // findings use 1-indexed lines
    const relevantFindings = findings.filter((f) => {
      if (f.line) {
        return Math.abs(f.line - line) <= 2;
      }
      // Check if the code snippet is on this line
      const lineText = document.lineAt(position.line).text;
      return lineText.includes(f.code) || f.code.includes(lineText.trim());
    });

    if (relevantFindings.length === 0) return null;

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true;
    contents.supportHtml = true;

    contents.appendMarkdown("## 🔮 Reality Check\n\n");

    for (const finding of relevantFindings) {
      const icon =
        finding.type === "critical"
          ? "❌"
          : finding.type === "warning"
            ? "⚠️"
            : "💡";
      const color =
        finding.type === "critical"
          ? "#ff6b6b"
          : finding.type === "warning"
            ? "#ffd93d"
            : "#6bcb77";

      contents.appendMarkdown(
        `### ${icon} ${finding.category.replace(/-/g, " ").toUpperCase()}\n\n`,
      );
      contents.appendMarkdown(`**You think:** ${finding.intent}\n\n`);
      contents.appendMarkdown(
        `**Reality:** <span style="color:${color}">${finding.reality}</span>\n\n`,
      );
      contents.appendMarkdown(`_${finding.explanation}_\n\n`);
      contents.appendMarkdown(
        `Confidence: ${Math.round(finding.confidence * 100)}%\n\n`,
      );
      contents.appendMarkdown("---\n\n");
    }

    // Add action links
    contents.appendMarkdown(
      "[🤖 AI Verify](command:guardrail.verifyIntent) | ",
    );
    contents.appendMarkdown("[📋 View All](command:guardrail.showFindings) | ");
    contents.appendMarkdown(
      "[🔄 Re-check](command:guardrail.realityCheckFile)\n\n",
    );
    contents.appendMarkdown("_Context Enhanced by guardrail AI_");

    return new vscode.Hover(contents);
  }
}
