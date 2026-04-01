/**
<<<<<<< HEAD
 * Guardrail Dashboard Panel — Guardrail
 *
 * Full-width VS Code webview: fixed top bar, Home / Analytics / Settings / Upgrade,
 * bottom nav, and CSP-safe CSS aligned with the Guardrail dashboard reference.
=======
 * Guardrail Dashboard Panel — Cyber Circuit Edition
 *
 * Full-width VS Code webview with bento-grid layout,
 * security posture hero, vulnerability bars, threat visualization,
 * live status feed, and multi-page navigation.
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
 */

import * as vscode from 'vscode';
import { getLastScanResult } from '../scan-state';
<<<<<<< HEAD
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
=======
import type { ScanResult } from '../mcp-client';
import { KINETIC_ARCHIVE_VERSION } from '../kinetic-archive-styles';
import { getGuardrailSharedStyles } from '../webview-shared-styles';

export class GuardrailDashboardPanel {
  public static currentPanel: GuardrailDashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _currentPage: string = 'home';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

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
<<<<<<< HEAD
          case 'copyText':
            if (typeof message.text === 'string') {
              await vscode.env.clipboard.writeText(message.text);
            }
            break;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
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
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      'Guardrail',
=======
      '🛡️ Guardrail',
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
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
=======
    this._panel.webview.html = this._getHtml();
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  private _escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

<<<<<<< HEAD
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
=======
  /* ── Dashboard-specific CSS (extends shared Kinetic Archive) ── */
  private _dashboardCss(): string {
    return `
      .db-main { padding: 24px; max-width: 1200px; margin: 0 auto; }
      .db-main > section { margin-bottom: 28px; }

      /* Bento grid */
      .db-bento { display: grid; gap: 16px; }
      .db-bento-2 { grid-template-columns: 1fr 1fr; }
      .db-bento-3 { grid-template-columns: 1fr 1fr 1fr; }
      .db-bento-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
      @media (max-width: 720px) {
        .db-bento-2, .db-bento-3, .db-bento-hero { grid-template-columns: 1fr; }
      }

      /* Posture hero (full width in narrow, left column in wide) */
      .db-posture {
        background: var(--surface-container);
        border-radius: 16px;
        padding: 28px;
        position: relative;
        overflow: hidden;
      }
      .db-posture::before {
        content: '';
        position: absolute;
        right: -60px;
        bottom: -60px;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: rgba(0, 229, 255, 0.06);
        filter: blur(60px);
        pointer-events: none;
        transition: background 0.3s;
      }
      .db-posture:hover::before { background: rgba(0, 229, 255, 0.12); }
      .db-posture-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.2em;
        color: var(--outline); margin-bottom: 16px;
      }
      .db-score-row { display: flex; align-items: baseline; gap: 6px; }
      .db-score-big {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 72px; font-weight: 800; line-height: 1;
        color: var(--cyan-glow);
        filter: drop-shadow(0 0 14px rgba(0, 229, 255, 0.5));
      }
      .db-score-max {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 24px; color: var(--on-surface-variant);
      }
      .db-posture-desc {
        font-size: 13px; color: #94a3b8;
        margin-top: 16px; line-height: 1.6;
        max-width: 240px;
      }
      .db-posture-desc strong { color: var(--cyan-glow); font-weight: 700; }
      .db-posture-meta {
        display: flex; align-items: center; gap: 16px; margin-top: 24px;
        flex-wrap: wrap;
      }
      .db-meta-item { display: flex; flex-direction: column; gap: 3px; }
      .db-meta-label {
        font-size: 9px; text-transform: uppercase;
        font-weight: 700; color: #64748b;
      }
      .db-meta-val {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px; font-weight: 700;
        display: flex; align-items: center; gap: 3px;
      }
      .db-meta-divider { width: 1px; height: 32px; background: rgba(255,255,255,0.06); }

      /* Threat map area */
      .db-threat-map {
        background: var(--surface-container-low);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        min-height: 260px;
      }
      .db-threat-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
      }
      .db-threat-header-left { display: flex; align-items: center; gap: 8px; }
      .db-threat-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #ef4444;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
        animation: ka-pulse 2s infinite;
      }
      .db-threat-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px; font-weight: 700; color: var(--on-surface);
      }
      .db-threat-btn {
        padding: 5px 12px;
        background: var(--surface-container-high);
        font-size: 9px; font-weight: 700; text-transform: uppercase;
        border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);
        color: var(--on-surface-variant); cursor: pointer;
        transition: all 0.15s;
      }
      .db-threat-btn:hover { border-color: rgba(0, 229, 255, 0.3); color: var(--on-surface); }
      .db-threat-canvas {
        flex: 1; border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.04);
        background: #0a0c0e;
        position: relative; overflow: hidden;
      }
      .db-threat-grid {
        position: absolute; inset: 0;
        background-image:
          linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px);
        background-size: 40px 40px;
      }
      .db-threat-node {
        position: absolute; border-radius: 50%;
        box-shadow: 0 0 12px currentColor;
      }
      @keyframes db-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .db-threat-node { animation: db-float 3s ease infinite; }

      /* Bento metric cards */
      .db-metric {
        background: var(--surface-container);
        border-radius: 14px;
        padding: 20px;
        transition: background 0.2s;
        cursor: pointer;
      }
      .db-metric:hover { background: var(--surface-container-high); }
      .db-metric-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        margin-bottom: 16px;
      }
      .db-metric-icon {
        padding: 8px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
      }
      .db-metric-badge {
        font-size: 9px; font-family: monospace; color: #475569;
      }
      .db-metric-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 15px; font-weight: 700; color: var(--on-surface);
        margin-bottom: 14px;
      }

      /* Vuln bars (dashboard version) */
      .db-vuln-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .db-vuln-row:last-child { margin-bottom: 0; }
      .db-vuln-label { font-size: 12px; color: #94a3b8; min-width: 55px; }
      .db-vuln-track { flex: 1; height: 5px; background: var(--surface-container-highest); border-radius: 999px; overflow: hidden; }
      .db-vuln-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
      .db-vuln-count { font-size: 12px; font-family: monospace; font-weight: 700; min-width: 22px; text-align: right; }

      /* Check items */
      .db-check { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
      .db-check-name { flex: 1; font-size: 12px; color: #94a3b8; }
      .db-check-time { font-size: 10px; font-family: monospace; color: #475569; }

      /* Scan progress */
      .db-scan-item {
        padding: 12px;
        background: var(--surface-container-lowest);
        border: 1px solid rgba(255,255,255,0.04);
        border-radius: 10px; margin-bottom: 8px;
      }
      .db-scan-item:last-child { margin-bottom: 0; }
      .db-scan-head {
        display: flex; justify-content: space-between;
        font-size: 10px; text-transform: uppercase; font-weight: 700;
        color: #64748b; margin-bottom: 8px;
      }
      .db-scan-bar { height: 5px; background: #0f172a; border-radius: 999px; overflow: hidden; }
      .db-scan-fill { height: 100%; background: var(--cyan-glow); border-radius: 999px; transition: width 0.6s ease; }

      /* Feed */
      .db-feed {
        background: var(--surface-container-lowest);
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.04);
        overflow: hidden;
      }
      .db-feed-head {
        padding: 12px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        display: flex; align-items: center; justify-content: space-between;
        background: var(--surface-container-low);
      }
      .db-feed-head-left { display: flex; align-items: center; gap: 10px; }
      .db-feed-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 10px; text-transform: uppercase; font-weight: 700;
        letter-spacing: 0.15em; color: #94a3b8;
      }
      .db-feed-status {
        display: flex; align-items: center; gap: 8px;
        font-size: 10px; font-family: monospace; color: #475569;
      }
      .db-feed-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
      .db-feed-body {
        padding: 14px 18px;
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 11px; line-height: 1.8;
        max-height: 200px; overflow-y: auto;
      }
      .db-feed-line { display: flex; gap: 10px; }
      .db-feed-line:hover .db-feed-msg { color: var(--on-surface); }
      .db-feed-ts { color: #334155; white-space: nowrap; }
      .db-feed-lv { font-weight: 700; white-space: nowrap; }
      .db-feed-info { color: var(--cyan-glow); }
      .db-feed-warn { color: var(--secondary); }
      .db-feed-fail { color: var(--error); }
      .db-feed-msg { color: #94a3b8; transition: color 0.15s; }

      /* Module cards (analysis page) */
      .db-mod {
        display: flex; align-items: center; justify-content: space-between;
        background: var(--surface-container-low);
        border: 1px solid var(--border-subtle);
        border-radius: 14px; padding: 16px 20px;
        cursor: pointer; transition: all 0.2s;
      }
      .db-mod:hover { background: var(--surface-container-high); border-color: rgba(0,229,255,0.15); }
      .db-mod-left { display: flex; align-items: center; gap: 16px; }
      .db-mod-icon {
        width: 44px; height: 44px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
      }

      /* Upgrade feature row */
      .db-feat {
        display: flex; align-items: center; justify-content: space-between;
        background: var(--surface-container-low);
        border: 1px solid var(--border-subtle);
        border-radius: 14px; padding: 16px 20px;
      }
      .db-feat-left { display: flex; align-items: center; gap: 14px; }

      /* Empty state */
      .db-empty { text-align: center; padding: 48px 24px; }
      .db-empty-icon {
        width: 80px; height: 80px; border-radius: 20px;
        background: linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,104,237,0.1));
        display: inline-flex; align-items: center; justify-content: center;
        margin-bottom: 20px;
      }
      .db-empty h2 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 24px; font-weight: 700;
        letter-spacing: -0.02em; margin-bottom: 10px;
      }
      .db-empty p {
        font-size: 13px; color: var(--outline);
        line-height: 1.7; max-width: 440px; margin: 0 auto 24px;
      }
      .db-empty code {
        color: var(--primary-fixed-dim);
        font-size: 12px;
      }
      .db-cta-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 14px 32px; border-radius: 12px; border: none;
        cursor: pointer;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700; font-size: 13px;
        letter-spacing: 0.06em; text-transform: uppercase;
        background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
        color: #001f24;
        box-shadow: 0 4px 20px rgba(0,229,255,0.25);
        transition: all 0.2s;
      }
      .db-cta-btn:hover { box-shadow: 0 6px 28px rgba(0,229,255,0.35); filter: brightness(1.05); }
      .db-cta-btn:active { transform: scale(0.98); }

      /* CLI shortcuts */
      .db-cli-row {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-radius: 10px;
        border: none; background: none; color: inherit;
        cursor: pointer; text-align: left; transition: background 0.15s;
      }
      .db-cli-row:hover { background: rgba(0,229,255,0.06); }
      .db-cli-cmd {
        font-family: 'SF Mono', 'Fira Code', monospace;
        font-size: 13px; color: var(--primary); font-weight: 700;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
    const navActive = (p: string) => (page === p ? 'active' : '');
    const navFill = (p: string) =>
      page === p ? "font-variation-settings:'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24;" : '';

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<<<<<<< HEAD
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
=======
  <title>Guardrail — Cyber Circuit</title>
  ${getGuardrailSharedStyles()}
  <style>${this._dashboardCss()}</style>
</head>
<body class="ka-dashboard-body">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <!-- Top Bar -->
  <header class="top-bar">
    <button type="button" class="brand" onclick="nav('home')" title="Home">
      <span class="material-symbols-outlined">shield_lock</span>
      <span>GUARDRAIL</span>
    </button>
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="db-feed-status" style="margin-right:8px;">
        <span class="db-feed-dot"></span>
        <span style="font-size:10px;color:#64748b;">v${KINETIC_ARCHIVE_VERSION}</span>
      </div>
      <button class="scan-btn" onclick="post('scan')">
        <span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">radar</span>
        Scan
      </button>
    </div>
  </header>

  ${body}

  </div>
  <!-- Bottom Nav -->
  <nav class="bottom-nav">
    <button class="nav-item ${page === 'home' ? 'active' : ''}" onclick="nav('home')" title="Dashboard">
      <span class="material-symbols-outlined" style="${page === 'home' ? "font-variation-settings:'FILL' 1;" : ''}">dashboard</span>
    </button>
    <button class="nav-item ${page === 'analytics' ? 'active' : ''}" onclick="nav('analytics')" title="Analysis">
      <span class="material-symbols-outlined" style="${page === 'analytics' ? "font-variation-settings:'FILL' 1;" : ''}">analytics</span>
    </button>
    <button class="nav-item ${page === 'settings' ? 'active' : ''}" onclick="nav('settings')" title="Settings">
      <span class="material-symbols-outlined" style="${page === 'settings' ? "font-variation-settings:'FILL' 1;" : ''}">settings</span>
    </button>
    <button class="nav-item ${page === 'upgrade' ? 'active' : ''}" onclick="nav('upgrade')" title="Upgrade">
      <span class="material-symbols-outlined" style="${page === 'upgrade' ? "font-variation-settings:'FILL' 1;" : ''}">workspace_premium</span>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    </button>
  </nav>

  <script>
    const vscode = acquireVsCodeApi();
<<<<<<< HEAD
    function post(cmd, data) { vscode.postMessage(Object.assign({ command: cmd }, data || {})); }
    function nav(page) { post('navigate', { page }); }
    function openPanel(p) { post('openPanel', { panel: p }); }
    function copyCmd(t) { post('copyText', { text: t }); }
=======
    function post(cmd, data) { vscode.postMessage({ command: cmd, ...data }); }
    function nav(page) { post('navigate', { page }); }
    function openPanel(p) { post('openPanel', { panel: p }); }
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  </script>
</body>
</html>`;
  }

<<<<<<< HEAD
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
=======
  /* ── HOME PAGE ── */
  private _homeBody(scan: ScanResult | null): string {
    if (!scan) {
      return `
  <div class="db-main">
    <section class="anim db-empty">
      <div class="db-empty-icon">
        <span class="material-symbols-outlined" style="font-size:40px;color:var(--cyan-glow);">terminal</span>
      </div>
      <h2>Cyber Circuit</h2>
      <p>
        Initialize a security scan to populate the dashboard.
        Run <code>guardrail scan</code> or <code>guardrail ship --json</code>
        from the terminal, or click below.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:420px;">
        <button class="db-cta-btn" onclick="post('scan')">
          <span class="material-symbols-outlined" style="font-size:18px;">radar</span>
          Deploy Scanner
        </button>
        <button class="db-cta-btn" onclick="post('runCLI')" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;border:1px solid var(--border-subtle);">
          <span class="material-symbols-outlined" style="font-size:18px;">rocket_launch</span>
          Run Ship Check
        </button>
        <button class="db-cta-btn" onclick="post('runGate')" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;border:1px solid var(--border-subtle);">
          <span class="material-symbols-outlined" style="font-size:18px;">gavel</span>
          Run Gate (JSON)
        </button>
        <button class="db-cta-btn" onclick="post('runDoctor')" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;border:1px solid var(--border-subtle);">
          <span class="material-symbols-outlined" style="font-size:18px;">health_and_safety</span>
          CLI Doctor
        </button>
        <button class="db-cta-btn" onclick="post('vscodeCommand', { id: 'guardrail.login' })" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;border:1px solid var(--border-subtle);">
          <span class="material-symbols-outlined" style="font-size:18px;">link</span>
          Login (browser)
        </button>
        <button class="db-cta-btn" onclick="post('vscodeCommand', { id: 'guardrail.openWebDashboard' })" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;border:1px solid var(--border-subtle);">
          <span class="material-symbols-outlined" style="font-size:18px;">open_in_new</span>
          Web app
        </button>
        <button class="db-cta-btn" onclick="post('vscodeCommand', { id: 'guardrail.syncCliCredentials' })" style="background:var(--surface-container-high);color:var(--on-surface);box-shadow:none;border:1px solid var(--border-subtle);">
          <span class="material-symbols-outlined" style="font-size:18px;">terminal</span>
          Sync CLI
        </button>
      </div>
    </section>

    <!-- Quick Start Tips -->
    <section class="anim anim-d1">
      <h2 class="section-title">Quick Start</h2>
      <div class="db-bento db-bento-3">
        <div class="db-metric" onclick="post('scan')">
          <div class="db-metric-head">
            <div class="db-metric-icon" style="background:rgba(0,229,255,0.1);">
              <span class="material-symbols-outlined" style="color:var(--cyan-glow);">search_check</span>
            </div>
          </div>
          <p style="font-size:13px;font-weight:700;">Scan Workspace</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin-top:4px;">Full security analysis</p>
        </div>
        <div class="db-metric" onclick="openPanel('security')">
          <div class="db-metric-head">
            <div class="db-metric-icon" style="background:rgba(255,180,171,0.1);">
              <span class="material-symbols-outlined" style="color:var(--error);">security</span>
            </div>
          </div>
          <p style="font-size:13px;font-weight:700;">Security Scanner</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin-top:4px;">OWASP · Secrets · Vault</p>
        </div>
        <div class="db-metric" onclick="openPanel('compliance')">
          <div class="db-metric-head">
            <div class="db-metric-icon" style="background:rgba(176,198,255,0.1);">
              <span class="material-symbols-outlined" style="color:var(--secondary);">verified_user</span>
            </div>
          </div>
          <p style="font-size:13px;font-weight:700;">Compliance</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin-top:4px;">SOC2 · HIPAA · GDPR</p>
        </div>
      </div>
    </section>
  </div>`;
    }

    const s = scan.cliSummary;
    const critical = s ? s.critical : scan.issues.filter(i => i.type === 'critical').length;
    const high = s ? s.high : scan.issues.filter(i => i.type === 'warning').length;
    const medium = s ? s.medium : 0;
    const low = s ? s.low : scan.issues.filter(i => i.type === 'suggestion').length;
    const total = s ? s.totalFindings : scan.issues.length;
    const scorePct = Math.max(0, Math.min(100, Math.round(scan.score)));
    const grade = scan.grade || '—';
    const shipOk = scan.canShip;
    const secCount = scan.counts?.secrets ?? 0;
    const integ = scan.counts?.integrity ?? 0;

    const critPct = total ? Math.round((critical / total) * 100) : 0;
    const highPct = total ? Math.round((high / total) * 100) : 0;
    const medPct = total ? Math.round((medium / total) * 100) : 0;

    const riskLabel = shipOk ? 'Minimal' : 'Elevated';
    const postureMsg = shipOk
      ? `Last scan score <strong>${scorePct}</strong> · grade <strong>${this._escapeHtml(grade)}</strong>.`
      : `Review findings before shipping — score <strong>${scorePct}</strong>, grade <strong>${this._escapeHtml(grade)}</strong>.`;

    return `
  <div class="db-main">
    <!-- Hero: Posture + Threat Map -->
    <section class="anim">
      <div class="db-bento db-bento-hero">
        <div class="db-posture">
          <div class="db-posture-label">Security Posture</div>
          <div class="db-score-row">
            <span class="db-score-big">${scorePct}</span>
            <span class="db-score-max">/100</span>
          </div>
          <p class="db-posture-desc">${postureMsg}</p>
          <div class="db-posture-meta">
            <div class="db-meta-item">
              <span class="db-meta-label">Grade</span>
              <span class="db-meta-val" style="color:var(--cyan-glow);">${this._escapeHtml(grade)}</span>
            </div>
            <div class="db-meta-divider"></div>
            <div class="db-meta-item">
              <span class="db-meta-label">Risk Level</span>
              <span class="db-meta-val" style="color:var(--secondary);">${riskLabel}</span>
            </div>
            <div class="db-meta-divider"></div>
            <div class="db-meta-item">
              <span class="db-meta-label">Ship</span>
              <span class="db-meta-val" style="color:${shipOk ? 'var(--cyan-glow)' : 'var(--error)'};">${shipOk ? 'READY' : 'BLOCKED'}</span>
            </div>
          </div>
        </div>

        <div class="db-threat-map">
          <div class="db-threat-header">
            <div class="db-threat-header-left">
              <span class="db-threat-title">Scan snapshot</span>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="db-threat-btn" onclick="post('showFindings')">Findings</button>
              <button class="db-threat-btn" onclick="post('scan')">Re-scan</button>
            </div>
          </div>
          <p style="font-size:10px;color:#64748b;margin:0 0 10px 0;line-height:1.4;">Dots scale with critical / high / secret counts from the last scan (not live network traffic).</p>
          <div class="db-threat-canvas">
            <div class="db-threat-grid"></div>
            ${this._threatNodes(critical, high, secCount)}
          </div>
        </div>
      </div>
    </section>

    <!-- Bento Metrics -->
    <section class="anim anim-d1">
      <div class="db-bento db-bento-3">
        <!-- Vulnerability Summary -->
        <div class="db-metric" onclick="post('showFindings')">
          <div class="db-metric-head">
            <div class="db-metric-icon" style="background:rgba(0,229,255,0.1);">
              <span class="material-symbols-outlined" style="color:var(--cyan-glow);font-size:22px;">shield</span>
            </div>
            <span class="db-metric-badge">TOTAL: ${total}</span>
          </div>
          <div class="db-metric-title">Vulnerabilities</div>
          <div class="db-vuln-row">
            <span class="db-vuln-label">Critical</span>
            <div class="db-vuln-track"><div class="db-vuln-fill" style="width:${critPct}%;background:var(--error);"></div></div>
            <span class="db-vuln-count" style="color:var(--error);">${String(critical).padStart(2, '0')}</span>
          </div>
          <div class="db-vuln-row">
            <span class="db-vuln-label">High</span>
            <div class="db-vuln-track"><div class="db-vuln-fill" style="width:${highPct}%;background:var(--secondary);"></div></div>
            <span class="db-vuln-count" style="color:var(--secondary);">${String(high).padStart(2, '0')}</span>
          </div>
          <div class="db-vuln-row">
            <span class="db-vuln-label">Medium</span>
            <div class="db-vuln-track"><div class="db-vuln-fill" style="width:${medPct}%;background:#94a3b8;"></div></div>
            <span class="db-vuln-count" style="color:#94a3b8;">${String(medium).padStart(2, '0')}</span>
          </div>
        </div>

        <!-- Session signals -->
        <div class="db-metric">
          <div class="db-metric-head">
            <div class="db-metric-icon" style="background:rgba(176,198,255,0.1);">
              <span class="material-symbols-outlined" style="color:var(--secondary);font-size:22px;">package_2</span>
            </div>
            <span class="db-metric-badge">LAST SCAN</span>
          </div>
          <div class="db-metric-title">Session signals</div>
          <div class="db-check">
            <span class="material-symbols-outlined" style="color:#22c55e;font-size:18px;font-variation-settings:'FILL' 1;">check_circle</span>
            <span class="db-check-name">Findings total</span>
            <span class="db-check-time">${total}</span>
          </div>
          <div class="db-check">
            <span class="material-symbols-outlined" style="color:#22c55e;font-size:18px;font-variation-settings:'FILL' 1;">check_circle</span>
            <span class="db-check-name">Integrity signals</span>
            <span class="db-check-time">${integ}</span>
          </div>
          <div class="db-check">
            <span class="material-symbols-outlined" style="color:${secCount > 0 ? 'var(--error)' : '#22c55e'};font-size:18px;font-variation-settings:'FILL' 1;">${secCount > 0 ? 'error' : 'check_circle'}</span>
            <span class="db-check-name">Secrets (count)</span>
            <span class="db-check-time">${secCount}</span>
          </div>
        </div>

        <!-- On-demand -->
        <div class="db-metric" style="position:relative;overflow:hidden;">
          <div class="db-metric-head">
            <div class="db-metric-icon" style="background:rgba(195,245,255,0.1);">
              <span class="material-symbols-outlined" style="color:var(--primary);font-size:22px;">radar</span>
            </div>
            <span style="padding:2px 8px;border-radius:999px;background:rgba(100,116,139,0.25);color:#94a3b8;font-size:9px;font-weight:800;">ON-DEMAND</span>
          </div>
          <div class="db-metric-title">How scans run</div>
          <p style="font-size:11px;color:var(--on-surface-variant);line-height:1.55;margin:0;">
            The extension does not run a background security sweep. Use <strong>Scan</strong> in the sidebar or the button above — each run invokes the local <code style="font-size:10px;">guardrail</code> CLI against your workspace.
          </p>
        </div>
      </div>
    </section>

    <!-- Session log -->
    <section class="anim anim-d2">
      <div class="db-feed">
        <div class="db-feed-head">
          <div class="db-feed-head-left">
            <span class="material-symbols-outlined" style="font-size:16px;color:#64748b;">list_alt</span>
            <span class="db-feed-title">Session log</span>
          </div>
          <div class="db-feed-status">
            <span style="font-size:10px;color:#64748b;">v${KINETIC_ARCHIVE_VERSION}</span>
          </div>
        </div>
        <div class="db-feed-body">
          ${this._feedLines(scan)}
        </div>
      </div>
    </section>

    <!-- CLI Shortcuts + Module Grid -->
    <section class="anim anim-d3">
      <div class="db-bento db-bento-2">
        <div>
          <h2 class="section-title">CLI Shortcuts</h2>
          <div class="card" style="padding:4px;background:var(--surface-container-lowest);">
            <button class="db-cli-row" onclick="post('scan')">
              <span class="db-cli-cmd">guardrail scan</span>
              <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);font-size:18px;">terminal</span>
            </button>
            <div style="height:1px;background:var(--border-subtle);margin:0 18px;"></div>
            <button class="db-cli-row" onclick="post('runCLI')">
              <span class="db-cli-cmd">guardrail ship</span>
              <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);font-size:18px;">rocket_launch</span>
            </button>
            <div style="height:1px;background:var(--border-subtle);margin:0 18px;"></div>
            <button class="db-cli-row" onclick="post('runFix')">
              <span class="db-cli-cmd">guardrail fix</span>
              <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);font-size:18px;">auto_fix_high</span>
            </button>
          </div>
        </div>
        <div>
          <h2 class="section-title">Analysis Modules</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${this._miniModule('security', 'Security', 'security')}
            ${this._miniModule('verified_user', 'Compliance', 'compliance')}
            ${this._miniModule('speed', 'Performance', 'performance')}
            ${this._miniModule('difference', 'Impact', 'impact')}
            ${this._miniModule('psychology', 'AI Explain', 'ai')}
            ${this._miniModule('description', 'MDC Gen', 'mdc')}
            ${this._miniModule('groups', 'Team', 'team')}
            ${this._miniModule('lan', 'Production', 'integrity')}
          </div>
        </div>
      </div>
    </section>
  </div>`;
  }

