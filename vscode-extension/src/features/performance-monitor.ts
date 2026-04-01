/**
 * Performance Monitoring with CodeLens Insights
 *
 * Enterprise feature for real-time performance monitoring
 * and code optimization suggestions directly in the editor.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ApiClient } from "../services/api-client";
import { CLIService } from "../services/cli-service";
import { getGuardrailPanelHead } from "../webview-shared-styles";
<<<<<<< HEAD
import { performanceMonitorStitchCss } from "./performance-monitor-stitch-css";
import { getPerformanceMonitorNexusHtml } from "./performance-monitor-webview-html";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { buildPerformanceMetricsFromScan } from "../scan-cli-map";

export interface PerformanceMetric {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'render';
  value: number;
  unit: string;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  timestamp: string;
}

export interface CodeLensInsight {
  range: vscode.Range;
  command: vscode.Command;
  priority: 'high' | 'medium' | 'low';
  type: 'performance' | 'security' | 'maintainability' | 'best-practice';
  message: string;
  suggestion: string;
}

export interface PerformanceData {
  timestamp: string;
  metrics: PerformanceMetric[];
  summary: {
    averageCPU: number;
    averageMemory: number;
    averageIO: number;
    issues: number;
  };
}

export class PerformanceMonitor {
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _statusBarItem: vscode.StatusBarItem;
  private _metrics: PerformanceMetric[] = [];
  private _codeLensProvider: PerformanceCodeLensProvider;
  private _cliService: CLIService;

  constructor(workspacePath: string) {
    this._workspacePath = workspacePath;
    this._cliService = new CLIService(workspacePath);
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this._codeLensProvider = new PerformanceCodeLensProvider();

    this._setupEventListeners();
    this._registerCodeLensProvider();
    this._startMonitoring();
  }

  private _setupEventListeners() {
    // Monitor file changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this._analyzeDocument(event.document);
      })
    );

    // Monitor active editor changes
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this._analyzeDocument(editor.document);
        }
      })
    );

    // Monitor save events
    this._disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        this._analyzeDocument(document);
      })
    );
  }

  private _registerCodeLensProvider() {
    const selector = {
      scheme: 'file',
      pattern: '**/*.{ts,tsx,js,jsx,py,java,cpp,c}'
    };

    this._disposables.push(
      vscode.languages.registerCodeLensProvider(selector, this._codeLensProvider)
    );
  }

  private _startMonitoring() {
    setInterval(() => {
      void this._refreshMetricsFromScan();
    }, 5000);
    void this._refreshMetricsFromScan();
  }

  private async _refreshMetricsFromScan(): Promise<void> {
    const cli = await this._cliService.runScanJson();
    if (cli.data) {
      this._metrics = buildPerformanceMetricsFromScan(cli.data);
    } else {
      this._metrics = [];
    }
    this._updateStatusBar();
  }

  private async _analyzeDocument(document: vscode.TextDocument) {
    if (document.languageId === 'typescript' || document.languageId === 'javascript') {
      const insights = await this._generateCodeInsights(document);
      this._codeLensProvider.updateInsights(document.uri, insights);
    }
  }

  private async _generateCodeInsights(document: vscode.TextDocument): Promise<CodeLensInsight[]> {
    const insights: CodeLensInsight[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i;

      // Performance patterns
      if (line.includes('forEach') && line.includes('await')) {
        insights.push({
          range: new vscode.Range(lineNum, 0, lineNum, line.length),
          command: {
            title: '⚠️ Inefficient async forEach',
            command: 'performance.suggestFix',
            arguments: [
              document.uri,
              lineNum,
              'Use Promise.all() or for...of loop for better performance'
            ]
          },
          priority: 'high',
          type: 'performance',
          message: 'Async forEach can cause performance issues',
          suggestion: 'Replace with Promise.all() or for...of loop'
        });
      }

      if (line.includes('console.log') && !line.includes('//')) {
        insights.push({
          range: new vscode.Range(lineNum, 0, lineNum, line.length),
          command: {
            title: '📝 Console.log in production',
            command: 'performance.suggestFix',
            arguments: [
              document.uri,
              lineNum,
              'Remove or replace with proper logging'
            ]
          },
          priority: 'medium',
          type: 'best-practice',
          message: 'Console.log statements in production code',
          suggestion: 'Use proper logging library or remove'
        });
      }

      if (line.includes('useState') && line.includes('useState') && line.includes('useState')) {
        insights.push({
          range: new vscode.Range(lineNum, 0, lineNum, line.length),
          command: {
            title: '🔄 Multiple useState calls',
            command: 'performance.suggestFix',
            arguments: [
              document.uri,
              lineNum,
              'Consider combining related state into useReducer'
            ]
          },
          priority: 'medium',
          type: 'performance',
          message: 'Multiple useState calls could be optimized',
          suggestion: 'Combine related state with useReducer'
        });
      }

      if (line.includes('useEffect') && !line.includes('[]')) {
        const hasDependency = line.includes('[') && line.includes(']');
        if (!hasDependency) {
          insights.push({
            range: new vscode.Range(lineNum, 0, lineNum, line.length),
            command: {
              title: '⚠️ useEffect without dependencies',
              command: 'performance.suggestFix',
              arguments: [
                document.uri,
                lineNum,
                'Add dependency array to prevent unnecessary re-renders'
              ]
            },
            priority: 'high',
            type: 'performance',
            message: 'useEffect without dependency array',
            suggestion: 'Add proper dependency array'
          });
        }
      }

      // Memory leak patterns
      if (line.includes('addEventListener') && !line.includes('removeEventListener')) {
        insights.push({
          range: new vscode.Range(lineNum, 0, lineNum, line.length),
          command: {
            title: '🔥 Potential memory leak',
            command: 'performance.suggestFix',
            arguments: [
              document.uri,
              lineNum,
              'Remember to remove event listeners in cleanup'
            ]
          },
          priority: 'high',
          type: 'performance',
          message: 'Event listener without cleanup',
          suggestion: 'Add removeEventListener in cleanup function'
        });
      }

      // Security patterns
      if (line.includes('eval(') && !line.includes('//')) {
        insights.push({
          range: new vscode.Range(lineNum, 0, lineNum, line.length),
          command: {
            title: '🚨 Security risk: eval()',
            command: 'performance.suggestFix',
            arguments: [
              document.uri,
              lineNum,
              'Avoid eval() - use safer alternatives'
            ]
          },
          priority: 'high',
          type: 'security',
          message: 'eval() poses security risks',
          suggestion: 'Use JSON.parse, Function constructor, or alternative approaches'
        });
      }
    }

    return insights;
  }

  private _updateStatusBar() {
    if (this._metrics.length === 0) {
      this._statusBarItem.text = "$(info) Performance: run guardrail scan";
      this._statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
      this._statusBarItem.backgroundColor = undefined;
      this._statusBarItem.tooltip = 'Click to view details — scan-derived metrics (not OS telemetry)';
      this._statusBarItem.command = 'performance.showDetails';
      this._statusBarItem.show();
      return;
    }

    const criticalIssues = this._metrics.filter(m => m.status === 'critical').length;
    const warningIssues = this._metrics.filter(m => m.status === 'warning').length;

    if (criticalIssues > 0) {
      this._statusBarItem.text = `$(alert) Performance: ${criticalIssues} critical`;
      this._statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (warningIssues > 0) {
      this._statusBarItem.text = `$(warning) Performance: ${warningIssues} warnings`;
      this._statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this._statusBarItem.text = `$(check) Performance: Good`;
      this._statusBarItem.color = new vscode.ThemeColor('statusBarItem.foreground');
      this._statusBarItem.backgroundColor = undefined;
    }

    this._statusBarItem.tooltip = 'Scan-derived risk metrics (not OS CPU/memory)';
    this._statusBarItem.command = 'performance.showDetails';
    this._statusBarItem.show();
  }

  public getMetrics(): PerformanceMetric[] {
    return this._metrics;
  }

  public dispose() {
    this._statusBarItem.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

class PerformanceCodeLensProvider implements vscode.CodeLensProvider {
  private _insights = new Map<string, CodeLensInsight[]>();
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();

  get onDidChangeCodeLenses(): vscode.Event<void> {
    return this._onDidChangeCodeLenses.event;
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const insights = this._insights.get(document.uri.toString()) || [];
    return insights.map(insight => new vscode.CodeLens(insight.range, insight.command));
  }

  updateInsights(uri: vscode.Uri, insights: CodeLensInsight[]) {
    this._insights.set(uri.toString(), insights);
    this._onDidChangeCodeLenses.fire();
  }
}

export class PerformancePanel {
  public static currentPanel: PerformancePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _currentMetrics: PerformanceData | null = null;
  private _isMonitoring: boolean = false;
  private _monitoringInterval: NodeJS.Timeout | null = null;
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
          case 'startMonitoring':
            await this._startMonitoring();
            break;
          case 'stopMonitoring':
            await this._stopMonitoring();
            break;
          case 'refresh':
            await this._refreshMetrics();
            break;
          case 'export':
            await this._exportReport(message.format);
            break;
          case 'getSuggestions':
            await this._getOptimizationSuggestions();
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

    if (PerformancePanel.currentPanel) {
      PerformancePanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'performanceMonitor',
<<<<<<< HEAD
      'Nexus Monitor',
=======
      'Performance Monitor',
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    PerformancePanel.currentPanel = new PerformancePanel(panel, workspacePath, extensionContext);
  }

  private async _startMonitoring(): Promise<void> {
    if (this._isMonitoring) return;

    this._isMonitoring = true;
    this._panel.webview.postMessage({ type: 'monitoring', status: true });

    this._monitoringInterval = setInterval(async () => {
      if (this._panel.visible && this._isMonitoring) {
        await this._refreshMetrics();
      }
    }, 5000);

    await this._refreshMetrics();
  }

  private async _stopMonitoring(): Promise<void> {
    this._isMonitoring = false;
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }
    this._panel.webview.postMessage({ type: 'monitoring', status: false });
  }

  private async _refreshMetrics(): Promise<void> {
    try {
      let metrics: PerformanceMetric[] = [];

      const cli = await this._cliService.runScanJson();
      if (cli.data) {
        metrics = buildPerformanceMetricsFromScan(cli.data);
      }

      if (metrics.length === 0) {
        try {
          const response = await this._apiClient.getPerformanceMetrics(this._workspacePath);
          if (response.success && response.data?.length) {
            metrics = response.data.map((metric: {
              type?: string;
              value?: number;
              unit?: string;
              threshold?: number;
              timestamp?: string;
            }) => ({
              type: (metric.type || "cpu") as PerformanceMetric["type"],
              value: metric.value ?? 0,
              unit: metric.unit || "%",
              threshold: metric.threshold ?? 80,
              status: this._determineStatus(
                metric.value ?? 0,
                metric.threshold ?? 80,
              ),
              timestamp: metric.timestamp || new Date().toISOString(),
            }));
          }
        } catch {
          /* keep empty */
        }
      }

      this._currentMetrics = {
        timestamp: new Date().toISOString(),
        metrics,
        summary: {
          averageCPU: metrics.find(m => m.type === 'cpu')?.value || 0,
          averageMemory: metrics.find(m => m.type === 'memory')?.value || 0,
          averageIO: metrics.find(m => m.type === 'io')?.value || 0,
          issues: metrics.filter(m => m.status !== 'good').length
        }
      };

      this._panel.webview.postMessage({
        type: 'metrics',
        data: this._currentMetrics
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to refresh metrics";
      this._panel.webview.postMessage({
        type: 'error',
        message: msg
      });
    }
  }

  private _determineStatus(value: number, threshold: number): 'good' | 'warning' | 'critical' {
    if (value > threshold) return 'critical';
    if (value > threshold * 0.8) return 'warning';
    return 'good';
  }

  private async _exportReport(format: string): Promise<void> {
    if (!this._currentMetrics) {
      vscode.window.showWarningMessage('No performance data to export. Start monitoring first.');
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, `performance-report-${new Date().toISOString().split('T')[0]}.json`)),
      filters: { 'JSON': ['json'] }
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, JSON.stringify(this._currentMetrics, null, 2));
      vscode.window.showInformationMessage('Performance report exported!');
    }
  }

  private async _getOptimizationSuggestions(): Promise<void> {
    vscode.window.showInformationMessage('Performance optimization suggestions feature coming soon!');
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
<<<<<<< HEAD
    return getPerformanceMonitorNexusHtml(
      getGuardrailPanelHead(performanceMonitorStitchCss),
    );
=======
    const panelCss = `
    .perf-main { padding: 16px; flex: 1; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .metric-value { font-size: 32px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
    .metric-label { color: var(--on-surface-variant); margin-top: 8px; font-size: 12px; }
    .metric-good { color: #6ee7b7; }
    .metric-warning { color: #ffd93d; }
    .metric-critical { color: #ff6b6b; }
    .chart-container {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      height: 280px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--on-surface-variant);
      font-size: 13px;
    }
    .insights-section h3 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--outline);
      margin-bottom: 12px;
    }
    .insight-item {
      padding: 14px 16px;
      border-left: 4px solid;
      margin-bottom: 10px;
      background: var(--surface-container-lowest);
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
    }
    .insight-high { border-left-color: #ff6b6b; }
    .insight-medium { border-left-color: #ffd93d; }
    .insight-low { border-left-color: #6ee7b7; }
    .insight-title { font-weight: 700; margin-bottom: 6px; font-size: 13px; }
    .insight-description { font-size: 12px; color: var(--on-surface-variant); line-height: 1.5; }
    `;
    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Monitor</title>
  ${getGuardrailPanelHead(panelCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <header class="header">
    <div class="header-left">
      <span class="material-symbols-outlined logo" style="font-size:28px;color:var(--cyan-glow);">speed</span>
      <div>
        <div class="title">Performance Monitor</div>
        <div class="subtitle">Real-time metrics · CodeLens insights</div>
      </div>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button type="button" class="btn btn-secondary" onclick="refresh()">
        <span class="material-symbols-outlined" style="font-size:18px;">refresh</span> Refresh
      </button>
      <button type="button" class="btn" onclick="optimize()">
        <span class="material-symbols-outlined" style="font-size:18px;">rocket_launch</span> Optimize
      </button>
      <button type="button" class="btn btn-secondary" onclick="exportReport()">
        <span class="material-symbols-outlined" style="font-size:18px;">upload</span> Export
      </button>
    </div>
  </header>

  <div class="perf-main">
  <div class="metrics-grid" id="metricsGrid">
    <div class="metric-card">
      <div class="metric-value" id="cpuValue">--</div>
      <div class="metric-label">CPU Usage</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="memoryValue">--</div>
      <div class="metric-label">Memory Usage</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="ioValue">--</div>
      <div class="metric-label">I/O Operations</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="networkValue">--</div>
      <div class="metric-label">Network</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="renderValue">--</div>
      <div class="metric-label">Render Time</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" id="scoreValue">--</div>
      <div class="metric-label">Performance Score</div>
    </div>
  </div>

  <div class="chart-container">
    <span class="material-symbols-outlined" style="font-size:48px;opacity:0.35;margin-right:12px;">show_chart</span>
    <span>Charts connect when profiling data is available.</span>
  </div>

  <div class="insights-section">
    <h3>Performance Insights</h3>
    <div id="insightsList">
      <div class="insight-item insight-low">
        <div class="insight-title">Performance is nominal</div>
        <div class="insight-description">No blocking issues detected in the latest sample.</div>
      </div>
    </div>
  </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function optimize() {
      vscode.postMessage({ command: 'getSuggestions' });
    }

    function exportReport() {
      vscode.postMessage({ command: 'export', format: 'json' });
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'metrics':
          updateMetrics(message.data);
          break;
        case 'monitoring':
          updateMonitoringStatus(message.status);
          break;
        case 'error':
          showError(message.message);
          break;
      }
    });

    function updateMetrics(data) {
      if (data.metrics) {
        data.metrics.forEach(metric => {
          const element = document.getElementById(metric.type + 'Value');
          if (element) {
            element.textContent = metric.value + metric.unit;
            element.className = 'metric-value metric-' + metric.status;
          }
        });
      }

      if (data.summary) {
        const scoreElement = document.getElementById('scoreValue');
        if (scoreElement) {
          const score = Math.max(0, 100 - (data.summary.issues * 10));
          scoreElement.textContent = score + '%';
          scoreElement.className = 'metric-value metric-' + (score > 80 ? 'good' : score > 60 ? 'warning' : 'critical');
        }
      }
    }

    function updateMonitoringStatus(isMonitoring) {
      const statusText = isMonitoring ? '🟢 Monitoring Active' : '🔴 Monitoring Stopped';
      console.log(statusText);
    }

    function showError(message) {
      console.error('Performance Monitor Error:', message);
    }

    // Request initial metrics
    refresh();
  </script>
  </div>
</body>
</html>`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  public dispose() {
    PerformancePanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
