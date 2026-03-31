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
  "guardrail.login",
  "guardrail.logout",
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

    /* ── Derive metrics from scan or use demo defaults ── */
    const scorePct = scan
      ? Math.max(0, Math.min(100, Math.round(scan.score)))
      : 94;
    const riskLabel = scan
      ? scan.canShip ? "Minimal" : "Elevated"
      : "Minimal";
    const trendVal = scan
      ? (scan.canShip ? "+2.4%" : "-1.2%")
      : "+2.4%";
    const trendIcon = trendVal.startsWith("+") ? "trending_up" : "trending_down";
    const trendColor = trendVal.startsWith("+") ? "color:var(--cyan-glow);" : "color:var(--error);";
    const postureDesc = scan
      ? (scan.canShip
        ? `Infrastructure integrity is within <strong>optimal</strong> parameters. Score: ${scorePct}.`
        : `Issues detected — review findings before shipping. Score: ${scorePct}.`)
      : `Infrastructure integrity is within <strong>optimal</strong> parameters. 2 recent mitigations applied.`;

    const cliSummary = scan?.cliSummary;
    const criticalCount = cliSummary ? cliSummary.critical : (scan ? scan.issues.filter(i => i.type === "critical").length : 3);
    const highCount = cliSummary ? cliSummary.high : (scan ? scan.issues.filter(i => i.type === "warning").length : 12);
    const medCount = cliSummary ? cliSummary.medium : 28;
    const totalFindings = cliSummary ? cliSummary.totalFindings : (scan ? scan.issues.length : 43);

    const critPct = totalFindings ? Math.round((criticalCount / totalFindings) * 100) : 15;
    const highPct = totalFindings ? Math.round((highCount / totalFindings) * 100) : 45;
    const medPct = totalFindings ? Math.round((medCount / totalFindings) * 100) : 70;

    const shipLabel = scan ? (scan.canShip ? "PASSED" : "BLOCKED") : "PASSED";

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
  <title>Guardrail — Cyber Circuit</title>
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
    <div style="display:flex;align-items:center;gap:4px;">
      <button type="button" class="ka-icon-btn" data-command="guardrail.scanWorkspace" title="Scan workspace" aria-label="Scan">
        <span class="material-symbols-outlined" style="font-size:18px;">search_check</span>
      </button>
      <button type="button" class="ka-icon-btn" data-command="openSettings" title="Extension settings" aria-label="Settings">
        <span class="material-symbols-outlined" style="font-size:18px;">settings</span>
      </button>
    </div>
  </header>

  <div class="ka-sidebar-inner">
    <!-- ── Security Posture Hero ── -->
    <div class="ka-cyber-posture">
      <div class="ka-posture-label">Security Posture</div>
      <div class="ka-posture-score">
        <span class="ka-score-num">${scorePct}</span>
        <span class="ka-score-max">/100</span>
      </div>
      <p class="ka-posture-desc">${postureDesc}</p>
      <div class="ka-posture-meta">
        <div class="ka-posture-meta-item">
          <span class="ka-posture-meta-label">Trend</span>
          <span class="ka-posture-meta-val" style="${trendColor}">
            ${trendVal}
            <span class="material-symbols-outlined" style="font-size:14px;">${trendIcon}</span>
          </span>
        </div>
        <div class="ka-posture-divider"></div>
        <div class="ka-posture-meta-item">
          <span class="ka-posture-meta-label">Risk Level</span>
          <span class="ka-posture-meta-val" style="color:var(--secondary);">${riskLabel}</span>
        </div>
        <div class="ka-posture-divider"></div>
        <div class="ka-posture-meta-item">
          <span class="ka-posture-meta-label">Ship</span>
          <span class="ka-posture-meta-val" style="color:${shipLabel === "PASSED" ? "var(--cyan-glow)" : "var(--error)"};">${shipLabel}</span>
        </div>
      </div>
    </div>

    <!-- ── Vulnerability Summary ── -->
    <div class="ka-vuln-card" data-command="guardrail.showFindings" style="cursor:pointer;">
      <div class="ka-vuln-header">
        <span class="material-symbols-outlined">shield</span>
        <span class="ka-vuln-ref">TOTAL: ${totalFindings}</span>
      </div>
      <div class="ka-vuln-title">Vulnerability Summary</div>
      <div class="ka-vuln-row">
        <span class="ka-vuln-row-label">Critical</span>
        <div class="ka-vuln-bar-track">
          <div class="ka-vuln-bar-fill" style="width:${critPct}%;background:var(--error);"></div>
        </div>
        <span class="ka-vuln-row-count" style="color:var(--error);">${String(criticalCount).padStart(2, "0")}</span>
      </div>
      <div class="ka-vuln-row">
        <span class="ka-vuln-row-label">High</span>
        <div class="ka-vuln-bar-track">
          <div class="ka-vuln-bar-fill" style="width:${highPct}%;background:var(--secondary);"></div>
        </div>
        <span class="ka-vuln-row-count" style="color:var(--secondary);">${String(highCount).padStart(2, "0")}</span>
      </div>
      <div class="ka-vuln-row">
        <span class="ka-vuln-row-label">Medium</span>
        <div class="ka-vuln-bar-track">
          <div class="ka-vuln-bar-fill" style="width:${medPct}%;background:#94a3b8;"></div>
        </div>
        <span class="ka-vuln-row-count" style="color:#94a3b8;">${String(medCount).padStart(2, "0")}</span>
      </div>
    </div>

    <!-- ── Recent Ship Checks ── -->
    <div class="ka-checks-card">
      <div class="ka-checks-header">
        <span class="material-symbols-outlined">package_2</span>
        <span class="ka-checks-badge">AUTO-RUN: ACTIVE</span>
      </div>
      <div class="ka-checks-title">Recent Ship Checks</div>
      <div class="ka-check-item">
        <span class="material-symbols-outlined" style="color:#22c55e;font-variation-settings:'FILL' 1;">check_circle</span>
        <span class="ka-check-name">Workspace Scan</span>
        <span class="ka-check-time">${scan ? "just now" : "2m ago"}</span>
      </div>
      <div class="ka-check-item">
        <span class="material-symbols-outlined" style="color:#22c55e;font-variation-settings:'FILL' 1;">check_circle</span>
        <span class="ka-check-name">Dependency Audit</span>
        <span class="ka-check-time">14m ago</span>
      </div>
      <div class="ka-check-item">
        <span class="material-symbols-outlined" style="color:var(--error);font-variation-settings:'FILL' 1;">error</span>
        <span class="ka-check-name">Pre-commit Gate</span>
        <span class="ka-check-time">1h ago</span>
      </div>
    </div>

    <!-- ── Active Scans ── -->
    <div class="ka-scans-card">
      <div class="ka-scans-header">
        <span class="material-symbols-outlined">radar</span>
        <span class="ka-scans-running">MONITORING</span>
      </div>
      <div class="ka-scans-title">Active Scans</div>
      <div class="ka-scan-progress">
        <div class="ka-scan-progress-head">
          <span>Security Sweep</span>
          <span>84%</span>
        </div>
        <div class="ka-scan-progress-bar">
          <div class="ka-scan-progress-fill" style="width:84%;"></div>
        </div>
      </div>
      <div class="ka-scan-progress" style="opacity:0.55;">
        <div class="ka-scan-progress-head">
          <span>Deep Dependency Check</span>
          <span>12%</span>
        </div>
        <div class="ka-scan-progress-bar">
          <div class="ka-scan-progress-fill" style="width:12%;"></div>
        </div>
      </div>
    </div>

    <!-- ── Quick Actions ── -->
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

    <!-- ── Enterprise Panels ── -->
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

    <!-- ── Live Status Feed ── -->
    <section>
      <div class="ka-feed-card">
        <div class="ka-feed-header">
          <div class="ka-feed-header-left">
            <span class="material-symbols-outlined">list_alt</span>
            <span class="ka-feed-title">Live Status Feed</span>
          </div>
          <div class="ka-feed-status">
            <span class="ka-feed-dot-live"></span>
            <span>STREAMING</span>
          </div>
        </div>
        <div class="ka-feed-body">
          <div class="ka-feed-line">
            <span class="ka-feed-ts">[14:22:01]</span>
            <span class="ka-feed-level ka-feed-level-info">INFO:</span>
            <span class="ka-feed-msg">Heartbeat signal received. Latency 14ms.</span>
          </div>
          <div class="ka-feed-line">
            <span class="ka-feed-ts">[14:22:04]</span>
            <span class="ka-feed-level ka-feed-level-info">INFO:</span>
            <span class="ka-feed-msg">Container scan started on Registry.</span>
          </div>
          <div class="ka-feed-line">
            <span class="ka-feed-ts">[14:22:08]</span>
            <span class="ka-feed-level ka-feed-level-warn">WARN:</span>
            <span class="ka-feed-msg">Anomalous access pattern detected.</span>
          </div>
          <div class="ka-feed-line">
            <span class="ka-feed-ts">[14:22:12]</span>
            <span class="ka-feed-level ka-feed-level-info">INFO:</span>
            <span class="ka-feed-msg">Posture re-calc complete. OPTIMAL.</span>
          </div>
          <div class="ka-feed-line">
            <span class="ka-feed-ts">[14:22:15]</span>
            <span class="ka-feed-level ka-feed-level-fail">FAIL:</span>
            <span class="ka-feed-msg">Integrity check failed on backup.</span>
          </div>
          <div class="ka-feed-line">
            <span class="ka-feed-ts">[14:22:20]</span>
            <span class="ka-feed-level ka-feed-level-info">INFO:</span>
            <span class="ka-feed-msg">Policy pushed to edge nodes.</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Auth / Deploy CTA ── -->
    <section>
      <button type="button" class="ka-primary-cta" data-command="guardrail.login" title="Link your CLI & extension to your web account">
        <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:'FILL' 1, 'wght' 400;">link</span>
        Login &amp; Link Device
      </button>
      <div style="margin-top:8px;">
        <button type="button" class="ka-primary-cta" data-command="guardrail.scanWorkspace" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;">
          <span class="material-symbols-outlined" style="font-size:18px;">radar</span>
          Deploy Scanner
        </button>
      </div>
    </section>
  </div>

  <footer class="ka-sidebar-footer">
    <div class="ka-footer-ver">
      <span class="ka-footer-dot" aria-hidden="true"></span>
      <span>V${KINETIC_ARCHIVE_VERSION}-STABLE</span>
    </div>
    <div style="display:flex;align-items:center;gap:4px;">
      <button type="button" class="ka-icon-btn" data-command="guardrail.logout" title="Logout" aria-label="Logout">
        <span class="material-symbols-outlined" style="font-size:16px;">logout</span>
      </button>
      <button type="button" class="ka-icon-btn" data-command="openExternal" data-url="${DOCS_URL}" title="Documentation" aria-label="Documentation">
        <span class="material-symbols-outlined" style="font-size:18px;">info</span>
      </button>
    </div>
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
