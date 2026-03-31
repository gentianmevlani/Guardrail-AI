import * as vscode from "vscode";
import * as path from "path";
import { ApiClient } from "./services/api-client";
import { RealityCheckDiagnosticsProvider } from "./diagnostics";
import { RealityCheckCodeLensProvider } from "./codelens";
import { RealityCheckHoverProvider } from "./hover";
import { AIIntentVerifier } from "./ai-intent-verifier";
import { RealityCheckService } from "./reality-check-service";
import { GuardrailMCPClient, ScanResult } from "./mcp-client";
import { ScoreBadge } from "./score-badge";
import { AgentVerifier } from "./agent-verifier";
import { MDCGeneratorPanel } from "./features/mdc-generator-panel";
import { ComplianceDashboard } from "./features/compliance-dashboard";
import { SecurityScannerPanel } from "./features/security-scanner-panel";
import { PerformanceMonitor, PerformancePanel } from "./features/performance-monitor";
import { ChangeImpactAnalyzer, ChangeImpactPanel } from "./features/change-impact-analyzer";
import { AIExplainerPanel } from "./features/ai-explainer-panel";
import { TeamCollaborationPanel } from "./features/team-collaboration-panel";
import { ProductionIntegrityPanel } from "./features/production-integrity-panel";
import { GuardrailDashboardPanel } from "./features/guardrail-dashboard-panel";
import {
  GuardrailSidebarViewProvider,
  GUARDRAIL_SIDEBAR_VIEW_ID,
} from "./features/guardrail-sidebar-view";
import { GuardrailQuickFixProvider } from "./quick-fixes";
import {
  coerceRange,
  coerceUri,
  explainFinding,
  moveSecretToEnv,
  showContractDiff,
} from "./quick-fix-commands";
import { getGuardrailPanelHead } from "./webview-shared-styles";

