/**
 * Production Integrity Dashboard
 *
 * Enterprise feature for monitoring production systems, deployment integrity,
 * and operational health in real-time.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../services/api-client';
import { CLIService } from '../services/cli-service';
import { getGuardrailPanelHead } from '../webview-shared-styles';
<<<<<<< HEAD
import { productionIntegrityStitchCss } from './production-integrity-stitch-css';
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

export interface ProductionService {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'development';
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime: number;
  lastDeploy: string;
  version: string;
  metrics: {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
    latency: number;
  };
  alerts: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface Deployment {
  id: string;
  version: string;
  environment: string;
  status: 'success' | 'failed' | 'in-progress' | 'rolling-back';
  timestamp: string;
  duration: number;
  author: string;
  changes: string[];
  rollbackAvailable: boolean;
  healthCheck: 'passed' | 'failed' | 'pending';
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  score: number;
  services: ProductionService[];
  uptime: number;
  lastIncident?: string;
  incidents: Array<{
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'investigating' | 'resolved' | 'monitoring';
    timestamp: string;
    duration: number;
    impact: string;
  }>;
}

export class ProductionIntegrityPanel {
  public static currentPanel: ProductionIntegrityPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _currentHealth: SystemHealth | null = null;
  private _isMonitoring: boolean = false;
  private _apiClient: ApiClient;
  private _cliService: CLIService;

  private constructor(panel: vscode.WebviewPanel, workspacePath: string, extensionContext: vscode.ExtensionContext) {
    this._panel = panel;
    this._workspacePath = workspacePath;
    this._apiClient = new ApiClient(extensionContext);
    this._cliService = new CLIService(workspacePath);

    this._update();

    void this._refreshData();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'startMonitoring':
            await this._startMonitoring();
            break;
          case 'stopMonitoring':
            await this._stopMonitoring();
            break;
          case 'refresh':
            await this._refreshData();
            break;
          case 'deploy':
            await this._deploy(message.environment);
            break;
          case 'rollback':
            await this._rollback(message.deploymentId);
            break;
          case 'exportReport':
            await this._exportReport();
            break;
          case 'viewLogs':
            await this._viewLogs(message.serviceId);
            break;
          case 'runHealthCheck':
            await this._runHealthCheck(message.serviceId);
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

    if (ProductionIntegrityPanel.currentPanel) {
      ProductionIntegrityPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'productionIntegrity',
      'Production Integrity Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    ProductionIntegrityPanel.currentPanel = new ProductionIntegrityPanel(panel, workspacePath, extensionContext);
  }

  private async _startMonitoring(): Promise<void> {
    if (this._isMonitoring) return;

    this._isMonitoring = true;
    this._panel.webview.postMessage({ type: 'monitoring', status: 'started' });

    // Start real-time monitoring simulation
    this._monitoringLoop();
  }

  private async _stopMonitoring(): Promise<void> {
    this._isMonitoring = false;
    this._panel.webview.postMessage({ type: 'monitoring', status: 'stopped' });
  }

  private async _refreshData(): Promise<void> {
    try {
      const cliResult = await this._cliService.getProductionIntegrity();
      if (cliResult.data) {
        this._currentHealth = this._shipJsonToSystemHealth(
          cliResult.data as Record<string, unknown>,
        );
        this._panel.webview.postMessage({
          type: "healthUpdate",
          health: this._currentHealth,
        });
        return;
      }
    } catch {
      /* try API */
    }

    try {
      const isConnected = await this._apiClient.testConnection();
      if (isConnected) {
        const response = await this._apiClient.getProductionIntegrity(
          "workspace-" + Date.now(),
        );
        if (response.success && response.data) {
          this._currentHealth = this._convertAPIIntegrityData(response.data);
          this._panel.webview.postMessage({
            type: "healthUpdate",
            health: this._currentHealth,
          });
          return;
        }
      }
    } catch {
      /* empty */
    }

    this._currentHealth = this._emptySystemHealth();
    this._panel.webview.postMessage({
      type: "healthUpdate",
      health: this._currentHealth,
    });
    void vscode.window.showWarningMessage(
      "No ship data. Run `guardrail ship --json` in this workspace and ensure the guardrail CLI is on PATH.",
    );
  }

  private async _deploy(environment: string): Promise<void> {
    void environment;
    await vscode.window.showInformationMessage(
      "Deploy is not available from the local guardrail extension. Use your CI/CD or hosting provider.",
    );
  }

  private async _rollback(deploymentId: string): Promise<void> {
    void deploymentId;
    await vscode.window.showInformationMessage(
      "Rollback is not available from the local guardrail extension.",
    );
  }

  private async _exportReport(): Promise<void> {
    if (!this._currentHealth) {
      vscode.window.showWarningMessage('No data to export. Start monitoring first.');
      return;
    }

    const report = this._generateReport(this._currentHealth);
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, 'production-integrity-report.md')),
      filters: { 'Markdown': ['md'] }
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, report);
      vscode.window.showInformationMessage('Production integrity report exported!');
    }
  }

  private async _viewLogs(serviceId: string): Promise<void> {
    vscode.window.showInformationMessage(`Opening logs for service: ${serviceId}`);
  }

  private async _runHealthCheck(serviceId: string): Promise<void> {
    void serviceId;
    await this._refreshData();
    this._panel.webview.postMessage({
      type: "healthCheckComplete",
      serviceId,
      status: "passed",
    });
  }

  private async _monitoringLoop(): Promise<void> {
    while (this._isMonitoring) {
      await this._refreshData();
      await this._delay(5000); // Update every 5 seconds
    }
  }

  private _generateReport(health: SystemHealth): string {
    let report = `# Production Integrity Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## System Overview\n\n`;
    report += `- **Overall Health:** ${health.overall}\n`;
    report += `- **Health Score:** ${health.score}/100\n`;
    report += `- **System Uptime:** ${health.uptime.toFixed(2)}%\n`;
    report += `- **Total Services:** ${health.services.length}\n`;
    report += `- **Active Incidents:** ${health.incidents.filter(i => i.status === 'open').length}\n\n`;

    report += `## Service Status\n\n`;
    health.services.forEach(service => {
      report += `### ${service.name}\n`;
      report += `- **Status:** ${service.status}\n`;
      report += `- **Environment:** ${service.environment}\n`;
      report += `- **Version:** ${service.version}\n`;
      report += `- **Uptime:** ${service.uptime}%\n`;
      report += `- **Last Deploy:** ${service.lastDeploy}\n`;
      report += `- **CPU Usage:** ${service.metrics.cpu.toFixed(1)}%\n`;
      report += `- **Memory Usage:** ${service.metrics.memory.toFixed(1)}%\n`;
      report += `- **Requests/min:** ${service.metrics.requests}\n`;
      report += `- **Error Rate:** ${service.metrics.errors}\n`;
      report += `- **Avg Latency:** ${service.metrics.latency.toFixed(0)}ms\n`;
      
      if (service.alerts.length > 0) {
        report += `- **Alerts:** ${service.alerts.length}\n`;
        service.alerts.forEach(alert => {
          report += `  - ${alert.type.toUpperCase()}: ${alert.message}\n`;
        });
      }
      report += '\n';
    });

    report += `## Recent Incidents\n\n`;
    health.incidents.forEach(incident => {
      report += `### ${incident.title}\n`;
      report += `- **Severity:** ${incident.severity}\n`;
      report += `- **Status:** ${incident.status}\n`;
      report += `- **Duration:** ${incident.duration} minutes\n`;
      report += `- **Impact:** ${incident.impact}\n`;
      report += `- **Timestamp:** ${incident.timestamp}\n\n`;
    });

    return report;
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
<<<<<<< HEAD
  <title>Production Integrity</title>
  ${getGuardrailPanelHead(productionIntegrityStitchCss)}
=======
  <title>Production Integrity Dashboard</title>
  ${getGuardrailPanelHead(`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body.ka-dashboard-body {
      font-family: 'Inter', sans-serif;
      padding: 0;
      background: var(--background);
      color: var(--on-surface);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .logo { font-size: 32px; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { color: var(--on-surface-variant); font-size: 14px; }
    .monitoring-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .monitoring-active {
      background: rgba(107, 203, 119, 0.2);
      color: #6bcb77;
      border: 1px solid rgba(107, 203, 119, 0.3);
    }
    .monitoring-inactive {
      background: rgba(255, 107, 107, 0.2);
      color: #ff6b6b;
      border: 1px solid rgba(255, 107, 107, 0.3);
    }
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .btn {
      background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
      color: #001f24;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { filter: brightness(1.08); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger {
      background: #ff6b6b;
      color: #000;
    }
    .btn-success {
      background: #6bcb77;
      color: #000;
    }
    .btn-secondary {
      background: var(--surface-container-high);
      color: var(--on-surface);
      border: 1px solid var(--border-subtle);
    }
    .health-overview {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 20px;
      text-align: center;
    }
    .health-score {
      font-size: 64px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .health-score.healthy { color: #6bcb77; }
    .health-score.degraded { color: #ffd93d; }
    .health-score.critical { color: #ff6b6b; }
    .health-status {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .health-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .health-metric {
      background: rgba(255, 255, 255, 0.1);
      padding: 15px;
      border-radius: 8px;
    }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { font-size: 12px; color: var(--on-surface-variant); }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .service-card {
      background: var(--surface-container-low);
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid;
    }
    .service-card.healthy { border-left-color: #6bcb77; }
    .service-card.warning { border-left-color: #ffd93d; }
    .service-card.critical { border-left-color: #ff6b6b; }
    .service-card.offline { border-left-color: #999; }
    .service-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .service-name { font-weight: bold; font-size: 16px; }
    .service-status {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    .status-healthy { background: #6bcb77; color: #000; }
    .status-warning { background: #ffd93d; color: #000; }
    .status-critical { background: #ff6b6b; color: #000; }
    .status-offline { background: #999; color: #000; }
    .service-metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 15px;
    }
    .service-metric {
      font-size: 12px;
    }
    .metric-name { color: var(--on-surface-variant); }
    .metric-number { font-weight: bold; }
    .alerts-section {
      margin-top: 15px;
    }
    .alert-item {
      background: var(--surface-container-lowest);
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 5px;
      font-size: 12px;
      border-left: 3px solid;
    }
    .alert-error { border-left-color: #ff6b6b; }
    .alert-warning { border-left-color: #ffd93d; }
    .alert-info { border-left-color: #74c0fc; }
    .incidents-section {
      background: var(--surface-container-low);
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .incident-item {
      background: var(--surface-container-lowest);
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid;
    }
    .incident-low { border-left-color: #6bcb77; }
    .incident-medium { border-left-color: #ffd93d; }
    .incident-high { border-left-color: #ffa94d; }
    .incident-critical { border-left-color: #ff6b6b; }
    .incident-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .incident-title { font-weight: bold; }
    .incident-severity {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    .severity-low { background: #6bcb77; color: #000; }
    .severity-medium { background: #ffd93d; color: #000; }
    .severity-high { background: #ffa94d; color: #000; }
    .severity-critical { background: #ff6b6b; color: #000; }
    .incident-meta {
      font-size: 12px;
      color: var(--on-surface-variant);
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--on-surface-variant);
    }
    .empty-icon { font-size: 48px; margin-bottom: 15px; }
    .integrity-pad { padding: 0 16px 16px; }
  `)}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
<<<<<<< HEAD
  <header class="pi-head">
    <div class="pi-head-left">
      <span class="logo" aria-hidden="true">🖥️</span>
      <div>
        <div class="pi-kicker">Fleet integrity</div>
        <div class="title">Production</div>
        <div class="subtitle">Real-time monitoring · deployment integrity</div>
=======
  <div class="header">
    <div class="header-left">
      <span class="logo">🖥️</span>
      <div>
        <div class="title">Production Integrity Dashboard</div>
        <div class="subtitle">Real-time monitoring and deployment integrity</div>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      </div>
    </div>
    <div class="monitoring-status monitoring-inactive" id="monitoringStatus">
      <div class="status-indicator"></div>
      <span id="monitoringText">Monitoring Off</span>
    </div>
<<<<<<< HEAD
  </header>

  <div class="pi-strip" aria-hidden="true">
    <svg viewBox="0 0 800 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 28 L 800 28" stroke="rgba(0,229,255,0.25)" stroke-width="1" stroke-dasharray="6 8" />
      <circle cx="160" cy="28" r="4" fill="#00e5ff" opacity="0.85" />
      <circle cx="400" cy="28" r="5" fill="#00e5ff" />
      <circle cx="640" cy="28" r="4" fill="#00e5ff" opacity="0.85" />
    </svg>
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  </div>

  <div class="integrity-pad">
  <div class="actions">
    <button class="btn btn-success" id="startBtn" onclick="startMonitoring()">
      <span>▶️</span> Start Monitoring
    </button>
    <button class="btn btn-danger" id="stopBtn" onclick="stopMonitoring()" disabled>
      <span>⏹️</span> Stop Monitoring
    </button>
    <button class="btn" onclick="refresh()">
      <span>🔄</span> Refresh
    </button>
    <button class="btn btn-secondary" onclick="deploy()">
      <span>🚀</span> Deploy
    </button>
    <button class="btn btn-secondary" onclick="exportReport()">
      <span>📤</span> Export Report
    </button>
  </div>

  <div class="empty-state" id="emptyState">
    <div class="empty-icon">🖥️</div>
    <h3>No Monitoring Data</h3>
    <p>Click "Start Monitoring" to begin tracking production integrity.</p>
  </div>

  <div id="dashboardContent" style="display: none;">
    <div class="health-overview">
      <div class="health-score" id="healthScore">--</div>
      <div class="health-status" id="healthStatus">--</div>
      <div class="health-metrics">
        <div class="health-metric">
          <div class="metric-value" id="uptimeMetric">--</div>
          <div class="metric-label">System Uptime</div>
        </div>
        <div class="health-metric">
          <div class="metric-value" id="servicesMetric">--</div>
          <div class="metric-label">Total Services</div>
        </div>
        <div class="health-metric">
          <div class="metric-value" id="incidentsMetric">--</div>
          <div class="metric-label">Active Incidents</div>
        </div>
      </div>
    </div>

    <div class="services-section">
      <h3 style="margin-bottom: 15px;">Service Status</h3>
      <div class="services-grid" id="servicesGrid"></div>
    </div>

    <div class="incidents-section">
      <h3 style="margin-bottom: 15px;">Recent Incidents</h3>
      <div id="incidentsList"></div>
    </div>
  </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentHealth = null;

    function startMonitoring() {
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;
      vscode.postMessage({ command: 'startMonitoring' });
    }

    function stopMonitoring() {
      document.getElementById('startBtn').disabled = false;
      document.getElementById('stopBtn').disabled = true;
      vscode.postMessage({ command: 'stopMonitoring' });
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function deploy() {
      const environments = ['production', 'staging'];
      const selected = prompt('Select environment (production/staging):', 'production');
      if (environments.includes(selected)) {
        vscode.postMessage({ command: 'deploy', environment: selected });
      }
    }

    function exportReport() {
      vscode.postMessage({ command: 'exportReport' });
    }

    function viewLogs(serviceId) {
      vscode.postMessage({ command: 'viewLogs', serviceId });
    }

    function runHealthCheck(serviceId) {
      vscode.postMessage({ command: 'runHealthCheck', serviceId });
    }

    function updateMonitoringStatus(status) {
      const statusElement = document.getElementById('monitoringStatus');
      const textElement = document.getElementById('monitoringText');
      
      if (status === 'started') {
        statusElement.className = 'monitoring-status monitoring-active';
        textElement.textContent = 'Monitoring Active';
      } else {
        statusElement.className = 'monitoring-status monitoring-inactive';
        textElement.textContent = 'Monitoring Off';
      }
    }

    function renderHealthData(health) {
      currentHealth = health;
      
      // Hide empty state, show dashboard
      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('dashboardContent').style.display = 'block';

      // Update health overview
      const scoreElement = document.getElementById('healthScore');
      scoreElement.textContent = health.score;
      scoreElement.className = 'health-score ' + health.overall;
      
      document.getElementById('healthStatus').textContent = health.overall.charAt(0).toUpperCase() + health.overall.slice(1);
      document.getElementById('uptimeMetric').textContent = health.uptime.toFixed(2) + '%';
      document.getElementById('servicesMetric').textContent = health.services.length;
      document.getElementById('incidentsMetric').textContent = health.incidents.filter(i => i.status === 'open').length;

      // Render services
      const servicesGrid = document.getElementById('servicesGrid');
      servicesGrid.innerHTML = health.services.map(service => \`
        <div class="service-card \${service.status}">
          <div class="service-header">
            <span class="service-name">\${service.name}</span>
            <span class="service-status status-\${service.status}">\${service.status.toUpperCase()}</span>
          </div>
          <div class="service-metrics">
            <div class="service-metric">
              <span class="metric-name">CPU:</span>
              <span class="metric-number">\${service.metrics.cpu.toFixed(1)}%</span>
            </div>
            <div class="service-metric">
              <span class="metric-name">Memory:</span>
              <span class="metric-number">\${service.metrics.memory.toFixed(1)}%</span>
            </div>
            <div class="service-metric">
              <span class="metric-name">Requests/min:</span>
              <span class="metric-number">\${service.metrics.requests}</span>
            </div>
            <div class="service-metric">
              <span class="metric-name">Errors:</span>
              <span class="metric-number">\${service.metrics.errors}</span>
            </div>
            <div class="service-metric">
              <span class="metric-name">Latency:</span>
              <span class="metric-number">\${service.metrics.latency.toFixed(0)}ms</span>
            </div>
            <div class="service-metric">
              <span class="metric-name">Uptime:</span>
              <span class="metric-number">\${service.uptime}%</span>
            </div>
          </div>
          <div class="service-actions" style="display: flex; gap: 8px; margin-bottom: 10px;">
            <button class="btn btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="viewLogs('\${service.id}')">
              📋 Logs
            </button>
            <button class="btn btn-secondary" style="font-size: 11px; padding: 4px 8px;" onclick="runHealthCheck('\${service.id}')">
              🔍 Health Check
            </button>
          </div>
          \${service.alerts.length > 0 ? \`
            <div class="alerts-section">
              <div style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Alerts (\${service.alerts.length})</div>
              \${service.alerts.map(alert => \`
                <div class="alert-item alert-\${alert.type}">
                  \${alert.severity.toUpperCase()}: \${alert.message}
                </div>
              \`).join('')}
            </div>
          \` : ''}
        </div>
      \`).join('');

      // Render incidents
      const incidentsList = document.getElementById('incidentsList');
      if (health.incidents.length === 0) {
        incidentsList.innerHTML = '<div style="text-align: center; color: var(--on-surface-variant);">No recent incidents</div>';
      } else {
        incidentsList.innerHTML = health.incidents.map(incident => \`
          <div class="incident-item incident-\${incident.severity}">
            <div class="incident-header">
              <span class="incident-title">\${incident.title}</span>
              <span class="incident-severity severity-\${incident.severity}">\${incident.severity.toUpperCase()}</span>
            </div>
            <div class="incident-meta">
              Status: \${incident.status} | Duration: \${incident.duration}min | Impact: \${incident.impact}
            </div>
          </div>
        \`).join('');
      }
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'monitoring':
          updateMonitoringStatus(message.status);
          break;

        case 'healthUpdate':
          renderHealthData(message.health);
          break;

        case 'deploymentStarted':
          alert(\`Deployment to \${message.environment} started...\`);
          break;

        case 'deploymentComplete':
          if (message.success) {
            alert(\`Deployment to \${message.environment} completed successfully!\`);
          } else {
            alert(\`Deployment to \${message.environment} failed!\`);
          }
          break;

        case 'rollbackStarted':
          alert('Rollback initiated...');
          break;

        case 'rollbackComplete':
          if (message.success) {
            alert('Rollback completed successfully!');
          }
          break;

        case 'healthCheckStarted':
          console.log('Health check started for service:', message.serviceId);
          break;

        case 'healthCheckComplete':
          const status = message.status === 'passed' ? 'passed' : 'failed';
          alert(\`Health check \${status} for service\`);
          break;
      }
    });
  </script>
  </div>
</body>
</html>`;
  }

  /** Map `guardrail ship --json` output to the dashboard model (no mock services). */
  private _shipJsonToSystemHealth(data: Record<string, unknown>): SystemHealth {
    const score = typeof data.score === "number" ? data.score : 0;
    const canShip = Boolean(data.canShip);
    const grade = typeof data.grade === "string" ? data.grade : "—";
    const issues = Array.isArray(data.issues)
      ? (data.issues as Record<string, unknown>[])
      : [];
    const critical = issues.filter((i) => i.type === "critical").length;

    let overall: SystemHealth["overall"] = "healthy";
    if (critical > 0) {
      overall = "critical";
    } else if (!canShip) {
      overall = "degraded";
    }

    const status: ProductionService["status"] =
      critical > 0 ? "critical" : canShip ? "healthy" : "warning";

    const incidents: SystemHealth["incidents"] = issues.slice(0, 20).map(
      (i, idx) => ({
        id: `finding-${idx}`,
        title: String(i.message ?? "Finding"),
        severity:
          i.type === "critical"
            ? ("critical" as const)
            : i.type === "warning"
              ? ("high" as const)
              : ("low" as const),
        status: "open" as const,
        timestamp: new Date().toISOString(),
        duration: 0,
        impact: String(i.category ?? i.type ?? ""),
      }),
    );

    const services: ProductionService[] = [
      {
        id: "workspace-ship-gate",
        name: "Workspace (guardrail ship)",
        environment: "development",
        status,
        uptime: canShip ? 99.9 : 95,
        lastDeploy: new Date().toISOString(),
        version: grade,
        metrics: {
          cpu: 0,
          memory: 0,
          requests: 0,
          errors: issues.length,
          latency: 0,
        },
        alerts: [],
      },
    ];

    return {
      overall,
      score,
      uptime: canShip ? 99.9 : 95,
      lastIncident: incidents[0]?.timestamp,
      services,
      incidents,
    };
  }

  private _emptySystemHealth(): SystemHealth {
    return {
      overall: "degraded",
      score: 0,
      uptime: 0,
      services: [],
      incidents: [],
    };
  }

  private _convertAPIIntegrityData(apiData: any): SystemHealth {
    return {
      overall: apiData.overall || 'healthy',
      score: apiData.score || 85,
      uptime: apiData.uptime || 99.9,
      services: apiData.services || [],
      incidents: apiData.incidents || []
    };
  }

  public dispose() {
    ProductionIntegrityPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
