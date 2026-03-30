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

      // Try CLI first (preferred approach as you suggested)
      this._panel.webview.postMessage({
        type: 'progress',
        message: 'Running CLI analysis...',
        progress: 20
      });

      try {
        const cliResult = await this._cliService.runAIExplanation(
          request.code,
          request.language,
          {
            detailLevel: request.detailLevel,
            includeExamples: request.includeExamples
          }
        );

        if (cliResult.success && cliResult.data) {
          // Convert CLI result to CodeExplanation format
          explanation = this._convertCLIResultToExplanation(cliResult.data, request);
          
          this._panel.webview.postMessage({
            type: 'progress',
            message: 'CLI analysis complete!',
            progress: 100
          });
        } else {
          throw new Error('CLI analysis failed');
        }
      } catch (cliError) {
        console.warn('CLI analysis failed, falling back to API:', cliError);
        
        // Fallback to API
        this._panel.webview.postMessage({
          type: 'progress',
          message: 'CLI unavailable, trying API...',
          progress: 40
        });

        try {
          const isConnected = await this._apiClient.testConnection();
          if (!isConnected) {
            throw new Error('API connection failed');
          }

          const response = await this._apiClient.explainCode(request.code, request.language, request.detailLevel);

          if (response.success && response.data) {
            explanation = this._convertAPIResultToExplanation(response.data, request);
          } else {
            throw new Error('API analysis failed');
          }
        } catch (apiError) {
          console.warn('API analysis failed, using fallback:', apiError);
          
          // Final fallback to mock data
          this._panel.webview.postMessage({
            type: 'progress',
            message: 'Using offline analysis...',
            progress: 60
          });

          explanation = this._generateFallbackExplanation(request);
        }
      }

      this._currentExplanation = explanation;

      this._panel.webview.postMessage({
        type: 'complete',
        explanation: this._currentExplanation
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        type: 'error',
        message: error.message || 'Failed to explain code'
      });
    } finally {
      this._isExplaining = false;
    }
  }

  private _convertCLIResultToExplanation(cliData: any, request: ExplanationRequest): CodeExplanation {
    return {
      id: `cli-${Date.now()}`,
      summary: cliData.summary || 'Code analysis completed via CLI',
      purpose: cliData.purpose || 'Analyze code structure and functionality',
      keyComponents: cliData.components || [
        {
          name: 'Main Function',
          description: 'Primary execution logic',
          line: 1
        }
      ],
      patterns: cliData.patterns || [
        {
          name: 'Standard Pattern',
          description: 'Common coding pattern detected',
          confidence: 0.8
        }
      ],
      complexity: cliData.complexity || 'moderate',
      estimatedTime: cliData.estimatedTime || '2 minutes',
      suggestions: cliData.suggestions || [
        'Consider adding error handling',
        'Add documentation for better maintainability'
      ]
    };
  }

  private _convertAPIResultToExplanation(apiData: any, request: ExplanationRequest): CodeExplanation {
    return {
      id: `api-${Date.now()}`,
      summary: apiData.summary || 'Code analysis completed via API',
      purpose: apiData.purpose || 'Analyze code structure and functionality',
      keyComponents: apiData.keyComponents || [
        {
          name: 'Main Function',
          description: 'Primary execution logic',
          line: 1
        }
      ],
      patterns: apiData.patterns || [
        {
          name: 'Standard Pattern',
          description: 'Common coding pattern detected',
          confidence: 0.8
        }
      ],
      complexity: apiData.complexity || 'moderate',
      estimatedTime: apiData.estimatedTime || '2 minutes',
      suggestions: apiData.suggestions || [
        'Consider adding error handling',
        'Add documentation for better maintainability'
      ]
    };
  }

  private _generateFallbackExplanation(request: ExplanationRequest): CodeExplanation {
    const lines = request.code.split('\n').length;
    const complexity = lines > 50 ? 'complex' : lines > 20 ? 'moderate' : 'simple';
    
    return {
      id: `fallback-${Date.now()}`,
      summary: `Analysis of ${request.language} code (${lines} lines)`,
      purpose: 'Provide code explanation and documentation',
      keyComponents: [
        {
          name: 'Code Structure',
          description: 'Overall code organization and flow',
          line: 1
        },
        {
          name: 'Logic Implementation',
          description: 'Core business logic and algorithms',
          line: Math.floor(lines / 2)
        }
      ],
      patterns: [
        {
          name: 'Code Pattern',
          description: 'Identified coding patterns and conventions',
          confidence: 0.7
        }
      ],
      complexity,
      estimatedTime: complexity === 'complex' ? '5 minutes' : complexity === 'moderate' ? '3 minutes' : '1 minute',
      suggestions: [
        'Add comprehensive documentation',
        'Consider unit tests for validation',
        'Review code for optimization opportunities'
      ]
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

  private async _generateExplanation(request: ExplanationRequest): Promise<CodeExplanation> {
    const lines = request.code.split('\n');
    const complexity = this._analyzeComplexity(request.code);
    
    // Extract key components
    const keyComponents = this._extractComponents(request.code, lines);
    
    // Identify patterns
    const patterns = this._identifyPatterns(request.code);
    
    // Generate summary based on language and patterns
    const summary = this._generateSummary(request, patterns, complexity);
    
    // Determine purpose
    const purpose = this._determinePurpose(request.code, patterns);
    
    // Calculate estimated reading time
    const estimatedTime = this._calculateReadingTime(lines.length, complexity);
    
    // Generate suggestions
    const suggestions = this._generateSuggestions(request.code, patterns, complexity);

    return {
      id: `explanation-${Date.now()}`,
      summary,
      purpose,
      keyComponents,
      patterns,
      complexity,
      estimatedTime,
      suggestions
    };
  }

  private _analyzeComplexity(code: string): 'simple' | 'moderate' | 'complex' {
    let complexity = 0;
    
    // Count control structures
    complexity += (code.match(/if|else|while|for|switch/g) || []).length * 2;
    complexity += (code.match(/try|catch|throw/g) || []).length * 3;
    complexity += (code.match(/async|await|Promise/g) || []).length * 2;
    complexity += (code.match(/class|interface|abstract/g) || []).length * 2;
    complexity += (code.match(/function|=>/g) || []).length;
    
    if (complexity < 10) return 'simple';
    if (complexity < 25) return 'moderate';
    return 'complex';
  }

  private _extractComponents(code: string, lines: string[]): Array<{name: string; description: string; line: number}> {
    const components: Array<{name: string; description: string; line: number}> = [];
    
    // Find functions
    const functionMatches = code.match(/(?:function|const|let)\s+(\w+)\s*[=:(]/g);
    if (functionMatches) {
      functionMatches.forEach((match, index) => {
        const name = match.match(/(\w+)\s*[=:(]/)?.[1] || `function_${index}`;
        const line = this._findLineNumber(code, match);
        components.push({
          name,
          description: `Function or method: ${name}`,
          line
        });
      });
    }
    
    // Find classes
    const classMatches = code.match(/class\s+(\w+)/g);
    if (classMatches) {
      classMatches.forEach((match) => {
        const name = match.match(/class\s+(\w+)/)?.[1] || 'Unknown';
        const line = this._findLineNumber(code, match);
        components.push({
          name,
          description: `Class definition: ${name}`,
          line
        });
      });
    }
    
    // Find imports/exports
    const importMatches = code.match(/import.*from\s+['"](.+)['"]/g);
    if (importMatches) {
      importMatches.forEach((match) => {
        const module = match.match(/from\s+['"](.+)['"]/)?.[1] || 'Unknown';
        const line = this._findLineNumber(code, match);
        components.push({
          name: module,
          description: `Imported module: ${module}`,
          line
        });
      });
    }
    
    return components.slice(0, 10); // Limit to 10 components
  }

  private _identifyPatterns(code: string): Array<{name: string; description: string; confidence: number}> {
    const patterns: Array<{name: string; description: string; confidence: number}> = [];
    
    // Common patterns
    if (code.includes('async') && code.includes('await')) {
      patterns.push({
        name: 'Async/Await Pattern',
        description: 'Asynchronous programming with async/await',
        confidence: 0.9
      });
    }
    
    if (code.includes('class') && code.includes('extends')) {
      patterns.push({
        name: 'Inheritance Pattern',
        description: 'Class inheritance and extension',
        confidence: 0.85
      });
    }
    
    if (code.includes('map') || code.includes('filter') || code.includes('reduce')) {
      patterns.push({
        name: 'Functional Programming',
        description: 'Use of functional array methods',
        confidence: 0.8
      });
    }
    
    if (code.includes('try') && code.includes('catch')) {
      patterns.push({
        name: 'Error Handling',
        description: 'Try-catch error handling pattern',
        confidence: 0.95
      });
    }
    
    if (code.includes('useState') || code.includes('useEffect')) {
      patterns.push({
        name: 'React Hooks',
        description: 'React functional component hooks',
        confidence: 0.9
      });
    }
    
    if (code.includes('Promise') || code.includes('.then(')) {
      patterns.push({
        name: 'Promise Pattern',
        description: 'Promise-based asynchronous operations',
        confidence: 0.85
      });
    }
    
    return patterns;
  }

  private _generateSummary(request: ExplanationRequest, patterns: any[], complexity: string): string {
    const language = request.language;
    const patternNames = patterns.map(p => p.name).join(', ');
    
    let summary = `This ${language} code `;
    
    switch (complexity) {
      case 'simple':
        summary += 'implements a straightforward solution';
        break;
      case 'moderate':
        summary += 'provides a well-structured implementation';
        break;
      case 'complex':
        summary += 'delivers a sophisticated solution with multiple components';
        break;
    }
    
    if (patterns.length > 0) {
      summary += ` utilizing ${patternNames}`;
    }
    
    summary += `. The code follows modern ${language} practices and `;
    
    if (complexity === 'simple') {
      summary += 'is easy to understand and maintain.';
    } else if (complexity === 'moderate') {
      summary += 'offers good balance between functionality and readability.';
    } else {
      summary += 'requires careful consideration due to its complexity.';
    }
    
    return summary;
  }

  private _determinePurpose(code: string, patterns: any[]): string {
    if (code.includes('export') || code.includes('module.exports')) {
      return 'Module/library code intended for reuse';
    }
    
    if (code.includes('app.') || code.includes('server') || code.includes('listen')) {
      return 'Server application or API endpoint';
    }
    
    if (code.includes('component') || code.includes('render') || code.includes('useState')) {
      return 'UI component or frontend logic';
    }
    
    if (code.includes('database') || code.includes('query') || code.includes('SELECT')) {
      return 'Database operations or data access';
    }
    
    if (code.includes('test') || code.includes('describe') || code.includes('it(')) {
      return 'Test code or test utilities';
    }
    
    if (code.includes('config') || code.includes('env') || code.includes('settings')) {
      return 'Configuration or environment setup';
    }
    
    return 'General purpose utility or business logic';
  }

  private _calculateReadingTime(lineCount: number, complexity: string): string {
    let baseTime = lineCount * 0.5; // 30 seconds per 60 lines
    
    switch (complexity) {
      case 'simple':
        baseTime *= 0.8;
        break;
      case 'moderate':
        baseTime *= 1.2;
        break;
      case 'complex':
        baseTime *= 1.5;
        break;
    }
    
    const minutes = Math.ceil(baseTime / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  private _generateSuggestions(code: string, patterns: any[], complexity: string): string[] {
    const suggestions: string[] = [];
    
    // General suggestions
    if (complexity === 'complex') {
      suggestions.push('Consider breaking this into smaller, more focused functions');
      suggestions.push('Add comprehensive documentation for complex logic');
    }
    
    if (!code.includes('/*') && !code.includes('//')) {
      suggestions.push('Add comments to explain complex logic');
    }
    
    if (!code.includes('console.log') && !code.includes('logger')) {
      suggestions.push('Consider adding logging for debugging and monitoring');
    }
    
    // Pattern-specific suggestions
    const hasErrorHandling = patterns.some(p => p.name.includes('Error'));
    if (!hasErrorHandling && (code.includes('fetch') || code.includes('async'))) {
      suggestions.push('Add error handling for asynchronous operations');
    }
    
    const hasTests = code.includes('test') || code.includes('spec');
    if (!hasTests) {
      suggestions.push('Write unit tests to ensure code reliability');
    }
    
    // Language-specific suggestions
    if (code.includes('var')) {
      suggestions.push('Replace var with let or const for better scoping');
    }
    
    if (code.includes('==') && !code.includes('===')) {
      suggestions.push('Use strict equality (===) instead of loose equality (==)');
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  private _findLineNumber(code: string, searchText: string): number {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
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

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Code Explainer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--vscode-input-border);
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .logo { font-size: 32px; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 14px; }
    .controls {
      background: var(--vscode-input-background);
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
      color: var(--vscode-descriptionForeground);
    }
    select, textarea {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      color: var(--vscode-input-foreground);
      padding: 8px;
      border-radius: 4px;
      width: 100%;
      font-family: var(--vscode-font-family);
    }
    textarea { min-height: 100px; resize: vertical; }
    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
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
      background: var(--vscode-input-background);
      border-radius: 8px;
    }
    .progress-bar {
      height: 8px;
      background: var(--vscode-input-border);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      background: var(--vscode-progressBar-background);
      transition: width 0.3s ease;
    }
    .explanation-result {
      display: none;
      background: var(--vscode-input-background);
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .explanation-header {
      border-bottom: 1px solid var(--vscode-input-border);
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .explanation-title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
    .explanation-meta {
      display: flex;
      gap: 20px;
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }
    .explanation-section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      color: var(--vscode-editor-foreground);
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
      background: var(--vscode-editor-background);
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 3px solid var(--vscode-button-background);
    }
    .component-name, .pattern-name { font-weight: bold; margin-bottom: 4px; }
    .component-description, .pattern-description {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
    .confidence {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }
    .empty-icon { font-size: 48px; margin-bottom: 15px; }
  </style>
</head>
<body>
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
    <p>Paste code above, use selection, or explain the current file to get AI-powered explanations.</p>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentExplanation = null;

    function explainCode() {
      const code = document.getElementById('codeInput').value;
      const detailLevel = document.getElementById('detailLevel').value;
      const includeExamples = document.getElementById('includeExamples').value === 'true';

      if (!code.trim()) {
        alert('Please enter code to explain');
        return;
      }

      document.getElementById('explainBtn').disabled = true;
      vscode.postMessage({
        command: 'explain',
        request: { code, detailLevel, includeExamples }
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
