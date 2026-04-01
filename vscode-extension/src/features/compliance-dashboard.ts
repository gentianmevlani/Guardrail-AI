/**
 * Compliance Dashboard
 *
 * Enterprise feature for tracking compliance with SOC2, HIPAA, GDPR, PCI-DSS
 * standards directly in VS Code.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ApiClient } from "../services/api-client";
import { CLIService } from "../services/cli-service";
import { getGuardrailPanelHead } from "../webview-shared-styles";
import { complianceDashboardStitchCss } from "./compliance-dashboard-stitch-css";
import { mapScanToComplianceChecks } from "../scan-cli-map";

export interface ComplianceCheck {
  id: string;
  framework: 'SOC2' | 'HIPAA' | 'GDPR' | 'PCI-DSS';
  control: string;
  title: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'not-applicable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence?: string[];
  remediation?: string;
  file?: string;
  line?: number;
}

export interface ComplianceReport {
  timestamp: string;
  score: number;
  frameworks: {
    [key: string]: {
      passed: number;
      failed: number;
      warnings: number;
      score: number;
    };
  };
  checks: ComplianceCheck[];
}

export class ComplianceDashboard {
  public static currentPanel: ComplianceDashboard | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _report: ComplianceReport | null = null;
  private _isScanning: boolean = false;
  private _apiClient: ApiClient;
  private _cliService: CLIService;

  private constructor(panel: vscode.WebviewPanel, workspacePath: string, extensionContext: vscode.ExtensionContext) {
    this._panel = panel;
    this._workspacePath = workspacePath;
    this._apiClient = new ApiClient(extensionContext);
    this._cliService = new CLIService(workspacePath);

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'scan':
            await this._runComplianceScan(message.frameworks);
            break;
          case 'openFile':
            await this._openFile(message.file, message.line);
            break;
          case 'export':
            await this._exportReport(message.format);
            break;
          case 'getDetails':
            await this._getCheckDetails(message.checkId);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(workspacePath: string, extensionContext: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ComplianceDashboard.currentPanel) {
      ComplianceDashboard.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'complianceDashboard',
      'Compliance Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    ComplianceDashboard.currentPanel = new ComplianceDashboard(panel, workspacePath, extensionContext);
  }

  private async _runComplianceScan(frameworks: string[]): Promise<void> {
    if (this._isScanning) return;

    this._isScanning = true;
    this._panel.webview.postMessage({ type: "scanning", progress: 0 });

    try {
      const fws = frameworks.length
        ? frameworks
        : ["SOC2", "HIPAA", "GDPR", "PCI-DSS"];
      let checks: ComplianceCheck[] = [];

      this._panel.webview.postMessage({
        type: "progress",
        message: "Running guardrail scan --json…",
        progress: 30,
      });

      const cli = await this._cliService.runScanJson();
      if (cli.data) {
        const mapped = mapScanToComplianceChecks(cli.data, fws);
        checks = mapped.map((c) => ({
          ...c,
          evidence: [],
          remediation: undefined,
          file: undefined,
          line: undefined,
        }));
      }

      if (checks.length === 0) {
        this._panel.webview.postMessage({
          type: "progress",
          message: "Trying Guardrail API…",
          progress: 55,
        });
        try {
          const isConnected = await this._apiClient.testConnection();
          if (isConnected) {
            const projectId = "workspace-" + Date.now();
            for (let i = 0; i < fws.length; i++) {
              const framework = fws[i];
              const progress = 55 + (i * 35) / fws.length;
              this._panel.webview.postMessage({
                type: "progress",
                message: `Checking ${framework}…`,
                progress,
              });
              const response = await this._apiClient.runComplianceAssessment(
                projectId,
                framework,
              );
              if (response.success && response.data) {
                const apiChecks = response.data.checks || [];
                checks.push(
                  ...apiChecks.map((check: Record<string, unknown>) => ({
                    id: String(check.id ?? `${framework}-${Date.now()}`),
                    framework: framework as ComplianceCheck["framework"],
                    control: String(check.control ?? check.controlId ?? "—"),
                    title: String(check.title ?? check.name ?? "Check"),
                    description: String(
                      check.description ?? check.requirement ?? "",
                    ),
                    status: (check.status as ComplianceCheck["status"]) ?? "warning",
                    severity:
                      (check.severity as ComplianceCheck["severity"]) ?? "medium",
                    evidence: (check.evidence as string[]) || [],
                    remediation: check.remediation as string | undefined,
                    file: check.file as string | undefined,
                    line: check.line as number | undefined,
                  })),
                );
              }
              await this._delay(200);
            }
          }
        } catch {
          /* leave checks empty */
        }
      }

      const frameworkScores: ComplianceReport["frameworks"] = {};
      for (const fw of fws) {
        const fwChecks = checks.filter((c) => c.framework === fw);
        const passed = fwChecks.filter((c) => c.status === "passed").length;
        const failed = fwChecks.filter((c) => c.status === "failed").length;
        const warnings = fwChecks.filter((c) => c.status === "warning").length;
        frameworkScores[fw] = {
          passed,
          failed,
          warnings,
          score:
            fwChecks.length > 0
              ? Math.round((passed / fwChecks.length) * 100)
              : 0,
        };
      }

      const totalPassed = checks.filter((c) => c.status === "passed").length;
      const overallScore =
        checks.length > 0
          ? Math.round((totalPassed / checks.length) * 100)
          : 0;

      this._report = {
        timestamp: new Date().toISOString(),
        score: overallScore,
        frameworks: frameworkScores,
        checks,
      };

      this._panel.webview.postMessage({
        type: "complete",
        report: this._report,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Compliance scan failed";
      this._panel.webview.postMessage({
        type: "error",
        message: msg,
      });
    } finally {
      this._isScanning = false;
    }
  }

  private async _openFile(filePath: string, line?: number): Promise<void> {
    const fullPath = path.join(this._workspacePath, filePath);
    if (fs.existsSync(fullPath)) {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(doc);

      if (line) {
        const position = new vscode.Position(line - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
      }
    }
  }

  private async _exportReport(format: 'json' | 'csv' | 'pdf'): Promise<void> {
    if (!this._report) {
      vscode.window.showWarningMessage('No compliance report to export. Run a scan first.');
      return;
    }

    const fileName = `compliance-report-${new Date().toISOString().split('T')[0]}.${format}`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, fileName)),
      filters: { [format.toUpperCase()]: [format] },
    });

    if (uri) {
      let content = '';

      if (format === 'json') {
        content = JSON.stringify(this._report, null, 2);
      } else if (format === 'csv') {
        content = 'Framework,Control,Title,Status,Severity\n';
        content += this._report.checks.map(c =>
          `${c.framework},${c.control},"${c.title}",${c.status},${c.severity}`
        ).join('\n');
      }

      fs.writeFileSync(uri.fsPath, content);
      vscode.window.showInformationMessage(`Compliance report exported to ${path.basename(uri.fsPath)}`);
    }
  }

  private async _getCheckDetails(checkId: string): Promise<void> {
    const check = this._report?.checks.find(c => c.id === checkId);
    if (check) {
      this._panel.webview.postMessage({
        type: 'checkDetails',
        check,
      });
    }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Dashboard</title>
  ${getGuardrailPanelHead(complianceDashboardStitchCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <header class="top-bar">
    <div class="top-bar-left">
      <span class="material-symbols-outlined" style="color:var(--cyan-glow);">policy</span>
      <div>
        <h1>COMPLIANCE</h1>
        <div class="top-bar-sub">SOC2 · HIPAA · GDPR · PCI-DSS</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <div class="export-dropdown">
        <button class="btn btn-secondary" id="exportBtn" onclick="toggleExportMenu()" disabled>
          <span class="material-symbols-outlined" style="font-size:16px;">download</span> Export
        </button>
        <div class="export-menu" id="exportMenu">
          <button class="export-option" onclick="exportReport('json')">Export as JSON</button>
          <button class="export-option" onclick="exportReport('csv')">Export as CSV</button>
        </div>
      </div>
    </div>
  </header>

  <div class="comp-strip" aria-hidden="true">
    <svg viewBox="0 0 800 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="compGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#00e5ff;stop-opacity:0.2" />
          <stop offset="100%" style="stop-color:#00e5ff;stop-opacity:0.7" />
        </linearGradient>
      </defs>
      <path d="M0 36 Q 200 8 400 36 T 800 36" fill="none" stroke="url(#compGrad)" stroke-width="1.5" />
      <circle cx="200" cy="22" r="3" fill="#00e5ff" opacity="0.9" />
      <circle cx="400" cy="36" r="4" fill="#00e5ff" />
      <circle cx="600" cy="24" r="3" fill="#00e5ff" opacity="0.85" />
    </svg>
  </div>

  <div class="content">
    <div class="fw-selector anim">
      <button class="fw-btn selected" data-framework="SOC2">SOC2</button>
      <button class="fw-btn selected" data-framework="HIPAA">HIPAA</button>
      <button class="fw-btn selected" data-framework="GDPR">GDPR</button>
      <button class="fw-btn selected" data-framework="PCI-DSS">PCI-DSS</button>
      <button class="btn" id="scanBtn" onclick="runScan()" style="margin-left:auto;">
        <span class="material-symbols-outlined" style="font-size:16px;">search</span> Scan
      </button>
    </div>

    <div class="progress-container" id="progressContainer">
      <div class="progress-msg" id="progressMessage">Initializing compliance scan...</div>
      <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width: 0%"></div></div>
    </div>

    <div class="score-section" id="scoreSection">
      <div class="overall-score anim">
        <div class="score-value" id="overallScore">--%</div>
        <div class="score-label">Overall Compliance Score</div>
      </div>
      <div class="fw-scores" id="frameworkScores"></div>
      <div>
        <h2 class="section-title">Compliance Checks</h2>
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="all">All</button>
          <button class="filter-tab" data-filter="failed">Failed</button>
          <button class="filter-tab" data-filter="warning">Warnings</button>
          <button class="filter-tab" data-filter="passed">Passed</button>
        </div>
        <div id="checksList"></div>
      </div>
    </div>

    <div class="empty-state" id="emptyState">
      <span class="material-symbols-outlined">policy</span>
      <h3>No Compliance Scan Yet</h3>
      <p>Select frameworks above and click "Scan" to check your codebase.</p>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentReport = null;
    let currentFilter = 'all';

    document.querySelectorAll('.fw-btn').forEach(btn => {
      btn.addEventListener('click', () => { btn.classList.toggle('selected'); });
    });
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderChecks();
      });
    });

    function runScan() {
      const frameworks = Array.from(document.querySelectorAll('.fw-btn.selected')).map(btn => btn.dataset.framework);
      if (frameworks.length === 0) { return; }
      document.getElementById('scanBtn').disabled = true;
      vscode.postMessage({ command: 'scan', frameworks });
    }
    function toggleExportMenu() { document.getElementById('exportMenu').classList.toggle('show'); }
    function exportReport(format) { document.getElementById('exportMenu').classList.remove('show'); vscode.postMessage({ command: 'export', format }); }

    function getScoreColor(score) {
      if (score >= 80) return '#00daf3';
      if (score >= 60) return '#ffb786';
      return '#ffb4ab';
    }

    function renderFrameworkScores(frameworks) {
      document.getElementById('frameworkScores').innerHTML = Object.entries(frameworks).map(([name, data]) => \`
        <div class="fw-score-card">
          <div class="fw-name">\${name}</div>
          <div class="fw-score" style="color:\${getScoreColor(data.score)}">\${data.score}%</div>
          <div class="fw-details">\${data.passed} passed · \${data.failed} failed · \${data.warnings} warnings</div>
        </div>
      \`).join('');
    }

    function renderChecks() {
      if (!currentReport) return;
      let checks = currentReport.checks;
      if (currentFilter !== 'all') { checks = checks.filter(c => c.status === currentFilter); }
      document.getElementById('checksList').innerHTML = checks.map(c => \`
        <div class="check-card \${c.status}" onclick="showCheckDetails('\${c.id}')">
          <div class="check-header">
            <span class="check-title">\${c.title}</span>
            <span class="check-badge badge-\${c.status}">\${c.status.toUpperCase()}</span>
          </div>
          <div class="check-meta">
            <span>\${c.framework}</span>
            <span>\${c.control}</span>
            <span>\${c.severity}</span>
          </div>
          <div class="check-description">\${c.description}</div>
          \${c.remediation ? \`<div class="check-remediation">\${c.remediation}</div>\` : ''}
        </div>
      \`).join('');
    }

    function showCheckDetails(checkId) { vscode.postMessage({ command: 'getDetails', checkId }); }

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'scanning': case 'progress':
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressMessage').textContent = message.message || 'Scanning...';
          document.getElementById('progressFill').style.width = (message.progress || 0) + '%';
          break;
        case 'complete':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('scanBtn').disabled = false;
          document.getElementById('exportBtn').disabled = false;
          document.getElementById('emptyState').style.display = 'none';
          document.getElementById('scoreSection').style.display = 'block';
          currentReport = message.report;
          document.getElementById('overallScore').textContent = currentReport.score + '%';
          document.getElementById('overallScore').style.color = getScoreColor(currentReport.score);
          renderFrameworkScores(currentReport.frameworks);
          renderChecks();
          break;
        case 'error':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('scanBtn').disabled = false;
          break;
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.export-dropdown')) { document.getElementById('exportMenu').classList.remove('show'); }
    });
  </script>
  </div>
</body>
</html>`;
  }

  public dispose() {
    ComplianceDashboard.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
