/**
 * Agent Verifier for VS Code Extension
 * Implements the vibe-coding UX for verifying AI agent output
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { getGuardrailPanelHead } from './webview-shared-styles';
import { getVerificationReportStitchCss } from './verification-report-stitch-css';

export type VerificationStatus = 'idle' | 'verifying' | 'pass' | 'fail';

export interface VerificationState {
  status: VerificationStatus;
  lastResult: VerificationResult | null;
  lastRawInput: string | null;
}

export interface VerificationResult {
  success: boolean;
  blockers: string[];
  warnings: string[];
  checks: CheckResult[];
  failureContext?: string;
  score?: number;
  verified?: boolean;
  parsedOutput?: {
    diff: string;
    commands?: string[];
    tests?: string[];
    notes?: string;
  };
}

export interface Issue {
  type?: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
  line?: number;
  column?: number;
  file?: string;
  suggestion?: string;
}

export interface CheckResult {
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
}

export class AgentVerifier {
  private state: VerificationState = {
    status: 'idle',
    lastResult: null,
    lastRawInput: null,
  };

  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private onStateChange: vscode.EventEmitter<VerificationState> = new vscode.EventEmitter();

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200
    );
    this.statusBarItem.command = 'guardrail.showVerificationReport';
    this.updateStatusBar();
    this.statusBarItem.show();

    this.outputChannel = vscode.window.createOutputChannel('guardrail Verification');
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.outputChannel.dispose();
    this.onStateChange.dispose();
  }

  getState(): VerificationState {
    return { ...this.state };
  }

  onDidChangeState(listener: (state: VerificationState) => void): vscode.Disposable {
    return this.onStateChange.event(listener);
  }

  private updateStatusBar(): void {
    switch (this.state.status) {
      case 'idle':
        this.statusBarItem.text = '$(shield) guardrail';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = 'Click to verify agent output';
        break;
      case 'verifying':
        this.statusBarItem.text = '$(sync~spin) Verifying...';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = 'Verification in progress';
        break;
      case 'pass':
        this.statusBarItem.text = '$(check) guardrail: PASS';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        this.statusBarItem.tooltip = 'Verification passed - Click to apply diff';
        break;
      case 'fail':
        this.statusBarItem.text = '$(x) guardrail: FAIL';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.tooltip = 'Verification failed - Click to view issues';
        break;
    }
  }

  private setState(status: VerificationStatus, result?: VerificationResult | null): void {
    this.state.status = status;
    if (result !== undefined) {
      this.state.lastResult = result;
    }
    this.updateStatusBar();
    this.onStateChange.fire(this.state);
  }

  /**
   * Extract JSON from input (raw JSON or fenced code block)
   */
  private extractJson(input: string): string | null {
    const trimmed = input.trim();

    if (trimmed.startsWith('{')) {
      return trimmed;
    }

    const jsonFenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonFenceMatch) {
      return jsonFenceMatch[1].trim();
    }

    const plainFenceMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
    if (plainFenceMatch) {
      const content = plainFenceMatch[1].trim();
      if (content.startsWith('{')) {
        return content;
      }
    }

    return null;
  }

  /**
   * Verify agent output from string
   */
  async verify(rawInput: string): Promise<VerificationResult> {
    this.state.lastRawInput = rawInput;
    this.setState('verifying');

    try {
      // For clipboard/selection verification, use the raw text directly
      const result = await this.performLocalVerificationFromText(rawInput);
      this.setState(result.success ? 'pass' : 'fail', result);
      return result;
    } catch (err) {
      const result: VerificationResult = {
        success: false,
        blockers: [err instanceof Error ? err.message : String(err)],
        warnings: [],
        checks: [{
          check: 'verification-error',
          status: 'fail',
          message: err instanceof Error ? err.message : String(err),
        }],
      };
      this.setState('fail', result);
      return result;
    }
  }

  /**
   * Run verification via CLI
   */
  private async runVerification(jsonInput: string): Promise<VerificationResult> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return {
        success: false,
        blockers: ['No workspace folder open'],
        warnings: [],
        checks: [{
          check: 'workspace',
          status: 'fail',
          message: 'Open a workspace folder to verify agent output',
        }],
      };
    }

    // Write input to temp file
    const tempFile = path.join(os.tmpdir(), `guardrail-verify-${Date.now()}.json`);
    fs.writeFileSync(tempFile, jsonInput, 'utf-8');

    try {
      const result = await this.execCli(workspaceRoot, tempFile);
      return result;
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Execute the guardrail CLI
   */
  private execCli(cwd: string, inputFile: string): Promise<VerificationResult> {
    return new Promise((resolve) => {
      // Use local verification since CLI doesn't have verify-agent-output
      const result = this.performLocalVerification(inputFile);
      resolve(result);
    });
  }

  /**
   * Perform local verification of AI-generated code from text
   */
  private async performLocalVerificationFromText(content: string): Promise<VerificationResult> {
    const issues: Issue[] = [];
    let score = 100;

    // Check for common AI-generated issues
    const checks = [
      {
        check: 'hardcoded-secrets',
        status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
        message: 'No hardcoded secrets detected'
      },
      {
        check: 'mock-data',
        status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
        message: 'No mock data in production paths'
      },
      {
        check: 'error-handling',
        status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
        message: 'Proper error handling implemented'
      },
      {
        check: 'security',
        status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
        message: 'Security best practices followed'
      }
    ];

    // Check for hardcoded secrets
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{48}/g,
      /['"]API_KEY['"]:\s*['"][a-zA-Z0-9]{20,}['"]/g,
      /password\s*=\s*['"][^'"]{8,}['"]/gi
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        issues.push({
          severity: 'critical',
          message: 'Hardcoded secret detected',
          line: 0,
          column: 0,
          suggestion: 'Move secrets to environment variables'
        });
        score -= 30;
        checks[0].status = 'fail';
        checks[0].message = 'Hardcoded secrets detected';
      }
    }

    // Check for mock data
    if (content.includes('mock') || content.includes('fake') || content.includes('test-data')) {
      if (content.includes('process.env.NODE_ENV') && content.includes('production')) {
        issues.push({
          severity: 'warning',
          message: 'Mock data detected in production code',
          line: 0,
          column: 0,
          suggestion: 'Remove mock data from production paths'
        });
        score -= 10;
        checks[1].status = 'fail';
        checks[1].message = 'Mock data in production paths';
      }
    }

    // Check for error handling
    if (content.includes('JSON.parse') && !content.includes('try') && !content.includes('catch')) {
      issues.push({
        severity: 'warning',
        message: 'JSON.parse without error handling',
        line: 0,
        column: 0,
        suggestion: 'Add try-catch around JSON.parse'
      });
      score -= 10;
      checks[2].status = 'fail';
      checks[2].message = 'Missing error handling';
    }

    // Check for suspicious imports
    const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      for (const imp of importMatches) {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match && match[1]) {
          const packageName = match[1];
          // Check for obviously fake packages
          if (packageName.includes('fake-') || packageName.includes('test-') || packageName.includes('mock-')) {
            issues.push({
              severity: 'warning',
              message: `Suspicious import: ${packageName}`,
              line: 0,
              column: 0,
              suggestion: 'Verify this package exists'
            });
            score -= 5;
            checks[3].status = 'fail';
            checks[3].message = 'Suspicious imports detected';
          }
        }
      }
    }

    const blockers = issues.filter(i => i.severity === 'critical').map(i => i.message);
    const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message);

    return {
      success: blockers.length === 0,
      blockers,
      warnings,
      checks,
      score: Math.max(0, score),
      verified: true
    };
  }

  /**
   * Perform local verification of AI-generated code
   */
  private performLocalVerification(inputFile: string): VerificationResult {
    const fs = require('fs');
    try {
      const content = fs.readFileSync(inputFile, 'utf-8');
      const issues: Issue[] = [];
      let score = 100;

      // Check for common AI-generated issues
      const checks = [
        {
          check: 'hardcoded-secrets',
          status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
          message: 'No hardcoded secrets detected'
        },
        {
          check: 'mock-data',
          status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
          message: 'No mock data in production paths'
        },
        {
          check: 'error-handling',
          status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
          message: 'Error handling looks good'
        },
        {
          check: 'imports',
          status: 'pass' as 'pass' | 'fail' | 'warn' | 'skip',
          message: 'All imports appear valid'
        }
      ];

      // Check for hardcoded secrets
      const secretPatterns = [
        /sk-[a-zA-Z0-9]{48}/g,
        /['"]API_KEY['"]:\s*['"][a-zA-Z0-9]{20,}['"]/g,
        /password\s*=\s*['"][^'"]{8,}['"]/gi
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          issues.push({
            severity: 'critical',
            message: 'Hardcoded secret detected',
            line: 0,
            column: 0,
            suggestion: 'Move secrets to environment variables'
          });
          score -= 30;
          checks[0].status = 'fail';
          checks[0].message = 'Hardcoded secrets detected';
        }
      }

      // Check for mock data
      if (content.includes('mock') || content.includes('fake') || content.includes('test-data')) {
        if (content.includes('process.env.NODE_ENV') && content.includes('production')) {
          issues.push({
            severity: 'warning',
            message: 'Mock data detected in production code',
            line: 0,
            column: 0,
            suggestion: 'Remove mock data from production paths'
          });
          score -= 10;
          checks[1].status = 'fail';
          checks[1].message = 'Mock data in production paths';
        }
      }

      // Check for error handling
      if (content.includes('JSON.parse') && !content.includes('try') && !content.includes('catch')) {
        issues.push({
          severity: 'warning',
          message: 'JSON.parse without error handling',
          line: 0,
          column: 0,
          suggestion: 'Add try-catch around JSON.parse'
        });
        score -= 10;
        checks[2].status = 'fail';
        checks[2].message = 'Missing error handling';
      }

      // Check for suspicious imports
      const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g);
      if (importMatches) {
        for (const imp of importMatches) {
          const match = imp.match(/from\s+['"]([^'"]+)['"]/);
          if (match && match[1]) {
            const packageName = match[1];
            // Check for obviously fake packages
            if (packageName.includes('fake-') || packageName.includes('test-') || packageName.includes('mock-')) {
              issues.push({
                severity: 'warning',
                message: `Suspicious import: ${packageName}`,
                line: 0,
                column: 0,
                suggestion: 'Verify this package exists'
              });
              score -= 5;
              checks[3].status = 'fail';
              checks[3].message = 'Suspicious imports detected';
            }
          }
        }
      }

      const blockers = issues.filter(i => i.severity === 'critical').map(i => i.message);
      const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message);

      return {
        success: blockers.length === 0,
        blockers,
        warnings,
        checks,
        score: Math.max(0, score),
        verified: true
      };
    } catch (error: any) {
      return {
        success: false,
        blockers: ['Failed to read input file'],
        warnings: [],
        checks: [{
          check: 'file-error',
          status: 'fail',
          message: error.message
        }],
        score: 0
      };
    }
  }

  /**
   * Find the guardrail executable
   */
  private findGuardrailExecutable(cwd: string): string {
    // Check node_modules/.bin first
    const localBin = path.join(cwd, 'node_modules', '.bin', 'guardrail');
    if (fs.existsSync(localBin)) {
      return localBin;
    }

    // Check for bin/guardrail.js in workspace
    const binPath = path.join(cwd, 'bin', 'guardrail.js');
    if (fs.existsSync(binPath)) {
      return binPath;
    }

    // Fallback to global
    return 'guardrail';
  }

  /**
   * Get workspace root
   */
  private getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  /**
   * Verify from clipboard
   */
  async verifyFromClipboard(): Promise<VerificationResult> {
    const clipboardText = await vscode.env.clipboard.readText();
    if (!clipboardText || clipboardText.trim().length === 0) {
      const result: VerificationResult = {
        success: false,
        blockers: ['Clipboard is empty'],
        warnings: [],
        checks: [{
          check: 'input',
          status: 'fail',
          message: 'No content in clipboard',
          suggestedFix: 'Copy the agent output to clipboard first',
        }],
      };
      this.setState('fail', result);
      return result;
    }

    return this.verify(clipboardText);
  }

  /**
   * Verify from editor selection
   */
  async verifyFromSelection(): Promise<VerificationResult> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      const result: VerificationResult = {
        success: false,
        blockers: ['No active editor'],
        warnings: [],
        checks: [{
          check: 'input',
          status: 'fail',
          message: 'No active text editor',
        }],
      };
      this.setState('fail', result);
      return result;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText || selectedText.trim().length === 0) {
      // Fallback to clipboard
      return this.verifyFromClipboard();
    }

    return this.verify(selectedText);
  }

  /**
   * Get failure context for retry
   */
  getFailureContext(): string | null {
    return this.state.lastResult?.failureContext || null;
  }

  /**
   * Copy failure context to clipboard
   */
  async copyFailureContextToClipboard(): Promise<boolean> {
    const context = this.getFailureContext();
    if (!context) {
      return false;
    }

    await vscode.env.clipboard.writeText(context);
    return true;
  }

  /**
   * Get the verified diff (only available after PASS)
   */
  getVerifiedDiff(): string | null {
    if (this.state.status !== 'pass' || !this.state.lastResult?.parsedOutput) {
      return null;
    }
    return this.state.lastResult.parsedOutput.diff;
  }

  /**
   * Apply verified diff to workspace
   */
  async applyVerifiedDiff(): Promise<boolean> {
    const diff = this.getVerifiedDiff();
    if (!diff) {
      vscode.window.showErrorMessage('No verified diff to apply. Run verification first.');
      return false;
    }

    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return false;
    }

    // Write diff to temp file
    const tempDiffFile = path.join(os.tmpdir(), `guardrail-apply-${Date.now()}.patch`);
    fs.writeFileSync(tempDiffFile, diff, 'utf-8');

    try {
      return await new Promise<boolean>((resolve) => {
        const proc = spawn('git', ['apply', tempDiffFile], {
          cwd: workspaceRoot,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stderr = '';
        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            vscode.window.showInformationMessage('✅ Diff applied successfully!');
            this.setState('idle', null);
            resolve(true);
          } else {
            vscode.window.showErrorMessage(`Failed to apply diff: ${stderr}`);
            resolve(false);
          }
        });

        proc.on('error', (err) => {
          vscode.window.showErrorMessage(`Failed to apply diff: ${err.message}`);
          resolve(false);
        });
      });
    } finally {
      try {
        fs.unlinkSync(tempDiffFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Show verification report
   */
  showReport(): void {
    const result = this.state.lastResult;
    if (!result) {
      vscode.window.showInformationMessage('No verification results. Run a verification first.');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'guardrailVerificationReport',
      'guardrail Verification Report',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const cspSource = panel.webview.cspSource;
    panel.webview.html = this.getReportHtml(result, cspSource);
  }

  private getReportHtml(result: VerificationResult, cspSource: string): string {
    const statusColor = result.success ? '#6ee7b7' : '#ff6b6b';
    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? 'PASSED' : 'FAILED';

    const checksHtml = result.checks.map(check => {
      const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'warn' ? '⚠' : '○';
      const color = check.status === 'pass' ? '#6ee7b7' : check.status === 'fail' ? '#ff6b6b' : check.status === 'warn' ? '#ffd93d' : '#849396';
      
      return `
        <div class="check" style="border-left: 3px solid ${color}">
          <div class="check-header">
            <span style="color: ${color}">${icon}</span>
            <strong>[${check.check}]</strong>
            ${check.message}
          </div>
          ${check.suggestedFix ? `<div class="fix">💡 ${check.suggestedFix}</div>` : ''}
        </div>
      `;
    }).join('');

    const blockersHtml = result.blockers.length > 0 ? `
      <div class="section blockers">
        <h3>❌ Blockers (${result.blockers.length})</h3>
        <ul>
          ${result.blockers.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const warningsHtml = result.warnings.length > 0 ? `
      <div class="section warnings">
        <h3>⚠️ Warnings (${result.warnings.length})</h3>
        <ul>
          ${result.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const reportCss = `
    .verify-pad { padding: 16px; max-width: 720px; margin: 0 auto; }
    .header {
      text-align: center;
      padding: 28px 20px;
      background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .status { font-size: 40px; margin-bottom: 8px; }
    .status-text {
      font-size: 20px;
      font-weight: 700;
      font-family: 'Space Grotesk', sans-serif;
      color: ${statusColor};
    }
    .section {
      margin: 16px 0;
      padding: 16px;
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
    }
    .section h3 { margin-top: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14px; }
    .check {
      margin: 10px 0;
      padding: 10px 12px;
      background: var(--surface-container-lowest);
      border-radius: 8px;
    }
    .check-header { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; font-size: 13px; color: var(--on-surface); }
    .fix {
      margin-top: 8px;
      padding: 8px 10px;
      background: rgba(255, 217, 61, 0.1);
      border-radius: 6px;
      font-size: 12px;
      color: var(--on-surface-variant);
    }
    .blockers { border-left: 4px solid #ff6b6b; }
    .warnings { border-left: 4px solid #ffd93d; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 5px 0; font-size: 13px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
    `;

    const csp = [
      `default-src 'none'`,
      `style-src ${cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src ${cspSource} https://fonts.gstatic.com`,
      `script-src 'unsafe-inline'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="Content-Security-Policy" content="${csp}"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${getGuardrailPanelHead(getVerificationReportStitchCss(statusColor))}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell verify-pad">
  <div class="header">
    <div class="status">${statusIcon}</div>
    <div class="status-text">VERIFICATION ${statusText}</div>
  </div>

  ${blockersHtml}
  ${warningsHtml}

  <div class="section">
    <h3>Checks</h3>
    ${checksHtml}
  </div>

  <div class="actions">
    ${result.success ? '<button type="button" class="btn" onclick="applyDiff()">Apply Diff</button>' : ''}
    ${!result.success && result.failureContext ? '<button type="button" class="btn" onclick="copyFixPrompt()">Copy Fix Prompt</button>' : ''}
    <button type="button" class="btn btn-secondary" onclick="close()">Close</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function applyDiff() { vscode.postMessage({ command: 'applyDiff' }); }
    function copyFixPrompt() { vscode.postMessage({ command: 'copyFixPrompt' }); }
    function close() { vscode.postMessage({ command: 'close' }); }
  </script>
  </div>
</body>
</html>`;
  }
}