let diagnosticsProvider: RealityCheckDiagnosticsProvider;
let codeLensProvider: RealityCheckCodeLensProvider;
let hoverProvider: RealityCheckHoverProvider;
let aiVerifier: AIIntentVerifier;
let realityCheckService: RealityCheckService;
let mcpClient: GuardrailMCPClient;
let scoreBadge: ScoreBadge;
let statusBarItem: vscode.StatusBarItem;
let agentVerifier: AgentVerifier;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  // Store extension context for use in enterprise features
  extensionContext = context;

  // Initialize MCP client and score badge
  mcpClient = new GuardrailMCPClient();
  scoreBadge = new ScoreBadge(mcpClient);
  context.subscriptions.push(mcpClient);
  context.subscriptions.push(scoreBadge);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GUARDRAIL_SIDEBAR_VIEW_ID,
      new GuardrailSidebarViewProvider(context.extensionUri),
    ),
  );

  // Initialize services
  realityCheckService = new RealityCheckService();
  diagnosticsProvider = new RealityCheckDiagnosticsProvider(
    realityCheckService,
  );
  codeLensProvider = new RealityCheckCodeLensProvider(realityCheckService);
  hoverProvider = new RealityCheckHoverProvider(realityCheckService);
  aiVerifier = new AIIntentVerifier();
  agentVerifier = new AgentVerifier();
  context.subscriptions.push(agentVerifier);

  // Create diagnostics collection
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("guardrail");
  context.subscriptions.push(diagnosticCollection);

  // Register diagnostics provider
  diagnosticsProvider.setDiagnosticCollection(diagnosticCollection);

  // Register CodeLens provider for supported languages
  const supportedLanguages = [
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
    "python",
    "go",
    "rust",
    "java",
    "csharp",
  ];

  for (const language of supportedLanguages) {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        { language, scheme: "file" },
        codeLensProvider,
      ),
    );

    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { language, scheme: "file" },
        hoverProvider,
      ),
    );

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { language, scheme: "file" },
        new GuardrailQuickFixProvider(),
        { providedCodeActionKinds: GuardrailQuickFixProvider.providedCodeActionKinds },
      ),
    );
  }

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "guardrail.showFindings";
  statusBarItem.tooltip = "guardrail Reality Check";
  updateStatusBar(0, 0, 0);
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register verification commands
  context.subscriptions.push(
    vscode.commands.registerCommand("guardrail.verifyLastOutput", async () => {
      const result = await agentVerifier.verifyFromClipboard();
      if (result.success) {
        const action = await vscode.window.showInformationMessage(
          "✅ Verification PASSED",
          "Apply Diff",
          "View Report"
        );
        if (action === "Apply Diff") {
          await agentVerifier.applyVerifiedDiff();
        } else if (action === "View Report") {
          agentVerifier.showReport();
        }
      } else {
        const action = await vscode.window.showErrorMessage(
          `❌ Verification FAILED: ${result.blockers[0] || "Unknown error"}`,
          "Copy Fix Prompt",
          "View Report"
        );
        if (action === "Copy Fix Prompt") {
          const copied = await agentVerifier.copyFailureContextToClipboard();
          if (copied) {
            vscode.window.showInformationMessage("Fix prompt copied to clipboard");
          }
        } else if (action === "View Report") {
          agentVerifier.showReport();
        }
      }
    }),
    vscode.commands.registerCommand("guardrail.verifySelection", async () => {
      const result = await agentVerifier.verifyFromSelection();
      if (result.success) {
        const action = await vscode.window.showInformationMessage(
          "✅ Verification PASSED",
          "Apply Diff",
          "View Report"
        );
        if (action === "Apply Diff") {
          await agentVerifier.applyVerifiedDiff();
        } else if (action === "View Report") {
          agentVerifier.showReport();
        }
      } else {
        const action = await vscode.window.showErrorMessage(
          `❌ Verification FAILED: ${result.blockers[0] || "Unknown error"}`,
          "Copy Fix Prompt",
          "View Report"
        );
        if (action === "Copy Fix Prompt") {
          const copied = await agentVerifier.copyFailureContextToClipboard();
          if (copied) {
            vscode.window.showInformationMessage("Fix prompt copied to clipboard");
          }
        } else if (action === "View Report") {
          agentVerifier.showReport();
        }
      }
    }),
    vscode.commands.registerCommand("guardrail.applyVerifiedDiff", async () => {
      await agentVerifier.applyVerifiedDiff();
    }),
    vscode.commands.registerCommand("guardrail.showVerificationReport", () => {
      agentVerifier.showReport();
    }),
    vscode.commands.registerCommand("guardrail.copyFixPrompt", async () => {
      const copied = await agentVerifier.copyFailureContextToClipboard();
      if (copied) {
        vscode.window.showInformationMessage("Fix prompt copied to clipboard");
      } else {
        vscode.window.showWarningMessage("No fix prompt available. Run verification first.");
      }
    }),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("guardrail.scanWorkspace", () =>
      scanWorkspace(),
    ),
    vscode.commands.registerCommand("guardrail.showDashboard", () =>
      showDashboard(),
    ),
    vscode.commands.registerCommand("guardrail.realityCheck", () =>
      analyzeSelection(),
    ),
    vscode.commands.registerCommand("guardrail.realityCheckFile", () =>
      analyzeCurrentFile(),
    ),
    vscode.commands.registerCommand("guardrail.realityCheckWorkspace", () =>
      analyzeWorkspace(),
    ),
    vscode.commands.registerCommand("guardrail.verifyIntent", () =>
      verifyIntent(),
    ),
    vscode.commands.registerCommand("guardrail.toggleInlineHints", () =>
      toggleInlineHints(),
    ),
    vscode.commands.registerCommand("guardrail.showFindings", () =>
      showFindingsPanel(),
    ),
    vscode.commands.registerCommand("guardrail.applyFix", (finding: any) =>
      applyFix(finding),
    ),
    vscode.commands.registerCommand("guardrail.runShip", () =>
      runShipCheck(),
    ),
    vscode.commands.registerCommand("guardrail.runReality", () =>
      runRealityMode(),
    ),
    vscode.commands.registerCommand("guardrail.scanSecrets", () =>
      scanSecrets(),
    ),
    vscode.commands.registerCommand("guardrail.scanVulnerabilities", () =>
      scanVulnerabilities(),
    ),
    vscode.commands.registerCommand("guardrail.runSmells", () =>
      runSmells(),
    ),
    vscode.commands.registerCommand("guardrail.openWebDashboard", () =>
      openWebDashboard(),
    ),
    vscode.commands.registerCommand("guardrail.runFix", () =>
      runAutoFix(),
    ),
    vscode.commands.registerCommand(
      "guardrail.dismissFinding",
      (finding: any) => dismissFinding(finding),
    ),
    vscode.commands.registerCommand("guardrail.validateCode", () =>
      validateSelectedCode(),
    ),
    // ── Device Code Login ──
    vscode.commands.registerCommand("guardrail.login", async () => {
      const { ApiClient } = await import("./services/api-client");
      const client = new ApiClient(extensionContext);

      const signal = { cancelled: false };

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Guardrail — Logging in",
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => { signal.cancelled = true; });

          try {
            progress.report({ message: "Requesting device code…" });

            const result = await client.deviceCodeLogin(
              (userCode, verificationUrl) => {
                progress.report({
                  message: `Code: ${userCode} — Opening browser…`,
                });
                void vscode.env.openExternal(vscode.Uri.parse(verificationUrl));
                void vscode.window.showInformationMessage(
                  `Enter code ${userCode} in your browser to authorize this device.`,
                  "Copy Code",
                ).then((action) => {
                  if (action === "Copy Code") {
                    void vscode.env.clipboard.writeText(userCode);
                  }
                });
              },
              signal,
            );

            // Store user info
            await client.setUserInfo({
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              plan: result.plan,
            });

            // Refresh sidebar to show logged-in state
            GuardrailSidebarViewProvider.refreshIfOpen();

            void vscode.window.showInformationMessage(
              `Logged in as ${result.user.email || result.user.name} (${result.plan})`,
            );
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Login failed";
            if (msg !== "Login cancelled") {
              void vscode.window.showErrorMessage(`Login failed: ${msg}`);
            }
          }
        },
      );
    }),
    vscode.commands.registerCommand("guardrail.logout", async () => {
      const { ApiClient } = await import("./services/api-client");
      const client = new ApiClient(extensionContext);
      await client.logout();
      GuardrailSidebarViewProvider.refreshIfOpen();
      void vscode.window.showInformationMessage("Logged out of Guardrail");
    }),
    // Enterprise commands
    vscode.commands.registerCommand("guardrail.openMDCGenerator", () =>
      openMDCGenerator(),
    ),
    vscode.commands.registerCommand("guardrail.openComplianceDashboard", () =>
      openComplianceDashboard(),
    ),
    vscode.commands.registerCommand("guardrail.openSecurityScanner", () =>
      openSecurityScanner(),
    ),
    vscode.commands.registerCommand("guardrail.openPerformanceMonitor", () =>
      openPerformanceMonitor(),
    ),
    vscode.commands.registerCommand("guardrail.openChangeImpactAnalyzer", () =>
      openChangeImpactAnalyzer(),
    ),
    vscode.commands.registerCommand("guardrail.openAIExplainer", () =>
      openAIExplainer(),
    ),
    vscode.commands.registerCommand("guardrail.openTeamCollaboration", () =>
      openTeamCollaboration(),
    ),
    vscode.commands.registerCommand("guardrail.openProductionIntegrity", () =>
      openProductionIntegrity(),
    ),
    vscode.commands.registerCommand(
      "guardrail.moveSecretToEnv",
      async (uri: unknown, range: unknown) => {
        const u = coerceUri(uri);
        const rg = coerceRange(range);
        if (!u || !rg) {
          vscode.window.showWarningMessage(
            "Move to .env: open a file from the editor and use Quick Fix on a guardrail finding.",
          );
          return;
        }
        await moveSecretToEnv(u, rg);
      },
    ),
    vscode.commands.registerCommand(
      "guardrail.showContractDiff",
      async (uri: unknown, range: unknown) => {
        const u = coerceUri(uri);
        const rg = coerceRange(range);
        if (!u || !rg) {
          vscode.window.showWarningMessage(
            "Contract diff: use Quick Fix from a guardrail diagnostic.",
          );
          return;
        }
        await showContractDiff(u, rg);
      },
    ),
    vscode.commands.registerCommand(
      "guardrail.explainFinding",
      async (uri: unknown, raw: unknown) => {
        const u = coerceUri(uri);
        if (!u) {
          vscode.window.showWarningMessage(
            "Explain finding: use Quick Fix from a guardrail diagnostic.",
          );
          return;
        }
        await explainFinding(u, raw);
      },
    ),
  );

  // Listen for document changes
  const config = vscode.workspace.getConfiguration("guardrail");

  if (config.get("analyzeOnSave")) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isSupportedLanguage(document.languageId)) {
          analyzeDocument(document);
        }
      }),
    );
  }

  if (config.get("analyzeOnType")) {
    let debounceTimer: NodeJS.Timeout;
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (isSupportedLanguage(event.document.languageId)) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            analyzeDocument(event.document);
          }, 1000);
        }
      }),
    );
  }

  // Analyze active document on activation
  if (vscode.window.activeTextEditor) {
    const doc = vscode.window.activeTextEditor.document;
    if (isSupportedLanguage(doc.languageId)) {
      analyzeDocument(doc);
    }
  }

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isSupportedLanguage(editor.document.languageId)) {
        analyzeDocument(editor.document);
      }
    }),
  );

  // Load last scan on activation
  loadLastScan();

  const activationHintKey = "guardrail.activationHintShown";
  if (!context.globalState.get(activationHintKey)) {
    void context.globalState.update(activationHintKey, true);
    void vscode.window.showInformationMessage(
      "guardrail: Scan Workspace uses Ctrl+Shift+Alt+G (Cmd+Shift+Alt+G on Mac), or run Ship Check from the Command Palette.",
    );
  }
}

