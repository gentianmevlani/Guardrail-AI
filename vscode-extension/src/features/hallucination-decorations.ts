/**
 * Hallucination Guard — Inline Editor Decorations
 *
 * Shows real-time visual indicators in the editor when guardrail detects
 * potential AI hallucinations: wrong APIs, fake endpoints, phantom deps,
 * hardcoded mock data, version mismatches, etc.
 *
 * Makes the extension feel alive by reacting to code as you type/save.
 */

import * as vscode from "vscode";

// ── Decoration Types ──

const hallucinationDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(244, 114, 182, 0.08)",
  border: "1px solid rgba(244, 114, 182, 0.25)",
  borderRadius: "3px",
  gutterIconSize: "contain",
  overviewRulerColor: "#f472b6",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " ⚠ hallucination",
    color: "rgba(244, 114, 182, 0.5)",
    fontStyle: "italic",
    margin: "0 0 0 16px",
  },
});

const fakeFeatureDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(251, 191, 36, 0.06)",
  border: "1px dashed rgba(251, 191, 36, 0.25)",
  borderRadius: "3px",
  overviewRulerColor: "#fbbf24",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " ⚡ fake/stub",
    color: "rgba(251, 191, 36, 0.45)",
    fontStyle: "italic",
    margin: "0 0 0 16px",
  },
});

const phantomDepDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(251, 146, 60, 0.06)",
  border: "1px solid rgba(251, 146, 60, 0.2)",
  borderRadius: "3px",
  overviewRulerColor: "#fb923c",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " 👻 phantom dep?",
    color: "rgba(251, 146, 60, 0.45)",
    fontStyle: "italic",
    margin: "0 0 0 16px",
  },
});

const mockDataDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(96, 165, 250, 0.06)",
  border: "1px dashed rgba(96, 165, 250, 0.2)",
  borderRadius: "3px",
  overviewRulerColor: "#60a5fa",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " 🎭 mock data",
    color: "rgba(96, 165, 250, 0.45)",
    fontStyle: "italic",
    margin: "0 0 0 16px",
  },
});

const secretDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(239, 68, 68, 0.08)",
  border: "2px solid rgba(239, 68, 68, 0.3)",
  borderRadius: "3px",
  overviewRulerColor: "#ef4444",
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: " 🔑 EXPOSED SECRET",
    color: "rgba(239, 68, 68, 0.7)",
    fontWeight: "bold",
    margin: "0 0 0 16px",
  },
});

// ── Pattern Definitions ──

interface DetectionPattern {
  regex: RegExp;
  type: "hallucination" | "fake" | "phantom" | "mock" | "secret";
  message: string;
}

