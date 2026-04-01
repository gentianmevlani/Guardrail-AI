import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { getGuardrailPanelHead } from "./webview-shared-styles";
import { explainFindingStitchCss } from "./explain-finding-stitch-css";
import { getGuardrailWebUrl } from "./guardrail-web-urls";

export function coerceUri(input: unknown): vscode.Uri | undefined {
  if (input instanceof vscode.Uri) return input;
  if (typeof input === "string") {
    try {
      return vscode.Uri.parse(input);
    } catch {
      return undefined;
    }
  }
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    if (typeof o.fsPath === "string") {
      return vscode.Uri.file(o.fsPath);
    }
    if (typeof o.scheme === "string" && typeof o.path === "string") {
      return vscode.Uri.from({
        scheme: o.scheme,
        authority: typeof o.authority === "string" ? o.authority : "",
        path: o.path,
        query: typeof o.query === "string" ? o.query : "",
        fragment: typeof o.fragment === "string" ? o.fragment : "",
      });
    }
  }
  return undefined;
}

export function coerceRange(input: unknown): vscode.Range | undefined {
  if (input instanceof vscode.Range) return input;
  if (!input || typeof input !== "object") return undefined;
  const r = input as {
    start?: { line: number; character: number };
    end?: { line: number; character: number };
  };
  if (r.start && r.end) {
    return new vscode.Range(
      new vscode.Position(r.start.line, r.start.character),
      new vscode.Position(r.end.line, r.end.character),
    );
  }
  return undefined;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inferEnvName(document: vscode.TextDocument, range: vscode.Range): string {
  const line = document.lineAt(range.start.line).text;
  const varMatch = line.match(/(?:const|let|var)\s+(\w+)|(\w+)\s*[=:]/);
  return varMatch
    ? (varMatch[1] || varMatch[2]).replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()
    : "SECRET_VALUE";
}

/**
 * Append the secret to `.env` and replace the selection with `process.env.NAME`.
 */
export async function moveSecretToEnv(
  uri: vscode.Uri,
  range: vscode.Range,
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    vscode.window.showWarningMessage(
      "Open a folder workspace to use Move to .env.",
    );
    return;
  }

  const secretText = document.getText(range).trim();
  if (!secretText) {
    vscode.window.showWarningMessage("No secret text in range.");
    return;
  }

  const envName = inferEnvName(document, range);
  const envPath = path.join(workspaceFolder.uri.fsPath, ".env");
  const line = `${envName}=${secretText}\n`;

  try {
    await fs.appendFile(envPath, line, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    vscode.window.showErrorMessage(`Could not write .env: ${msg}`);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  if (document.languageId === "python") {
    const full = document.getText();
    if (!/^\s*import os\s*$/m.test(full) && !/^\s*from\s+os\s+import/m.test(full)) {
      edit.insert(uri, new vscode.Position(0, 0), "import os\n");
    }
  }
  const replacement =
    document.languageId === "python"
      ? `os.environ["${envName}"]`
      : `process.env.${envName}`;
  edit.replace(uri, range, replacement);
  const ok = await vscode.workspace.applyEdit(edit);
  if (ok) {
    void vscode.window.showInformationMessage(
      `Added ${envName} to .env and replaced code with ${replacement}.`,
    );
  }
}

export async function showContractDiff(
  uri: vscode.Uri,
  range: vscode.Range,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    selection: range,
    viewColumn: vscode.ViewColumn.Active,
  });
  const pick = await vscode.window.showInformationMessage(
    "Contract drift: compare this code with your OpenAPI spec, GraphQL schema, or shared types package.",
    "Documentation",
  );
  if (pick === "Documentation") {
    await vscode.env.openExternal(vscode.Uri.parse("https://guardrailai.dev/docs"));
  }
}

export async function explainFinding(
  uri: vscode.Uri,
  raw: unknown,
): Promise<void> {
  const d = raw as {
    message?: string;
    code?: string | { value?: string };
  };
  const message = d?.message ?? "No details for this finding.";
  const code =
    typeof d?.code === "object" && d.code?.value
      ? d.code.value
      : typeof d?.code === "string"
        ? d.code
        : "";

  const panel = vscode.window.createWebviewPanel(
    "guardrailExplainFinding",
    "guardrail — Finding",
    vscode.ViewColumn.Beside,
    { enableScripts: false },
  );

  const explainCss = `
    .explain-pad { padding: 16px; max-width: 640px; }
    h1 { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; margin: 0 0 12px 0; color: var(--on-surface); }
    pre { white-space: pre-wrap; font-size: 12px; line-height: 1.55; color: var(--on-surface); background: var(--surface-container-lowest); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle); }
    .meta { color: var(--on-surface-variant); font-size: 11px; margin-bottom: 12px; }
  `;
  panel.webview.html = `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${getGuardrailPanelHead(explainFindingStitchCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <div class="explain-head">
    <h1>Explain this finding</h1>
  </div>
  <div class="explain-pad">
  ${code ? `<p class="meta">Category: ${escapeHtml(String(code))}</p>` : ""}
  <pre>${escapeHtml(message)}</pre>
  </div>
  </div>
</body>
</html>`;
}
