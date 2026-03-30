/**
 * CodeGuard Premium Webview Panel
 * 
 * Apple/Vercel-inspired design with glassmorphism, 
 * smooth animations, and premium typography.
 */

import * as vscode from 'vscode';
import { ScanResult, Issue } from './mcp-client';

interface DashboardData {
  score: number;
  grade: string;
  canShip: boolean;
  issues: Issue[];
  scanTime?: string;
  filesScanned?: number;
}

export class CodeGuardDashboardPanel {
  public static currentPanel: CodeGuardDashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _data: DashboardData;

  private constructor(panel: vscode.WebviewPanel, data: DashboardData) {
    this._panel = panel;
    this._data = data;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'rescan':
            vscode.commands.executeCommand('codeguard.scanWorkspace');
            break;
          case 'openFile':
            const doc = await vscode.workspace.openTextDocument(message.file);
            const editor = await vscode.window.showTextDocument(doc);
            if (message.line) {
              const position = new vscode.Position(message.line - 1, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(new vscode.Range(position, position));
            }
            break;
          case 'fixIssue':
            vscode.commands.executeCommand('codeguard.applyFix', message.issue);
            break;
          case 'openDocs':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
          case 'exportReport':
            this._exportReport();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(data: DashboardData): CodeGuardDashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (CodeGuardDashboardPanel.currentPanel) {
      CodeGuardDashboardPanel.currentPanel._data = data;
      CodeGuardDashboardPanel.currentPanel._update();
      CodeGuardDashboardPanel.currentPanel._panel.reveal(column);
      return CodeGuardDashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeguardDashboard',
      'CodeGuard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    CodeGuardDashboardPanel.currentPanel = new CodeGuardDashboardPanel(panel, data);
    return CodeGuardDashboardPanel.currentPanel;
  }

  public updateData(data: DashboardData): void {
    this._data = data;
    this._update();
  }

  private _update(): void {
    this._panel.webview.html = this._getHtml();
  }

  private async _exportReport(): Promise<void> {
    const report = this._generateMarkdownReport();
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('codeguard-report.md'),
      filters: { 'Markdown': ['md'] },
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(report));
      vscode.window.showInformationMessage('Report exported successfully');
    }
  }

