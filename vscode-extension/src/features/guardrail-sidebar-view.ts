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

    const scorePct =
      hasScan && scan!.score != null
        ? Math.max(0, Math.min(100, Math.round(scan!.score)))
        : null;

    const cliSummary = scan?.cliSummary;
    const totalFindings = cliSummary
      ? cliSummary.totalFindings
      : hasScan
        ? scan!.issues.length
        : 0;

    const tokensDisplay =
      hasScan && totalFindings >= 0
        ? totalFindings.toLocaleString("en-US")
        : "—";
    const vibe = getLastVibeCheckSnapshot();
    const vibeScore = vibe ? String(vibe.score ?? "—") : "—";
    const vibeBar = vibe && vibe.score != null ? Math.max(0, Math.min(100, vibe.score)) : 0;
    const vibeEmoji = vibe
      ? vibe.canShip
        ? "🟢"
        : (vibe.score ?? 0) >= 60
          ? "🟡"
          : "🔴"
      : "○";
    const vibeReady = vibe
      ? vibe.canShip
        ? "Ready"
        : "Not ready"
      : "Not run";
    const vibeCrit = vibe ? String(vibe.missingCritical) : "—";
    const vibeEss = vibe ? String(vibe.missingEssential) : "—";
    const vibeImp = vibe ? String(vibe.missingImportant) : "—";
    const vibeGapsList =
      vibe && vibe.topGaps.length > 0
        ? `<ul class="ka-sb2-vibe-gaps">${vibe.topGaps
            .slice(0, 4)
            .map((g) => `<li>${escapeHtml(g)}</li>`)
            .join("")}</ul>`
        : "";
    const vibeHint = vibe
      ? `ETA ship-ready: ${escapeHtml(vibe.estimatedTimeToShip)} · Updated ${new Date(vibe.updatedAt).toLocaleString()}`
      : "Run <strong>Vibe Check</strong> to score gaps (auth, env, UX). Results stay in this panel.";
    const statusBarPct = hasScan ? scorePct ?? 0 : 65;
    const riskLabel = hasScan
      ? scan!.canShip
        ? "NOMINAL"
        : "ELEVATED"
      : "—";

    const fonts = getGuardrailFontLinks();
    const theme = `${getGuardrailCssBlock()}${getGuardrailSidebarCss()}`;

    return `<!DOCTYPE html>
<html class="dark ka-sidebar-root" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Security-Policy" content="${csp}"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guardrail - Dashboard</title>
  ${fonts}
  <style>
  ${theme}
  </style>
</head>
<body class="ka-sidebar-body ka-sidebar-v2">
  <div class="ka-sb2-ambient" id="sidebarAmbient"></div>
  <header class="ka-sb2-header">
    <button type="button" class="ka-sb2-brand" data-command="guardrail.showDashboard" title="Open dashboard">
      <span class="material-symbols-outlined">shield_lock</span>
      <h1>GUARDRAIL</h1>
    </button>
    <button type="button" class="ka-sb2-settings" data-command="openSettings" title="Extension settings" aria-label="Settings">
      <span class="material-symbols-outlined">settings</span>
    </button>
  </header>
  <div class="ka-sb2-scanning-bar" id="scanBar">
    <div class="ka-sb2-scanning-fill"></div>
  </div>
  <div class="ka-sb2-plan-wrap" title="Resolved from API, login, or CLI state (same as dashboard Settings)">
    <span class="ka-sb2-plan">Plan: ${getTierDisplayCached()}</span>
  </div>

  <div class="ka-sb2-scroll">
    <div class="ka-sb2-cta-wrap" style="display:flex;gap:8px;">
      <button type="button" class="ka-sb2-cta-primary" data-command="guardrail.openHub" title="Open Guardrail Hub" style="flex:1;">
        <span class="material-symbols-outlined ka-sb2-icon-fill">hub</span>
        Open Hub
      </button>
      <button type="button" class="ka-sb2-cta-primary" data-command="guardrail.showDashboard" title="Open dashboard" style="flex:1;background:linear-gradient(to bottom right,var(--surface-container-high),var(--surface-container-highest));color:var(--on-surface);box-shadow:none;">
        <span class="material-symbols-outlined ka-sb2-icon-fill">dashboard_customize</span>
        Dashboard
      </button>
    </div>

    <!-- Live Stats -->
    <section>
      <h2 class="ka-sb2-h2">Live Status</h2>
      <div class="ka-sb2-live-stats">
        <div class="ka-sb2-live-stat">
          <span class="ka-sb2-live-stat-val" id="liveScore">${scorePct ?? "—"}</span>
          <span class="ka-sb2-live-stat-lbl">Score</span>
        </div>
        <div class="ka-sb2-live-stat">
          <span class="ka-sb2-live-stat-val" id="liveFindings">${tokensDisplay}</span>
          <span class="ka-sb2-live-stat-lbl">Findings</span>
        </div>
        <div class="ka-sb2-live-stat">
          <span class="ka-sb2-live-stat-val" id="liveVibe">${vibeScore}</span>
          <span class="ka-sb2-live-stat-lbl">Vibe</span>
        </div>
      </div>
    </section>

    <section>
      <h2 class="ka-sb2-h2">Quick Actions</h2>
      <div class="ka-sb2-quick-grid">
        <button type="button" class="ka-sb2-glass-tile" data-command="guardrail.scanWorkspace">
          <span class="material-symbols-outlined">search_check</span>
          <span class="ka-sb2-tile-lbl">Scan Workspace</span>
        </button>
        <button type="button" class="ka-sb2-glass-tile" data-command="guardrail.runShip">
          <span class="material-symbols-outlined">rocket_launch</span>
          <span class="ka-sb2-tile-lbl">Run Ship Check</span>
        </button>
        <button type="button" class="ka-sb2-glass-tile" data-command="guardrail.verifyLastOutput">
          <span class="material-symbols-outlined">auto_awesome</span>
          <span class="ka-sb2-tile-lbl">Verify AI Output</span>
        </button>
        <button type="button" class="ka-sb2-glass-tile" data-command="guardrail.showFindings">
          <span class="material-symbols-outlined">visibility</span>
          <span class="ka-sb2-tile-lbl">Show Findings</span>
        </button>
      </div>
    </section>

    <section class="ka-sb2-vibe-section" aria-label="Ship readiness">
      <h2 class="ka-sb2-h2">Ship readiness</h2>
      <p class="ka-sb2-vibe-lead">Vibe Check scores what AI-built apps often skip — auth, env, error handling, UX polish.</p>
      <div class="ka-sb2-vibe-card">
        <div class="ka-sb2-vibe-head">
          <span class="ka-sb2-vibe-emoji" aria-hidden="true">${vibeEmoji}</span>
          <div class="ka-sb2-vibe-scoreblock">
            <span class="ka-sb2-vibe-score">${vibeScore}</span>
            <span class="ka-sb2-vibe-sub">/100 · ${escapeHtml(vibeReady)}</span>
          </div>
        </div>
        <div class="ka-sb2-vibe-bar-track" aria-hidden="true">
          <div class="ka-sb2-vibe-bar-fill" style="width:${vibeBar}%"></div>
        </div>
        <div class="ka-sb2-vibe-meta">
          <span><abbr title="Blocking issues">Crit</abbr> ${vibeCrit}</span>
          <span><abbr title="UX gaps">Ess</abbr> ${vibeEss}</span>
          <span><abbr title="Scale / security">Imp</abbr> ${vibeImp}</span>
        </div>
        ${vibeGapsList}
        <p class="ka-sb2-vibe-hint">${vibeHint}</p>
      </div>
      <div class="ka-sb2-quick-grid ka-sb2-vibe-actions">
        <button type="button" class="ka-sb2-glass-tile" data-command="guardrail.runVibeCheck">
          <span class="material-symbols-outlined">rocket_launch</span>
          <span class="ka-sb2-tile-lbl">Run Vibe Check</span>
        </button>
        <button type="button" class="ka-sb2-glass-tile" data-command="guardrail.applyTemplate">
          <span class="material-symbols-outlined">file_copy</span>
          <span class="ka-sb2-tile-lbl">Apply Template</span>
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
