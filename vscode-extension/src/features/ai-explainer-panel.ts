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
import { GUARDRAIL_VERSION } from '../guardrail-styles';
import { getAiExplainerCyberCircuitHtml } from './ai-explainer-webview-html';
import { cyberCircuitPanelCss } from './ai-explainer-cyber-css';

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
          case 'vscodeCommand':
            if (typeof message.id === 'string') {
              void vscode.commands.executeCommand(message.id);
            }
            break;
          case 'copyText':
            if (typeof message.text === 'string') {
              await vscode.env.clipboard.writeText(message.text);
            }
            break;
          case 'feedback':
            vscode.window.showInformationMessage(
              'Thanks — we logged your feedback for this session.',
            );
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
      'Cyber-Circuit AI Explainer',
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
    return getAiExplainerCyberCircuitHtml(
      GUARDRAIL_VERSION,
      getGuardrailPanelHead(cyberCircuitPanelCss),
    );
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