  private _generateMarkdownReport(): string {
    const { score, grade, issues } = this._data;
    const critical = issues.filter(i => i.type === 'critical');
    const warnings = issues.filter(i => i.type === 'warning');
    
    return `# CodeGuard Report

**Score:** ${score}/100 (Grade: ${grade})
**Generated:** ${new Date().toISOString()}

## Summary

- Critical Issues: ${critical.length}
- Warnings: ${warnings.length}
- Total Issues: ${issues.length}

## Critical Issues

${critical.map(i => `### ${i.category}\n- **File:** ${i.file || 'Unknown'}${i.line ? `:${i.line}` : ''}\n- **Message:** ${i.message}\n`).join('\n')}

## Warnings

${warnings.map(i => `### ${i.category}\n- **File:** ${i.file || 'Unknown'}${i.line ? `:${i.line}` : ''}\n- **Message:** ${i.message}\n`).join('\n')}
`;
  }

  private _getHtml(): string {
    const { score, grade, canShip, issues, scanTime, filesScanned } = this._data;
    
    const critical = issues.filter(i => i.type === 'critical');
    const warnings = issues.filter(i => i.type === 'warning');
    const suggestions = issues.filter(i => i.type === 'suggestion');

    const scoreColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const scoreGlow = score >= 80 ? '0 0 60px rgba(16, 185, 129, 0.4)' : score >= 50 ? '0 0 60px rgba(245, 158, 11, 0.3)' : '0 0 60px rgba(239, 68, 68, 0.4)';
    const statusEmoji = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '🚫';
    const statusText = canShip ? 'Ready to Ship' : score >= 50 ? 'Needs Attention' : 'Critical Issues';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeGuard Dashboard</title>
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #141414;
      --bg-tertiary: #1a1a1a;
      --bg-card: rgba(26, 26, 26, 0.8);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent-green: #10b981;
      --accent-yellow: #f59e0b;
      --accent-red: #ef4444;
      --accent-blue: #3b82f6;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      --font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Animated gradient background */
    .bg-gradient {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 600px;
      background: radial-gradient(ellipse at 50% 0%, rgba(${score >= 80 ? '16, 185, 129' : score >= 50 ? '245, 158, 11' : '239, 68, 68'}, 0.15) 0%, transparent 60%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 48px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, ${scoreColor} 0%, ${score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626'} 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: ${scoreGlow};
    }

    .logo-text {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .btn:hover {
      background: var(--bg-tertiary);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-primary {
      background: ${scoreColor};
      border-color: ${scoreColor};
      color: #000;
    }

    .btn-primary:hover {
      filter: brightness(1.1);
    }

    /* Score Card */
    .score-card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      padding: 48px;
      text-align: center;
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
    }

    .score-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 200px;
      background: ${scoreColor};
      filter: blur(100px);
      opacity: 0.2;
      pointer-events: none;
    }

    .score-value {
      font-size: 120px;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: ${scoreColor};
      line-height: 1;
      text-shadow: ${scoreGlow};
      position: relative;
    }

    .score-max {
      font-size: 32px;
      color: var(--text-muted);
      font-weight: 400;
    }

    .score-label {
      font-size: 14px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 8px;
    }

    .score-grade {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 24px;
      padding: 12px 24px;
      background: rgba(${score >= 80 ? '16, 185, 129' : score >= 50 ? '245, 158, 11' : '239, 68, 68'}, 0.15);
      border: 1px solid rgba(${score >= 80 ? '16, 185, 129' : score >= 50 ? '245, 158, 11' : '239, 68, 68'}, 0.3);
      border-radius: 100px;
      font-size: 16px;
      font-weight: 600;
      color: ${scoreColor};
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.2s ease;
    }

    .stat-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .stat-value.critical { color: var(--accent-red); }
    .stat-value.warning { color: var(--accent-yellow); }
    .stat-value.suggestion { color: var(--accent-blue); }
    .stat-value.neutral { color: var(--text-primary); }

    .stat-label {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    /* Issues Section */
    .section {
      margin-bottom: 32px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge.critical { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    .badge.warning { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
    .badge.suggestion { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }

    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .issue-item {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .issue-item:hover {
      border-color: rgba(255, 255, 255, 0.15);
      background: var(--bg-tertiary);
    }

    .issue-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .issue-indicator.critical { background: var(--accent-red); box-shadow: 0 0 8px var(--accent-red); }
    .issue-indicator.warning { background: var(--accent-yellow); box-shadow: 0 0 8px var(--accent-yellow); }
    .issue-indicator.suggestion { background: var(--accent-blue); box-shadow: 0 0 8px var(--accent-blue); }

    .issue-content {
      flex: 1;
      min-width: 0;
    }

    .issue-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .issue-meta {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .issue-actions {
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .issue-item:hover .issue-actions {
      opacity: 1;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .icon-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 48px;
      color: var(--text-secondary);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 32px;
      border-top: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer a {
      color: var(--text-secondary);
      text-decoration: none;
    }

    .footer a:hover {
      color: var(--text-primary);
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-in {
      animation: fadeIn 0.5s ease forwards;
    }

    .delay-1 { animation-delay: 0.1s; opacity: 0; }
    .delay-2 { animation-delay: 0.2s; opacity: 0; }
    .delay-3 { animation-delay: 0.3s; opacity: 0; }
    .delay-4 { animation-delay: 0.4s; opacity: 0; }

    /* Responsive */
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .score-value {
        font-size: 80px;
      }
    }
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  
  <div class="container">
    <header class="header animate-in">
      <div class="logo">
        <div class="logo-icon">🛡️</div>
        <span class="logo-text">CodeGuard</span>
      </div>
      <div class="header-actions">
        <button class="btn" onclick="exportReport()">
          📄 Export
        </button>
        <button class="btn btn-primary" onclick="rescan()">
          🔄 Rescan
        </button>
      </div>
    </header>

    <div class="score-card animate-in delay-1">
      <div class="score-value">
        ${score}<span class="score-max">/100</span>
      </div>
      <div class="score-label">Production Readiness Score</div>
      <div class="score-grade">
        ${statusEmoji} ${statusText} • Grade ${grade}
      </div>
    </div>

    <div class="stats-grid animate-in delay-2">
      <div class="stat-card">
        <div class="stat-value critical">${critical.length}</div>
        <div class="stat-label">Critical Issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-value warning">${warnings.length}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value suggestion">${suggestions.length}</div>
        <div class="stat-label">Suggestions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value neutral">${filesScanned || '—'}</div>
        <div class="stat-label">Files Scanned</div>
      </div>
    </div>

    ${critical.length > 0 ? `
    <div class="section animate-in delay-3">
      <div class="section-header">
        <h2 class="section-title">
          🚫 Critical Issues
          <span class="badge critical">${critical.length}</span>
        </h2>
      </div>
      <div class="issues-list">
        ${critical.map(issue => this._renderIssue(issue, 'critical')).join('')}
      </div>
    </div>
    ` : ''}

    ${warnings.length > 0 ? `
    <div class="section animate-in delay-3">
      <div class="section-header">
        <h2 class="section-title">
          ⚠️ Warnings
          <span class="badge warning">${warnings.length}</span>
        </h2>
      </div>
      <div class="issues-list">
        ${warnings.map(issue => this._renderIssue(issue, 'warning')).join('')}
      </div>
    </div>
    ` : ''}

    ${suggestions.length > 0 ? `
    <div class="section animate-in delay-4">
      <div class="section-header">
        <h2 class="section-title">
          💡 Suggestions
          <span class="badge suggestion">${suggestions.length}</span>
        </h2>
      </div>
      <div class="issues-list">
        ${suggestions.map(issue => this._renderIssue(issue, 'suggestion')).join('')}
      </div>
    </div>
    ` : ''}

    ${issues.length === 0 ? `
    <div class="empty-state animate-in delay-3">
      <div class="empty-state-icon">🎉</div>
      <h3>No Issues Found</h3>
      <p>Your code is production-ready!</p>
    </div>
    ` : ''}

    <footer class="footer animate-in delay-4">
      <p>
        CodeGuard v1.0.0 • 
        <a href="#" onclick="openDocs('https://docs.codeguard.dev')">Documentation</a> • 
        <a href="#" onclick="openDocs('https://codeguard.dev')">codeguard.dev</a>
      </p>
      ${scanTime ? `<p>Last scan: ${scanTime}</p>` : ''}
    </footer>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function rescan() {
      vscode.postMessage({ command: 'rescan' });
    }

    function openFile(file, line) {
      vscode.postMessage({ command: 'openFile', file, line });
    }

    function fixIssue(issue) {
      vscode.postMessage({ command: 'fixIssue', issue });
    }

    function openDocs(url) {
      vscode.postMessage({ command: 'openDocs', url });
    }

    function exportReport() {
      vscode.postMessage({ command: 'exportReport' });
    }
  </script>
</body>
</html>`;
  }

  private _renderIssue(issue: Issue, type: string): string {
    const fileDisplay = issue.file 
      ? `${issue.file.split('/').pop()}${issue.line ? `:${issue.line}` : ''}`
      : 'Unknown file';
    
    return `
      <div class="issue-item" onclick="openFile('${issue.file || ''}', ${issue.line || 0})">
        <div class="issue-indicator ${type}"></div>
        <div class="issue-content">
          <div class="issue-title">${this._escapeHtml(issue.message)}</div>
          <div class="issue-meta">${fileDisplay} • ${issue.category}</div>
        </div>
        <div class="issue-actions">
          ${issue.fix ? `<button class="icon-btn" onclick="event.stopPropagation(); fixIssue(${JSON.stringify(issue).replace(/"/g, '&quot;')})" title="Apply fix">🔧</button>` : ''}
          <button class="icon-btn" onclick="event.stopPropagation(); openFile('${issue.file || ''}', ${issue.line || 0})" title="Go to file">→</button>
        </div>
      </div>
    `;
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public dispose(): void {
    CodeGuardDashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
