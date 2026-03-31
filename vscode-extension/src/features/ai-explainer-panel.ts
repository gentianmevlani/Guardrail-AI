/**
 * AI Code Explainer
 *
 * Enterprise feature for AI-powered code explanation and documentation
 * generation with natural language processing.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../services/api-client';
import { CLIService } from '../services/cli-service';
import { getGuardrailPanelHead } from '../webview-shared-styles';

export interface CodeExplanation {
  id: string;
  summary: string;
  purpose: string;
  keyComponents: Array<{
    name: string;
    description: string;
    line: number;
  }>;
  patterns: Array<{
    name: string;
    description: string;
    confidence: number;
  }>;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
  suggestions: string[];
}

export interface ExplanationRequest {
  code: string;
  language: string;
  context?: string;
  includeExamples: boolean;
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  /** When set, runs `guardrail explain <id>` (CLI); API path uses code + language. */
  findingId?: string;
}

export class AIExplainerPanel {
  public static currentPanel: AIExplainerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _currentExplanation: CodeExplanation | null = null;
  private _isExplaining: boolean = false;
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
          case 'explain':
            await this._explainCode(message.request);
            break;
          case 'explainSelection':
            await this._explainSelection();
            break;
          case 'explainFile':
            await this._explainCurrentFile();
            break;
          case 'export':
            await this._exportExplanation();
            break;
          case 'generateDocs':
            await this._generateDocumentation();
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

    if (AIExplainerPanel.currentPanel) {
      AIExplainerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'aiExplainer',
      'AI Code Explainer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    AIExplainerPanel.currentPanel = new AIExplainerPanel(panel, workspacePath, extensionContext);
  }

  private async _explainCode(request: ExplanationRequest): Promise<void> {
    if (this._isExplaining) return;

    this._isExplaining = true;
    this._panel.webview.postMessage({ type: 'explaining', progress: 0 });

    try {
      let explanation: CodeExplanation;

      const findingId = request.findingId?.trim();
      if (findingId) {
        this._panel.webview.postMessage({
          type: 'progress',
          message: 'Running guardrail explain…',
          progress: 40,
        });
        const cli = await this._cliService.runExplainFinding(findingId);
        if (cli.success && cli.data?.text) {
          explanation = this._explainTextToCodeExplanation(
            cli.data.text,
            findingId,
          );
        } else {
          throw new Error(
            cli.error ?? "guardrail explain produced no output",
          );
        }
      } else {
        this._panel.webview.postMessage({
          type: 'progress',
          message: 'Calling API…',
          progress: 40,
        });
        const isConnected = await this._apiClient.testConnection();
        if (!isConnected) {
          throw new Error(
            'Enter a finding ID (from `guardrail scan --json`) for CLI explain, or configure the Guardrail API for code-based explain.',
          );
        }
        const response = await this._apiClient.explainCode(
          request.code,
          request.language,
          request.detailLevel,
        );
        if (response.success && response.data) {
          explanation = this._convertAPIResultToExplanation(
            response.data as Record<string, unknown>,
            request,
          );
        } else {
          throw new Error('API returned no explanation');
        }
      }

      this._currentExplanation = explanation;

      this._panel.webview.postMessage({
        type: 'complete',
        explanation: this._currentExplanation,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to explain code';
      this._panel.webview.postMessage({
        type: 'error',
        message,
      });
    } finally {
      this._isExplaining = false;
    }
  }

  private _explainTextToCodeExplanation(
    text: string,
    findingId: string,
  ): CodeExplanation {
    const trimmed = text.trim();
    return {
      id: findingId,
      summary: trimmed,
      purpose: `Output of \`guardrail explain ${findingId}\``,
      keyComponents: [],
      patterns: [],
      complexity: 'moderate',
      estimatedTime: '—',
      suggestions: [],
    };
  }

  private _convertAPIResultToExplanation(
    apiData: Record<string, unknown>,
    _request: ExplanationRequest,
  ): CodeExplanation {
    const kc = apiData.keyComponents;
    const pat = apiData.patterns;
    const sug = apiData.suggestions;
    return {
      id: `api-${Date.now()}`,
      summary: typeof apiData.summary === 'string' ? apiData.summary : '',
      purpose: typeof apiData.purpose === 'string' ? apiData.purpose : '',
      keyComponents: Array.isArray(kc) ? (kc as CodeExplanation['keyComponents']) : [],
      patterns: Array.isArray(pat) ? (pat as CodeExplanation['patterns']) : [],
      complexity:
        apiData.complexity === 'simple' ||
        apiData.complexity === 'moderate' ||
        apiData.complexity === 'complex'
          ? apiData.complexity
          : 'moderate',
      estimatedTime:
        typeof apiData.estimatedTime === 'string' ? apiData.estimatedTime : '—',
      suggestions: Array.isArray(sug)
        ? (sug as string[])
        : typeof sug === 'string'
          ? [sug]
          : [],
    };
  }

  private async _explainSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found.');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage('Please select code to explain.');
      return;
    }

    const selectedCode = editor.document.getText(selection);
    const language = editor.document.languageId;

    await this._explainCode({
      code: selectedCode,
      language,
      includeExamples: true,
      detailLevel: 'detailed'
    });
  }

