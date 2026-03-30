import * as vscode from "vscode";
import { RealityCheckService, Finding } from "./reality-check-service";
import { getSeverityForFinding } from "./diagnostic-severity";

export class RealityCheckDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection | null = null;
  private findingsCache: Map<string, Finding[]> = new Map();
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> =
    new Map();

  constructor(private realityCheckService: RealityCheckService) {
    this.initDecorationTypes();
  }

  private initDecorationTypes(): void {
    this.decorationTypes.set(
      "critical",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("guardrail.criticalBackground"),
        borderWidth: "0 0 2px 0",
        borderStyle: "solid",
        borderColor: "#ff6b6b",
        overviewRulerColor: "#ff6b6b",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        after: {
          contentText: " ❌",
          color: "#ff6b6b",
        },
      }),
    );

    this.decorationTypes.set(
      "warning",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("guardrail.warningBackground"),
        borderWidth: "0 0 2px 0",
        borderStyle: "solid",
        borderColor: "#ffd93d",
        overviewRulerColor: "#ffd93d",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        after: {
          contentText: " ⚠️",
          color: "#ffd93d",
        },
      }),
    );

    this.decorationTypes.set(
      "suggestion",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(
          "guardrail.suggestionBackground",
        ),
        borderWidth: "0 0 1px 0",
        borderStyle: "dashed",
        borderColor: "#6bcb77",
        overviewRulerColor: "#6bcb77",
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      }),
    );
  }

  setDiagnosticCollection(collection: vscode.DiagnosticCollection): void {
    this.diagnosticCollection = collection;
  }

  async analyze(document: vscode.TextDocument): Promise<Finding[]> {
    const code = document.getText();
    const fileName = document.fileName;

    try {
      const findings = await this.realityCheckService.analyzeCode(
        code,
        fileName,
      );
      this.findingsCache.set(document.uri.toString(), findings);

      this.updateDiagnostics(document, findings);
      this.updateDecorations(document, findings);

      return findings;
    } catch (error) {
      console.error("Reality Check analysis error:", error);
      return [];
    }
  }

  private updateDiagnostics(
    document: vscode.TextDocument,
    findings: Finding[],
  ): void {
    if (!this.diagnosticCollection) return;

    const diagnostics: vscode.Diagnostic[] = [];
    for (const finding of findings) {
      const line = finding.line ? finding.line - 1 : 0;
      const range = this.findCodeRange(document, finding.code, line);

      const severity = getSeverityForFinding(finding);
      if (severity === null) {
        continue;
      }

      const diagnostic = new vscode.Diagnostic(
        range,
        `${finding.intent}\n\nReality: ${finding.reality}`,
        severity,
      );

      diagnostic.code = finding.category;
      diagnostic.source = "guardrail Reality Check";

      // Add related information
      diagnostic.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(document.uri, range),
          `Why it matters: ${finding.explanation}`,
        ),
      ];

      diagnostics.push(diagnostic);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private updateDecorations(
    document: vscode.TextDocument,
    findings: Finding[],
  ): void {
    const config = vscode.workspace.getConfiguration("guardrail");
    if (!config.get("showInlineHints")) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString())
      return;

    const criticalDecorations: vscode.DecorationOptions[] = [];
    const warningDecorations: vscode.DecorationOptions[] = [];
    const suggestionDecorations: vscode.DecorationOptions[] = [];

    for (const finding of findings) {
      if (getSeverityForFinding(finding) === null) {
        continue;
      }

      const line = finding.line ? finding.line - 1 : 0;
      const range = this.findCodeRange(document, finding.code, line);

      const decoration: vscode.DecorationOptions = {
        range,
        hoverMessage: new vscode.MarkdownString(
          `**🔮 Reality Check: ${finding.category.replace(/-/g, " ")}**\n\n` +
            `**You think:** ${finding.intent}\n\n` +
            `**Reality:** ${finding.reality}\n\n` +
            `_${finding.explanation}_\n\n` +
            `Confidence: ${Math.round(finding.confidence * 100)}%`,
        ),
      };

      if (finding.type === "critical") {
        criticalDecorations.push(decoration);
      } else if (finding.type === "warning") {
        warningDecorations.push(decoration);
      } else {
        suggestionDecorations.push(decoration);
      }
    }

    const criticalType = this.decorationTypes.get("critical");
    const warningType = this.decorationTypes.get("warning");
    const suggestionType = this.decorationTypes.get("suggestion");

    if (criticalType) editor.setDecorations(criticalType, criticalDecorations);
    if (warningType) editor.setDecorations(warningType, warningDecorations);
    if (suggestionType)
      editor.setDecorations(suggestionType, suggestionDecorations);
  }

  private findCodeRange(
    document: vscode.TextDocument,
    code: string,
    startLine: number,
  ): vscode.Range {
    // Try to find the exact code in the document
    const text = document.getText();
    const codeIndex = text.indexOf(code);

    if (codeIndex !== -1) {
      const startPos = document.positionAt(codeIndex);
      const endPos = document.positionAt(codeIndex + code.length);
      return new vscode.Range(startPos, endPos);
    }

    // Fall back to the line range
    const line = document.lineAt(Math.min(startLine, document.lineCount - 1));
    return line.range;
  }

  getFindings(uri: vscode.Uri): Finding[] {
    return this.findingsCache.get(uri.toString()) || [];
  }

  clearDiagnostics(uri: vscode.Uri): void {
    if (this.diagnosticCollection) {
      this.diagnosticCollection.delete(uri);
    }
    this.findingsCache.delete(uri.toString());
  }

  dispose(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
  }
}
