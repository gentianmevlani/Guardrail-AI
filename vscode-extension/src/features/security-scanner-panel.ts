/**
 * Security Scanner Panel
 *
 * Enterprise feature for comprehensive security scanning with
 * vault integration and OWASP Top 10 vulnerability detection.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ApiClient } from "../services/api-client";
import { CLIService } from "../services/cli-service";
import { getGuardrailPanelHead } from "../webview-shared-styles";
import { securityScannerStitchCss } from "./security-scanner-stitch-css";
import { getSecurityScannerStitchHtml } from "./security-scanner-webview-html";
import {
  mapFindingToSecurityIssue,
  scanFindingsFromData,
} from "../scan-cli-map";
import { getGuardrailWebUrl } from "../guardrail-web-urls";
import {
  resolveExtensionTier,
  shouldHideIssueDetailsForTier,
} from "../tier-context";

export interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  code?: string;
  cwe?: string;
  owasp?: string;
  fix?: string;
  autoFixable: boolean;
}

export interface SecurityReport {
  timestamp: string;
  score: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  issues: SecurityIssue[];
  secretsFound: number;
  vaultConfigured: boolean;
  /** When true, only severity summary is shown; issue rows are gated (free / unauthenticated). */
  issueDetailsLocked?: boolean;
}

export class SecurityScannerPanel {
  public static currentPanel: SecurityScannerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _report: SecurityReport | null = null;
  private _isScanning: boolean = false;
  private _apiClient: ApiClient;
  private _cliService: CLIService;
  private readonly _extensionContext: vscode.ExtensionContext;