  private _threatNodes(critical: number, high: number, secrets: number): string {
    const positions = [
      { top: '18%', left: '25%' }, { top: '45%', left: '72%' },
      { top: '65%', left: '35%' }, { top: '30%', left: '55%' },
      { top: '75%', left: '80%' }, { top: '20%', left: '85%' },
      { top: '55%', left: '15%' }, { top: '40%', left: '45%' },
    ];
    const totalWeighted = critical + high + secrets;
    if (totalWeighted === 0) {
      return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;font-size:11px;color:#64748b;line-height:1.5;">
        No critical/high/secret signals in this summary — run a scan to populate counts.
      </div>`;
    }
    const nodes: string[] = [];
    const count = Math.min(totalWeighted, 8);
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      const isCritical = i < critical;
      const size = isCritical ? 10 : 6;
      const color = isCritical ? '#ef4444' : (i < critical + high ? 'var(--secondary)' : 'var(--cyan-glow)');
      const ping = isCritical ? 'animation:ka-pulse 1.5s infinite,db-float 3s ease infinite;' : `animation:db-float ${3 + i * 0.5}s ease infinite;`;
      nodes.push(`<div class="db-threat-node" style="top:${p.top};left:${p.left};width:${size}px;height:${size}px;background:${color};color:${color};${ping}"></div>`);
    }
    return nodes.join('\n            ');
  }

  private _feedLines(scan: ScanResult): string {
    const now = new Date();
    const ts = (offset: number) => {
      const d = new Date(now.getTime() - offset * 1000);
      return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}]`;
    };
    const grade = scan.grade || '—';
    const lines: Array<{ t: string; lv: string; msg: string }> = [
      { t: ts(0), lv: 'info', msg: `Scan summary · grade ${grade} · score ${Math.round(scan.score)}/100.` },
      { t: ts(1), lv: 'info', msg: `${scan.cliSummary?.totalFindings ?? scan.issues.length} finding(s) in session state.` },
      { t: ts(2), lv: scan.canShip ? 'info' : 'warn', msg: scan.canShip ? 'canShip: true (last scan).' : 'canShip: false — review before shipping.' },
      { t: ts(3), lv: (scan.counts?.secrets ?? 0) > 0 ? 'fail' : 'info', msg: (scan.counts?.secrets ?? 0) > 0 ? `Secret-related count: ${scan.counts!.secrets}.` : 'No secret hits in scan counts.' },
    ];
    let offset = 4;
    for (const issue of scan.issues.slice(0, 10)) {
      const lv = issue.type === 'critical' ? 'fail' : issue.type === 'warning' ? 'warn' : 'info';
      const prefix = issue.file ? `${issue.file}${issue.line != null ? `:${issue.line}` : ''} · ` : '';
      lines.push({
        t: ts(offset),
        lv,
        msg: prefix + issue.message,
      });
      offset += 1;
    }
    return lines.map((l) => `
          <div class="db-feed-line">
            <span class="db-feed-ts">${l.t}</span>
            <span class="db-feed-lv db-feed-${l.lv}">${l.lv.toUpperCase()}:</span>
            <span class="db-feed-msg">${this._escapeHtml(l.msg)}</span>
          </div>`).join('');
  }

