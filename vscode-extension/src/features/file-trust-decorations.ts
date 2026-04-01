/**
 * File Trust Decorations — Explorer badges showing per-file guardrail status.
 *
 * Shows colored badges next to files in the VS Code explorer:
 * - Red badge with count: critical findings
 * - Yellow badge with count: warnings
 * - Green checkmark: clean file
 *
 * Makes guardrail omnipresent — users see trust status everywhere they look.
 */

import * as vscode from "vscode";

interface FileIssueState {
  critical: number;
  warnings: number;
  suggestions: number;
}

export class GuardrailFileDecorationProvider
  implements vscode.FileDecorationProvider
{
  private _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private _fileStates = new Map<string, FileIssueState>();
  private _scannedFiles = new Set<string>();

  /**
   * Update findings for a specific file.
   */
  setFileFindings(uri: vscode.Uri, critical: number, warnings: number, suggestions: number): void {
    const key = uri.toString();
    this._fileStates.set(key, { critical, warnings, suggestions });
    this._scannedFiles.add(key);
    this._onDidChangeFileDecorations.fire(uri);
  }

  /**
   * Mark a file as clean (scanned, no issues).
   */
  setFileClean(uri: vscode.Uri): void {
    const key = uri.toString();
    this._fileStates.set(key, { critical: 0, warnings: 0, suggestions: 0 });
    this._scannedFiles.add(key);
    this._onDidChangeFileDecorations.fire(uri);
  }

  /**
   * Bulk update from scan results.
   */
  updateFromScanIssues(issues: Array<{ file?: string; type: string }>): void {
    // Reset all tracked files
    const changedUris: vscode.Uri[] = [];
    for (const key of this._scannedFiles) {
      this._fileStates.set(key, { critical: 0, warnings: 0, suggestions: 0 });
    }

    // Aggregate by file
    const fileCounts = new Map<string, FileIssueState>();
    for (const issue of issues) {
      if (!issue.file) continue;
      const uri = this._resolveFileUri(issue.file);
      if (!uri) continue;
      const key = uri.toString();
      const state = fileCounts.get(key) ?? { critical: 0, warnings: 0, suggestions: 0 };
      if (issue.type === "critical") state.critical++;
      else if (issue.type === "warning") state.warnings++;
      else state.suggestions++;
      fileCounts.set(key, state);
    }

    for (const [key, state] of fileCounts) {
      this._fileStates.set(key, state);
      this._scannedFiles.add(key);
      try {
        changedUris.push(vscode.Uri.parse(key));
      } catch { /* ignore parse errors */ }
    }

    // Fire change for all affected files
    if (changedUris.length > 0) {
      this._onDidChangeFileDecorations.fire(changedUris);
    } else {
      this._onDidChangeFileDecorations.fire(undefined);
    }
  }

  /**
   * Clear all decorations.
   */
  clear(): void {
    this._fileStates.clear();
    this._scannedFiles.clear();
    this._onDidChangeFileDecorations.fire(undefined);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const key = uri.toString();
    const state = this._fileStates.get(key);
    if (!state) return undefined;

    const total = state.critical + state.warnings + state.suggestions;
    if (total === 0 && this._scannedFiles.has(key)) {
      // Clean file — subtle green
      return {
        badge: "✓",
        color: new vscode.ThemeColor("gitDecoration.untrackedResourceForeground"),
        tooltip: "Guardrail: Clean",
      };
    }

    if (state.critical > 0) {
      return {
        badge: String(state.critical > 9 ? "9+" : state.critical),
        color: new vscode.ThemeColor("errorForeground"),
        tooltip: `Guardrail: ${state.critical} critical, ${state.warnings} warnings`,
        propagate: true,
      };
    }

    if (state.warnings > 0) {
      return {
        badge: String(state.warnings > 9 ? "9+" : state.warnings),
        color: new vscode.ThemeColor("editorWarning.foreground"),
        tooltip: `Guardrail: ${state.warnings} warnings, ${state.suggestions} hints`,
        propagate: true,
      };
    }

    if (state.suggestions > 0) {
      return {
        badge: String(state.suggestions > 9 ? "9+" : state.suggestions),
        color: new vscode.ThemeColor("editorInfo.foreground"),
        tooltip: `Guardrail: ${state.suggestions} suggestions`,
      };
    }

    return undefined;
  }

  private _resolveFileUri(filePath: string): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;

    // If already absolute
    if (filePath.startsWith("/") || filePath.match(/^[a-zA-Z]:\\/)) {
      return vscode.Uri.file(filePath);
    }

    // Relative to workspace
    return vscode.Uri.joinPath(folders[0].uri, filePath);
  }
}
