/**
 * Change Impact Analysis
 *
 * Enterprise feature for analyzing the impact of code changes
 * across the entire codebase before deployment.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ApiClient } from "../services/api-client";
import { CLIService } from "../services/cli-service";
import { getGuardrailPanelHead } from "../webview-shared-styles";
import { buildImpactAnalysisFromScan } from "../scan-cli-map";

export interface ImpactAnalysis {
  timestamp: string;
  changes: ChangeImpact[];
  summary: {
    totalFiles: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    affectedComponents: string[];
    riskScore: number;
  };
  recommendations: string[];
}

export interface ChangeImpact {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  impact: 'high' | 'medium' | 'low';
  dependencies: string[];
  dependents: string[];
  affectedTests: string[];
  affectedDocs: string[];
  breakingChanges: BreakingChange[];
  riskFactors: RiskFactor[];
}

export interface BreakingChange {
  type: 'api' | 'interface' | 'config' | 'database';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedFiles: string[];
}

export interface RiskFactor {
  category: 'complexity' | 'dependencies' | 'test-coverage' | 'documentation';
  score: number;
  description: string;
}

export class ChangeImpactAnalyzer {
  private _workspacePath: string;
  private _dependencyGraph: Map<string, Set<string>> = new Map();
  private _fileMetrics: Map<string, FileMetrics> = new Map();

  constructor(workspacePath: string) {
    this._workspacePath = workspacePath;
    this._buildDependencyGraph();
    this._analyzeFileMetrics();
  }

  private async _buildDependencyGraph() {
    const files = await this._findSourceFiles();
    
    for (const file of files) {
      const dependencies = await this._extractDependencies(file);
      this._dependencyGraph.set(file, new Set(dependencies));
    }
  }

  private async _extractDependencies(filePath: string): Promise<string[]> {
    const dependencies: string[] = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this._workspacePath, filePath);
      
      // Extract import statements
      const importRegex = /import.*from\s+['"](.+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        // Convert relative imports to absolute paths
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
          const absolutePath = path.resolve(path.dirname(filePath), importPath);
          const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
          
          for (const ext of possibleExtensions) {
            const fullPath = absolutePath + ext;
            if (fs.existsSync(fullPath)) {
              dependencies.push(fullPath);
              break;
            }
          }
        }
      }
      
      // Extract require statements
      const requireRegex = /require\s*\(\s*['"](.+)['"]\s*\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        const requirePath = match[1];
        if (requirePath.startsWith('./') || requirePath.startsWith('../')) {
          const absolutePath = path.resolve(path.dirname(filePath), requirePath);
          const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx'];
          
          for (const ext of possibleExtensions) {
            const fullPath = absolutePath + ext;
            if (fs.existsSync(fullPath)) {
              dependencies.push(fullPath);
              break;
            }
          }
        }
      }
    } catch (error) {
      // Ignore files that can't be read
    }
    
    return dependencies;
  }

  private async _analyzeFileMetrics() {
    const files = await this._findSourceFiles();
    
    for (const file of files) {
      const metrics = await this._calculateFileMetrics(file);
      this._fileMetrics.set(file, metrics);
    }
  }

  private async _calculateFileMetrics(filePath: string): Promise<FileMetrics> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const metrics: FileMetrics = {
        linesOfCode: lines.length,
        complexity: this._calculateComplexity(content),
        hasTests: this._hasTests(filePath),
        hasDocumentation: this._hasDocumentation(content),
        isPublicAPI: this._isPublicAPI(filePath, content),
        isConfig: this._isConfigFile(filePath),
        isDatabase: this._isDatabaseFile(filePath, content),
      };
      
      return metrics;
    } catch (error) {
      return {
        linesOfCode: 0,
        complexity: 0,
        hasTests: false,
        hasDocumentation: false,
        isPublicAPI: false,
        isConfig: false,
        isDatabase: false,
      };
    }
  }

  private _calculateComplexity(content: string): number {
    let complexity = 0;
    
    // Count cyclomatic complexity indicators
    complexity += (content.match(/if\s*\(/g) || []).length;
    complexity += (content.match(/else\s+if/g) || []).length;
    complexity += (content.match(/while\s*\(/g) || []).length;
    complexity += (content.match(/for\s*\(/g) || []).length;
    complexity += (content.match(/switch\s*\(/g) || []).length;
    complexity += (content.match(/case\s+/g) || []).length;
    complexity += (content.match(/catch\s*\(/g) || []).length;
    complexity += (content.match(/&&/g) || []).length;
    complexity += (content.match(/\|\|/g) || []).length;
    
    return complexity;
  }

  private _hasTests(filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /__tests__\//,
      /test\//,
      /tests\//
    ];
    
    return testPatterns.some(pattern => pattern.test(filePath));
  }

  private _hasDocumentation(content: string): boolean {
    return content.includes('/**') || content.includes('///') || content.includes('##');
  }

  private _isPublicAPI(filePath: string, content: string): boolean {
    const apiPatterns = [
      /\/api\//,
      /\/routes\//,
      /\/controllers\//,
      /\/handlers\//,
      /export.*function/,
      /export.*class/,
      /export.*const/
    ];
    
    return apiPatterns.some(pattern => pattern.test(filePath) || pattern.test(content));
  }

  private _isConfigFile(filePath: string): boolean {
    const configPatterns = [
      /\.config\./,
      /\/config\//,
      /\/configs\//,
      /\.env/,
      /package\.json/,
      /tsconfig\.json/
    ];
    
    return configPatterns.some(pattern => pattern.test(filePath));
  }

  private _isDatabaseFile(filePath: string, content: string): boolean {
    const dbPatterns = [
      /\/migrations\//,
      /\/seeds\//,
      /\/models\//,
      /\/schema\./,
      /\.sql$/,
      /prisma/,
      /sequelize/,
      /mongoose/,
      /typeorm/
    ];
    
    return dbPatterns.some(pattern => pattern.test(filePath) || pattern.test(content));
  }

  public async analyzeChanges(changedFiles: string[]): Promise<ImpactAnalysis> {
    const impacts: ChangeImpact[] = [];
    const affectedComponents = new Set<string>();
    let totalRiskScore = 0;

    for (const file of changedFiles) {
      const impact = await this._analyzeFileImpact(file);
      impacts.push(impact);
      
      // Collect affected components
      impact.dependencies.forEach(dep => affectedComponents.add(dep));
      impact.dependents.forEach(dep => affectedComponents.add(dep));
      
      totalRiskScore += this._calculateRiskScore(impact);
    }

    const summary = {
      totalFiles: changedFiles.length,
      highImpact: impacts.filter(i => i.impact === 'high').length,
      mediumImpact: impacts.filter(i => i.impact === 'medium').length,
      lowImpact: impacts.filter(i => i.impact === 'low').length,
      affectedComponents: Array.from(affectedComponents),
      riskScore: Math.min(100, totalRiskScore / changedFiles.length)
    };

    const recommendations = this._generateRecommendations(impacts);

    return {
      timestamp: new Date().toISOString(),
      changes: impacts,
      summary,
      recommendations
    };
  }

  private async _analyzeFileImpact(file: string): Promise<ChangeImpact> {
    const fullPath = path.resolve(this._workspacePath, file);
    const metrics = this._fileMetrics.get(fullPath) || await this._calculateFileMetrics(fullPath);
    
    // Determine change type (simplified - in production would use git diff)
    const changeType: 'added' | 'modified' | 'deleted' = fs.existsSync(fullPath) ? 'modified' : 'deleted';
    
    // Find dependents
    const dependents: string[] = [];
    for (const [filePath, deps] of this._dependencyGraph.entries()) {
      if (deps.has(fullPath)) {
        dependents.push(path.relative(this._workspacePath, filePath));
      }
    }

    // Find dependencies
    const dependencies = Array.from(this._dependencyGraph.get(fullPath) || [])
      .map(dep => path.relative(this._workspacePath, dep));

    // Find affected tests
    const affectedTests = await this._findAffectedTests(fullPath);

    // Find affected documentation
    const affectedDocs = await this._findAffectedDocs(fullPath);

    // Detect breaking changes
    const breakingChanges = await this._detectBreakingChanges(fullPath, changeType);

    // Calculate risk factors
    const riskFactors = this._calculateRiskFactors(metrics, dependents.length);

    // Determine overall impact
    const impact = this._calculateImpact(metrics, dependents.length, breakingChanges);

    return {
      file: path.relative(this._workspacePath, fullPath),
      type: changeType,
      impact,
      dependencies,
      dependents,
      affectedTests,
      affectedDocs,
      breakingChanges,
      riskFactors
    };
  }

  private async _findAffectedTests(filePath: string): Promise<string[]> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const testFiles: string[] = [];
    
    // Look for test files with similar names
    const testPatterns = [
      `${fileName}.test.`,
      `${fileName}.spec.`,
      `test/${fileName}.`,
      `tests/${fileName}.`,
      `__tests__/${fileName}.`
    ];

    for (const pattern of testPatterns) {
      const files = await vscode.workspace.findFiles(`**/${pattern}*`, '**/node_modules/**', 5);
      testFiles.push(...files.map(f => path.relative(this._workspacePath, f.fsPath)));
    }

    return testFiles;
  }

  private async _findAffectedDocs(filePath: string): Promise<string[]> {
    const fileName = path.basename(filePath, path.extname(filePath));
    const docFiles: string[] = [];
    
    // Look for documentation files
    const docPatterns = [
      `${fileName}.md`,
      `docs/${fileName}.md`,
      `documentation/${fileName}.md`,
      `README.md`
    ];

    for (const pattern of docPatterns) {
      const files = await vscode.workspace.findFiles(`**/${pattern}`, '**/node_modules/**', 5);
      docFiles.push(...files.map(f => path.relative(this._workspacePath, f.fsPath)));
    }

    return docFiles;
  }

  private async _detectBreakingChanges(filePath: string, changeType: string): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];
    const metrics = this._fileMetrics.get(filePath);

    if (!metrics || changeType === 'deleted') {
      if (metrics?.isPublicAPI) {
        breakingChanges.push({
          type: 'api',
          description: 'Public API file deleted',
          severity: 'critical',
          affectedFiles: [path.relative(this._workspacePath, filePath)]
        });
      }
      return breakingChanges;
    }

    // Detect potential breaking changes based on file type
    if (metrics.isPublicAPI) {
      breakingChanges.push({
        type: 'api',
        description: 'Public API modified - potential breaking changes',
        severity: 'high',
        affectedFiles: [path.relative(this._workspacePath, filePath)]
      });
    }

    if (metrics.isDatabase) {
      breakingChanges.push({
        type: 'database',
        description: 'Database-related file modified',
        severity: 'high',
        affectedFiles: [path.relative(this._workspacePath, filePath)]
      });
    }

    if (metrics.isConfig) {
      breakingChanges.push({
        type: 'config',
        description: 'Configuration file modified',
        severity: 'medium',
        affectedFiles: [path.relative(this._workspacePath, filePath)]
      });
    }

    return breakingChanges;
  }

  private _calculateRiskFactors(metrics: FileMetrics, dependentCount: number): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Complexity risk
    if (metrics.complexity > 20) {
      riskFactors.push({
        category: 'complexity',
        score: Math.min(100, metrics.complexity * 2),
        description: `High complexity (${metrics.complexity} cyclomatic complexity)`
      });
    }

    // Dependencies risk
    if (dependentCount > 5) {
      riskFactors.push({
        category: 'dependencies',
        score: Math.min(100, dependentCount * 10),
        description: `${dependentCount} files depend on this change`
      });
    }

    // Test coverage risk
    if (!metrics.hasTests) {
      riskFactors.push({
        category: 'test-coverage',
        score: 75,
        description: 'No tests found for this file'
      });
    }

    // Documentation risk
    if (!metrics.hasDocumentation && metrics.isPublicAPI) {
      riskFactors.push({
        category: 'documentation',
        score: 50,
        description: 'Public API lacks documentation'
      });
    }

    return riskFactors;
  }

  private _calculateImpact(metrics: FileMetrics, dependentCount: number, breakingChanges: BreakingChange[]): 'high' | 'medium' | 'low' {
    let score = 0;

    // Base score from file characteristics
    if (metrics.isPublicAPI) score += 30;
    if (metrics.isDatabase) score += 25;
    if (metrics.isConfig) score += 20;
    if (metrics.complexity > 15) score += 15;
    if (dependentCount > 3) score += 10;

    // Add score from breaking changes
    breakingChanges.forEach(bc => {
      switch (bc.severity) {
        case 'critical': score += 40; break;
        case 'high': score += 30; break;
        case 'medium': score += 20; break;
        case 'low': score += 10; break;
      }
    });

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private _calculateRiskScore(impact: ChangeImpact): number {
    let score = 0;

    switch (impact.impact) {
      case 'high': score += 70; break;
      case 'medium': score += 40; break;
      case 'low': score += 20; break;
    }

    // Add risk from risk factors
    impact.riskFactors.forEach(rf => {
      score += rf.score * 0.3;
    });

    // Add risk from breaking changes
    impact.breakingChanges.forEach(bc => {
      switch (bc.severity) {
        case 'critical': score += 30; break;
        case 'high': score += 20; break;
        case 'medium': score += 10; break;
        case 'low': score += 5; break;
      }
    });

    return Math.min(100, score);
  }

  private _generateRecommendations(impacts: ChangeImpact[]): string[] {
    const recommendations: string[] = [];

    const highImpactCount = impacts.filter(i => i.impact === 'high').length;
    const breakingChangesCount = impacts.reduce((sum, i) => sum + i.breakingChanges.length, 0);
    const untestedCount = impacts.filter(i => !i.affectedTests.length).length;

    if (highImpactCount > 0) {
      recommendations.push(`${highImpactCount} high-impact changes detected. Consider deploying in phases.`);
    }

    if (breakingChangesCount > 0) {
      recommendations.push(`${breakingChangesCount} potential breaking changes found. Review API contracts.`);
    }

    if (untestedCount > 0) {
      recommendations.push(`${untestedCount} changes lack test coverage. Add tests before deployment.`);
    }

    const totalDependents = impacts.reduce((sum, i) => sum + i.dependents.length, 0);
    if (totalDependents > 10) {
      recommendations.push('High dependency chain detected. Consider integration testing.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Low risk changes detected. Standard deployment process should be safe.');
    }

    return recommendations;
  }

  private async _findSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

    const scan = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
            scan(fullPath);
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch {
        // Ignore unreadable directories
      }
    };

    scan(this._workspacePath);
    return files;
  }
}

interface FileMetrics {
  linesOfCode: number;
  complexity: number;
  hasTests: boolean;
  hasDocumentation: boolean;
  isPublicAPI: boolean;
  isConfig: boolean;
  isDatabase: boolean;
}

export class ChangeImpactPanel {
  public static currentPanel: ChangeImpactPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _currentAnalysis: ImpactAnalysis | null = null;
  private _isAnalyzing: boolean = false;
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
          case 'analyze':
            await this._runImpactAnalysis(message.files);
            break;
          case 'openFile':
            await this._openFile(message.file, message.line);
            break;
          case 'export':
            await this._exportReport(message.format);
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

    if (ChangeImpactPanel.currentPanel) {
      ChangeImpactPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'changeImpact',
      'Change Impact Analysis',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    ChangeImpactPanel.currentPanel = new ChangeImpactPanel(panel, workspacePath, extensionContext);
  }

  private async _runImpactAnalysis(files?: string[]): Promise<void> {
    if (this._isAnalyzing) return;

    this._isAnalyzing = true;
    const changedFiles = files || await this._getChangedFiles();
    
    if (changedFiles.length === 0) {
      vscode.window.showInformationMessage('No changed files found to analyze.');
      this._isAnalyzing = false;
      return;
    }

    this._panel.webview.postMessage({ type: 'analyzing', files: changedFiles });

    try {
      let analysis: ImpactAnalysis;

      const cli = await this._cliService.runScanJson();
      if (cli.data) {
        analysis = buildImpactAnalysisFromScan(
          cli.data,
        ) as ImpactAnalysis;
      } else {
        analysis = {
          timestamp: new Date().toISOString(),
          changes: [],
          summary: {
            totalFiles: 0,
            highImpact: 0,
            mediumImpact: 0,
            lowImpact: 0,
            affectedComponents: [],
            riskScore: 0,
          },
          recommendations: [
            "Run `guardrail scan --json` in this workspace to populate hotspots.",
          ],
        };
      }

      if (analysis.changes.length === 0) {
        try {
          const isConnected = await this._apiClient.testConnection();
          if (isConnected) {
            const projectId = "workspace-" + Date.now();
            const response = await this._apiClient.analyzeChangeImpact(
              changedFiles,
              projectId,
            );
            if (response.success && response.data) {
              analysis = {
                timestamp:
                  response.data.timestamp || new Date().toISOString(),
                changes: response.data.changes || [],
                summary: response.data.summary || {
                  totalFiles: changedFiles.length,
                  highImpact: 0,
                  mediumImpact: 0,
                  lowImpact: 0,
                  affectedComponents: [],
                  riskScore: 0,
                },
                recommendations: response.data.recommendations || [],
              };
            }
          }
        } catch {
          /* keep CLI-empty analysis */
        }
      }

      this._currentAnalysis = analysis;

      this._panel.webview.postMessage({
        type: "complete",
        analysis,
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to run change impact analysis";
      this._panel.webview.postMessage({
        type: "error",
        message: msg,
      });
    } finally {
      this._isAnalyzing = false;
    }
  }

  private async _getChangedFiles(): Promise<string[]> {
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx}',
      '**/node_modules/**',
      20
    );
    
    return files.slice(0, 5).map(f => path.relative(this._workspacePath, f.fsPath));
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

  private async _exportReport(format: string): Promise<void> {
    if (!this._currentAnalysis) {
      vscode.window.showWarningMessage('No analysis to export. Run an analysis first.');
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, `change-impact-report-${new Date().toISOString().split('T')[0]}.json`)),
      filters: { 'JSON': ['json'] }
    });

    if (uri) {
      fs.writeFileSync(uri.fsPath, JSON.stringify(this._currentAnalysis, null, 2));
      vscode.window.showInformationMessage('Change impact report exported!');
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    const panelCss = `
    .cim-wrap { padding: 16px; flex: 1; }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .summary-value { font-size: 28px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
    .summary-label { font-size: 12px; color: var(--on-surface-variant); margin-top: 5px; }
    .risk-score {
      background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      margin-bottom: 20px;
      border: 1px solid var(--border-subtle);
    }
    .risk-value { font-size: 64px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
    .risk-label { color: var(--outline); margin-top: 5px; }
    .risk-low { color: #6ee7b7; }
    .risk-medium { color: #ffd93d; }
    .risk-high { color: #ff6b6b; }
    .changes-section { margin-top: 20px; }
    .changes-section h3 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--outline);
      margin-bottom: 12px;
    }
    .change-card {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 4px solid var(--outline-variant);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .change-card:hover { transform: translateX(5px); background: var(--surface-container-high); }
    .change-high { border-left-color: #ff6b6b; }
    .change-medium { border-left-color: #ffd93d; }
    .change-low { border-left-color: #6ee7b7; }
    .change-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .change-title { font-weight: 700; font-size: 13px; }
    .change-badge {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-high { background: rgba(255,107,107,0.25); color: #ffb4ab; }
    .badge-medium { background: rgba(255,217,61,0.2); color: #ffe082; }
    .badge-low { background: rgba(110,231,183,0.2); color: #6ee7b7; }
    .change-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      color: var(--on-surface-variant);
      margin-bottom: 10px;
    }
    .recommendations {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 20px;
      border-radius: 12px;
      margin-top: 20px;
    }
    .recommendations h3 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--outline);
      margin-bottom: 12px;
    }
    .recommendation-item {
      padding: 10px 12px;
      background: var(--surface-container-lowest);
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 3px solid var(--primary-fixed-dim);
      font-size: 12px;
      color: var(--on-surface);
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--on-surface-variant);
    }
    .empty-icon { margin-bottom: 15px; color: var(--cyan-glow); }
    .analyzing {
      text-align: center;
      padding: 60px 20px;
      color: var(--on-surface-variant);
    }
    .spinner {
      border: 3px solid var(--border-subtle);
      border-top: 3px solid var(--primary-container);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    `;
    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Change Impact Analysis</title>
  ${getGuardrailPanelHead(panelCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <header class="header">
    <div class="header-left">
      <span class="material-symbols-outlined logo" style="font-size:28px;color:var(--cyan-glow);">hub</span>
      <div>
        <div class="title">Change Impact Analysis</div>
        <div class="subtitle">Blast radius · dependencies · dependents</div>
      </div>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button type="button" class="btn" onclick="runAnalysis()">
        <span class="material-symbols-outlined" style="font-size:18px;">search</span> Analyze Changes
      </button>
      <button type="button" class="btn btn-secondary" id="exportBtn" onclick="exportReport()" disabled>
        <span class="material-symbols-outlined" style="font-size:18px;">upload</span> Export Report
      </button>
    </div>
  </header>

  <div class="cim-wrap">
  <div class="empty-state" id="emptyState">
    <div class="empty-icon"><span class="material-symbols-outlined" style="font-size:56px;">analytics</span></div>
    <h3>No Analysis Yet</h3>
    <p>Click "Analyze Changes" to analyze the impact of your code changes.</p>
  </div>

  <div class="analyzing" id="analyzingState" style="display: none;">
    <div class="spinner"></div>
    <h3>Analyzing Changes...</h3>
    <p>Building dependency graph and calculating impact...</p>
  </div>

  <div id="resultsContainer" style="display: none;">
    <div class="risk-score">
      <div class="risk-value" id="riskValue">--</div>
      <div class="risk-label">Risk Score</div>
    </div>

    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-value" id="totalFiles">0</div>
        <div class="summary-label">Total Files</div>
      </div>
      <div class="summary-card">
        <div class="summary-value" id="highImpact">0</div>
        <div class="summary-label">High Impact</div>
      </div>
      <div class="summary-card">
        <div class="summary-value" id="mediumImpact">0</div>
        <div class="summary-label">Medium Impact</div>
      </div>
      <div class="summary-card">
        <div class="summary-value" id="affectedComponents">0</div>
        <div class="summary-label">Affected Components</div>
      </div>
    </div>

    <div class="changes-section">
      <h3>Change Details</h3>
      <div id="changesList"></div>
    </div>

    <div class="recommendations">
      <h3>Recommendations</h3>
      <div id="recommendationsList"></div>
    </div>
  </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentAnalysis = null;

    function runAnalysis() {
      vscode.postMessage({ command: 'analyze' });
    }

    function exportReport() {
      vscode.postMessage({ command: 'export' });
    }

    function openFile(file) {
      vscode.postMessage({ command: 'openFile', file });
    }

    function getRiskColor(score) {
      if (score >= 70) return '#ff6b6b';
      if (score >= 40) return '#ffd93d';
      return '#6bcb77';
    }

    function renderAnalysis(analysis) {
      currentAnalysis = analysis;
      
      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('analyzingState').style.display = 'none';
      document.getElementById('resultsContainer').style.display = 'block';
      document.getElementById('exportBtn').disabled = false;

      // Update risk score
      const riskElement = document.getElementById('riskValue');
      riskElement.textContent = analysis.summary.riskScore;
      riskElement.className = 'risk-value risk-' + (analysis.summary.riskScore >= 70 ? 'high' : analysis.summary.riskScore >= 40 ? 'medium' : 'low');
      riskElement.style.color = getRiskColor(analysis.summary.riskScore);

      // Update summary cards
      document.getElementById('totalFiles').textContent = analysis.summary.totalFiles;
      document.getElementById('highImpact').textContent = analysis.summary.highImpact;
      document.getElementById('mediumImpact').textContent = analysis.summary.mediumImpact;
      document.getElementById('affectedComponents').textContent = analysis.summary.affectedComponents.length;

      // Render changes
      document.getElementById('changesList').innerHTML = analysis.changes.map(change => \`
        <div class="change-card change-\${change.impact}" onclick="openFile('\${change.file}')">
          <div class="change-header">
            <span class="change-title">\${change.file}</span>
            <span class="change-badge badge-\${change.impact}">\${change.impact.toUpperCase()}</span>
          </div>
          <div class="change-meta">
            <span>📝 \${change.type}</span>
            <span>🔗 \${change.dependencies.length} dependencies</span>
            <span>📡 \${change.dependents.length} dependents</span>
            <span>🧪 \${change.affectedTests.length} tests</span>
          </div>
          \${change.breakingChanges.length > 0 ? \`
            <div style="color: #ff6b6b; font-size: 12px;">
              ⚠️ \${change.breakingChanges.length} breaking changes
            </div>
          \` : ''}
        </div>
      \`).join('');

      // Render recommendations
      document.getElementById('recommendationsList').innerHTML = analysis.recommendations.map(rec => \`
        <div class="recommendation-item">
          💡 \${rec}
        </div>
      \`).join('');
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'analyzing':
          document.getElementById('emptyState').style.display = 'none';
          document.getElementById('resultsContainer').style.display = 'none';
          document.getElementById('analyzingState').style.display = 'block';
          break;

        case 'complete':
          document.getElementById('analyzingState').style.display = 'none';
          renderAnalysis(message.analysis);
          break;

        case 'error':
          document.getElementById('analyzingState').style.display = 'none';
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
    ChangeImpactPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
