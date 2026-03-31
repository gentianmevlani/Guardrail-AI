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
  "guardrail.runDoctor",
  "guardrail.runWhoami",
  "guardrail.runGate",
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

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
    const hasScan = Boolean(scan);

    const scorePct = hasScan
      ? Math.max(0, Math.min(100, Math.round(scan!.score)))
      : null;
    const scoreDisplay = scorePct !== null ? String(scorePct) : "—";
    const riskLabel = hasScan
      ? scan!.canShip
        ? "Minimal"
        : "Elevated"
      : "—";
    const postureDesc = hasScan
      ? scan!.canShip
        ? `Last scan score <strong>${scoreDisplay}</strong> — within acceptable range for your tier.`
        : `Last scan score <strong>${scoreDisplay}</strong> — review findings before shipping.`
      : `No scan loaded. Run <strong>Scan workspace</strong> to compute posture from the CLI.`;

    const cliSummary = scan?.cliSummary;
    const criticalCount = cliSummary
      ? cliSummary.critical
      : hasScan
        ? scan!.issues.filter((i) => i.type === "critical").length
        : 0;
    const highCount = cliSummary
      ? cliSummary.high
      : hasScan
        ? scan!.issues.filter((i) => i.type === "warning").length
        : 0;
    const medCount = cliSummary
      ? cliSummary.medium
      : hasScan
        ? scan!.issues.filter((i) => i.type === "suggestion").length
        : 0;
    const totalFindings = cliSummary
      ? cliSummary.totalFindings
      : hasScan
        ? scan!.issues.length
        : 0;

    const hasSeverityData =
      hasScan && (totalFindings > 0 || Boolean(cliSummary?.totalFindings));

    const critPct =
      hasSeverityData && totalFindings > 0
        ? Math.round((criticalCount / totalFindings) * 100)
        : 0;
    const highPct =
      hasSeverityData && totalFindings > 0
        ? Math.round((highCount / totalFindings) * 100)
        : 0;
    const medPct =
      hasSeverityData && totalFindings > 0
        ? Math.round((medCount / totalFindings) * 100)
        : 0;

    const shipLabel = hasScan ? (scan!.canShip ? "CLEAR" : "REVIEW") : "—";

    const activityLines: string[] = [];
    if (hasScan && scan!.issues.length > 0) {
      for (const issue of scan!.issues.slice(0, 12)) {
        const lvlClass =
          issue.type === "critical"
            ? "ka-feed-level-fail"
            : issue.type === "warning"
              ? "ka-feed-level-warn"
              : "ka-feed-level-info";
        const tag =
          issue.type === "critical"
            ? "CRIT"
            : issue.type === "warning"
              ? "WARN"
              : "INFO";
        const file = issue.file
          ? `${issue.file}${issue.line != null ? `:${issue.line}` : ""}`
          : "";
        const msg = escapeHtml(issue.message);
        activityLines.push(`<div class="ka-feed-line" style="flex-direction:column;align-items:flex-start;gap:4px;margin-bottom:10px;">
            <span><span class="ka-feed-level ${lvlClass}">${tag}</span>${file ? ` <span class="ka-feed-msg" style="opacity:0.85;">${escapeHtml(file)}</span>` : ""}</span>
            <span class="ka-feed-msg">${msg}</span>
          </div>`);
      }
    }

    const fonts = getKineticArchiveFontLinks();
    const theme = getKineticArchiveCssBlock();

    const navRow = (
      command: string,
      label: string,
      icon: string,
      showPing: boolean,
    ) => `
<button type="button" class="ka-nav-row" data-command="${command}">
  <span class="material-symbols-outlined">${icon}</span>
  <span style="font-size:13px;font-weight:500;">${label}</span>
  ${showPing ? '<span class="ka-nav-ping" aria-hidden="true"></span>' : ""}
</button>`;

    return `<!DOCTYPE html>
<html class="dark ka-sidebar-root" lang="en">
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

  <div class="ka-sidebar-tabs" role="tablist" aria-label="Guardrail sidebar sections">
    <button type="button" class="ka-sidebar-tab ka-tab-active" role="tab" aria-selected="true" data-tab="overview">Overview</button>
    <button type="button" class="ka-sidebar-tab" role="tab" aria-selected="false" data-tab="enterprise">Enterprise</button>
    <button type="button" class="ka-sidebar-tab" role="tab" aria-selected="false" data-tab="activity">Activity</button>
  </div>

  <div class="ka-sidebar-inner">
    <!-- Overview -->
    <div class="ka-tab-panel" data-tab-panel="overview" role="tabpanel">
    <div class="ka-cyber-posture">
      <div class="ka-posture-label">Security Posture</div>
      <div class="ka-posture-score">
        <span class="ka-score-num">${scoreDisplay}</span>
        <span class="ka-score-max">/100</span>
      </div>
      <p class="ka-posture-desc">${postureDesc}</p>
      <div class="ka-posture-meta">
        <div class="ka-posture-meta-item">
          <span class="ka-posture-meta-label">Grade</span>
          <span class="ka-posture-meta-val" style="color:var(--secondary);">${hasScan ? escapeHtml(scan!.grade) : "—"}</span>
        </div>
        <div class="ka-posture-divider"></div>
        <div class="ka-posture-meta-item">
          <span class="ka-posture-meta-label">Risk</span>
          <span class="ka-posture-meta-val" style="color:var(--secondary);">${riskLabel}</span>
        </div>
        <div class="ka-posture-divider"></div>
        <div class="ka-posture-meta-item">
          <span class="ka-posture-meta-label">Ship</span>
          <span class="ka-posture-meta-val" style="color:${shipLabel === "CLEAR" ? "var(--cyan-glow)" : shipLabel === "REVIEW" ? "var(--error)" : "var(--outline)"};">${shipLabel}</span>
        </div>
      </div>
    </div>

    <div class="ka-vuln-card" data-command="guardrail.showFindings" style="cursor:pointer;" title="Open findings">
      <div class="ka-vuln-header">
        <span class="material-symbols-outlined">shield</span>
        <span class="ka-vuln-ref">TOTAL: ${hasSeverityData ? totalFindings : "—"}</span>
      </div>
      <div class="ka-vuln-title">Vulnerability summary</div>
      <p style="font-size:11px;color:var(--on-surface-variant);margin:0 0 12px;line-height:1.45;">
        ${hasSeverityData
          ? "Counts from the last <code style=\"font-size:10px;\">guardrail scan</code> run in this session."
          : "Run <strong>Scan workspace</strong> to load severity counts from the CLI."}
      </p>
      ${hasSeverityData
        ? `<div class="ka-vuln-row">
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
      </div>`
        : `<p style="font-size:12px;color:var(--outline);margin:0;">No severity data yet.</p>`}
    </div>

    <section>
      <h2 class="ka-section-label">Quick actions</h2>
      <div class="ka-quick-grid">
        <button type="button" class="ka-quick-tile" data-command="guardrail.scanWorkspace">
          <span class="material-symbols-outlined">search_check</span>
          <span>Scan Workspace</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.runShip">
          <span class="material-symbols-outlined">rocket_launch</span>
          <span>Run Ship Check</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.runGate">
          <span class="material-symbols-outlined">gavel</span>
          <span>Run Gate (JSON)</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.verifyLastOutput">
          <span class="material-symbols-outlined">auto_awesome</span>
          <span>Verify AI Output</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.showFindings">
          <span class="material-symbols-outlined">visibility</span>
          <span>Show Findings</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.runDoctor">
          <span class="material-symbols-outlined">health_and_safety</span>
          <span>CLI Doctor</span>
        </button>
        <button type="button" class="ka-quick-tile" data-command="guardrail.runWhoami">
          <span class="material-symbols-outlined">badge</span>
          <span>CLI Whoami</span>
        </button>
      </div>
    </section>

    <section>
      <button type="button" class="ka-primary-cta" data-command="guardrail.login" title="Link your CLI and extension to your Guardrail account">
        <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:'FILL' 1, 'wght' 400;">link</span>
        Login &amp; Link Device
      </button>
    </section>
    </div>

    <!-- Enterprise -->
    <div class="ka-tab-panel" data-tab-panel="enterprise" role="tabpanel" hidden>
    <section>
      <h2 class="ka-section-label">Enterprise panels</h2>
      <p style="font-size:11px;color:var(--on-surface-variant);margin:-4px 0 12px;line-height:1.45;">
        Opens the same panels as the full dashboard. Data comes from the CLI (<code style="font-size:10px;">guardrail scan</code>, etc.) or your API when configured.
      </p>
      <nav class="ka-nav-list" aria-label="Enterprise panels">
        ${navRow("guardrail.openSecurityScanner", "Security Scanner", "security_update_good", true)}
        ${navRow("guardrail.openComplianceDashboard", "Compliance", "verified_user", false)}
        ${navRow("guardrail.openPerformanceMonitor", "Performance", "speed", false)}
        ${navRow("guardrail.openMDCGenerator", "MDC Generator", "terminal", false)}
        ${navRow("guardrail.openChangeImpactAnalyzer", "Change Impact", "dynamic_form", false)}
        ${navRow("guardrail.openAIExplainer", "AI Explainer", "psychology", false)}
        ${navRow("guardrail.openTeamCollaboration", "Team Collaboration", "groups", false)}
        ${navRow("guardrail.openProductionIntegrity", "Production Integrity", "lan", false)}
      </nav>
    </section>
    </div>

    <!-- Activity -->
    <div class="ka-tab-panel" data-tab-panel="activity" role="tabpanel" hidden>
    <section>
      <h2 class="ka-section-label">Findings from last scan</h2>
      <div class="ka-feed-card">
        <div class="ka-feed-header">
          <div class="ka-feed-header-left">
            <span class="material-symbols-outlined">list_alt</span>
            <span class="ka-feed-title">Issues</span>
          </div>
        </div>
        <div class="ka-feed-body">
          ${activityLines.length > 0
            ? activityLines.join("")
            : hasScan &&
                cliSummary &&
                cliSummary.totalFindings > 0 &&
                scan!.issues.length === 0
              ? `<p style="font-size:12px;color:var(--outline);margin:12px 0 0;padding:0 4px;line-height:1.5;">