const PATTERNS: DetectionPattern[] = [
  // Fake features / stubs
  { regex: /(?:\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK|\/\/\s*XXX)(?::?\s*.+)/gi, type: "fake", message: "Unfinished TODO/FIXME marker" },
  { regex: /throw\s+(?:new\s+)?Error\(\s*['"`](?:Not implemented|TODO|FIXME|not yet)[^'"`]*['"`]\s*\)/gi, type: "fake", message: "Stub implementation throwing 'Not implemented'" },
  { regex: /=>\s*\{\s*\}\s*[;,)]/g, type: "fake", message: "Empty arrow function (noop handler)" },
  { regex: /(?:onClick|onSubmit|onChange|onPress|handleClick|handleSubmit)\s*=\s*\{?\s*\(\)\s*=>\s*(?:\{\s*\}|null|undefined|void\s+0)/gi, type: "fake", message: "Empty event handler — likely placeholder" },
  { regex: /setTimeout\(\s*(?:\(\)\s*=>|function\s*\(\))\s*\{[^}]*\}\s*,\s*\d{3,5}\s*\)/g, type: "fake", message: "Fake async with setTimeout (simulated delay)" },

  // Mock data in non-test files
  { regex: /(?:const|let|var)\s+(?:mock|fake|dummy|test|sample|placeholder|hardcoded)\w*\s*=/gi, type: "mock", message: "Possible hardcoded mock/fake data" },
  { regex: /['"`]lorem\s+ipsum/gi, type: "mock", message: "Lorem ipsum placeholder text" },
  { regex: /['"`](?:user@example\.com|test@test\.com|admin@admin\.com|john@doe\.com)['"`]/gi, type: "mock", message: "Placeholder email address" },
  { regex: /['"`](?:123-?456-?789\d|555-?\d{3}-?\d{4}|000-?00-?0000)['"`]/gi, type: "mock", message: "Placeholder phone/SSN number" },
  { regex: /(?:price|amount|total|cost)\s*[:=]\s*(?:0|9\.?99|19\.?99|99\.?99|100)\b/gi, type: "mock", message: "Hardcoded price value" },

  // Exposed secrets
  { regex: /(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*['"`][A-Za-z0-9_\-./+=]{16,}['"`]/gi, type: "secret", message: "Possible exposed API key or secret" },
  { regex: /(?:sk|pk)[-_](?:live|test)[-_][A-Za-z0-9]{20,}/g, type: "secret", message: "Stripe-style key detected" },
  { regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g, type: "secret", message: "GitHub token detected" },
  { regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, type: "secret", message: "AWS access key detected" },
  { regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, type: "secret", message: "JWT token detected in source" },

  // Phantom/hallucinated patterns
  { regex: /from\s+['"](?:@(?:next|react|vue)\/(?:server-actions|streaming|hydration|navigation\/v2|server-components))['"`]/g, type: "phantom", message: "Possibly hallucinated import path" },
  { regex: /(?:useServerAction|useStreamingData|useHydration|useServerComponent)\s*\(/g, type: "hallucination", message: "Possibly hallucinated React hook" },
];

// ── Decoration Manager ──

export class HallucinationDecorationManager implements vscode.Disposable {
  private _disposables: vscode.Disposable[] = [];
  private _enabled = true;

  constructor() {
    // Update decorations on active editor change
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.updateDecorations(editor);
      }),
    );

    // Update on document save
    this._disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === doc) {
          this.updateDecorations(editor);
        }
      }),
    );

    // Debounced update on type
    let debounce: NodeJS.Timeout;
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === e.document) {
          clearTimeout(debounce);
          debounce = setTimeout(() => this.updateDecorations(editor), 800);
        }
      }),
    );

    // Apply to current editor
    if (vscode.window.activeTextEditor) {
      this.updateDecorations(vscode.window.activeTextEditor);
    }
  }

  updateDecorations(editor: vscode.TextEditor): void {
    if (!this._enabled) return;

    const doc = editor.document;
    // Only apply to source files
    const supported = ["javascript", "typescript", "javascriptreact", "typescriptreact", "python", "go", "rust", "java", "csharp"];
    if (!supported.includes(doc.languageId)) return;

    // Skip test files
    const path = doc.uri.fsPath;
    if (/\.(test|spec|e2e|cy)\.[jt]sx?$/.test(path) || /\/__tests__\//.test(path) || /\/test\//.test(path)) {
      this._clearAll(editor);
      return;
    }

    const text = doc.getText();
    const hallucinationRanges: vscode.DecorationOptions[] = [];
    const fakeRanges: vscode.DecorationOptions[] = [];
    const phantomRanges: vscode.DecorationOptions[] = [];
    const mockRanges: vscode.DecorationOptions[] = [];
    const secretRanges: vscode.DecorationOptions[] = [];

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const startPos = doc.positionAt(match.index);
        const endPos = doc.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const decoration: vscode.DecorationOptions = {
          range,
          hoverMessage: new vscode.MarkdownString(
            `**Guardrail**: ${pattern.message}\n\n` +
            `*Category: ${pattern.type}*\n\n` +
            `[Scan Workspace](command:guardrail.scanWorkspace) | [Open Hub](command:guardrail.openHub)`,
          ),
        };
        (decoration.hoverMessage as vscode.MarkdownString).isTrusted = true;

        switch (pattern.type) {
          case "hallucination": hallucinationRanges.push(decoration); break;
          case "fake": fakeRanges.push(decoration); break;
          case "phantom": phantomRanges.push(decoration); break;
          case "mock": mockRanges.push(decoration); break;
          case "secret": secretRanges.push(decoration); break;
        }
      }
    }

    editor.setDecorations(hallucinationDecoration, hallucinationRanges);
    editor.setDecorations(fakeFeatureDecoration, fakeRanges);
    editor.setDecorations(phantomDepDecoration, phantomRanges);
    editor.setDecorations(mockDataDecoration, mockRanges);
    editor.setDecorations(secretDecoration, secretRanges);
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled && vscode.window.activeTextEditor) {
      this._clearAll(vscode.window.activeTextEditor);
    }
  }

  private _clearAll(editor: vscode.TextEditor): void {
    editor.setDecorations(hallucinationDecoration, []);
    editor.setDecorations(fakeFeatureDecoration, []);
    editor.setDecorations(phantomDepDecoration, []);
    editor.setDecorations(mockDataDecoration, []);
    editor.setDecorations(secretDecoration, []);
  }

  dispose(): void {
    hallucinationDecoration.dispose();
    fakeFeatureDecoration.dispose();
    phantomDepDecoration.dispose();
    mockDataDecoration.dispose();
    secretDecoration.dispose();
    this._disposables.forEach((d) => d.dispose());
  }
}
