/**
 * Activity bar sidebar: quick entry to the same flows as {@link GuardrailDashboardPanel}
 * and enterprise feature panels (commands already registered in extension.ts).
 */

import * as vscode from "vscode";
import { getGuardrailSharedStyles } from "../webview-shared-styles";

export const GUARDRAIL_SIDEBAR_VIEW_ID = "guardrail.sidebar";

const ALLOWED_COMMANDS = new Set<string>([
  "guardrail.showDashboard",
  "guardrail.scanWorkspace",
  "guardrail.runShip",
  "guardrail.verifyLastOutput",
  "guardrail.showFindings",
  "guardrail.openSecurityScanner",
  "guardrail.openComplianceDashboard",
  "guardrail.openPerformanceMonitor",
  "guardrail.openMDCGenerator",
  "guardrail.openChangeImpactAnalyzer",
  "guardrail.openAIExplainer",
  "guardrail.openTeamCollaboration",
  "guardrail.openProductionIntegrity",
]);

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class GuardrailSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = GUARDRAIL_SIDEBAR_VIEW_ID;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    const { webview } = webviewView;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const nonce = getNonce();
    const cspSource = webview.cspSource;
    const csp = [
      `default-src 'none'`,
      `style-src ${cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src ${cspSource} https://fonts.gstatic.com`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    webview.html = this._getHtml(csp, nonce);

    webview.onDidReceiveMessage((msg: { command?: string }) => {
      const cmd = msg.command;
      if (!cmd || !ALLOWED_COMMANDS.has(cmd)) {
        return;
      }
      void vscode.commands.executeCommand(cmd);
    });
  }

  private _getHtml(csp: string, nonce: string): string {
    const styles = getGuardrailSharedStyles();
    const action = (command: string, label: string, icon: string) => `
      <button type="button" class="sidebar-action" data-command="${command}">
        <span class="material-symbols-outlined">${icon}</span>
        <span class="sidebar-action-label">${label}</span>
      </button>`;

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Security-Policy" content="${csp}"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guardrail</title>
  ${styles}
  <style nonce="${nonce}">
    body.guardrail-sidebar {
      padding-bottom: 12px;
      min-height: auto;
    }
    .sidebar-wrap { padding: 0 12px 12px; }
    .sidebar-hint {
      font-size: 11px;
      line-height: 1.45;
      color: var(--on-surface-variant);
      margin-bottom: 12px;
    }
    .sidebar-primary {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: linear-gradient(135deg, var(--primary), var(--primary-container));
      color: var(--on-primary);
      box-shadow: 0 6px 16px rgba(0, 90, 194, 0.35);
    }
    .sidebar-primary:hover { filter: brightness(1.08); }
    .sidebar-primary:active { transform: scale(0.98); }
    .sidebar-primary .material-symbols-outlined { font-size: 20px; }
    .sidebar-section { margin-bottom: 14px; }
    .sidebar-action {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 6px;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      background: var(--surface-low);
      color: inherit;
      cursor: pointer;
      text-align: left;
      font-size: 12px;
      transition: background 0.15s;
    }
    .sidebar-action:hover { background: var(--surface-high); }
    .sidebar-action .material-symbols-outlined {
      color: var(--primary);
      font-size: 20px;
    }
    .sidebar-action-label { font-weight: 600; }
  </style>
</head>
<body class="guardrail-sidebar">
  <header class="top-bar" style="position:relative;">
    <div class="brand">
      <span class="material-symbols-outlined">shield</span>
      <span>GUARDRAIL</span>
    </div>
  </header>
  <div class="sidebar-wrap">
    <p class="sidebar-hint">
      Opens the full dashboard (home, analytics, settings) in an editor tab. Use the buttons below for quick actions.
    </p>
    <button type="button" class="sidebar-primary" data-command="guardrail.showDashboard">
      <span class="material-symbols-outlined">dashboard</span>
      Open full dashboard
    </button>

    <section class="sidebar-section">
      <h2 class="section-title">Quick actions</h2>
      ${action("guardrail.scanWorkspace", "Scan workspace", "search")}
      ${action("guardrail.runShip", "Run Ship Check", "rocket_launch")}
      ${action("guardrail.verifyLastOutput", "Verify AI output (clipboard)", "shield")}
      ${action("guardrail.showFindings", "Show findings", "list_alt")}
    </section>

    <section class="sidebar-section">
      <h2 class="section-title">Enterprise panels</h2>
      ${action("guardrail.openSecurityScanner", "Security scanner", "security")}
      ${action("guardrail.openComplianceDashboard", "Compliance", "policy")}
      ${action("guardrail.openPerformanceMonitor", "Performance", "speed")}
      ${action("guardrail.openMDCGenerator", "MDC generator", "article")}
      ${action("guardrail.openChangeImpactAnalyzer", "Change impact", "device_hub")}
      ${action("guardrail.openAIExplainer", "AI explainer", "smart_toy")}
      ${action("guardrail.openTeamCollaboration", "Team collaboration", "groups")}
      ${action("guardrail.openProductionIntegrity", "Production integrity", "dns")}
    </section>
  </div>
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      document.querySelectorAll("[data-command]").forEach(function (el) {
        el.addEventListener("click", function () {
          var cmd = el.getAttribute("data-command");
          if (cmd) { vscode.postMessage({ command: cmd }); }
        });
      });
    })();
  </script>
</body>
</html>`;
  }
}