/**
 * Scan entire workspace with guardrail
 */
async function scanWorkspace(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    scoreBadge.setNoWorkspace();
    vscode.window.showWarningMessage(
      "Open a workspace to scan with guardrail.",
    );
    return;
  }

  const projectPath = workspaceFolders[0].uri.fsPath;

  scoreBadge.setScanning();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🛡️ guardrail Scan",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Analyzing workspace..." });

        const result = await mcpClient.scan(projectPath);

        scoreBadge.updateScore(result);
        GuardrailDashboardPanel.refreshIfOpen();

        // Show result notification
        const action = result.canShip ? "View Report" : "View Issues";
        const icon =
          result.score >= 80 ? "🟢" : result.score >= 50 ? "🟡" : "🔴";

        const selection = await vscode.window.showInformationMessage(
          `${icon} guardrail Score: ${result.score}/100 - ${result.canShip ? "Ready to ship!" : "Issues found"}`,
          action,
        );

        if (selection === action) {
          showDashboard();
        }
      } catch (error: any) {
        scoreBadge.setError(error.message);
        vscode.window.showErrorMessage(
          `guardrail scan failed: ${error.message}`,
        );
      }
    },
  );
}

/**
 * Load last scan results on activation
 */
async function loadLastScan(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    scoreBadge.setNoWorkspace();
    return;
  }

  try {
    const lastScan = await mcpClient.getLastScan(
      workspaceFolders[0].uri.fsPath,
    );
    if (lastScan) {
      scoreBadge.updateScore(lastScan);
      GuardrailDashboardPanel.refreshIfOpen();
    }
  } catch {
    // No previous scan, that's fine
  }
}

