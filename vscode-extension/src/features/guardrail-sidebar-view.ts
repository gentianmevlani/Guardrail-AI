/**
 * Activity bar sidebar: quick entry to the same flows as {@link GuardrailDashboardPanel}
 * and enterprise feature panels (commands already registered in extension.ts).
 */

import * as vscode from "vscode";
import {
  GUARDRAIL_VERSION,
  getGuardrailCssBlock,
  getGuardrailFontLinks,
  getGuardrailSidebarCss,
} from "../guardrail-styles";
import { getLastScanResult } from "../scan-state";
import { getLastVibeCheckSnapshot } from "../vibe-check-state";
import { getGuardrailWebUrl } from "../guardrail-web-urls";
import { getTierDisplayCached } from "../tier-ui-cache";

export const GUARDRAIL_SIDEBAR_VIEW_ID = "guardrail.sidebar";

const ALLOWED_COMMANDS = new Set<string>([
  "guardrail.openHub",
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
  "guardrail.openPromptFirewall",
  "guardrail.login",
  "guardrail.logout",
  "guardrail.openWebDashboard",
  "guardrail.refreshPlan",
  "guardrail.runVibeCheck",
  "guardrail.applyTemplate",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
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

  /** Send a live update to the sidebar without full HTML rebuild. */
  public static postLiveUpdate(data: {
    type: string;
    [key: string]: unknown;
  }): void {
    const view = GuardrailSidebarViewProvider._instance?._view;
    if (view) {
      void view.webview.postMessage(data);
    }
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

    <!-- Service Heartbeats -->
    <section>
      <h2 class="ka-sb2-h2">Services</h2>
      <div class="ka-sb2-heartbeat-grid" id="heartbeatGrid">
        <div class="ka-sb2-hb-chip" data-svc="context-engine" data-status="watching">
          <span class="ka-sb2-hb-dot"></span>
          <span>Context</span>
        </div>
        <div class="ka-sb2-hb-chip" data-svc="security-scanner" data-status="watching">
          <span class="ka-sb2-hb-dot"></span>
          <span>Security</span>
        </div>
        <div class="ka-sb2-hb-chip" data-svc="vibe-check" data-status="idle">
          <span class="ka-sb2-hb-dot"></span>
          <span>Vibe</span>
        </div>
        <div class="ka-sb2-hb-chip" data-svc="template-engine" data-status="idle">
          <span class="ka-sb2-hb-dot"></span>
          <span>Templates</span>
        </div>
        <div class="ka-sb2-hb-chip" data-svc="reality-check" data-status="idle">
          <span class="ka-sb2-hb-dot"></span>
          <span>Reality</span>
        </div>
        <div class="ka-sb2-hb-chip" data-svc="compliance" data-status="idle">
          <span class="ka-sb2-hb-dot"></span>
          <span>Compliance</span>
        </div>
      </div>
    </section>

    <!-- Activity Feed -->
    <section>
      <h2 class="ka-sb2-h2">Activity</h2>
      <div class="ka-sb2-feed" id="activityFeed">
        <div class="ka-sb2-feed-empty">
          <span class="material-symbols-outlined">radio_button_unchecked</span>
          Save a file or run a scan...
        </div>
      </div>
    </section>

    <section>
      <h2 class="ka-sb2-h2">Enterprise Panels</h2>
      <nav class="ka-sb2-nav" aria-label="Enterprise panels">
        <button type="button" class="ka-sb2-nav-row ka-sb2-nav-active" data-command="guardrail.openSecurityScanner">
          <span class="material-symbols-outlined">security_update_good</span>
          <span class="ka-sb2-nav-lbl">Security Scanner</span>
          <span class="ka-sb2-nav-ping" aria-hidden="true"></span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openComplianceDashboard">
          <span class="material-symbols-outlined">verified_user</span>
          <span class="ka-sb2-nav-lbl">Compliance</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openPerformanceMonitor">
          <span class="material-symbols-outlined">speed</span>
          <span class="ka-sb2-nav-lbl">Performance</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openMDCGenerator">
          <span class="material-symbols-outlined">terminal</span>
          <span class="ka-sb2-nav-lbl">MDC Generator</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openChangeImpactAnalyzer">
          <span class="material-symbols-outlined">dynamic_form</span>
          <span class="ka-sb2-nav-lbl">Change Impact</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openAIExplainer">
          <span class="material-symbols-outlined">psychology</span>
          <span class="ka-sb2-nav-lbl">AI Explainer</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openTeamCollaboration">
          <span class="material-symbols-outlined">groups</span>
          <span class="ka-sb2-nav-lbl">Team Collaboration</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openProductionIntegrity">
          <span class="material-symbols-outlined">lan</span>
          <span class="ka-sb2-nav-lbl">Production Integrity</span>
        </button>
        <button type="button" class="ka-sb2-nav-row" data-command="guardrail.openPromptFirewall">
          <span class="material-symbols-outlined">shield</span>
          <span class="ka-sb2-nav-lbl">Prompt Firewall</span>
        </button>
      </nav>
    </section>

    <section class="ka-sb2-status-section">
      <div class="ka-sb2-status-card">
        <div class="ka-sb2-status-inner">
          <div class="ka-sb2-status-head">
            <span class="ka-sb2-status-title">Live Status</span>
            <span class="ka-sb2-status-badge" id="statusBadge">ENCRYPTED</span>
          </div>
          <div class="ka-sb2-status-rows">
            <div class="ka-sb2-status-row">
              <span>Findings</span>
              <span class="ka-sb2-status-val" id="statusFindings">${tokensDisplay}</span>
            </div>
            <div class="ka-sb2-status-bar-track" aria-hidden="true">
              <div class="ka-sb2-status-bar-fill" id="statusBar" style="width:${statusBarPct}%"></div>
            </div>
            <div class="ka-sb2-status-row">
              <span>Risk Level</span>
              <span class="ka-sb2-status-val-strong" id="statusRisk">${riskLabel}</span>
            </div>
            <div class="ka-sb2-status-row">
              <span>Last Scan</span>
              <span class="ka-sb2-status-val" id="statusLastScan">—</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>

  <footer class="ka-sb2-footer">
    <div class="ka-sb2-footer-ver">
      <span class="ka-sb2-footer-dot" aria-hidden="true"></span>
      <span class="ver">V${GUARDRAIL_VERSION}-STABLE</span>
    </div>
    <div class="ka-sb2-footer-actions">
      <button type="button" class="ka-sb2-footer-icon" data-command="guardrail.logout" title="Logout" aria-label="Logout">
        <span class="material-symbols-outlined" style="font-size:18px;">logout</span>
      </button>
      <button type="button" class="ka-sb2-footer-icon" data-command="guardrail.openWebDashboard" title="Open web dashboard" aria-label="Open web dashboard">
        <span class="material-symbols-outlined" style="font-size:18px;">dashboard</span>
      </button>
      <button type="button" class="ka-sb2-footer-icon" data-command="guardrail.refreshPlan" title="Refresh plan (API / CLI)" aria-label="Refresh plan">
        <span class="material-symbols-outlined" style="font-size:18px;">sync</span>
      </button>
      <button type="button" class="ka-sb2-footer-icon" data-command="openExternal" data-url="${getGuardrailWebUrl("/docs")}" title="Documentation" aria-label="Documentation">
        <span class="material-symbols-outlined" style="font-size:18px;">info</span>
      </button>
    </div>
  </footer>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();

      // ── Command routing ──
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

      // ── Live update handlers ──
      var feed = document.getElementById("activityFeed");
      var scanBar = document.getElementById("scanBar");
      var ambient = document.getElementById("sidebarAmbient");

      function animateVal(id, val) {
        var el = document.getElementById(id);
        if (!el) return;
        if (el.textContent === String(val)) return;
        el.textContent = String(val);
        el.classList.add("counting");
        setTimeout(function() { el.classList.remove("counting"); }, 400);
      }

      function formatTime(ts) {
        var d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }

      function esc(s) {
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
      }

      window.addEventListener("message", function(event) {
        var msg = event.data;
        if (!msg || !msg.type) return;

        if (msg.type === "snapshot") {
          var snap = msg.data;
          // Update live stats
          if (snap.findingsLive != null) animateVal("liveFindings", snap.findingsLive);
          if (snap.contextScore != null) animateVal("liveVibe", snap.contextScore);

          // Scanning state
          if (snap.isScanning) {
            scanBar && scanBar.classList.add("active");
            ambient && (ambient.className = "ka-sb2-ambient scanning");
          } else {
            scanBar && scanBar.classList.remove("active");
            ambient && (ambient.className = "ka-sb2-ambient");
          }

          // Service heartbeats
          if (snap.services) {
            snap.services.forEach(function(svc) {
              var chip = document.querySelector('[data-svc="' + svc.id + '"]');
              if (chip) chip.setAttribute("data-status", svc.status);
            });
          }
        }

        if (msg.type === "activity") {
          var evt = msg.data;
          var empty = feed && feed.querySelector(".ka-sb2-feed-empty");
          if (empty) empty.remove();
          if (!feed) return;

          var item = document.createElement("div");
          item.className = "ka-sb2-feed-item";
          item.innerHTML =
            '<span class="material-symbols-outlined ka-sb2-feed-icon" style="color:' + (evt.accent || "var(--primary-fixed-dim)") + '">' + evt.icon + '</span>' +
            '<div class="ka-sb2-feed-body">' +
              '<span class="ka-sb2-feed-msg">' + esc(evt.message) + '</span>' +
              '<span class="ka-sb2-feed-time">' + formatTime(evt.timestamp) + '</span>' +
            '</div>';
          feed.insertBefore(item, feed.firstChild);
          while (feed.children.length > 15) feed.removeChild(feed.lastChild);
        }

        if (msg.type === "scoreUpdate") {
          animateVal("liveScore", msg.score);
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}