  private _miniModule(icon: string, label: string, panel: string): string {
    return `
    <div class="db-metric" onclick="openPanel('${panel}')" style="padding:14px;">
      <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);font-size:20px;margin-bottom:8px;">${icon}</span>
      <p style="font-size:12px;font-weight:600;">${label}</p>
    </div>`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  /* ── ANALYTICS PAGE ── */
  private _analyticsBody(): string {
<<<<<<< HEAD
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
=======
    return `
  <div class="db-main">
    <section class="anim">
      <h2 class="section-title">Analysis Reports</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${this._analyticsCard('security', 'Security Scanner', 'OWASP Top 10 · Secret Detection · Vault Integration', 'security')}
        ${this._analyticsCard('policy', 'Compliance Dashboard', 'SOC2 · HIPAA · GDPR · PCI-DSS Frameworks', 'compliance')}
        ${this._analyticsCard('speed', 'Performance Monitor', 'Bundle analysis · Lighthouse · Memory profiling', 'performance')}
        ${this._analyticsCard('difference', 'Change Impact', 'Blast radius · Dependency tracking · Risk assessment', 'impact')}
        ${this._analyticsCard('psychology', 'AI Explainer', 'Code understanding · Intent analysis · Smart docs', 'ai')}
        ${this._analyticsCard('group', 'Team Collaboration', 'Review workflows · Annotations · Shared reports', 'team')}
        ${this._analyticsCard('verified', 'Production Integrity', 'Deploy readiness · Environment checks · Uptime', 'integrity')}
        ${this._analyticsCard('description', 'MDC Generator', 'Architecture docs · Rule generation · Schema maps', 'mdc')}
      </div>
    </section>
  </div>`;
  }

  private _analyticsCard(icon: string, title: string, desc: string, panel: string): string {
    return `
    <div class="db-mod" onclick="openPanel('${panel}')">
      <div class="db-mod-left">
        <div class="db-mod-icon" style="background:rgba(0,229,255,0.08);">
          <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);font-size:24px;">${icon}</span>
        </div>
        <div>
          <p style="font-size:14px;font-weight:700;">${title}</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">${desc}</p>
        </div>
      </div>
      <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.25);font-size:22px;">chevron_right</span>
    </div>`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  /* ── SETTINGS PAGE ── */
  private _settingsBody(): string {
<<<<<<< HEAD
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
=======
    return `
  <div class="db-main">
    <section class="anim">
      <h2 class="section-title">Settings</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="db-mod" onclick="post('vscodeCommand', { id: 'guardrail.login' })">
          <div class="db-mod-left">
            <div class="db-mod-icon" style="background:rgba(0,229,255,0.08);"><span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);">link</span></div>
            <div>
              <p style="font-size:14px;font-weight:700;">Login &amp; link CLI</p>
              <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">Browser device code — syncs to local <code style="font-size:10px;">guardrail</code> CLI when enabled</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.25);">chevron_right</span>
        </div>
        <div class="db-mod" onclick="post('vscodeCommand', { id: 'guardrail.openWebDashboard' })">
          <div class="db-mod-left">
            <div class="db-mod-icon" style="background:rgba(0,229,255,0.08);"><span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);">public</span></div>
            <div>
              <p style="font-size:14px;font-weight:700;">Open web app</p>
              <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">Configure <code style="font-size:10px;">guardrail.webAppUrl</code> for local dev</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.25);">open_in_new</span>
        </div>
        <div class="db-mod" onclick="post('openSettings')">
          <div class="db-mod-left">
            <div class="db-mod-icon" style="background:rgba(0,229,255,0.08);"><span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);">tune</span></div>
            <div>
              <p style="font-size:14px;font-weight:700;">Extension Settings</p>
              <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">Configure scan profiles, API keys, thresholds</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.25);">chevron_right</span>
        </div>
        <div class="db-mod" onclick="post('openExternal',{url:'https://guardrailai.dev/docs'})">
          <div class="db-mod-left">
            <div class="db-mod-icon" style="background:rgba(255,193,192,0.1);"><span class="material-symbols-outlined" style="color:var(--tertiary);">menu_book</span></div>
            <div>
              <p style="font-size:14px;font-weight:700;">Documentation</p>
              <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">CLI reference, engine docs, API guides</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.25);">open_in_new</span>
        </div>
        <div class="db-mod" onclick="post('openExternal',{url:'https://github.com/guardrail-dev/guardrail'})">
          <div class="db-mod-left">
            <div class="db-mod-icon" style="background:rgba(255,255,255,0.05);"><span class="material-symbols-outlined" style="color:var(--on-surface-variant);">code</span></div>
            <div>
              <p style="font-size:14px;font-weight:700;">Source & Issues</p>
              <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">Report bugs, contribute, view changelog</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.25);">open_in_new</span>
        </div>
      </div>
    </section>
    <section class="anim anim-d1">
      <p style="text-align:center;font-size:11px;color:var(--outline);margin-top:24px;">Guardrail v${KINETIC_ARCHIVE_VERSION} · guardrailai.dev</p>
    </section>
  </div>`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  /* ── UPGRADE PAGE ── */
  private _upgradeBody(): string {
<<<<<<< HEAD
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
=======
    return `
  <div class="db-main">
    <section class="anim db-empty">
      <div style="width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,var(--primary-container),var(--secondary-container));display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 28px rgba(0,229,255,0.3);">
        <span class="material-symbols-outlined" style="color:#001f24;font-size:36px;font-variation-settings:'FILL' 1;">workspace_premium</span>
      </div>
      <h2>Upgrade to Pro</h2>
      <p>Unlock advanced security engines, team collaboration, compliance reporting, and priority support.</p>
    </section>

    <section class="anim anim-d1">
      <h2 class="section-title">Pro Features</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${this._upgradeFeature('rocket_launch', 'Unlimited Scans', 'No daily scan limits')}
        ${this._upgradeFeature('shield_with_heart', 'All Security Engines', 'OWASP, SAST, DAST, SCA')}
        ${this._upgradeFeature('group', 'Team Dashboard', 'Shared reports & annotations')}
        ${this._upgradeFeature('policy', 'Compliance Reports', 'SOC2, HIPAA, GDPR, PCI-DSS')}
        ${this._upgradeFeature('support_agent', 'Priority Support', 'Direct Slack channel access')}
      </div>
    </section>

    <section class="anim anim-d2" style="text-align:center;padding-top:16px;">
      <button class="db-cta-btn" onclick="post('openExternal',{url:'https://guardrailai.dev/pricing'})">
        View Plans
      </button>
      <p style="font-size:11px;color:var(--outline);margin-top:14px;">Free 14-day trial · No credit card required</p>
    </section>
  </div>`;
  }

  private _upgradeFeature(icon: string, title: string, desc: string): string {
    return `
    <div class="db-feat">
      <div class="db-feat-left">
        <span class="material-symbols-outlined" style="color:var(--primary);font-size:24px;">${icon}</span>
        <div>
          <p style="font-size:14px;font-weight:700;">${title}</p>
          <p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px;">${desc}</p>
        </div>
      </div>
      <span class="material-symbols-outlined" style="color:var(--primary);font-size:20px;font-variation-settings:'FILL' 1;">check_circle</span>
    </div>`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