/**
 * Validate selected AI-generated code
 */
async function validateSelectedCode(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage("Select code to validate");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🤖 Validating AI Code",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Checking for hallucinations..." });

        const result = await mcpClient.validate(selectedText);

        if (result.status === "passed") {
          vscode.window.showInformationMessage(
            `✅ Code validation passed (${result.score}/100)`,
          );
        } else {
          const issues = result.issues.map((i) => `• ${i.message}`).join("\n");
          vscode.window.showWarningMessage(
            `⚠️ Code validation found issues (${result.score}/100):\n${issues}`,
          );
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Validation failed: ${error.message}`);
      }
    },
  );
}

/**
 * Show guardrail dashboard
 */
function showDashboard(): void {
  GuardrailDashboardPanel.createOrShow();
}

function isSupportedLanguage(languageId: string): boolean {
  const supported = [
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
    "python",
    "go",
    "rust",
    "java",
    "csharp",
  ];
  return supported.includes(languageId);
}

async function analyzeDocument(document: vscode.TextDocument): Promise<void> {
  const config = vscode.workspace.getConfiguration("guardrail");
  if (!config.get("enabled")) return;

  try {
    statusBarItem.text = "$(sync~spin) Analyzing...";
    const findings = await diagnosticsProvider.analyze(document);

    const critical = findings.filter((f) => f.type === "critical").length;
    const warnings = findings.filter((f) => f.type === "warning").length;
    const suggestions = findings.filter((f) => f.type === "suggestion").length;

    updateStatusBar(critical, warnings, suggestions);
    codeLensProvider.updateFindings(document.uri, findings);
    hoverProvider.updateFindings(document.uri, findings);
  } catch (error) {
    console.error("Reality Check analysis failed:", error);
    statusBarItem.text = "$(error) Reality Check Error";
  }
}

function updateStatusBar(
  critical: number,
  warnings: number,
  suggestions: number,
): void {
  const total = critical + warnings + suggestions;
  if (total === 0) {
    statusBarItem.text = "$(check) Reality Check";
    statusBarItem.backgroundColor = undefined;
  } else if (critical > 0) {
    statusBarItem.text = `$(alert) ${critical} critical, ${warnings} warnings`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
  } else if (warnings > 0) {
    statusBarItem.text = `$(warning) ${warnings} warnings, ${suggestions} hints`;
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  } else {
    statusBarItem.text = `$(info) ${suggestions} hints`;
    statusBarItem.backgroundColor = undefined;
  }
}

async function analyzeSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage(
      "No text selected. Select code to analyze.",
    );
    return;
  }

  try {
    const findings = await realityCheckService.analyzeCode(
      selectedText,
      editor.document.fileName,
    );
    showFindingsQuickPick(findings);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
  }
}

async function analyzeCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  await analyzeDocument(editor.document);
  vscode.window.showInformationMessage(
    "Reality Check complete. See Problems panel for findings.",
  );
}

async function analyzeWorkspace(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("No workspace folder open");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🔮 Running Full Production Reality Check...",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({ increment: 0, message: "Starting analysis..." });

        const result = await realityCheckService.productionIntegrityCheck(
          workspaceFolders[0].uri.fsPath,
        );

        progress.report({ increment: 100, message: "Complete!" });

        // Show results in a webview
        showProductionAuditResults(result);
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Production audit failed: ${error.message}`,
        );
      }
    },
  );
}

