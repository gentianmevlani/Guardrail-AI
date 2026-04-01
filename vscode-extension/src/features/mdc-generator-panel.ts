/**
 * MDC Generator Panel
 *
 * Enterprise feature for generating Markdown Context (MDC) documentation
 * from the codebase with hallucination detection and source verification.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../services/api-client';
import { CLIService } from '../services/cli-service';
import { getGuardrailPanelHead } from '../webview-shared-styles';
<<<<<<< HEAD
import { mdcGeneratorStitchCss } from './mdc-generator-stitch-css';
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { mapContextJsonToMdcResults } from '../scan-cli-map';

export interface MDCResult {
  fileName: string;
  title: string;
  category: string;
  importanceScore: number;
  confidence: number;
  riskScore: number;
  components: Array<{
    name: string;
    type: string;
    path: string;
    verificationScore: number;
  }>;
  patterns: Array<{
    name: string;
    type: string;
    confidence: number;
  }>;
}

export class MDCGeneratorPanel {
  public static currentPanel: MDCGeneratorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _results: MDCResult[] = [];
  private _isGenerating: boolean = false;
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
          case 'generate':
            await this._generateMDC(message.options);
            break;
          case 'openFile':
            await this._openFile(message.file);
            break;
          case 'refresh':
            await this._loadExistingSpecs();
            break;
          case 'export':
            await this._exportReport();
            break;
        }
      },
      null,
      this._disposables
    );

    // Load existing specs on init
    this._loadExistingSpecs();
  }

  public static createOrShow(workspacePath: string, extensionContext: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (MDCGeneratorPanel.currentPanel) {
      MDCGeneratorPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'mdcGenerator',
      'MDC Generator - Codebase Documentation',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    MDCGeneratorPanel.currentPanel = new MDCGeneratorPanel(panel, workspacePath, extensionContext);
  }

  private async _generateMDC(options: {
    depth: 'shallow' | 'medium' | 'deep';
    categories: string[];
    includeExamples: boolean;
  }) {
    if (this._isGenerating) {
      return;
    }

    this._isGenerating = true;
    this._panel.webview.postMessage({ type: 'generating', progress: 0 });

    try {
      this._panel.webview.postMessage({
        type: 'progress',
        message: 'Running guardrail context --json...',
        progress: 25,
      });

      let results: MDCResult[] = [];

      const cliResult = await this._cliService.runContextStdoutJson();
      if (cliResult.success && cliResult.data) {
        results = mapContextJsonToMdcResults(cliResult.data) as MDCResult[];
        if (options.categories.length > 0) {
          results = results.filter((r) =>
            options.categories.includes(r.category),
          );
        }
        this._panel.webview.postMessage({
          type: 'progress',
          message: 'Context JSON loaded',
          progress: 100,
        });
      }

      if (results.length === 0) {
        this._panel.webview.postMessage({
          type: 'progress',
          message: 'Trying API…',
          progress: 50,
        });
        const isConnected = await this._apiClient.testConnection();
        if (isConnected) {
          const response = await this._apiClient.generateMDC(this._workspacePath, {
            depth: options.depth,
            categories: options.categories,
            includeExamples: options.includeExamples,
          });
          if (response.success && response.data) {
            results = this._convertAPIMDCData(response.data);
          }
        }
      }

      this._results = results;

      if (this._results.length > 0) {
        await this._saveResults(this._results);
      }

      this._panel.webview.postMessage({
        type: 'complete',
        results: this._results
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to generate MDC';
      this._panel.webview.postMessage({
        type: 'error',
        message: msg
      });
    } finally {
      this._isGenerating = false;
    }
  }

  private _convertAPIMDCData(apiData: any): MDCResult[] {
    return (apiData.results || []).map((item: any) => ({
      fileName: item.fileName || 'untitled.md',
      title: item.title || 'Untitled Document',
      category: item.category || 'general',
      importanceScore: item.importanceScore || 50,
      confidence: item.confidence || 0.8,
      riskScore: item.riskScore || 10,
      components: item.components || [],
      patterns: item.patterns || []
    }));
  }

  private async _saveResults(results: MDCResult[]): Promise<void> {
    const specsDir = path.join(this._workspacePath, '.specs');

    try {
      if (!fs.existsSync(specsDir)) {
        fs.mkdirSync(specsDir, { recursive: true });
      }

      // Save index file
      const index = results.map(r => ({
        fileName: r.fileName,
        title: r.title,
        category: r.category,
        importanceScore: r.importanceScore,
        confidence: r.confidence,
        riskScore: r.riskScore,
      }));

      fs.writeFileSync(
        path.join(specsDir, 'specifications.json'),
        JSON.stringify(index, null, 2)
      );

      // Save individual MDC files
      for (const result of results) {
        const content = this._formatMDC(result);
        fs.writeFileSync(path.join(specsDir, result.fileName), content);
      }
    } catch (error) {
      console.error('Failed to save MDC results:', error);
    }
  }

  private _formatMDC(result: MDCResult): string {
    let content = `---\n`;
    content += `description: ${result.title}\n`;
    content += `category: ${result.category}\n`;
    content += `importance: ${result.importanceScore}\n`;
    content += `confidence: ${Math.round(result.confidence * 100)}\n`;
    content += `riskScore: ${result.riskScore}\n`;
    content += `generatedAt: ${new Date().toISOString()}\n`;
    content += `---\n\n`;
    content += `# ${result.title}\n\n`;

    const badge = result.riskScore < 30 ? 'Verified' : result.riskScore < 60 ? 'Medium Risk' : 'High Risk';
    content += `> ${badge} | Confidence: ${Math.round(result.confidence * 100)}% | Risk: ${result.riskScore}%\n\n`;

    content += `## Components (${result.components.length})\n\n`;
    result.components.forEach((comp, i) => {
      const verified = comp.verificationScore >= 0.8 ? '✅' : comp.verificationScore >= 0.6 ? '⚠️' : '❌';
      content += `${i + 1}. ${verified} **${comp.name}** (\`${comp.path}\`)\n`;
      content += `   - Type: ${comp.type}\n`;
      content += `   - Verification: ${Math.round(comp.verificationScore * 100)}%\n\n`;
    });

    if (result.patterns.length > 0) {
      content += `## Detected Patterns\n\n`;
      result.patterns.forEach(p => {
        content += `- **${p.name}** (${p.type}) - ${Math.round(p.confidence * 100)}% confidence\n`;
      });
    }

    content += `\n---\n*Generated by guardrail MDC Generator*\n`;
    return content;
  }

  private async _loadExistingSpecs(): Promise<void> {
    const specsDir = path.join(this._workspacePath, '.specs');
    const indexPath = path.join(specsDir, 'specifications.json');

    try {
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        this._results = JSON.parse(content);
        this._panel.webview.postMessage({
          type: 'existing',
          results: this._results,
          outputDir: specsDir
        });
      }
    } catch (error) {
      // No existing specs
    }
  }

  private async _openFile(filePath: string): Promise<void> {
    const fullPath = path.join(this._workspacePath, '.specs', filePath);
    if (fs.existsSync(fullPath)) {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc);
    }
  }

  private async _exportReport(): Promise<void> {
    const report = this._generateReport();

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, 'mdc-report.md')),
      filters: { 'Markdown': ['md'] }
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, report);
      vscode.window.showInformationMessage('MDC Report exported successfully!');
    }
  }

  private _generateReport(): string {
    let report = `# MDC Generation Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Workspace: ${this._workspacePath}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Specifications: ${this._results.length}\n`;
    const n = this._results.length;
    report += `- Average Confidence: ${n > 0 ? Math.round(this._results.reduce((sum, r) => sum + r.confidence, 0) / n * 100) : 0}%\n`;
    report += `- Average Risk Score: ${n > 0 ? Math.round(this._results.reduce((sum, r) => sum + r.riskScore, 0) / n) : 0}%\n\n`;

    report += `## Specifications\n\n`;
    this._results.forEach(r => {
      report += `### ${r.title}\n`;
      report += `- Category: ${r.category}\n`;
      report += `- Importance: ${r.importanceScore}/100\n`;
      report += `- Confidence: ${Math.round(r.confidence * 100)}%\n`;
      report += `- Components: ${r.components.length}\n`;
      report += `- Patterns: ${r.patterns.map(p => p.name).join(', ') || 'None detected'}\n\n`;
    });

    return report;
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
  <title>Prism MDC</title>
  ${getGuardrailPanelHead(mdcGeneratorStitchCss)}
</head>
<body class="ka-dashboard-body ka-panel-page mdc-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="mdc-cyber-grid" aria-hidden="true"></div>
  <div class="mdc-shell">
  <header class="mdc-head">
    <div class="mdc-head-icon" aria-hidden="true">📋</div>
    <div>
      <h1 class="mdc-title">Prism MDC</h1>
      <p class="mdc-sub">Generate verified codebase documentation with hallucination detection.</p>
    </div>
  </header>
=======
  <title>MDC Generator</title>
  ${getGuardrailPanelHead(`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body.ka-dashboard-body {
      font-family: 'Inter', sans-serif;
      padding: 0;
      background: var(--background);
      color: var(--on-surface);
    }
    .ka-shell { padding: 16px; }
    .header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .logo { font-size: 32px; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { color: var(--on-surface-variant); font-size: 14px; }
    .controls {
      background: var(--surface-container-low);
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .control-row {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }
    .control-group { flex: 1; min-width: 200px; }
    .control-group label {
      display: block;
      margin-bottom: 5px;
      font-size: 12px;
      color: var(--on-surface-variant);
    }
    select, input[type="checkbox"] {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      color: var(--on-surface);
      padding: 8px;
      border-radius: 4px;
      width: 100%;
    }
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 5px;
      background: var(--surface-container-high);
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
    .checkbox-item input { width: auto; }
    .btn {
      background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
      color: #001f24;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn:hover { filter: brightness(1.08); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--surface-container-high);
      color: var(--on-surface);
      border: 1px solid var(--border-subtle);
    }
    .button-row {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .progress-container {
      display: none;
      margin: 20px 0;
      padding: 20px;
      background: var(--surface-container-low);
      border-radius: 8px;
    }
    .progress-bar {
      height: 8px;
      background: var(--surface-container-highest);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary-container), var(--secondary-container));
      transition: width 0.3s ease;
    }
    .results {
      display: none;
    }
    .result-card {
      background: var(--surface-container-low);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .result-card:hover { transform: translateX(5px); }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .result-title { font-weight: bold; font-size: 16px; }
    .result-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    .badge-low { background: #6bcb77; color: #000; }
    .badge-medium { background: #ffd93d; color: #000; }
    .badge-high { background: #ff6b6b; color: #000; }
    .result-meta {
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: var(--on-surface-variant);
    }
    .patterns-list {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .pattern-tag {
      background: var(--surface-container-high);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: linear-gradient(135deg, rgba(107, 203, 119, 0.1) 0%, rgba(107, 203, 119, 0.05) 100%);
      border: 1px solid rgba(107, 203, 119, 0.3);
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-value { font-size: 28px; font-weight: bold; color: #6bcb77; }
    .summary-label { font-size: 12px; color: var(--on-surface-variant); }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--on-surface-variant);
    }
    .empty-icon { font-size: 48px; margin-bottom: 15px; }
  `)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <div class="header">
    <span class="logo">📋</span>
    <div>
      <div class="title">MDC Generator</div>
      <div class="subtitle">Generate verified codebase documentation with hallucination detection</div>
    </div>
  </div>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

  <div class="controls">
    <div class="control-row">
      <div class="control-group">
        <label>Analysis Depth</label>
        <select id="depth">
          <option value="shallow">Shallow - Quick overview</option>
          <option value="medium" selected>Medium - Balanced analysis</option>
          <option value="deep">Deep - Comprehensive scan</option>
        </select>
      </div>
      <div class="control-group">
        <label>Include Code Examples</label>
        <select id="examples">
          <option value="true" selected>Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    </div>

    <div class="control-row">
      <div class="control-group" style="flex: 2;">
        <label>Categories to Generate</label>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" value="architecture" checked> Architecture
          </label>
          <label class="checkbox-item">
            <input type="checkbox" value="security" checked> Security
          </label>
          <label class="checkbox-item">
            <input type="checkbox" value="design-system" checked> Design System
          </label>
          <label class="checkbox-item">
            <input type="checkbox" value="integration" checked> Integration
          </label>
          <label class="checkbox-item">
            <input type="checkbox" value="data-flow" checked> Data Flow
          </label>
          <label class="checkbox-item">
            <input type="checkbox" value="utility" checked> Utility
          </label>
        </div>
      </div>
    </div>

    <div class="button-row">
      <button class="btn" id="generateBtn" onclick="generate()">
        <span>🚀</span> Generate MDC Files
      </button>
      <button class="btn btn-secondary" onclick="refresh()">
        <span>🔄</span> Refresh
      </button>
      <button class="btn btn-secondary" id="exportBtn" onclick="exportReport()" disabled>
        <span>📤</span> Export Report
      </button>
    </div>
  </div>

  <div class="progress-container" id="progressContainer">
    <div id="progressMessage">Initializing...</div>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
  </div>

  <div class="results" id="resultsContainer">
    <div class="summary-cards" id="summaryCards"></div>
    <div id="resultsList"></div>
  </div>

  <div class="empty-state" id="emptyState">
    <div class="empty-icon">📋</div>
    <h3>No MDC Files Generated Yet</h3>
    <p>Configure your options above and click "Generate MDC Files" to create codebase documentation.</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function generate() {
      const depth = document.getElementById('depth').value;
      const includeExamples = document.getElementById('examples').value === 'true';
      const checkboxes = document.querySelectorAll('.checkbox-group input:checked');
      const categories = Array.from(checkboxes).map(cb => cb.value);

      document.getElementById('generateBtn').disabled = true;
      vscode.postMessage({
        command: 'generate',
        options: { depth, categories, includeExamples }
      });
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function exportReport() {
      vscode.postMessage({ command: 'export' });
    }

    function openFile(fileName) {
      vscode.postMessage({ command: 'openFile', file: fileName });
    }

    function showResults(results, outputDir) {
      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('resultsContainer').style.display = 'block';
      document.getElementById('exportBtn').disabled = false;

      // Summary cards
      const totalComponents = results.reduce((sum, r) => sum + (r.components?.length || 0), 0);
      const avgConfidence = Math.round(results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length * 100);
      const avgRisk = Math.round(results.reduce((sum, r) => sum + (r.riskScore || 0), 0) / results.length);

      document.getElementById('summaryCards').innerHTML = \`
        <div class="summary-card">
          <div class="summary-value">\${results.length}</div>
          <div class="summary-label">Specifications</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">\${totalComponents}</div>
          <div class="summary-label">Components</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">\${avgConfidence}%</div>
          <div class="summary-label">Avg Confidence</div>
        </div>
        <div class="summary-card">
          <div class="summary-value" style="color: \${avgRisk < 30 ? '#6bcb77' : avgRisk < 60 ? '#ffd93d' : '#ff6b6b'}">\${avgRisk}%</div>
          <div class="summary-label">Avg Risk</div>
        </div>
      \`;

      // Results list
      document.getElementById('resultsList').innerHTML = results.map(r => {
        const badgeClass = r.riskScore < 30 ? 'badge-low' : r.riskScore < 60 ? 'badge-medium' : 'badge-high';
        const badgeText = r.riskScore < 30 ? 'Verified' : r.riskScore < 60 ? 'Medium Risk' : 'High Risk';

        return \`
          <div class="result-card" onclick="openFile('\${r.fileName}')">
            <div class="result-header">
              <span class="result-title">\${r.title}</span>
              <span class="result-badge \${badgeClass}">\${badgeText}</span>
            </div>
            <div class="result-meta">
              <span>📁 \${r.category}</span>
              <span>⭐ Importance: \${r.importanceScore}</span>
              <span>✅ Confidence: \${Math.round((r.confidence || 0) * 100)}%</span>
              <span>📦 \${r.components?.length || 0} components</span>
            </div>
            \${r.patterns?.length > 0 ? \`
              <div class="patterns-list">
                \${r.patterns.map(p => \`<span class="pattern-tag">\${p.name}</span>\`).join('')}
              </div>
            \` : ''}
          </div>
        \`;
      }).join('');
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'generating':
        case 'progress':
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressMessage').textContent = message.message || 'Generating...';
          document.getElementById('progressFill').style.width = (message.progress || 0) + '%';
          break;

        case 'complete':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('generateBtn').disabled = false;
          showResults(message.results, message.outputDir);
          break;

        case 'existing':
          if (message.results && message.results.length > 0) {
            showResults(message.results, message.outputDir);
          }
          break;

        case 'error':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('generateBtn').disabled = false;
          alert('Error: ' + message.message);
          break;
      }
    });
  </script>
  </div>
</body>
</html>`;
  }

  public dispose() {
    MDCGeneratorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
