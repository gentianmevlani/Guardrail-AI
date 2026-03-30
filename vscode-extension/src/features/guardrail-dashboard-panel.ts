/**
 * Guardrail Dashboard Panel
 * 
 * Premium VS Code webview with multi-page navigation,
 * Material Design 3 color system, and glassmorphism effects.
 */

import * as vscode from 'vscode';
import { getLastScanResult } from '../scan-state';
import type { ScanResult } from '../mcp-client';
import { getGuardrailSharedStyles } from '../webview-shared-styles';

export class GuardrailDashboardPanel {
  public static currentPanel: GuardrailDashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _currentPage: string = 'home';

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
          case 'scan':
            vscode.commands.executeCommand('guardrail.scanWorkspace');
            break;
          case 'runCLI':
            vscode.commands.executeCommand('guardrail.runShip');
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
        }
      },
      null,
      this._disposables
    );
  }

  /** Re-render when the last scan snapshot changes (e.g. after Ship/Scan). */
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
      '🛡️ Guardrail',
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
    this._panel.webview.html = this._getHtml();
  }

  private _getHtml(): string {
    const page = this._currentPage;
    let body = '';
    if (page === 'home') { body = this._homeBody(getLastScanResult()); }
    else if (page === 'analytics') { body = this._analyticsBody(); }
    else if (page === 'settings') { body = this._settingsBody(); }
    else if (page === 'upgrade') { body = this._upgradeBody(); }

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guardrail</title>
  ${getGuardrailSharedStyles()}
</head>
<body>
  <!-- Top Bar -->
  <header class="top-bar">
    <div class="brand">
      <span class="material-symbols-outlined">shield</span>
      <span>GUARDRAIL</span>
    </div>
    <button class="scan-btn" onclick="post('scan')">Scan</button>
  </header>

  ${body}

  <!-- Bottom Nav -->
  <nav class="bottom-nav">
    <button class="nav-item ${page === 'home' ? 'active' : ''}" onclick="nav('home')">
      <span class="material-symbols-outlined" style="${page === 'home' ? "font-variation-settings:'FILL' 1;" : ''}">home</span>
    </button>
    <button class="nav-item ${page === 'analytics' ? 'active' : ''}" onclick="nav('analytics')">
      <span class="material-symbols-outlined" style="${page === 'analytics' ? "font-variation-settings:'FILL' 1;" : ''}">analytics</span>
    </button>
    <button class="nav-item ${page === 'settings' ? 'active' : ''}" onclick="nav('settings')">
      <span class="material-symbols-outlined" style="${page === 'settings' ? "font-variation-settings:'FILL' 1;" : ''}">settings</span>
    </button>
    <button class="nav-item ${page === 'upgrade' ? 'active' : ''}" onclick="nav('upgrade')">
      <span class="material-symbols-outlined" style="${page === 'upgrade' ? "font-variation-settings:'FILL' 1;" : ''}">workspace_premium</span>
    </button>
  </nav>

  <script>
    const vscode = acquireVsCodeApi();
    function post(cmd, data) { vscode.postMessage({ command: cmd, ...data }); }
    function nav(page) { post('navigate', { page }); }
    function openPanel(p) { post('openPanel', { panel: p }); }
  </script>
</body>
</html>`;
  }

  /* ── HOME PAGE ── */
  private _homeBody(scan: ScanResult | null): string {
    if (!scan) {
      return `
  <div class="page-content">
    <section class="anim">
      <div class="card" style="border-left:4px solid var(--tertiary-container); padding: 20px;">
        <p style="font-size:14px; font-weight:700; margin-bottom:8px;">No scan data yet</p>
        <p style="font-size:12px; color:var(--on-surface-variant); line-height:1.5;">
          Run <strong>Scan Workspace</strong> (⌘⇧⌥G / Ctrl+Shift+Alt+G) or <strong>Run Ship Check</strong> from the Command Palette. Results from the CLI (e.g. <code style="color:var(--primary);">guardrail ship --json</code>) are loaded when a summary exists under <code style="color:var(--primary);">.guardrail/</code>.
        </p>
      </div>
    </section>
  </div>`;
    }

    const critical = scan.issues.filter((i) => i.type === 'critical').length;
    const warnings = scan.issues.filter((i) => i.type === 'warning').length;
    const suggestions = scan.issues.filter((i) => i.type === 'suggestion').length;
    const shipLabel = scan.canShip ? 'SHIP' : 'BLOCK';
    const scorePct = Math.max(0, Math.min(100, Math.round(scan.score)));
    const grade = scan.grade || '—';
    const secCount = scan.counts?.secrets ?? 0;
    const mockCount = scan.counts?.mocks ?? 0;
    const routeCount = scan.counts?.routes ?? 0;
    const integ = scan.counts?.integrity ?? 0;

    const secWarn = secCount > 0;
    const mockMuted = mockCount === 0;

    return `
  <div class="page-content">
    <!-- Project Health -->
    <section class="anim">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h2 class="section-title" style="margin:0;">Project Health</h2>
        <div class="status-pill">
          <div class="status-dot"></div>
          <span class="status-label">${shipLabel}</span>
        </div>
      </div>
      <p style="font-size:11px;color:var(--outline);margin:-8px 0 12px 0;">Grade <strong>${grade}</strong> · ${scan.issues.length} issue(s) in last run</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="card" style="border-left:4px solid var(--primary);">
          <span style="font-family:'Space Grotesk',sans-serif; font-size:28px; font-weight:700;">${scorePct}</span>
          <span style="display:block; font-size:10px; color:var(--primary); font-weight:700; text-transform:uppercase; letter-spacing:0.08em; margin-top:4px;">Score</span>
        </div>
        <div class="card" style="border-left:4px solid var(--tertiary-container);">
          <span style="font-family:'Space Grotesk',sans-serif; font-size:28px; font-weight:700;">${warnings}</span>
          <span style="display:block; font-size:10px; color:var(--tertiary-container); font-weight:700; text-transform:uppercase; letter-spacing:0.08em; margin-top:4px;">Warnings</span>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px;">
        <div class="card" style="border-left:4px solid var(--error-container);">
          <span style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700;">${critical}</span>
          <span style="display:block; font-size:10px; color:var(--error); font-weight:700; text-transform:uppercase; letter-spacing:0.08em; margin-top:4px;">Critical</span>
        </div>
        <div class="card" style="border-left:4px solid var(--outline-variant);">
          <span style="font-family:'Space Grotesk',sans-serif; font-size:22px; font-weight:700;">${suggestions}</span>
          <span style="display:block; font-size:10px; color:var(--on-surface-variant); font-weight:700; text-transform:uppercase; letter-spacing:0.08em; margin-top:4px;">Hints</span>
        </div>
      </div>
    </section>

    <!-- Analysis Modules -->
    <section class="anim anim-d1">
      <h2 class="section-title">Analysis Modules</h2>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${this._moduleCard('verified_user', 'Integrity', integ ? `${integ} integrity signal(s)` : 'No integrity count in last scan', 'primary', integ ? 'check_circle' : 'circle', 'integrity', false, !integ)}
        ${this._moduleCard('security', 'Security', secWarn ? `${secCount} secret-related count(s)` : 'No secret hits in summary', secWarn ? 'tertiary-container' : 'on-surface-variant', secWarn ? 'warning' : 'check_circle', 'security', secWarn)}
        ${this._moduleCard('cleaning_services', 'Hygiene', scan.canShip ? 'Last scan: ready to ship' : 'Last scan: blocked', 'on-surface-variant', scan.canShip ? 'check_circle' : 'warning', 'compliance', !scan.canShip)}
        ${this._moduleCard('assignment', 'Contracts', `${routeCount} route signal(s)`, 'on-surface-variant', routeCount ? 'warning' : 'check_circle', 'mdc', !!routeCount)}
        ${this._moduleCard('layers', 'Mocks', mockCount ? `${mockCount} mock signal(s)` : 'No mock hits in summary', 'on-surface-variant', mockCount ? 'warning' : 'circle', 'integrity', !!mockCount, mockMuted)}
      </div>
    </section>

    <!-- CLI Shortcuts -->
    <section class="anim anim-d2">
      <h2 class="section-title">CLI Shortcuts</h2>
      <div class="card" style="padding:6px; background:var(--surface-lowest);">
        <button onclick="post('runCLI')" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:8px;border:none;background:none;color:inherit;cursor:pointer;text-align:left;" onmouseover="this.style.background='rgba(173,198,255,0.1)'" onmouseout="this.style.background='none'">
          <span style="font-family:monospace;font-size:13px;color:var(--primary);font-weight:700;">guardrail scan</span>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.4);font-size:20px;">terminal</span>
        </button>
        <div style="height:1px;background:var(--border-subtle);margin:0 16px;"></div>
        <button onclick="post('runCLI')" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:8px;border:none;background:none;color:inherit;cursor:pointer;text-align:left;" onmouseover="this.style.background='rgba(173,198,255,0.1)'" onmouseout="this.style.background='none'">
          <span style="font-family:monospace;font-size:13px;color:var(--primary);font-weight:700;">guardrail gate</span>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.4);font-size:20px;">lock_open</span>
        </button>
        <div style="height:1px;background:var(--border-subtle);margin:0 16px;"></div>
        <button onclick="post('runCLI')" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:8px;border:none;background:none;color:inherit;cursor:pointer;text-align:left;" onmouseover="this.style.background='rgba(173,198,255,0.1)'" onmouseout="this.style.background='none'">
          <span style="font-family:monospace;font-size:13px;color:var(--primary);font-weight:700;">guardrail fix</span>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.4);font-size:20px;">auto_fix_high</span>
        </button>
      </div>
    </section>

    <!-- Tier -->
    <section class="anim anim-d3">
      <div style="background:rgba(26,36,61,0.4);backdrop-filter:blur(12px);padding:20px;border-radius:16px;border:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;box-shadow:0 8px 24px rgba(0,0,0,0.3);">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--primary),var(--primary-container));display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(173,198,255,0.2);">
            <span class="material-symbols-outlined" style="color:var(--on-primary);font-size:24px;font-variation-settings:'FILL' 1;">workspace_premium</span>
          </div>
          <div>
            <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;color:var(--primary);">DATA</p>
            <p style="font-size:16px;font-weight:700;font-family:'Space Grotesk',sans-serif;">Last workspace scan</p>
          </div>
        </div>
        <button onclick="nav('upgrade')" style="border:none;background:none;color:var(--primary);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;text-decoration:underline;text-underline-offset:4px;">Upgrade</button>
      </div>
    </section>
  </div>`;
  }

  private _moduleCard(icon: string, title: string, subtitle: string, iconColor: string, statusIcon: string, panel: string, isWarning: boolean = false, isMuted: boolean = false): string {
    const borderStyle = isWarning ? `border:1px solid rgba(255,140,0,0.3);` : `border:1px solid var(--border-subtle);`;
    const opacity = isMuted ? 'opacity:0.8;' : '';
    const iconBg = iconColor === 'primary' ? 'rgba(173,198,255,0.1)' : iconColor === 'tertiary-container' ? 'rgba(255,140,0,0.1)' : 'rgba(255,255,255,0.05)';
    const iconClr = iconColor === 'primary' ? 'var(--primary)' : iconColor === 'tertiary-container' ? 'var(--tertiary-container)' : 'var(--on-surface-variant)';
    const statusClr = statusIcon === 'warning' ? 'var(--tertiary-container)' : statusIcon === 'check_circle' ? 'var(--primary)' : 'var(--outline)';
    const statusFill = statusIcon === 'circle' ? '' : "font-variation-settings:'FILL' 1;";
    const subtitleClr = isWarning ? 'var(--tertiary-container)' : 'var(--on-surface-variant)';

    return `
    <div class="card card-row" style="${borderStyle}${opacity}cursor:pointer;" onclick="openPanel('${panel}')">
      <div class="card-left">
        <div class="icon-box" style="background:${iconBg};">
          <span class="material-symbols-outlined" style="color:${iconClr};font-size:24px;">${icon}</span>
        </div>
        <div>
          <p style="font-size:14px;font-weight:700;">${title}</p>
          <p style="font-size:11px;color:${subtitleClr};font-weight:500;">${subtitle}</p>
        </div>
      </div>
      <span class="material-symbols-outlined" style="color:${statusClr};font-size:20px;${statusFill}">${statusIcon}</span>
    </div>`;
  }

  /* ── ANALYTICS PAGE ── */
  private _analyticsBody(): string {
    return `
  <div class="page-content">
    <section class="anim">
      <h2 class="section-title">Analysis Reports</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${this._analyticsCard('security', 'Security Scanner', 'OWASP Top 10 · Secret Detection', 'security')}
        ${this._analyticsCard('policy', 'Compliance Dashboard', 'SOC2 · HIPAA · GDPR · PCI-DSS', 'compliance')}
        ${this._analyticsCard('speed', 'Performance Monitor', 'Bundle analysis · Lighthouse', 'performance')}
        ${this._analyticsCard('difference', 'Change Impact', 'Blast radius · dependency tracking', 'impact')}
        ${this._analyticsCard('psychology', 'AI Explainer', 'Code understanding · intent analysis', 'ai')}
        ${this._analyticsCard('group', 'Team Collaboration', 'Review workflows · annotations', 'team')}
        ${this._analyticsCard('verified', 'Production Integrity', 'Deploy readiness · environment checks', 'integrity')}
        ${this._analyticsCard('description', 'MDC Generator', 'Architecture docs · rule generation', 'mdc')}
      </div>
    </section>
  </div>`;
  }

  private _analyticsCard(icon: string, title: string, desc: string, panel: string): string {
    return `
    <div class="card card-row" style="cursor:pointer;" onclick="openPanel('${panel}')">
      <div class="card-left">
        <div class="icon-box" style="background:rgba(173,198,255,0.1);">
          <span class="material-symbols-outlined" style="color:var(--primary);font-size:24px;">${icon}</span>
        </div>
        <div>
          <p style="font-size:14px;font-weight:700;">${title}</p>
          <p style="font-size:11px;color:var(--on-surface-variant);font-weight:500;">${desc}</p>
        </div>
      </div>
      <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);font-size:20px;">chevron_right</span>
    </div>`;
  }

  /* ── SETTINGS PAGE ── */
  private _settingsBody(): string {
    return `
  <div class="page-content">
    <section class="anim">
      <h2 class="section-title">Settings</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="card card-row" style="cursor:pointer;" onclick="post('openSettings')">
          <div class="card-left">
            <div class="icon-box" style="background:rgba(173,198,255,0.1);">
              <span class="material-symbols-outlined" style="color:var(--primary);">tune</span>
            </div>
            <div>
              <p style="font-size:14px;font-weight:700;">Extension Settings</p>
              <p style="font-size:11px;color:var(--on-surface-variant);">Configure scan profiles, API keys, thresholds</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);">chevron_right</span>
        </div>
        <div class="card card-row" style="cursor:pointer;" onclick="post('openExternal',{url:'https://docs.guardrail.dev'})">
          <div class="card-left">
            <div class="icon-box" style="background:rgba(255,183,134,0.1);">
              <span class="material-symbols-outlined" style="color:var(--tertiary);">menu_book</span>
            </div>
            <div>
              <p style="font-size:14px;font-weight:700;">Documentation</p>
              <p style="font-size:11px;color:var(--on-surface-variant);">CLI reference, engine docs, API guides</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);">open_in_new</span>
        </div>
        <div class="card card-row" style="cursor:pointer;" onclick="post('openExternal',{url:'https://github.com/guardrail-dev/guardrail'})">
          <div class="card-left">
            <div class="icon-box" style="background:rgba(255,255,255,0.05);">
              <span class="material-symbols-outlined" style="color:var(--on-surface-variant);">code</span>
            </div>
            <div>
              <p style="font-size:14px;font-weight:700;">Source & Issues</p>
              <p style="font-size:11px;color:var(--on-surface-variant);">Report bugs, contribute, view changelog</p>
            </div>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.3);">open_in_new</span>
        </div>
      </div>
    </section>
    <section class="anim anim-d1">
      <p style="text-align:center;font-size:11px;color:var(--outline);margin-top:24px;">Guardrail v2.0.0 · guardrail.dev</p>
    </section>
  </div>`;
  }

  /* ── UPGRADE PAGE ── */
  private _upgradeBody(): string {
    return `
  <div class="page-content">
    <section class="anim">
      <div style="text-align:center;padding:24px 0;">
        <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,var(--primary),var(--primary-container));display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 8px 24px rgba(173,198,255,0.3);">
          <span class="material-symbols-outlined" style="color:var(--on-primary);font-size:32px;font-variation-settings:'FILL' 1;">workspace_premium</span>
        </div>
        <h2 style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;margin-bottom:8px;">Upgrade to Pro</h2>
        <p style="font-size:13px;color:var(--on-surface-variant);max-width:320px;margin:0 auto;">Unlock advanced engines, team features, and priority support.</p>
      </div>
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

    <section class="anim anim-d2" style="text-align:center;padding-top:8px;">
      <button onclick="post('openExternal',{url:'https://guardrail.dev/pricing'})" style="background:var(--primary);color:var(--on-primary);border:none;padding:14px 48px;border-radius:12px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(173,198,255,0.3);transition:all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
        View Plans
      </button>
      <p style="font-size:11px;color:var(--outline);margin-top:12px;">Free 14-day trial · No credit card required</p>
    </section>
  </div>`;
  }

  private _upgradeFeature(icon: string, title: string, desc: string): string {
    return `
    <div class="card card-row">
      <div class="card-left">
        <span class="material-symbols-outlined" style="color:var(--primary);font-size:22px;">${icon}</span>
        <div>
          <p style="font-size:13px;font-weight:700;">${title}</p>
          <p style="font-size:11px;color:var(--on-surface-variant);">${desc}</p>
        </div>
      </div>
      <span class="material-symbols-outlined" style="color:var(--primary);font-size:18px;font-variation-settings:'FILL' 1;">check_circle</span>
    </div>`;
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