async function verifyIntent(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showWarningMessage("Select code to verify intent");
    return;
  }

  const config = vscode.workspace.getConfiguration("guardrail");
  const apiKey = config.get<string>("openaiApiKey");

  if (!apiKey) {
    const setKey = await vscode.window.showWarningMessage(
      "OpenAI API key required for AI intent verification",
      "Set API Key",
    );
    if (setKey) {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "guardrail.openaiApiKey",
      );
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🤖 AI Intent Verification...",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Analyzing with AI..." });

        const result = await aiVerifier.verify(selectedText, apiKey);
        showAIVerificationResults(result, editor);
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `AI verification failed: ${error.message}`,
        );
      }
    },
  );
}

function toggleInlineHints(): void {
  const config = vscode.workspace.getConfiguration("guardrail");
  const current = config.get("showInlineHints");
  config.update("showInlineHints", !current, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    `Inline hints ${!current ? "enabled" : "disabled"}`,
  );
}

function showFindingsPanel(): void {
  vscode.commands.executeCommand("workbench.action.problems.focus");
}

function showFindingsQuickPick(findings: any[]): void {
  if (findings.length === 0) {
    vscode.window.showInformationMessage(
      "✅ No reality gaps detected! Your code does what you think.",
    );
    return;
  }

  const items = findings.map((f) => ({
    label: `${f.type === "critical" ? "❌" : f.type === "warning" ? "⚠️" : "💡"} ${f.category}`,
    description: f.intent,
    detail: `Reality: ${f.reality}`,
    finding: f,
  }));

  vscode.window
    .showQuickPick(items, {
      placeHolder: "Reality Check Findings",
      matchOnDescription: true,
      matchOnDetail: true,
    })
    .then((selected) => {
      if (selected) {
        showFindingDetail(selected.finding);
      }
    });
}