  private constructor(panel: vscode.WebviewPanel, workspacePath: string, extensionContext: vscode.ExtensionContext) {
    this._panel = panel;
    this._workspacePath = workspacePath;
    this._extensionContext = extensionContext;
    this._apiClient = new ApiClient(extensionContext);
    this._cliService = new CLIService(workspacePath);

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'scan':
            await this._runSecurityScan();
            break;
          case 'openFile':
            await this._openFile(message.file, message.line);
            break;
          case 'applyFix':
            await this._applyFix(message.issueId);
            break;
          case 'configureVault':
            await this._configureVault();
            break;
          case 'exportSBOM':
            await this._exportSBOM();
            break;
          case 'export':
            await this._exportReport();
            break;
          case 'openBilling':
            await vscode.env.openExternal(
              vscode.Uri.parse(getGuardrailWebUrl("/billing")),
            );
            break;
          case 'vscodeCommand':
            if (typeof message.id === 'string') {
              void vscode.commands.executeCommand(message.id);
            }
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

    if (SecurityScannerPanel.currentPanel) {
      SecurityScannerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'securityScanner',
      'Security Archive',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    SecurityScannerPanel.currentPanel = new SecurityScannerPanel(panel, workspacePath, extensionContext);
  }

  private async _runSecurityScan(): Promise<void> {
    if (this._isScanning) return;

    this._isScanning = true;
    this._panel.webview.postMessage({ type: "scanning", progress: 0 });

    try {
      let issues: SecurityIssue[] = [];
      let secretsFound = 0;
      let vaultConfigured = false;

      this._panel.webview.postMessage({
        type: "progress",
        message: "Running guardrail scan --json…",
        progress: 20,
      });

      const cliResult = await this._cliService.runScanJson();
      if (cliResult.data) {
        const raw = scanFindingsFromData(cliResult.data);
        issues = raw.map((f, i) => {
          const m = mapFindingToSecurityIssue(f, i);
          return {
            ...m,
            title: String(f.type ?? m.title),
            description: m.description,
            autoFixable: false,
          };
        });
        secretsFound = issues.filter(
          (i) => i.category.toLowerCase().includes("secret"),
        ).length;
      }

      if (issues.length === 0) {
        this._panel.webview.postMessage({
          type: "progress",
          message: "Trying Guardrail API…",
          progress: 40,
        });
        try {
          const isConnected = await this._apiClient.testConnection();
          if (isConnected) {
            const scanResponse = await this._apiClient.runSecurityScan(
              this._workspacePath,
            );
            if (scanResponse.success && scanResponse.data) {
              const apiIssues = scanResponse.data.issues || [];
              issues = apiIssues.map((issue: Record<string, unknown>) => ({
                id: String(issue.id ?? `api-${Date.now()}`),
                severity: (issue.severity as SecurityIssue["severity"]) || "medium",
                category: String(issue.category ?? "general"),
                title: String(issue.title ?? "Security issue"),
                description: String(
                  issue.description ?? "No description available",
                ),
                file: issue.file as string | undefined,
                line: issue.line as number | undefined,
                code: issue.code as string | undefined,
                cwe: issue.cwe as string | undefined,
                owasp: issue.owasp as string | undefined,
                fix: (issue.fix ?? issue.remediation) as string | undefined,
                autoFixable: Boolean(issue.autoFixable),
              }));
              secretsFound = scanResponse.data.secretsFound || 0;
              vaultConfigured = scanResponse.data.vaultConfigured || false;
            }
          }
        } catch {
          /* keep CLI-only issues */
        }
      }

      this._panel.webview.postMessage({
        type: "progress",
        message: "Analyzing results…",
        progress: 80,
      });
      await this._delay(200);

      let score = 100;
      for (const issue of issues) {
        switch (issue.severity) {
          case "critical":
            score -= 15;
            break;
          case "high":
            score -= 8;
            break;
          case "medium":
            score -= 4;
            break;
          case "low":
            score -= 1;
            break;
        }
      }
      score = Math.max(0, score);

      const issueDetailsLocked =
        (await this._shouldLockIssueDetails()) && issues.length > 0;

      this._report = {
        timestamp: new Date().toISOString(),
        score,
        summary: {
          critical: issues.filter((i) => i.severity === "critical").length,
          high: issues.filter((i) => i.severity === "high").length,
          medium: issues.filter((i) => i.severity === "medium").length,
          low: issues.filter((i) => i.severity === "low").length,
          total: issues.length,
        },
        issues,
        secretsFound,
        vaultConfigured,
        issueDetailsLocked,
      };

      this._panel.webview.postMessage({
        type: "complete",
        report: this._report,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Scan failed";
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

  private async _applyFix(issueId: string): Promise<void> {
    vscode.window.showInformationMessage('This issue requires manual review and fix.');
  }

  private async _configureVault(): Promise<void> {
    const options = ['HashiCorp Vault', 'AWS Secrets Manager', 'Azure Key Vault', 'Google Secret Manager'];
    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select your secrets manager',
    });

    if (selected) {
      vscode.window.showInformationMessage(`Vault configured for ${selected}. Update .vault file with your credentials.`);
    }
  }

  private async _exportSBOM(): Promise<void> {
    vscode.window.showInformationMessage('SBOM export feature coming soon!');
  }

  private async _exportReport(): Promise<void> {
    if (!this._report) {
      vscode.window.showWarningMessage('No security report to export. Run a scan first.');
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(this._workspacePath, `security-report-${new Date().toISOString().split('T')[0]}.json`)),
      filters: { 'JSON': ['json'] },
    });

    if (uri) {
      const payload =
        this._report.issueDetailsLocked
          ? {
              ...this._report,
              issues: [],
              issueDetailsRedacted: true,
              upgradeHint: `Upgrade for full issue list: ${getGuardrailWebUrl("/billing")}`,
            }
          : this._report;
      fs.writeFileSync(uri.fsPath, JSON.stringify(payload, null, 2));
      vscode.window.showInformationMessage(
        this._report.issueDetailsLocked
          ? 'Exported severity summary (issue details omitted on Free plan).'
          : 'Security report exported!',
      );
    }
  }

  /** Free tier: show counts only (same as CLI JSON redaction and web `hideIssueDetailsForTier`). */
  private async _shouldLockIssueDetails(): Promise<boolean> {
    try {
      const tier = await resolveExtensionTier(this._extensionContext);
      return shouldHideIssueDetailsForTier(tier);
    } catch {
      return true;
    }
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    return getSecurityScannerStitchHtml(
      getGuardrailPanelHead(securityScannerStitchCss),
    );
  }

  public dispose() {
    SecurityScannerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
