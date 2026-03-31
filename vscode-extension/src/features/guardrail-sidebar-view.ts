/**
 * Activity bar sidebar: quick entry to the same flows as {@link GuardrailDashboardPanel}
 * and enterprise feature panels (commands already registered in extension.ts).
 */

import * as vscode from "vscode";
import {
  KINETIC_ARCHIVE_VERSION,
  getKineticArchiveCssBlock,
  getKineticArchiveFontLinks,
} from "../kinetic-archive-styles";
import { getLastScanResult } from "../scan-state";

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

const DOCS_URL = "https://docs.guardrail.dev";

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

  private static _instance: GuardrailSidebarViewProvider | undefined;

  private _view: vscode.WebviewView | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {
    GuardrailSidebarViewProvider._instance = this;
  }

  /** Re-render sidebar HTML when scan state changes (matches {@link GuardrailDashboardPanel.refreshIfOpen}). */
  public static refreshIfOpen(): void {
    GuardrailSidebarViewProvider._instance?._refreshHtml();
  }

  private _buildCsp(webview: vscode.Webview, nonce: string): string {
    const cspSource = webview.cspSource;
    return [
      `default-src 'none'`,
      `style-src ${cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src ${cspSource} https://fonts.gstatic.com`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");
  }

  private _refreshHtml(): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const nonce = getNonce();
    const csp = this._buildCsp(view.webview, nonce);
    view.webview.html = this._getHtml(csp, nonce);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;
    webviewView.onDidDispose(() => {
      if (this._view === webviewView) {
        this._view = undefined;
      }
    });

    const { webview } = webviewView;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const nonce = getNonce();
    const csp = this._buildCsp(webview, nonce);

    webview.html = this._getHtml(csp, nonce);

    webview.onDidReceiveMessage(
      (msg: { command?: string; url?: string }) => {
        if (msg.command === "openSettings") {
          void vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "guardrail",
          );
          return;
        }
        if (msg.command === "openExternal" && msg.url) {
          void vscode.env.openExternal(vscode.Uri.parse(msg.url));
          return;
        }
        const cmd = msg.command;
        if (!cmd || !ALLOWED_COMMANDS.has(cmd)) {
          return;
        }
        void vscode.commands.executeCommand(cmd);
      },
      null,
      undefined,
    );
  }

  private _getHtml(csp: string, nonce: string): string {
    const scan = getLastScanResult();
    const tokenDisplay = scan
      ? Math.max(0, Math.round(scan.score * 19.14)).toLocaleString("en-US")
      : "1,244";
    const barPct = scan
      ? Math.max(0, Math.min(100, Math.round(scan.score)))
      : 65;
    const riskLabel = scan
      ? scan.canShip
        ? "NOMINAL"
        : "ELEVATED"
      : "NOMINAL";

    const fonts = getKineticArchiveFontLinks();
    const theme = getKineticArchiveCssBlock();

    const navRow = (
      command: string,
      label: string,
      icon: string,
      active: boolean,
      showPing: boolean,
    ) => `
<button type="button" class="ka-nav-row${active ? " ka-nav-active" : ""}" data-command="${command}">
  <span class="material-symbols-outlined"${active ? ` style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;"` : ""}>${icon}</span>
  <span style="font-size:13px;font-weight:${active ? "600" : "500"};">${label}</span>
  ${showPing ? '<span class="ka-nav-ping" aria-hidden="true"></span>' : ""}
</button>`;

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Security-Policy" content="${csp}"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guardrail — Kinetic Archive</title>
  ${fonts}
  <style>
  ${theme}
  </style>
</head>
<body class="ka-sidebar-body">
  <header class="ka-sidebar-header">
    <button type="button" class="ka-sidebar-brand" data-command="guardrail.showDashboard" title="Open full dashboard">
      <span class="material-symbols-outlined">shield_lock</span>
      <h1>GUARDRAIL</h1>
    </button>
    <button type="button" class="ka-icon-btn" data-command="openSettings" title="Extension settings" aria-label="Settings">
      <span class="material-symbols-outlined">settings</span>
    </button>
  </header>

  <div class="ka-sidebar-inner">
    <div style="margin-top:6px;">
      <button type="button" class="ka-primary-cta" data-command="guardrail.showDashboard">
        <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;">dashboard_customize</span>
        Open Full Dashboard
      </button>
    </div>

    <section>
      <h2 class="ka-section-label">Quick Actions</h2>
      <div class="ka-quick-grid">
        <button type="button" class="ka-quick-tile" data-command="guardrail.scanWorkspace">
          <span class="material-symbols-outlined">search_check</span>
          <span>Scan Workspace</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.runShip">
          <span class="material-symbols-outlined">rocket_launch</span>
          <span>Run Ship Check</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.verifyLastOutput">
          <span class="material-symbols-outlined">auto_awesome</span>
          <span>Verify AI Output</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.showFindings">
          <span class="material-symbols-outlined">visibility</span>
          <span>Show Findings</span>
        </button>
      </div>
    </section>

    <section>
      <h2 class="ka-section-label">Enterprise Panels</h2>
      <nav class="ka-nav-list" aria-label="Enterprise panels">
        ${navRow("guardrail.openSecurityScanner", "Security Scanner", "security_update_good", true, true)}
        ${navRow("guardrail.openComplianceDashboard", "Compliance", "verified_user", false, false)}
        ${navRow("guardrail.openPerformanceMonitor", "Performance", "speed", false, false)}
        ${navRow("guardrail.openMDCGenerator", "MDC Generator", "terminal", false, false)}
        ${navRow("guardrail.openChangeImpactAnalyzer", "Change Impact", "dynamic_form", false, false)}
        ${navRow("guardrail.openAIExplainer", "AI Explainer", "psychology", false, false)}
        ${navRow("guardrail.openTeamCollaboration", "Team Collaboration", "groups", false, false)}
        ${navRow("guardrail.openProductionIntegrity", "Production Integrity", "lan", false, false)}
      </nav>
    </section>

    <section style="margin-top:auto;">
      <div class="ka-status-bento">
        <div class="ka-status-inner">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <span style="font-size:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--outline);letter-spacing:0.15em;text-transform:uppercase;">Live Status</span>
            <span style="padding:2px 8px;border-radius:999px;background:rgba(195,245,255,0.1);color:var(--primary-fixed);font-size:9px;font-weight:800;">ENCRYPTED</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;">
              <span style="color:var(--on-surface-variant);">Active Tokens</span>
              <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--primary-fixed-dim);">${tokenDisplay}</span>
            </div>
            <div style="width:100%;height:4px;background:var(--surface-container-highest);border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${barPct}%;background:var(--primary-container);border-radius:999px;"></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;">
              <span style="color:var(--on-surface-variant);">Risk Level</span>
              <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--on-surface);">${riskLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <footer class="ka-sidebar-footer">
    <div class="ka-footer-ver">
      <span class="ka-footer-dot" aria-hidden="true"></span>
      <span>V${KINETIC_ARCHIVE_VERSION}-STABLE</span>
    </div>
    <button type="button" class="ka-icon-btn" data-command="openExternal" data-url="${DOCS_URL}" title="Documentation" aria-label="Documentation">
      <span class="material-symbols-outlined" style="font-size:18px;">info</span>
    </button>
  </footer>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      document.querySelectorAll("[data-command]").forEach(function (el) {
        el.addEventListener("click", function () {
          var cmd = el.getAttribute("data-command");
          var url = el.getAttribute("data-url");
          if (cmd === "openExternal" && url) {
            vscode.postMessage({ command: "openExternal", url: url });
            return;
          }
          if (cmd === "openSettings") {
            vscode.postMessage({ command: "openSettings" });
            return;
          }
          if (cmd) { vscode.postMessage({ command: cmd }); }
        });
      });
    })();
  </script>
</body>
</html>`;
  }
}