function showFindingDetail(finding: any): void {
  const panel = vscode.window.createWebviewPanel(
    "guardrailFinding",
    `Reality Check: ${finding.category}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );

  panel.webview.html = getFindingDetailHtml(finding);
}

function getFindingDetailHtml(finding: any): string {
  const typeColor =
    finding.type === "critical"
      ? "#ff6b6b"
      : finding.type === "warning"
        ? "#ffd93d"
        : "#6bcb77";
  const typeIcon =
    finding.type === "critical"
      ? "❌"
      : finding.type === "warning"
        ? "⚠️"
        : "💡";

  const findingCss = `
    .finding-pad { padding: 16px; }
    .header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    .badge { background: ${typeColor}; color: #001f24; padding: 4px 12px; border-radius: 8px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; font-size: 11px; }
    .section { margin: 16px 0; padding: 15px; background: var(--surface-container-low); border: 1px solid var(--border-subtle); border-radius: 12px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--outline); margin-bottom: 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
    .code { background: var(--surface-container-lowest); padding: 10px; border-radius: 8px; font-family: monospace; overflow-x: auto; border: 1px solid var(--border-subtle); }
    .intent { color: #6ee7b7; }
    .reality { color: #ff6b6b; }
    .confidence { margin-top: 20px; }
    .confidence-bar { height: 8px; background: var(--surface-container-highest); border-radius: 4px; overflow: hidden; }
    .confidence-fill { height: 100%; background: ${typeColor}; }
  `;
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${getGuardrailPanelHead(findingCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell finding-pad">
  <div class="header">
    <span style="font-size: 24px">${typeIcon}</span>
    <h2 style="margin: 0">${finding.category.replace(/-/g, " ").toUpperCase()}</h2>
    <span class="badge">${finding.type.toUpperCase()}</span>
  </div>

  <div class="section">
    <div class="section-title">Code</div>
    <pre class="code">${escapeHtml(finding.code)}</pre>
  </div>

  <div class="section">
    <div class="section-title">What You Think</div>
    <p class="intent">${escapeHtml(finding.intent)}</p>
  </div>

  <div class="section">
    <div class="section-title">The Reality</div>
    <p class="reality">${escapeHtml(finding.reality)}</p>
  </div>

  <div class="section">
    <div class="section-title">Why It Matters</div>
    <p>${escapeHtml(finding.explanation)}</p>
  </div>

  <div class="confidence">
    <div class="section-title">Confidence: ${Math.round(finding.confidence * 100)}%</div>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width: ${finding.confidence * 100}%"></div>
    </div>
  </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDashboardHtml(score: number): string {
  const scoreColor =
    score >= 80 ? "#6bcb77" : score >= 50 ? "#ffd93d" : "#ff6b6b";
  const statusEmoji = score >= 80 ? "🟢" : score >= 50 ? "🟡" : "🔴";
  const verdict =
    score >= 80
      ? "Ready to Ship"
      : score >= 50
        ? "Needs Attention"
        : "Critical Issues";

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: var(--vscode-font-family); 
      padding: 40px; 
      background: var(--vscode-editor-background); 
      color: var(--vscode-editor-foreground);
      min-height: 100vh;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }
    .score-card {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 20px;
      padding: 50px;
      text-align: center;
      margin-bottom: 30px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }
    .score-value {
      font-size: 96px;
      font-weight: bold;
      color: ${scoreColor};
      line-height: 1;
    }
    .score-label {
      font-size: 18px;
      color: var(--vscode-descriptionForeground);
      margin-top: 10px;
    }
    .verdict {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 30px;
      background: ${scoreColor};
      color: #000;
      border-radius: 30px;
      font-weight: bold;
      font-size: 16px;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 30px;
    }
    .action-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 15px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
    }
    .action-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 40px;
    }
    .feature {
      background: var(--vscode-input-background);
      padding: 25px;
      border-radius: 12px;
      text-align: center;
    }
    .feature-icon {
      font-size: 32px;
      margin-bottom: 10px;
    }
    .feature-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .feature-desc {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-input-border);
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🛡️</div>
    <div class="title">guardrail Dashboard</div>
    <div class="subtitle">Production Readiness & AI Code Safety</div>
  </div>

  <div class="score-card">
    <div class="score-value">${score >= 0 ? score : "—"}</div>
    <div class="score-label">${score >= 0 ? "Production Readiness Score" : "No scan yet"}</div>
    <div class="verdict">${statusEmoji} ${verdict}</div>
  </div>

  <div class="actions">
    <button class="action-btn" onclick="scanWorkspace()">
      🔍 Scan Workspace
    </button>
    <button class="action-btn" onclick="viewReport()">
      📊 View Full Report
    </button>
    <button class="action-btn" onclick="validateCode()">
      🤖 Validate AI Code
    </button>
    <button class="action-btn" onclick="openSettings()">
      ⚙️ Settings
    </button>
  </div>

  <div class="features">
    <div class="feature">
      <div class="feature-icon">🔐</div>
      <div class="feature-title">Secrets Detection</div>
      <div class="feature-desc">Finds hardcoded API keys and credentials</div>
    </div>
    <div class="feature">
      <div class="feature-icon">🎭</div>
      <div class="feature-title">Mock Detection</div>
      <div class="feature-desc">Catches fake data in production code</div>
    </div>
    <div class="feature">
      <div class="feature-icon">🤖</div>
      <div class="feature-title">AI Validation</div>
      <div class="feature-desc">Detects hallucinated code and imports</div>
    </div>
  </div>

  <div class="footer">
    guardrail v1.0.0 • guardrail.dev
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function scanWorkspace() { vscode.postMessage({ command: 'scan' }); }
    function viewReport() { vscode.postMessage({ command: 'report' }); }
    function validateCode() { vscode.postMessage({ command: 'validate' }); }
    function openSettings() { vscode.postMessage({ command: 'settings' }); }
  </script>
</body>
</html>`;
}

function showProductionAuditResults(result: any): void {
  const panel = vscode.window.createWebviewPanel(
    "guardrailAudit",
    "🔮 Production Reality Check",
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  panel.webview.html = getProductionAuditHtml(result);
}

function getProductionAuditHtml(result: any): string {
  const score = result.integrity?.score || 0;
  const grade = result.integrity?.grade || "F";
  const canShip = result.integrity?.canShip || false;

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 30px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .score-box { text-align: center; padding: 40px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; margin-bottom: 30px; }
    .score { font-size: 72px; font-weight: bold; color: ${canShip ? "#6bcb77" : "#ff6b6b"}; }
    .grade { font-size: 32px; margin-top: 10px; }
    .verdict { font-size: 24px; margin-top: 20px; padding: 10px 30px; border-radius: 8px; display: inline-block; background: ${canShip ? "#6bcb77" : "#ff6b6b"}; color: #000; }
    .section { margin: 20px 0; padding: 20px; background: var(--vscode-input-background); border-radius: 12px; }
    .section h3 { margin-top: 0; display: flex; align-items: center; gap: 10px; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--vscode-input-border); }
    .metric:last-child { border-bottom: none; }
    .metric-value { font-weight: bold; }
    .critical { color: #ff6b6b; }
    .warning { color: #ffd93d; }
    .ok { color: #6bcb77; }
  </style>
</head>
<body>
  <div class="score-box">
    <div class="score">${score}</div>
    <div class="grade">Grade: ${grade}</div>
    <div class="verdict">${canShip ? "✅ CLEAR TO SHIP" : "🚫 NOT READY"}</div>
  </div>

  <div class="section">
    <h3>🎭 Reality vs. Expectation</h3>
    <div class="metric">
      <span>API Endpoints Working</span>
      <span class="metric-value ${result.counts?.api?.missing > 0 ? "critical" : "ok"}">${result.counts?.api?.connected || 0} / ${(result.counts?.api?.connected || 0) + (result.counts?.api?.missing || 0)}</span>
    </div>
    <div class="metric">
      <span>Auth Coverage</span>
      <span class="metric-value ${result.counts?.auth?.exposed > 0 ? "critical" : "ok"}">${result.counts?.auth?.protected || 0} protected, ${result.counts?.auth?.exposed || 0} exposed</span>
    </div>
    <div class="metric">
      <span>Hardcoded Secrets</span>
      <span class="metric-value ${result.counts?.secrets?.critical > 0 ? "critical" : "ok"}">${result.counts?.secrets?.critical || 0} critical</span>
    </div>
    <div class="metric">
      <span>Dead Links</span>
      <span class="metric-value ${result.counts?.routes?.deadLinks > 0 ? "warning" : "ok"}">${result.counts?.routes?.deadLinks || 0}</span>
    </div>
    <div class="metric">
      <span>Mock Code in Production</span>
      <span class="metric-value ${(result.counts?.mocks?.critical || 0) > 0 ? "critical" : "ok"}">${(result.counts?.mocks?.critical || 0) + (result.counts?.mocks?.high || 0)} issues</span>
    </div>
  </div>

  <p style="text-align: center; color: var(--vscode-descriptionForeground); margin-top: 30px;">
    Context Enhanced by guardrail AI
  </p>
</body>
</html>`;
}

function showAIVerificationResults(
  result: any,
  editor: vscode.TextEditor,
): void {
  const panel = vscode.window.createWebviewPanel(
    "guardrailAI",
    "🤖 AI Intent Verification",
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );

  panel.webview.html = getAIVerificationHtml(result);
}

function getAIVerificationHtml(result: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .header { text-align: center; margin-bottom: 30px; }
    .section { margin: 20px 0; padding: 15px; background: var(--vscode-input-background); border-radius: 8px; }
    .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .gap { background: #ff6b6b20; border-left: 4px solid #ff6b6b; padding: 10px; margin: 10px 0; border-radius: 0 4px 4px 0; }
    .suggestion { background: #6bcb7720; border-left: 4px solid #6bcb77; padding: 10px; margin: 10px 0; border-radius: 0 4px 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 AI Intent Verification</h1>
    <p>Cross-checked your code against AI understanding</p>
  </div>

  <div class="section">
    <div class="section-title">📝 Inferred Intent</div>
    <p>${escapeHtml(String(result.inferredIntent || "Unable to determine"))}</p>
  </div>

  <div class="section">
    <div class="section-title">🔍 Actual Behavior</div>
    <p>${escapeHtml(String(result.actualBehavior || "Unable to analyze"))}</p>
  </div>

  ${
    result.gaps && result.gaps.length > 0
      ? `
  <div class="section">
    <div class="section-title">⚠️ Semantic Gaps Found</div>
    ${result.gaps.map((g: string) => `<div class="gap">${escapeHtml(String(g))}</div>`).join("")}
  </div>
  `
      : `
  <div class="section">
    <div class="section-title">✅ No Semantic Gaps</div>
    <p>The code appears to do what its structure implies.</p>
  </div>
  `
  }

  ${
    result.suggestions && result.suggestions.length > 0
      ? `
  <div class="section">
    <div class="section-title">💡 Suggestions</div>
    ${result.suggestions.map((s: string) => `<div class="suggestion">${escapeHtml(String(s))}</div>`).join("")}
  </div>
  `
      : ""
  }

  <p style="text-align: center; color: var(--vscode-descriptionForeground); margin-top: 30px;">
    Context Enhanced by guardrail AI
  </p>
</body>
</html>`;
}

async function applyFix(_finding: unknown): Promise<void> {
  await vscode.commands.executeCommand("editor.action.quickFix");
}

async function dismissFinding(finding: any): Promise<void> {
  // TODO: Add to dismissed list
  vscode.window.showInformationMessage(`Dismissed: ${finding.category}`);
}

/**
 * Run Ship Check command
 */
async function runShipCheck(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to run Ship Check.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🚀 Running Ship Check...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await mcpClient.ship(workspaceFolders[0].uri.fsPath);
        scoreBadge.updateScore(result);

        const uploadRuns = vscode.workspace
          .getConfiguration("guardrail")
          .get<boolean>("uploadRunsToCloud", false);
        if (uploadRuns) {
          const api = new ApiClient(extensionContext);
          await api.ensureAuthLoaded();
          if (api.isAuthenticated()) {
            const wsPath = workspaceFolders[0].uri.fsPath;
            const repo = path.basename(wsPath);
            const verdict = result.canShip ? "pass" : "fail";
            const findings = result.issues.map((issue) => ({
              type: issue.type,
              category: issue.category,
              file: issue.file,
              line: issue.line,
              message: issue.message,
            }));
            const up = await api.saveRunToCloud({
              repo,
              verdict,
              score: result.score,
              source: "vscode",
              findings,
              guardrailResult: {
                grade: result.grade,
                canShip: result.canShip,
                counts: result.counts,
              },
            });
            if (!up.success) {
              vscode.window.showWarningMessage(
                `Could not sync run to cloud: ${up.error || "unknown"}`,
              );
            }
          } else {
            vscode.window.showWarningMessage(
              "Upload runs to cloud is enabled but no API key or token is configured in Settings.",
            );
          }
        }

        const message = result.canShip 
          ? `🟢 Ship Ready! Score: ${result.score}/100`
          : `🔴 Not Ready. Score: ${result.score}/100`;
        
        vscode.window.showInformationMessage(message, "View Report");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Ship Check failed: ${error.message}`);
      }
    }
  );
}

/**
 * Run Reality Mode command
 */
async function runRealityMode(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to run Reality Mode.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🔍 Running Reality Mode...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await mcpClient.execCLI("reality", [], workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage("Reality Mode completed!", "View Report");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Reality Mode failed: ${error.message}`);
      }
    }
  );
}

/**
 * Scan for Secrets command
 */
async function scanSecrets(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to scan for secrets.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🔐 Scanning for secrets...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await mcpClient.execCLI("scan:secrets", ["--json"], workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage("Secrets scan completed!", "View Report");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Secrets scan failed: ${error.message}`);
      }
    }
  );
}

/**
 * Scan Vulnerabilities command
 */
async function scanVulnerabilities(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to scan vulnerabilities.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🛡️ Scanning vulnerabilities...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await mcpClient.execCLI("scan:vulnerabilities", ["--json"], workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage("Vulnerability scan completed!", "View Report");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Vulnerability scan failed: ${error.message}`);
      }
    }
  );
}

/**
 * Analyze Code Smells command
 */
async function runSmells(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to analyze code smells.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "👃 Analyzing code smells...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await mcpClient.execCLI("smells", ["--json"], workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage("Code smells analysis completed!", "View Report");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Code smells analysis failed: ${error.message}`);
      }
    }
  );
}

