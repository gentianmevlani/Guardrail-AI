/**
 * AI Output Firewall — The signature feature.
 *
 * Shows AI-generated code passing through the Guardrail firewall in real-time.
 * Displays verification stages, trust analysis, blockers, and one-click autofix.
 *
 * This is what makes Guardrail THE tool for AI-assisted development.
 */

import * as vscode from "vscode";
import type { LiveActivityEngine } from "../services/live-activity-engine";

function getFirewallFontLinks(): string {
  return `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>`;
}

export interface FirewallCheckResult {
  stage: string;
  status: "pass" | "fail" | "warn" | "running" | "pending";
  message: string;
  detail?: string;
  duration?: number;
}

export interface FirewallReport {
  codeSnippet: string;
  language: string;
  overallVerdict: "PASS" | "FAIL" | "WARN";
  trustScore: number;
  stages: FirewallCheckResult[];
  blockers: string[];
  warnings: string[];
  autoFixAvailable: boolean;
  timestamp: number;
}

export class AIFirewallPanel {
  public static currentPanel: AIFirewallPanel | undefined;
  private static _liveEngine: LiveActivityEngine | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static registerLiveEngine(engine: LiveActivityEngine): void {
    AIFirewallPanel._liveEngine = engine;
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.ViewColumn.Beside;
    if (AIFirewallPanel.currentPanel) {
      AIFirewallPanel.currentPanel._panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "guardrailFirewall",
      "AI Firewall",
      column,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    AIFirewallPanel.currentPanel = new AIFirewallPanel(panel);
  }

  /** Send a firewall report to the panel */
  public static sendReport(report: FirewallReport): void {
    if (AIFirewallPanel.currentPanel) {
      void AIFirewallPanel.currentPanel._panel.webview.postMessage({
        type: "firewallReport",
        data: report,
      });
    }
  }

  /** Update a single stage in-place */
  public static updateStage(index: number, stage: FirewallCheckResult): void {
    if (AIFirewallPanel.currentPanel) {
      void AIFirewallPanel.currentPanel._panel.webview.postMessage({
        type: "stageUpdate",
        data: { index, stage },
      });
    }
  }

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml();
    this._panel.onDidDispose(() => {
      AIFirewallPanel.currentPanel = undefined;
      this._disposables.forEach((d) => d.dispose());
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === "applyFix") {
        void vscode.commands.executeCommand("guardrail.applyVerifiedDiff");
      } else if (msg.command === "recheck") {
        void vscode.commands.executeCommand("guardrail.verifyLastOutput");
      } else if (msg.command === "copyFixPrompt") {
        void vscode.commands.executeCommand("guardrail.copyFixPrompt");
      }
    }, null, this._disposables);
  }

  private _getHtml(): string {
    const nonce = getNonce();
    const fonts = getFirewallFontLinks();

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <title>AI Output Firewall</title>
  ${fonts}
  <style>
    :root {
      --background: #111316;
      --surface-container: #1e2023;
      --surface-container-highest: #333538;
      --surface-container-lowest: #0c0e11;
      --on-surface: #e2e2e6;
      --on-surface-variant: #bac9cc;
      --outline: #849396;
      --outline-variant: #3b494c;
      --primary-fixed: #9cf0ff;
      --primary-fixed-dim: #00daf3;
      --primary-container: #00e5ff;
      --secondary-container: #0068ed;
      --cyan-glow: #00e5ff;
      --border-subtle: rgba(255,255,255,0.05);
      --border-light: rgba(255,255,255,0.08);
      --error: #ffb4ab;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .material-symbols-outlined {
      font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
      font-size: 20px;
    }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--background);
      color: var(--on-surface);
      margin: 0;
      padding: 24px;
      min-height: 100vh;
    }
    .fw-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .fw-header .material-symbols-outlined {
      font-size: 28px;
      color: var(--cyan-glow);
    }
    .fw-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: var(--cyan-glow);
    }
    .fw-subtitle {
      font-size: 11px;
      color: var(--outline);
    }

    .fw-verdict {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      animation: fadeUp 0.4s ease;
    }
    .fw-verdict.pass {
      background: rgba(107, 203, 119, 0.08);
      border: 1px solid rgba(107, 203, 119, 0.2);
    }
    .fw-verdict.fail {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .fw-verdict.warn {
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.2);
    }
    .fw-verdict-icon { font-size: 36px; }
    .fw-verdict.pass .fw-verdict-icon { color: #6bcb77; }
    .fw-verdict.fail .fw-verdict-icon { color: #ef4444; }
    .fw-verdict.warn .fw-verdict-icon { color: #fbbf24; }
    .fw-verdict-text h2 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 18px;
      font-weight: 700;
      margin: 0;
    }
    .fw-verdict.pass .fw-verdict-text h2 { color: #6bcb77; }
    .fw-verdict.fail .fw-verdict-text h2 { color: #ef4444; }
    .fw-verdict.warn .fw-verdict-text h2 { color: #fbbf24; }
    .fw-verdict-text p { font-size: 12px; color: var(--on-surface-variant); margin: 4px 0 0; }

    .fw-trust {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .fw-trust-score {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 42px;
      font-weight: 700;
      color: var(--primary-fixed);
    }
    .fw-trust-bar {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: var(--surface-container-highest);
      overflow: hidden;
    }
    .fw-trust-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.8s ease;
    }
    .fw-trust-fill.high { background: linear-gradient(90deg, #6bcb77, #10b981); }
    .fw-trust-fill.mid { background: linear-gradient(90deg, #fbbf24, #f97316); }
    .fw-trust-fill.low { background: linear-gradient(90deg, #ef4444, #dc2626); }

    .fw-stages { margin-bottom: 20px; }
    .fw-stage {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      animation: fadeUp 0.3s ease backwards;
    }
    .fw-stage:nth-child(1) { animation-delay: 0.05s; }
    .fw-stage:nth-child(2) { animation-delay: 0.1s; }
    .fw-stage:nth-child(3) { animation-delay: 0.15s; }
    .fw-stage:nth-child(4) { animation-delay: 0.2s; }
    .fw-stage:nth-child(5) { animation-delay: 0.25s; }
    .fw-stage:nth-child(6) { animation-delay: 0.3s; }
    .fw-stage:nth-child(7) { animation-delay: 0.35s; }
    .fw-stage-icon { font-size: 20px; width: 24px; text-align: center; }
    .fw-stage-icon.pass { color: #6bcb77; }
    .fw-stage-icon.fail { color: #ef4444; }
    .fw-stage-icon.warn { color: #fbbf24; }
    .fw-stage-icon.running { color: var(--cyan-glow); animation: spin 1s linear infinite; }
    .fw-stage-icon.pending { color: var(--outline-variant); }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .fw-stage-body { flex: 1; }
    .fw-stage-name { font-size: 13px; font-weight: 600; color: var(--on-surface); }
    .fw-stage-msg { font-size: 11px; color: var(--on-surface-variant); }
    .fw-stage-time { font-size: 10px; color: var(--outline); min-width: 40px; text-align: right; }

    .fw-blockers {
      padding: 14px;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.06);
      border: 1px solid rgba(239, 68, 68, 0.15);
      margin-bottom: 16px;
    }
    .fw-blockers h3 {
      font-size: 12px;
      font-weight: 700;
      color: #ef4444;
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .fw-blockers li {
      font-size: 12px;
      color: var(--on-surface-variant);
      margin-bottom: 4px;
    }

    .fw-actions {
      display: flex;
      gap: 8px;
    }
    .fw-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 12px;
      transition: all 0.2s;
    }
    .fw-btn.primary {
      background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
      color: #001f24;
    }
    .fw-btn.secondary {
      background: var(--surface-container);
      color: var(--on-surface-variant);
      border: 1px solid var(--border-light);
    }
    .fw-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }

    .fw-empty {
      text-align: center;
      padding: 60px 20px;
      color: var(--outline);
    }
    .fw-empty .material-symbols-outlined { font-size: 48px; display: block; margin-bottom: 12px; opacity: 0.3; }
    .fw-empty p { font-size: 13px; margin: 0; }
    .fw-empty .fw-hint { font-size: 11px; margin-top: 8px; color: var(--outline-variant); }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="fw-header">
    <span class="material-symbols-outlined">shield_with_heart</span>
    <div>
      <div class="fw-title">AI OUTPUT FIREWALL</div>
      <div class="fw-subtitle">Verify AI-generated code before it touches your project</div>
    </div>
  </div>

  <div id="content">
    <div class="fw-empty">
      <span class="material-symbols-outlined">shield_lock</span>
      <p>Firewall standing by</p>
      <p class="fw-hint">Copy AI-generated code → run <strong>Verify AI Output</strong> (Cmd+Shift+V)</p>
    </div>
  </div>

  <script nonce="${nonce}">
  (function() {
    var vscode = acquireVsCodeApi();
    var content = document.getElementById("content");

    function escapeHtml(s) {
      var d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }

    function stageIcon(status) {
      switch (status) {
        case "pass": return '<span class="material-symbols-outlined fw-stage-icon pass">check_circle</span>';
        case "fail": return '<span class="material-symbols-outlined fw-stage-icon fail">cancel</span>';
        case "warn": return '<span class="material-symbols-outlined fw-stage-icon warn">warning</span>';
        case "running": return '<span class="material-symbols-outlined fw-stage-icon running">progress_activity</span>';
        default: return '<span class="material-symbols-outlined fw-stage-icon pending">radio_button_unchecked</span>';
      }
    }

    window.addEventListener("message", function(event) {
      var msg = event.data;

      if (msg.type === "firewallReport") {
        var r = msg.data;
        var vc = r.overallVerdict === "PASS" ? "pass" : r.overallVerdict === "FAIL" ? "fail" : "warn";
        var verdictIcon = vc === "pass" ? "verified_user" : vc === "fail" ? "gpp_bad" : "gpp_maybe";
        var verdictTitle = vc === "pass" ? "Verification Passed" : vc === "fail" ? "Verification Failed" : "Review Required";
        var trustClass = r.trustScore >= 80 ? "high" : r.trustScore >= 50 ? "mid" : "low";

        var html = '<div class="fw-verdict ' + vc + '">' +
          '<span class="material-symbols-outlined fw-verdict-icon">' + verdictIcon + '</span>' +
          '<div class="fw-verdict-text"><h2>' + verdictTitle + '</h2>' +
          '<p>' + r.stages.filter(function(s){return s.status==="pass"}).length + '/' + r.stages.length + ' checks passed</p></div></div>';

        html += '<div class="fw-trust">' +
          '<span class="fw-trust-score">' + r.trustScore + '</span>' +
          '<div class="fw-trust-bar"><div class="fw-trust-fill ' + trustClass + '" style="width:' + r.trustScore + '%"></div></div></div>';

        html += '<div class="fw-stages">';
        r.stages.forEach(function(s) {
          html += '<div class="fw-stage">' + stageIcon(s.status) +
            '<div class="fw-stage-body"><div class="fw-stage-name">' + escapeHtml(s.stage) + '</div>' +
            '<div class="fw-stage-msg">' + escapeHtml(s.message) + '</div></div>' +
            '<span class="fw-stage-time">' + (s.duration ? s.duration + 'ms' : '') + '</span></div>';
        });
        html += '</div>';

        if (r.blockers.length) {
          html += '<div class="fw-blockers"><h3>Blockers</h3><ul>' +
            r.blockers.map(function(b){return '<li>' + escapeHtml(b) + '</li>'}).join("") + '</ul></div>';
        }

        html += '<div class="fw-actions">';
        if (vc === "pass" && r.autoFixAvailable) {
          html += '<button class="fw-btn primary" onclick="vscode.postMessage({command:\'applyFix\'})">' +
            '<span class="material-symbols-outlined" style="font-size:16px">check</span> Apply Verified Code</button>';
        }
        if (vc === "fail") {
          html += '<button class="fw-btn primary" onclick="vscode.postMessage({command:\'copyFixPrompt\'})">' +
            '<span class="material-symbols-outlined" style="font-size:16px">content_copy</span> Copy Fix Prompt</button>';
        }
        html += '<button class="fw-btn secondary" onclick="vscode.postMessage({command:\'recheck\'})">' +
          '<span class="material-symbols-outlined" style="font-size:16px">refresh</span> Re-check</button>';
        html += '</div>';

        content.innerHTML = html;
      }

      if (msg.type === "stageUpdate") {
        var stages = content.querySelectorAll(".fw-stage");
        if (stages[msg.data.index]) {
          var s = msg.data.stage;
          stages[msg.data.index].innerHTML = stageIcon(s.status) +
            '<div class="fw-stage-body"><div class="fw-stage-name">' + escapeHtml(s.stage) + '</div>' +
            '<div class="fw-stage-msg">' + escapeHtml(s.message) + '</div></div>' +
            '<span class="fw-stage-time">' + (s.duration ? s.duration + 'ms' : '') + '</span>';
        }
      }
    });
  })();
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