Scan reported <strong>${cliSummary.totalFindings}</strong> finding(s), but issue rows are not in session state (common on free tier or when details are redacted). Use a <strong>Finding ID</strong> with <code style="font-size:10px;">guardrail explain</code> or upgrade for full lists.
                </p>`
              : `<p style="font-size:12px;color:var(--outline);margin:12px 0 0;padding:0 4px;line-height:1.5;">
No issue rows in session state yet. Run <strong>Scan workspace</strong> (CLI) — on some tiers finding details require an API key.
              </p>`}
        </div>
      </div>
    </section>
    <section>
      <h2 class="ka-section-label">Ship &amp; production</h2>
      <p style="font-size:12px;color:var(--on-surface-variant);margin:0;line-height:1.5;">
        Full <strong>ship</strong> gate output is not shown here. Use <strong>Run Ship Check</strong> or open <strong>Production Integrity</strong> for the workspace ship JSON.
      </p>
    </section>
    </div>
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
      document.querySelectorAll(".ka-sidebar-tab").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var tab = btn.getAttribute("data-tab");
          if (!tab) return;
          document.querySelectorAll(".ka-sidebar-tab").forEach(function (b) {
            var on = b === btn;
            b.classList.toggle("ka-tab-active", on);
            b.setAttribute("aria-selected", on ? "true" : "false");
          });
          document.querySelectorAll("[data-tab-panel]").forEach(function (p) {
            p.hidden = p.getAttribute("data-tab-panel") !== tab;
          });
        });
      });
    })();
  </script>
</body>
</html>`;
  }
}
