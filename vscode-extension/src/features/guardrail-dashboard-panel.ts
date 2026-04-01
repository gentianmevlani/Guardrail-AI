/**
 * Guardrail Dashboard Panel — Guardrail
 *
 * Full-width VS Code webview: fixed top bar, Home / Analytics / Settings / Upgrade,
 * bottom nav, and CSP-safe CSS aligned with the Guardrail dashboard reference.
 */

import * as vscode from 'vscode';
import { getLastScanResult } from '../scan-state';
import {
  GuardrailMCPClient,
  type GuardrailConnectionStatus,
  type ScanResult,
} from '../mcp-client';
import { GUARDRAIL_VERSION } from '../guardrail-styles';
import { getGuardrailSharedStyles } from '../webview-shared-styles';
import {
  buildWebDashboardUrl,
  getGuardrailWebAppDisplayHost,
  getGuardrailWebUrl,
} from '../guardrail-web-urls';
import { getTierDisplayCached } from '../tier-ui-cache';

export class GuardrailDashboardPanel {
  public static currentPanel: GuardrailDashboardPanel | undefined;
  private static _mcpClient: GuardrailMCPClient | undefined;

  /** Call once from {@link activate} so Settings can show CLI/MCP diagnostics. */
  public static registerMcpClient(client: GuardrailMCPClient): void {
    GuardrailDashboardPanel._mcpClient = client;
  }

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _currentPage: string = 'home';
  private _connectionStatus: GuardrailConnectionStatus | null = null;
  private _htmlUpdateSeq = 0;

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'navigate':
            this._currentPage = message.page;
            this._update();
            break;
          case 'copyText':
            if (typeof message.text === 'string') {
              await vscode.env.clipboard.writeText(message.text);
            }
            break;
          case 'scan':
            vscode.commands.executeCommand('guardrail.scanWorkspace');
            break;
          case 'showFindings':
            vscode.commands.executeCommand('guardrail.showFindings');
            break;
          case 'runCLI':
            vscode.commands.executeCommand('guardrail.runShip');
            break;
          case 'runGate':
            vscode.commands.executeCommand('guardrail.runGate');
            break;
          case 'runDoctor':
            vscode.commands.executeCommand('guardrail.runDoctor');
            break;
          case 'runFix':
            vscode.commands.executeCommand('guardrail.runFix');
            break;
          case 'openPanel':
            this._openFeaturePanel(message.panel);
            break;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'guardrail');
            break;
          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
          case 'vscodeCommand':
            if (typeof message.id === 'string') {
              void vscode.commands.executeCommand(message.id);
            }
            break;
          case 'copyMcpPath': {
            const c = GuardrailDashboardPanel._mcpClient;
            if (c) {
              const p = c.getMcpServerPath();
              await vscode.env.clipboard.writeText(p);
              void vscode.window.showInformationMessage('MCP server path copied to clipboard.');
            }
            break;
          }
          case 'copyDashboardLink': {
            const name = vscode.workspace.workspaceFolders?.[0]?.name;
            const link = buildWebDashboardUrl({ workspaceName: name, context: 'dashboard-settings' });
            await vscode.env.clipboard.writeText(link);
            void vscode.window.showInformationMessage('Web dashboard link copied.');
            break;
          }
        }
      },
      null,
      this._disposables
    );
  }

  public static refreshIfOpen(): void {
    if (GuardrailDashboardPanel.currentPanel) {
      GuardrailDashboardPanel.currentPanel._update();
    }
  }

  public static createOrShow(): GuardrailDashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (GuardrailDashboardPanel.currentPanel) {
      GuardrailDashboardPanel.currentPanel._panel.reveal(column);
      return GuardrailDashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'guardrailDashboard',
      'Guardrail',
      column || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    GuardrailDashboardPanel.currentPanel = new GuardrailDashboardPanel(panel);
    return GuardrailDashboardPanel.currentPanel;
  }

  private _openFeaturePanel(panelName: string): void {
    const commandMap: Record<string, string> = {
      'security': 'guardrail.openSecurityScanner',
      'compliance': 'guardrail.openComplianceDashboard',
      'performance': 'guardrail.openPerformanceMonitor',
      'mdc': 'guardrail.openMDCGenerator',
      'impact': 'guardrail.openChangeImpactAnalyzer',
      'ai': 'guardrail.openAIExplainer',
      'team': 'guardrail.openTeamCollaboration',
      'integrity': 'guardrail.openProductionIntegrity',
    };
    const cmd = commandMap[panelName];
    if (cmd) { vscode.commands.executeCommand(cmd); }
  }

  private _update(): void {
    const client = GuardrailDashboardPanel._mcpClient;
    if (!client) {
      this._connectionStatus = null;
      this._panel.webview.html = this._getHtml();
      return;
    }
    const seq = ++this._htmlUpdateSeq;
    void client.getConnectionStatus().then((status) => {
      if (seq !== this._htmlUpdateSeq) {
        return;
      }
      this._connectionStatus = status;
      this._panel.webview.html = this._getHtml();
    }).catch(() => {
      if (seq !== this._htmlUpdateSeq) {
        return;
      }
      this._connectionStatus = null;
      this._panel.webview.html = this._getHtml();
    });
  }

  private _escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Guardrail dashboard (CSP-safe; matches reference layout) ── */
  private _dashboardCss(): string {
    return `
      body.ka-dashboard-body.ka-dash-page {
        min-height: max(884px, 100dvh);
        min-height: 100vh;
        padding-bottom: 80px;
        overflow-x: hidden;
        background: #111316;
      }
      .ka-dash-page .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
      }
      .glass-panel {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        background: rgba(26, 28, 31, 0.7);
      }
      .glow-primary { box-shadow: 0 0 20px rgba(0, 229, 255, 0.15); }
      .ka-dash-topbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 24px;
        background: rgba(17, 19, 22, 0.8);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .ka-dash-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        border: none;
        background: none;
        padding: 0;
        cursor: pointer;
        color: inherit;
        font: inherit;
      }
      .ka-dash-brand .material-symbols-outlined { color: #00e5ff; font-size: 26px; }
      .ka-dash-brand h1 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: #00e5ff;
        margin: 0;
      }
      .ka-dash-scan-btn {
        background: var(--primary-container);
        color: var(--on-primary-container);
        border: none;
        padding: 6px 16px;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s, transform 0.2s, color 0.2s;
      }
      .ka-dash-scan-btn:hover { background: rgba(195, 245, 255, 0.1); color: var(--on-primary-container); }
      .ka-dash-scan-btn:active { transform: scale(0.95); }
      .ka-dash-main {
        padding: 80px 16px 96px;
        max-width: 720px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 32px;
      }
      .ka-dash-section { margin-bottom: 0; }
      .ka-dash-home-stack {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .ka-dash-hero {
        position: relative;
        overflow: hidden;
        border-radius: 4px;
        background: var(--surface-container-low);
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .ka-dash-hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to bottom right, rgba(0, 229, 255, 0.05), transparent);
        pointer-events: none;
      }
      .ka-dash-hero-inner { position: relative; z-index: 1; }
      .ka-dash-ring-wrap { position: relative; width: 128px; height: 128px; margin: 0 auto; }
      .ka-dash-ring-wrap svg { display: block; }
      .ka-dash-ring-center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .ka-dash-score-num {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 30px;
        font-weight: 700;
        color: var(--on-surface);
        line-height: 1;
      }
      .ka-dash-score-lbl {
        font-family: Inter, sans-serif;
        font-size: 10px;
        font-weight: 500;
        color: var(--on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.2em;
        margin-top: 4px;
      }
      .ka-dash-hero h2 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 18px;
        font-weight: 500;
        color: var(--primary);
        margin: 16px 0 0;
      }
      .ka-dash-hero > p, .ka-dash-hero .ka-dash-sub {
        font-size: 12px;
        color: var(--on-surface-variant);
        max-width: 20rem;
        margin: 8px auto 0;
        line-height: 1.5;
      }
      .ka-dash-bento2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 480px) { .ka-dash-bento2 { grid-template-columns: 1fr; } }
      .ka-dash-mini-card {
        background: var(--surface-container-high);
        padding: 16px;
        border-radius: 2px;
        text-align: left;
      }
      .ka-dash-mini-card.crit { border-left: 2px solid var(--error); }
      .ka-dash-mini-card.warn { border-left: 2px solid var(--tertiary-container); }
      .ka-dash-mini-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .ka-dash-mini-head .material-symbols-outlined { font-size: 18px; }
      .ka-dash-mini-tag {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ka-dash-mini-title { font-size: 13px; font-weight: 500; line-height: 1.3; color: var(--on-surface); }
      .ka-dash-mini-sub { font-size: 11px; color: var(--on-surface-variant); margin-top: 4px; }
      .ka-dash-h3 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 12px;
        font-weight: 700;
        color: var(--on-surface-variant);
        letter-spacing: 0.2em;
        text-transform: uppercase;
        margin: 0 0 12px 4px;
      }
      .ka-dash-mod {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: var(--surface-container-lowest);
        border-radius: 4px;
        cursor: pointer;
        border: none;
        width: 100%;
        text-align: left;
        color: inherit;
        font: inherit;
        margin-bottom: 8px;
        transition: background 0.15s;
      }
      .ka-dash-mod:last-child { margin-bottom: 0; }
      .ka-dash-mod:hover { background: var(--surface-container); }
      .ka-dash-mod-left { display: flex; align-items: center; gap: 16px; }
      .ka-dash-mod-left .material-symbols-outlined { color: var(--primary-fixed); opacity: 0.7; font-size: 22px; }
      .ka-dash-mod:hover .material-symbols-outlined { opacity: 1; }
      .ka-dash-mod span:last-child { color: var(--on-surface-variant); transition: transform 0.15s; }
      .ka-dash-mod:hover span:last-child { transform: translateX(4px); }
      .ka-dash-cli {
        padding: 16px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 4px;
        border: 1px solid rgba(59, 73, 76, 0.2);
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: 11px;
        color: var(--primary-fixed-dim);
      }
      .ka-dash-cli-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .ka-dash-cli-head span:first-child {
        opacity: 0.5;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .ka-dash-cli-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border: none;
        background: none;
        width: 100%;
        cursor: pointer;
        color: inherit;
        font: inherit;
        text-align: left;
      }
      .ka-dash-cli-row + .ka-dash-cli-row { border-top: 1px solid rgba(59, 73, 76, 0.1); }
      .ka-dash-cli-row:hover { opacity: 0.9; }
      .ka-dash-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 50;
        height: 64px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 0 16px;
        background: rgba(17, 19, 22, 0.9);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }
      .ka-dash-nav-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        max-width: 100px;
        padding: 4px 16px;
        border: none;
        background: transparent;
        cursor: pointer;
        color: #64748b;
        border-left: 2px solid transparent;
        transition: color 0.2s, background 0.2s;
      }
      .ka-dash-nav-tab:hover:not(.active) { color: #c3f5ff; background: rgba(28, 31, 38, 0.5); }
      .ka-dash-nav-tab.active {
        color: #00e5ff;
        background: #1c1f26;
        border-left-color: #00e5ff;
      }
      .ka-dash-nav-tab .material-symbols-outlined { font-size: 22px; }
      .ka-dash-nav-label {
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-top: 4px;
        font-family: Inter, sans-serif;
      }
      .ka-dash-report {
        padding: 20px;
        background: var(--surface-container-low);
        border-radius: 4px;
        position: relative;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .ka-dash-report:last-child { margin-bottom: 0; }
      .ka-dash-report-glow {
        position: absolute;
        top: 0;
        right: 0;
        width: 96px;
        height: 96px;
        background: rgba(195, 245, 255, 0.05);
        border-radius: 50%;
        filter: blur(32px);
        transform: translate(40px, -40px);
      }
      .ka-dash-report h4 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 18px;
        font-weight: 700;
        color: var(--on-surface);
        margin: 0 0 8px;
        line-height: 1.2;
      }
      .ka-dash-report p.desc {
        font-size: 12px;
        color: var(--on-surface-variant);
        line-height: 1.55;
        margin: 0 0 16px;
      }
      .ka-dash-report-bar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ka-dash-report-bar-track {
        flex: 1;
        height: 4px;
        background: var(--surface-container-highest);
        border-radius: 999px;
        overflow: hidden;
      }
      .ka-dash-report-bar-fill {
        height: 100%;
        background: var(--primary);
        border-radius: 999px;
        box-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
      }
      .ka-dash-report-meta {
        font-size: 10px;
        color: var(--on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .ka-dash-report-time {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--on-surface);
        margin-top: 2px;
      }
      .ka-dash-upgrade-hero {
        position: relative;
        border-radius: 8px;
        background: var(--surface-container-lowest);
        padding: 32px;
        overflow: hidden;
        border: 1px solid rgba(195, 245, 255, 0.1);
        text-align: center;
      }
      .ka-dash-upgrade-hero::before {
        content: '';
        position: absolute;
        top: -48px;
        right: -48px;
        width: 192px;
        height: 192px;
        background: rgba(195, 245, 255, 0.1);
        border-radius: 50%;
        filter: blur(48px);
      }
      .ka-dash-upgrade-inner { position: relative; z-index: 1; }
      .ka-dash-upgrade-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 24px;
        border-radius: 50%;
        background: rgba(0, 229, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 30px rgba(0, 229, 255, 0.15);
      }
      .ka-dash-upgrade-icon .material-symbols-outlined {
        font-size: 40px;
        color: #00e5ff;
        font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
      .ka-dash-upgrade-hero h3 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: var(--on-surface);
        margin: 0;
        letter-spacing: -0.02em;
      }
      .ka-dash-upgrade-hero > .ka-dash-upgrade-inner > p {
        font-size: 14px;
        color: var(--on-surface-variant);
        margin: 8px auto 0;
        max-width: 280px;
        line-height: 1.5;
      }
      .ka-dash-upgrade-list {
        margin-top: 32px;
        text-align: left;
        width: 100%;
      }
      .ka-dash-upgrade-li {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .ka-dash-upgrade-li .material-symbols-outlined { color: var(--primary-container); font-size: 18px; }
      .ka-dash-upgrade-li span:last-child { font-size: 12px; font-weight: 500; color: var(--on-surface); }
      .ka-dash-upgrade-cta {
        margin-top: 40px;
        width: 100%;
        padding: 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        background: linear-gradient(to right, var(--primary), var(--primary-container));
        color: #001f24;
        box-shadow: 0 10px 30px rgba(0, 229, 255, 0.2);
        transition: opacity 0.15s;
      }
      .ka-dash-upgrade-cta:hover { opacity: 0.9; }
      .ka-dash-upgrade-note {
        margin-top: 16px;
        font-size: 10px;
        color: var(--on-surface-variant);
        opacity: 0.6;
      }
      .ka-dash-deco {
        margin-top: 24px;
        height: 128px;
        border-radius: 4px;
        overflow: hidden;
        position: relative;
        background: linear-gradient(135deg, rgba(0, 229, 255, 0.08), var(--surface-container-high));
      }
      .ka-dash-deco::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, #111316, transparent);
      }
      .ka-dash-deco span {
        position: absolute;
        bottom: 16px;
        left: 16px;
        z-index: 1;
        font-size: 10px;
        font-weight: 700;
        color: var(--primary);
        letter-spacing: 0.15em;
        text-transform: uppercase;
      }
      .ka-dash-settings-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: var(--surface-container-low);
        border-radius: 4px;
        border: 1px solid var(--border-subtle);
        cursor: pointer;
        width: 100%;
        text-align: left;
        color: inherit;
        font: inherit;
        margin-bottom: 12px;
        transition: background 0.15s;
      }
      .ka-dash-settings-card:hover { background: var(--surface-container-high); }
      .ka-dash-settings-card .material-symbols-outlined:last-child { opacity: 0.35; }
      .ka-dash-empty-cta {
        margin-top: 20px;
        padding: 12px 24px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 13px;
        background: linear-gradient(to bottom right, var(--primary-container), var(--secondary-container));
        color: #001f24;
        box-shadow: 0 0 20px rgba(0, 229, 255, 0.15);
      }
    `;
  }

  private _getHtml(): string {
    const page = this._currentPage;
    let body = '';
    if (page === 'home') { body = this._homeBody(getLastScanResult()); }
    else if (page === 'analytics') { body = this._analyticsBody(); }
    else if (page === 'settings') { body = this._settingsBody(); }
    else if (page === 'upgrade') { body = this._upgradeBody(); }

    const navActive = (p: string) => (page === p ? 'active' : '');
    const navFill = (p: string) =>
      page === p ? "font-variation-settings:'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24;" : '';

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guardrail - Dashboard</title>
  ${getGuardrailSharedStyles()}
  <style>${this._dashboardCss()}</style>
</head>
<body class="ka-dashboard-body ka-dash-page">
  <header class="ka-dash-topbar">
    <button type="button" class="ka-dash-brand" onclick="nav('home')" title="Home">
      <span class="material-symbols-outlined">security</span>
      <h1>GUARDRAIL</h1>
    </button>
    <button type="button" class="ka-dash-scan-btn" onclick="post('scan')">SCAN</button>
  </header>

  <main class="ka-dash-main">
    ${body}
  </main>

  <nav class="ka-dash-bottom-nav" aria-label="Dashboard sections">
    <button type="button" class="ka-dash-nav-tab ${navActive('home')}" onclick="nav('home')">
      <span class="material-symbols-outlined" style="${navFill('home')}">home</span>
      <span class="ka-dash-nav-label">Home</span>
    </button>
    <button type="button" class="ka-dash-nav-tab ${navActive('analytics')}" onclick="nav('analytics')">
      <span class="material-symbols-outlined" style="${navFill('analytics')}">analytics</span>
      <span class="ka-dash-nav-label">Analytics</span>
    </button>
    <button type="button" class="ka-dash-nav-tab ${navActive('settings')}" onclick="nav('settings')">
      <span class="material-symbols-outlined" style="${navFill('settings')}">settings</span>
      <span class="ka-dash-nav-label">Settings</span>
    </button>
    <button type="button" class="ka-dash-nav-tab ${navActive('upgrade')}" onclick="nav('upgrade')">
      <span class="material-symbols-outlined" style="${navFill('upgrade')}">bolt</span>
      <span class="ka-dash-nav-label">Upgrade</span>
    </button>
  </nav>

  <script>
    const vscode = acquireVsCodeApi();
    function post(cmd, data) { vscode.postMessage(Object.assign({ command: cmd }, data || {})); }
    function nav(page) { post('navigate', { page }); }
    function openPanel(p) { post('openPanel', { panel: p }); }
    function copyCmd(t) { post('copyText', { text: t }); }
  </script>
</body>
</html>`;
  }

  private _healthRingSvg(scorePct: number | null): string {
    const r = 58;
    const c = 2 * Math.PI * r;
    const offset = scorePct == null ? c : c * (1 - scorePct / 100);
    const label = scorePct == null ? "—" : String(Math.round(scorePct));
    return `
      <div class="ka-dash-ring-wrap">
        <svg width="128" height="128" viewBox="0 0 128 128" style="transform:rotate(-90deg);">
          <circle cx="64" cy="64" r="${r}" fill="transparent" stroke="var(--surface-container-highest)" stroke-width="4"></circle>
          <circle cx="64" cy="64" r="${r}" fill="transparent" stroke="var(--primary-container)" stroke-width="4"
            stroke-dasharray="${c}" stroke-dashoffset="${offset}"
            style="filter:drop-shadow(0 0 8px rgba(0,229,255,0.6));"></circle>
        </svg>
        <div class="ka-dash-ring-center">
          <span class="ka-dash-score-num">${label}</span>
          <span class="ka-dash-score-lbl">Health</span>
        </div>
      </div>`;
  }

  private _homeCliBlock(): string {
    const c1 = "kinetic-archive --full-scan";
    const c2 = "kinetic doctor --fix";
    return `
      <div class="ka-dash-cli">
        <div class="ka-dash-cli-head">
          <span>CLI Quick Commands</span>
          <span class="material-symbols-outlined" style="font-size:12px;">terminal</span>
        </div>
        <button type="button" class="ka-dash-cli-row" onclick="copyCmd(${JSON.stringify(c1)})">
          <span>${c1}</span>
          <span class="material-symbols-outlined" style="font-size:14px;opacity:0.4;">content_copy</span>
        </button>
        <button type="button" class="ka-dash-cli-row" onclick="copyCmd(${JSON.stringify(c2)})">
          <span>${c2}</span>
          <span class="material-symbols-outlined" style="font-size:14px;opacity:0.4;">content_copy</span>
        </button>
      </div>`;
  }

  /* ── HOME PAGE ── */
  private _homeBody(scan: ScanResult | null): string {
    const analysisRows = `
      <button type="button" class="ka-dash-mod" onclick="openPanel('security')">
        <div class="ka-dash-mod-left">
          <span class="material-symbols-outlined">verified_user</span>
          <span style="font-size:14px;font-weight:500;">Security &amp; Privacy</span>
        </div>
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
      <button type="button" class="ka-dash-mod" onclick="openPanel('compliance')">
        <div class="ka-dash-mod-left">
          <span class="material-symbols-outlined">contract</span>
          <span style="font-size:14px;font-weight:500;">Smart Contracts</span>
        </div>
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
      <button type="button" class="ka-dash-mod" onclick="openPanel('mdc')">
        <div class="ka-dash-mod-left">
          <span class="material-symbols-outlined">science</span>
          <span style="font-size:14px;font-weight:500;">MDC &amp; docs</span>
        </div>
        <span class="material-symbols-outlined">chevron_right</span>
      </button>`;

    if (!scan) {
      return `
  <section class="ka-dash-section" id="home-section">
    <div class="ka-dash-home-stack">
    <div class="ka-dash-hero">
      <div class="ka-dash-hero-inner">
        ${this._healthRingSvg(null)}
        <h2>Awaiting Scan</h2>
        <p class="ka-dash-sub">Run <strong>guardrail scan</strong> or tap <strong>SCAN</strong> above to populate health and findings.</p>
        <button type="button" class="ka-dash-empty-cta" onclick="post('scan')">Run scan</button>
      </div>
    </div>
    <div class="ka-dash-bento2">
      <div class="ka-dash-mini-card crit">
        <div class="ka-dash-mini-head">
          <span class="material-symbols-outlined" style="color:var(--error);">dangerous</span>
          <span class="ka-dash-mini-tag" style="color:var(--error);">Critical</span>
        </div>
        <p class="ka-dash-mini-title">No data yet</p>
        <p class="ka-dash-mini-sub">Scan to load severity signals.</p>
      </div>
      <div class="ka-dash-mini-card warn">
        <div class="ka-dash-mini-head">
          <span class="material-symbols-outlined" style="color:var(--tertiary-container);">warning</span>
          <span class="ka-dash-mini-tag" style="color:var(--tertiary-container);">Warning</span>
        </div>
        <p class="ka-dash-mini-title">—</p>
        <p class="ka-dash-mini-sub">Warnings appear after a scan.</p>
      </div>
    </div>
    <div>
      <h3 class="ka-dash-h3">Analysis Modules</h3>
      <div>${analysisRows}</div>
    </div>
    ${this._homeCliBlock()}
    </div>
  </section>`;
    }

    const s = scan.cliSummary;
    const critical = s ? s.critical : scan.issues.filter((i) => i.type === "critical").length;
    const warnCount = s
      ? s.high + s.medium + s.low
      : scan.issues.filter((i) => i.type !== "critical").length;
    const scorePct = Math.max(0, Math.min(100, Math.round(scan.score)));
    const shipOk = scan.canShip;
    const critIssue = scan.issues.find((i) => i.type === "critical");
    const warnIssue = scan.issues.find((i) => i.type === "warning");

    const critTitle = critIssue
      ? this._escapeHtml(critIssue.message.slice(0, 80))
      : critical > 0
        ? `${critical} critical finding(s)`
        : "No critical findings";
    const critSub = critIssue?.file
      ? this._escapeHtml(critIssue.file)
      : critical > 0
        ? "Review in Security Scanner"
        : "Clear in last scan";

    const warnTitle = warnIssue
      ? this._escapeHtml(warnIssue.message.slice(0, 80))
      : warnCount > 0
        ? `${warnCount} warning-level item(s)`
        : "No warnings";
    const warnSub =
      warnCount > 0 ? `${warnCount} modules / rows in summary` : "None in last scan";

    const integrityTitle = shipOk
      ? "System Integrity Optimal"
      : "Review Before Ship";
    const integritySub = shipOk
      ? `All primary guardrails are active.${warnCount > 0 ? ` ${warnCount} warning(s) may need review.` : ""}`
      : "Last scan reported blockers — open findings before shipping.";

    return `
  <section class="ka-dash-section" id="home-section">
    <div class="ka-dash-home-stack">
    <div class="ka-dash-hero">
      <div class="ka-dash-hero-inner">
        ${this._healthRingSvg(scorePct)}
        <h2>${integrityTitle}</h2>
        <p class="ka-dash-sub">${integritySub}</p>
      </div>
    </div>
    <div class="ka-dash-bento2">
      <div class="ka-dash-mini-card crit">
        <div class="ka-dash-mini-head">
          <span class="material-symbols-outlined" style="color:var(--error);">dangerous</span>
          <span class="ka-dash-mini-tag" style="color:var(--error);">Critical</span>
        </div>
        <p class="ka-dash-mini-title">${critTitle}</p>
        <p class="ka-dash-mini-sub">${critSub}</p>
      </div>
      <div class="ka-dash-mini-card warn">
        <div class="ka-dash-mini-head">
          <span class="material-symbols-outlined" style="color:var(--tertiary-container);">warning</span>
          <span class="ka-dash-mini-tag" style="color:var(--tertiary-container);">Warning</span>
        </div>
        <p class="ka-dash-mini-title">${warnTitle}</p>
        <p class="ka-dash-mini-sub">${warnSub}</p>
      </div>
    </div>
    <div>
      <h3 class="ka-dash-h3">Analysis Modules</h3>
      <div>${analysisRows}</div>
    </div>
    ${this._homeCliBlock()}
    </div>
  </section>`;
  }

  /* ── ANALYTICS PAGE ── */
  private _analyticsBody(): string {
    const scan = getLastScanResult();
    const scorePct = scan
      ? Math.max(0, Math.min(100, Math.round(scan.score)))
      : 0;
    const nonSuggestion = scan
      ? scan.issues.filter((i) => i.type !== "suggestion").length
      : 0;
    const complianceLabel =
      scan && nonSuggestion > 0 ? `${nonSuggestion} Issues` : "Clear";
    const complianceColor =
      scan && nonSuggestion > 0 ? "var(--error)" : "var(--primary)";
    const perfColor = scan?.canShip ? "var(--primary)" : "var(--error)";
    const perfLabel = scan?.canShip ? "Stable" : "Review";

    const scanPctDisplay = scan ? scorePct : 92;

    return `
  <section class="ka-dash-section" id="analytics-section" style="padding-top:16px;">
    <div style="display:flex;flex-direction:column;gap:24px;">
    <h3 class="ka-dash-h3" style="margin:0;">Analysis Reports</h3>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <button type="button" class="ka-dash-report" onclick="openPanel('security')" style="border:none;width:100%;cursor:pointer;text-align:left;color:inherit;font:inherit;">
        <div class="ka-dash-report-glow" aria-hidden="true"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div style="padding:8px;background:var(--surface-container-high);border-radius:4px;">
              <span class="material-symbols-outlined" style="color:var(--primary);font-size:22px;">query_stats</span>
            </div>
            <div style="text-align:right;">
              <span class="ka-dash-report-meta">Last Scan</span>
              <span class="ka-dash-report-time">2m ago</span>
            </div>
          </div>
          <h4>Security Scanner</h4>
          <p class="desc">Cross-referencing global vulnerability databases against local module tree.</p>
          <div class="ka-dash-report-bar">
            <div class="ka-dash-report-bar-track">
              <div class="ka-dash-report-bar-fill" style="width:${scan ? scorePct : 92}%;"></div>
            </div>
            <span style="font-size:10px;font-family:ui-monospace,monospace;line-height:1;">${scanPctDisplay}%</span>
          </div>
        </div>
      </button>

      <button type="button" class="ka-dash-report" onclick="openPanel('compliance')" style="border:none;width:100%;cursor:pointer;text-align:left;color:inherit;font:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div style="padding:8px;background:var(--surface-container-high);border-radius:4px;color:var(--secondary);">
            <span class="material-symbols-outlined" style="font-size:22px;">gavel</span>
          </div>
          <div style="text-align:right;">
            <span class="ka-dash-report-meta">Compliance</span>
            <span class="ka-dash-report-time" style="color:${complianceColor};">${complianceLabel}</span>
          </div>
        </div>
        <h4>Legal &amp; License</h4>
        <p class="desc">Automated audit of AGPL-3.0 vs commercial constraints in core assets.</p>
      </button>

      <button type="button" class="ka-dash-report" onclick="openPanel('performance')" style="border:none;width:100%;cursor:pointer;text-align:left;color:inherit;font:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div style="padding:8px;background:var(--surface-container-high);border-radius:4px;color:var(--tertiary-fixed-dim);">
            <span class="material-symbols-outlined" style="font-size:22px;">speed</span>
          </div>
          <div style="text-align:right;">
            <span class="ka-dash-report-meta">Performance</span>
            <span class="ka-dash-report-time" style="color:${perfColor};">${perfLabel}</span>
          </div>
        </div>
        <h4>Runtime Hygiene</h4>
        <p class="desc">Tracing memory allocations and garbage collection cycles during simulation.</p>
      </button>
    </div>
    </div>
  </section>`;
  }

  /* ── SETTINGS PAGE ── */
  private _settingsBody(): string {
    const webHost = getGuardrailWebAppDisplayHost();
    const docsUrl = getGuardrailWebUrl('/docs');
    const st = this._connectionStatus;
    const cliLine = st
      ? st.cliAvailable
        ? 'CLI: ready'
        : 'CLI: not found (install the published <code>guardrail</code> CLI or open this repo from a dev install)'
      : 'CLI: …';
    const mcpLine = st
      ? st.mcpBundleFound
        ? 'MCP server bundle: found (use path below for Cursor MCP config)'
        : 'MCP server bundle: not beside this extension — scans still use the CLI'
      : 'MCP: …';
    const mcpProtoLine = st
      ? st.mcpProtocol === 'responded'
        ? 'MCP protocol: responded (short stdio <code>initialize</code> handshake succeeded)'
        : st.mcpProtocol === 'path_only'
          ? 'MCP protocol: path only — bundle present but no valid MCP reply (install <code>mcp-server</code> deps or fix Node path)'
          : 'MCP protocol: not probed (no local MCP bundle)'
      : 'MCP protocol: …';
    const planLine = `Plan: <strong>${getTierDisplayCached()}</strong> — Free shows severity counts only; paid and Enterprise plans show full findings (same as CLI and web).`;
    return `
  <section class="ka-dash-section">
    <h3 class="ka-dash-h3" style="margin-bottom:16px;">Settings</h3>
    <div style="margin-bottom:16px;padding:14px 16px;background:var(--surface-container-low);border-radius:8px;border:1px solid var(--border-subtle);">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;">Web app &amp; MCP</p>
      <p style="margin:0 0 10px;font-size:11px;color:var(--on-surface-variant);line-height:1.45;">${planLine}</p>
      <p style="margin:0;font-size:11px;color:var(--on-surface-variant);line-height:1.45;">${cliLine}</p>
      <p style="margin:8px 0 0;font-size:11px;color:var(--on-surface-variant);line-height:1.45;">${mcpLine}</p>
      <p style="margin:8px 0 0;font-size:11px;color:var(--on-surface-variant);line-height:1.45;">${mcpProtoLine}</p>
      <p style="margin:10px 0 0;font-size:10px;color:var(--outline);line-height:1.4;">Extension runs ship/scan via the CLI. The MCP server uses the same tools over stdio for agents; copy the path to wire Cursor or other MCP hosts. Handshake is re-checked every 60s when you open Settings.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
        <button type="button" class="ka-dash-empty-cta" style="margin:0;padding:8px 14px;font-size:11px;" onclick="post('copyDashboardLink')">Copy web dashboard link</button>
        <button type="button" class="ka-dash-empty-cta" style="margin:0;padding:8px 14px;font-size:11px;background:var(--surface-container-high);color:var(--on-surface);" onclick="post('copyMcpPath')">Copy MCP server path</button>
      </div>
    </div>
    <button type="button" class="ka-dash-settings-card" onclick="post('vscodeCommand', { id: 'guardrail.login' })">
      <div style="display:flex;align-items:center;gap:14px;">
        <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);">link</span>
        <div>
          <p style="font-size:14px;font-weight:700;margin:0;">Login &amp; link CLI</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0;">Opens ${webHost} (link-device) to approve this machine; token syncs to the published CLI when enabled</p>
        </div>
      </div>
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
    <button type="button" class="ka-dash-settings-card" onclick="post('vscodeCommand', { id: 'guardrail.openWebDashboard' })">
      <div style="display:flex;align-items:center;gap:14px;">
        <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);">public</span>
        <div>
          <p style="font-size:14px;font-weight:700;margin:0;">Open web app</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0;">Uses guardrail.webAppUrl (currently ${webHost})</p>
        </div>
      </div>
      <span class="material-symbols-outlined">open_in_new</span>
    </button>
    <button type="button" class="ka-dash-settings-card" onclick="post('openSettings')">
      <div style="display:flex;align-items:center;gap:14px;">
        <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);">tune</span>
        <div>
          <p style="font-size:14px;font-weight:700;margin:0;">Extension settings</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0;">Scan profiles, API keys, thresholds</p>
        </div>
      </div>
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
    <button type="button" class="ka-dash-settings-card" onclick="post('openExternal',{url:'${docsUrl}'})">
      <div style="display:flex;align-items:center;gap:14px;">
        <span class="material-symbols-outlined" style="color:var(--tertiary);">menu_book</span>
        <div>
          <p style="font-size:14px;font-weight:700;margin:0;">Documentation</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0;">CLI reference and guides</p>
        </div>
      </div>
      <span class="material-symbols-outlined">open_in_new</span>
    </button>
    <p style="text-align:center;font-size:11px;color:var(--outline);margin-top:28px;">Guardrail v${GUARDRAIL_VERSION} · ${webHost}</p>
  </section>`;
  }

  /* ── UPGRADE PAGE ── */
  private _upgradeBody(): string {
    const pricingUrl = getGuardrailWebUrl('/pricing');
    return `
  <section class="ka-dash-section" id="upgrade-section">
    <div class="ka-dash-upgrade-hero">
      <div class="ka-dash-upgrade-inner">
        <div class="ka-dash-upgrade-icon">
          <span class="material-symbols-outlined">bolt</span>
        </div>
        <h3>UPGRADE TO PRO</h3>
        <p>Unlock enterprise-grade archives and deep-layer analytics for your infrastructure.</p>
        <div class="ka-dash-upgrade-list">
          <div class="ka-dash-upgrade-li">
            <span class="material-symbols-outlined">check_circle</span>
            <span>Real-time threat interception</span>
          </div>
          <div class="ka-dash-upgrade-li">
            <span class="material-symbols-outlined">check_circle</span>
            <span>Unlimited historical snapshots</span>
          </div>
          <div class="ka-dash-upgrade-li">
            <span class="material-symbols-outlined">check_circle</span>
            <span>Advanced CLI automation suite</span>
          </div>
          <div class="ka-dash-upgrade-li">
            <span class="material-symbols-outlined">check_circle</span>
            <span>24/7 Priority engineering support</span>
          </div>
        </div>
        <button type="button" class="ka-dash-upgrade-cta" onclick="post('openExternal',{url:'${pricingUrl}'})">
          View Plans
        </button>
        <p class="ka-dash-upgrade-note">No credit card required for 14-day trial</p>
      </div>
    </div>
    <div class="ka-dash-deco">
      <span>Global Mesh Network</span>
    </div>
  </section>`;
  }

  public dispose(): void {
    GuardrailDashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }
}