  private async _explainCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found.');
      return;
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;

    await this._explainCode({
      code,
      language,
      includeExamples: true,
      detailLevel: 'comprehensive'
    });
  }

  private async _exportExplanation(): Promise<void> {
    if (!this._currentExplanation) {
      vscode.window.showWarningMessage('No explanation to export. Generate an explanation first.');
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, 'code-explanation.md')),
      filters: { 'Markdown': ['md'] }
    });

    if (uri) {
      const content = this._formatExplanationAsMarkdown(this._currentExplanation);
      fs.writeFileSync(uri.fsPath, content);
      vscode.window.showInformationMessage('Code explanation exported successfully!');
    }
  }

  private _formatExplanationAsMarkdown(explanation: CodeExplanation): string {
    let content = `# Code Explanation\n\n`;
    content += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    content += `## Summary\n\n`;
    content += `${explanation.summary}\n\n`;
    
    content += `## Purpose\n\n`;
    content += `${explanation.purpose}\n\n`;
    
    content += `## Complexity\n\n`;
    content += `**Level:** ${explanation.complexity}\n`;
    content += `**Estimated Reading Time:** ${explanation.estimatedTime}\n\n`;
    
    if (explanation.keyComponents.length > 0) {
      content += `## Key Components\n\n`;
      explanation.keyComponents.forEach((component, index) => {
        content += `${index + 1}. **${component.name}** (Line ${component.line})\n`;
        content += `   - ${component.description}\n\n`;
      });
    }
    
    if (explanation.patterns.length > 0) {
      content += `## Identified Patterns\n\n`;
      explanation.patterns.forEach((pattern) => {
        content += `- **${pattern.name}** (${Math.round(pattern.confidence * 100)}% confidence)\n`;
        content += `  - ${pattern.description}\n\n`;
      });
    }
    
    if (explanation.suggestions.length > 0) {
      content += `## Suggestions\n\n`;
      explanation.suggestions.forEach((suggestion, index) => {
        content += `${index + 1}. ${suggestion}\n`;
      });
    }
    
    return content;
  }

  private async _generateDocumentation(): Promise<void> {
    if (!this._currentExplanation) {
      vscode.window.showWarningMessage('No explanation available. Generate an explanation first.');
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found.');
      return;
    }

    // Generate JSDoc comment
    const jsdoc = this._generateJSDoc(this._currentExplanation);
    
    // Insert at cursor position
    const position = editor.selection.active;
    await editor.edit(editBuilder => {
      editBuilder.insert(position, jsdoc);
    });

    vscode.window.showInformationMessage('Documentation generated and inserted!');
  }

  private _generateJSDoc(explanation: CodeExplanation): string {
    let jsdoc = '/**\n';
    jsdoc += ` * ${explanation.summary}\n`;
    jsdoc += ` *\n`;
    jsdoc += ` * @purpose ${explanation.purpose}\n`;
    jsdoc += ` * @complexity ${explanation.complexity}\n`;
    
    if (explanation.keyComponents.length > 0) {
      explanation.keyComponents.forEach(component => {
        jsdoc += ` * @component ${component.name} - ${component.description}\n`;
      });
    }
    
    jsdoc += ' */\n';
    
    return jsdoc;
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
  <title>AI Code Explainer</title>
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
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
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
    select, textarea {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      color: var(--on-surface);
      padding: 8px;
      border-radius: 4px;
      width: 100%;
      font-family: 'Inter', sans-serif;
    }
    textarea { min-height: 100px; resize: vertical; }
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
    .explanation-result {
      display: none;
      background: var(--surface-container-low);
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .explanation-header {
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .explanation-title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
    .explanation-meta {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: var(--on-surface-variant);
    }
    .explanation-section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      color: var(--on-surface);
    }
    .complexity-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    .complexity-simple { background: #6bcb77; color: #000; }
    .complexity-moderate { background: #ffd93d; color: #000; }
    .complexity-complex { background: #ff6b6b; color: #000; }
    .component-list, .pattern-list, .suggestion-list {
      list-style: none;
      padding: 0;
    }
    .component-item, .pattern-item, .suggestion-item {
      background: var(--surface-container-lowest);
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 3px solid var(--primary-container);
    }
    .component-name, .pattern-name { font-weight: bold; margin-bottom: 4px; }
    .component-description, .pattern-description {
      font-size: 13px;
      color: var(--on-surface-variant);
    }
    .confidence {
      font-size: 11px;
      color: var(--on-surface-variant);
      margin-top: 4px;
    }
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
    <div class="header-left">
      <span class="logo">🤖</span>
      <div>
        <div class="title">AI Code Explainer</div>
        <div class="subtitle">Natural language code explanations and documentation generation</div>
      </div>
    </div>
  </div>

  <div class="controls">
    <div class="control-row">
      <div class="control-group">
        <label>Detail Level</label>
        <select id="detailLevel">
          <option value="basic">Basic - Quick overview</option>
          <option value="detailed" selected>Detailed - Comprehensive explanation</option>
          <option value="comprehensive">Comprehensive - In-depth analysis</option>
        </select>
      </div>
      <div class="control-group">
        <label>Include Examples</label>
        <select id="includeExamples">
          <option value="true" selected>Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    </div>

    <div class="control-row">
      <div class="control-group">
        <label>Finding ID (optional — runs <code>guardrail explain &lt;id&gt;</code>)</label>
        <input type="text" id="findingIdInput" placeholder="From guardrail scan --json" style="width:100%;padding:8px;border-radius:6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);" />
      </div>
    </div>

    <div class="control-row">
      <div class="control-group" style="flex: 2;">
        <label>Code to Explain (or use selection/current file)</label>
        <textarea id="codeInput" placeholder="Paste your code here or use the buttons below..."></textarea>
      </div>
    </div>

    <div class="button-row">
      <button class="btn" id="explainBtn" onclick="explainCode()">
        <span>🤖</span> Explain Code
      </button>
      <button class="btn btn-secondary" onclick="explainSelection()">
        <span>📋</span> Explain Selection
      </button>
      <button class="btn btn-secondary" onclick="explainFile()">
        <span>📄</span> Explain Current File
      </button>
    </div>
  </div>

  <div class="progress-container" id="progressContainer">
    <div id="progressMessage">Analyzing code...</div>
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
  </div>

  <div class="explanation-result" id="explanationResult">
    <div class="explanation-header">
      <div class="explanation-title" id="explanationTitle">Code Analysis</div>
      <div class="explanation-meta">
        <span>Complexity: <span class="complexity-badge" id="complexityBadge">--</span></span>
        <span>Reading Time: <span id="readingTime">--</span></span>
        <span>Purpose: <span id="purpose">--</span></span>
      </div>
    </div>

    <div class="explanation-section">
      <div class="section-title">📝 Summary</div>
      <div id="summary">--</div>
    </div>

    <div class="explanation-section">
      <div class="section-title">🔧 Key Components</div>
      <ul class="component-list" id="componentList"></ul>
    </div>

    <div class="explanation-section">
      <div class="section-title">🎯 Identified Patterns</div>
      <ul class="pattern-list" id="patternList"></ul>
    </div>

    <div class="explanation-section">
      <div class="section-title">💡 Suggestions</div>
      <ul class="suggestion-list" id="suggestionList"></ul>
    </div>

    <div class="button-row" style="margin-top: 20px;">
      <button class="btn btn-secondary" onclick="exportExplanation()">
        <span>📤</span> Export Explanation
      </button>
      <button class="btn btn-secondary" onclick="generateDocs()">
        <span>📚</span> Generate Documentation
      </button>
    </div>
  </div>

  <div class="empty-state" id="emptyState">
    <div class="empty-icon">🤖</div>
    <h3>No Code Explained Yet</h3>
    <p>Enter a finding ID from <code>guardrail scan --json</code>, or paste code and use the API.</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentExplanation = null;

    function explainCode() {
      const code = document.getElementById('codeInput').value;
      const findingId = document.getElementById('findingIdInput').value.trim();
      const detailLevel = document.getElementById('detailLevel').value;
      const includeExamples = document.getElementById('includeExamples').value === 'true';

      if (!findingId && !code.trim()) {
        alert('Enter a finding ID for CLI explain, or paste code for the API');
        return;
      }

      document.getElementById('explainBtn').disabled = true;
      vscode.postMessage({
        command: 'explain',
        request: { code, detailLevel, includeExamples, language: 'typescript', findingId }
      });
    }

    function explainSelection() {
      vscode.postMessage({ command: 'explainSelection' });
    }

    function explainFile() {
      vscode.postMessage({ command: 'explainFile' });
    }

    function exportExplanation() {
      vscode.postMessage({ command: 'export' });
    }

    function generateDocs() {
      vscode.postMessage({ command: 'generateDocs' });
    }

    function renderExplanation(explanation) {
      currentExplanation = explanation;
      
      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('explanationResult').style.display = 'block';
      document.getElementById('explainBtn').disabled = false;

      // Update header
      document.getElementById('explanationTitle').textContent = 'Code Analysis Complete';
      
      const complexityBadge = document.getElementById('complexityBadge');
      complexityBadge.textContent = explanation.complexity.charAt(0).toUpperCase() + explanation.complexity.slice(1);
      complexityBadge.className = 'complexity-badge complexity-' + explanation.complexity;
      
      document.getElementById('readingTime').textContent = explanation.estimatedTime;
      document.getElementById('purpose').textContent = explanation.purpose;
      document.getElementById('summary').textContent = explanation.summary;

      // Render components
      const componentList = document.getElementById('componentList');
      componentList.innerHTML = explanation.keyComponents.map(comp => \`
        <li class="component-item">
          <div class="component-name">\${comp.name} (Line \${comp.line})</div>
          <div class="component-description">\${comp.description}</div>
        </li>
      \`).join('');

      // Render patterns
      const patternList = document.getElementById('patternList');
      patternList.innerHTML = explanation.patterns.map(pattern => \`
        <li class="pattern-item">
          <div class="pattern-name">\${pattern.name}</div>
          <div class="pattern-description">\${pattern.description}</div>
          <div class="confidence">Confidence: \${Math.round(pattern.confidence * 100)}%</div>
        </li>
      \`).join('');

      // Render suggestions
      const suggestionList = document.getElementById('suggestionList');
      suggestionList.innerHTML = explanation.suggestions.map(suggestion => \`
        <li class="suggestion-item">\${suggestion}</li>
      \`).join('');
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'explaining':
        case 'progress':
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressMessage').textContent = message.message || 'Analyzing...';
          document.getElementById('progressFill').style.width = (message.progress || 0) + '%';
          break;

        case 'complete':
          document.getElementById('progressContainer').style.display = 'none';
          renderExplanation(message.explanation);
          break;

        case 'error':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('explainBtn').disabled = false;
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
    AIExplainerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