/**
 * Open Web Dashboard command
 */
async function openWebDashboard(): Promise<void> {
  // Check if web dashboard is running locally
  const dashboardUrl = "http://localhost:3000";
  
  try {
    vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
    vscode.window.showInformationMessage(`Opening web dashboard at ${dashboardUrl}`);
  } catch (error: any) {
    // Fallback to remote dashboard
    const remoteUrl = "https://app.guardrail.dev";
    vscode.env.openExternal(vscode.Uri.parse(remoteUrl));
    vscode.window.showInformationMessage(`Opening web dashboard at ${remoteUrl}`);
  }
}

/**
 * Run Auto-Fix command
 */
async function runAutoFix(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to run auto-fix.");
    return;
  }

  const action = await vscode.window.showWarningMessage(
    "Auto-Fix will attempt to automatically fix detected issues. This will modify your code.",
    "Continue",
    "Cancel"
  );

  if (action !== "Continue") {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "🔧 Running Auto-Fix...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await mcpClient.execCLI("fix", ["--dry-run"], workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage("Auto-Fix analysis completed! Review changes before applying.", "Apply Changes");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Auto-Fix failed: ${error.message}`);
      }
    }
  );
}

// Enterprise feature functions
let performanceMonitor: PerformanceMonitor;

function openMDCGenerator() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use MDC Generator.");
    return;
  }
  MDCGeneratorPanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openComplianceDashboard() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use Compliance Dashboard.");
    return;
  }
  ComplianceDashboard.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openSecurityScanner() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use Security Scanner.");
    return;
  }
  SecurityScannerPanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openPerformanceMonitor() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use Performance Monitor.");
    return;
  }
  
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(workspaceFolders[0].uri.fsPath);
  }
  PerformancePanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openChangeImpactAnalyzer() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use Change Impact Analyzer.");
    return;
  }
  ChangeImpactPanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openAIExplainer() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use AI Code Explainer.");
    return;
  }
  AIExplainerPanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openTeamCollaboration() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use Team Collaboration.");
    return;
  }
  TeamCollaborationPanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

function openProductionIntegrity() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("Open a workspace to use Production Integrity Dashboard.");
    return;
  }
  ProductionIntegrityPanel.createOrShow(workspaceFolders[0].uri.fsPath, extensionContext);
}

export function deactivate() {
  console.log("guardrail Reality Check deactivated");
}
