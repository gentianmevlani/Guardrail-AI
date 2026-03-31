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
import { KINETIC_ARCHIVE_VERSION } from "./kinetic-archive-styles";
import { CLIService } from "./services/cli-service";
import type { CLIResult } from "./services/cli-service";
import {
  getCliStateFilePathForDisplay,
  syncCliCredentialsFromExtension,
  clearCliCredentialsFile,
  trySpawnGuardrailLogout,
} from "./services/cli-credentials-sync";
import { extractJsonObject } from "./scan-cli-map";

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

/** Unified output for CLI invocations from the command palette / sidebar. */
let cliOutputChannel: vscode.OutputChannel;

function getCliForWorkspace(): CLIService | null {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return null;
  }
  return new CLIService(folders[0].uri.fsPath);
}

function showCliResultInOutputChannel(title: string, result: CLIResult): void {
  cliOutputChannel.clear();
  cliOutputChannel.appendLine(`=== ${title} ===`);
  cliOutputChannel.appendLine(`Command: ${result.command}`);
  cliOutputChannel.appendLine(
    `Exit: ${result.exitCode} · ${result.duration}ms`,
  );
  if (result.stdout) {
    cliOutputChannel.appendLine("");
    cliOutputChannel.appendLine(result.stdout);
  }
  if (result.stderr) {
    cliOutputChannel.appendLine("");
    cliOutputChannel.appendLine("stderr:");
    cliOutputChannel.appendLine(result.stderr);
  }
  cliOutputChannel.show(true);
}

export function activate(context: vscode.ExtensionContext) {
  // Store extension context for use in enterprise features
  extensionContext = context;

  cliOutputChannel = vscode.window.createOutputChannel("Guardrail CLI");
  context.subscriptions.push(cliOutputChannel);

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
    vscode.commands.registerCommand("guardrail.runDoctor", () => runDoctorCli()),
    vscode.commands.registerCommand("guardrail.runWhoami", () => runWhoamiCli()),
    vscode.commands.registerCommand("guardrail.runGate", () => runGateCli()),
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

            const syncCli = vscode.workspace
              .getConfiguration("guardrail")
              .get<boolean>("syncCredentialsToCli", true);
            if (syncCli) {
              const apiKey = await extensionContext.secrets.get(
                "guardrail.apiKey",
              );
              if (apiKey) {
                await trySpawnGuardrailLogout();
                await syncCliCredentialsFromExtension({
                  apiKey,
                  email: result.user.email,
                  planLabel: result.plan,
                });
                void vscode.window.showInformationMessage(
                  `Logged in as ${result.user.email || result.user.name} (${result.plan}). CLI updated: ${getCliStateFilePathForDisplay()}`,
                );
              } else {
                void vscode.window.showInformationMessage(
                  `Logged in as ${result.user.email || result.user.name} (${result.plan})`,
                );
              }
            } else {
              void vscode.window.showInformationMessage(
                `Logged in as ${result.user.email || result.user.name} (${result.plan})`,
              );
            }
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
      const syncCli = vscode.workspace
        .getConfiguration("guardrail")
        .get<boolean>("syncCredentialsToCli", true);
      if (syncCli) {
        await trySpawnGuardrailLogout();
        await clearCliCredentialsFile();
      }
      GuardrailSidebarViewProvider.refreshIfOpen();
      void vscode.window.showInformationMessage("Logged out of Guardrail");
    }),
    vscode.commands.registerCommand("guardrail.syncCliCredentials", async () => {
      const { ApiClient } = await import("./services/api-client");
      const client = new ApiClient(extensionContext);
      const apiKey = await extensionContext.secrets.get("guardrail.apiKey");
      if (!apiKey) {
        void vscode.window.showWarningMessage(
          "Sign in first: run “Guardrail: Login” from the command palette or sidebar.",
        );
        return;
      }
      const user = await client.getUserInfo();
      await trySpawnGuardrailLogout();
      await syncCliCredentialsFromExtension({
        apiKey,
        email: user?.email,
        planLabel: user?.plan,
      });
      void vscode.window.showInformationMessage(
        `CLI credentials written to ${getCliStateFilePathForDisplay()}. Try \`guardrail whoami\` in a terminal.`,
      );
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
    score >= 80 ? "#6ee7b7" : score >= 50 ? "#ffd93d" : "#ff6b6b";
  const statusEmoji = score >= 80 ? "🟢" : score >= 50 ? "🟡" : "🔴";
  const verdict =
    score >= 80
      ? "Ready to Ship"
      : score >= 50
        ? "Needs Attention"
        : "Critical Issues";

  const dashboardCss = `
    .db-pad { padding: 24px 16px 32px; max-width: 720px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 28px; }
    .logo { font-size: 40px; margin-bottom: 8px; }
    .title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--on-surface); margin-bottom: 4px; }
    .subtitle { color: var(--on-surface-variant); font-size: 13px; }
    .score-card {
      background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 40px 24px;
      text-align: center;
      margin-bottom: 24px;
    }
    .score-value {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 88px;
      font-weight: 700;
      color: ${scoreColor};
      line-height: 1;
    }
    .score-label {
      font-size: 14px;
      color: var(--outline);
      margin-top: 8px;
    }
    .verdict {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 24px;
      background: ${scoreColor};
      color: #001f24;
      border-radius: 999px;
      font-weight: 700;
      font-size: 14px;
      font-family: 'Space Grotesk', sans-serif;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 20px;
    }
    .action-btn {
      background: var(--surface-container-high);
      color: var(--on-surface);
      border: 1px solid var(--border-subtle);
      padding: 12px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: filter 0.15s;
    }
    .action-btn:hover { filter: brightness(1.08); }
    .features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 32px;
    }
    .feature {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .feature-icon { font-size: 28px; margin-bottom: 8px; }
    .feature-title { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
    .feature-desc { font-size: 11px; color: var(--on-surface-variant); line-height: 1.45; }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      color: var(--outline);
      font-size: 11px;
    }
  `;

  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${getGuardrailPanelHead(dashboardCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell db-pad">
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
    guardrail v${KINETIC_ARCHIVE_VERSION} · guardrail.dev
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function scanWorkspace() { vscode.postMessage({ command: 'scan' }); }
    function viewReport() { vscode.postMessage({ command: 'report' }); }
    function validateCode() { vscode.postMessage({ command: 'validate' }); }
    function openSettings() { vscode.postMessage({ command: 'settings' }); }
  </script>
  </div>
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
  const shipColor = canShip ? "#6ee7b7" : "#ff6b6b";

  const auditCss = `
    .audit-pad { padding: 16px; }
    .score-box { text-align: center; padding: 32px 20px; background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high)); border: 1px solid var(--border-subtle); border-radius: 16px; margin-bottom: 24px; }
    .score { font-size: 64px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; color: ${shipColor}; }
    .grade { font-size: 24px; margin-top: 8px; color: var(--on-surface); }
    .verdict { font-size: 15px; margin-top: 16px; padding: 10px 24px; border-radius: 10px; display: inline-block; background: ${shipColor}; color: #001f24; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
    .section { margin: 16px 0; padding: 18px; background: var(--surface-container-low); border: 1px solid var(--border-subtle); border-radius: 12px; }
    .section h3 { margin-top: 0; display: flex; align-items: center; gap: 10px; font-family: 'Space Grotesk', sans-serif; font-size: 14px; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); font-size: 13px; }
    .metric:last-child { border-bottom: none; }
    .metric-value { font-weight: 700; }
    .critical { color: #ff6b6b; }
    .warning { color: #ffd93d; }
    .ok { color: #6ee7b7; }
    .audit-foot { text-align: center; color: var(--outline); margin-top: 24px; font-size: 12px; }
  `;

  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${getGuardrailPanelHead(auditCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell audit-pad">
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

  <p class="audit-foot">
    Context Enhanced by guardrail AI
  </p>
  </div>
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
  const aiCss = `
    .ai-pad { padding: 16px; max-width: 720px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; color: var(--on-surface); margin-bottom: 8px; }
    .header p { color: var(--on-surface-variant); font-size: 13px; }
    .section { margin: 16px 0; padding: 16px; background: var(--surface-container-low); border: 1px solid var(--border-subtle); border-radius: 12px; }
    .section-title { font-size: 12px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; color: var(--on-surface); }
    .gap { background: rgba(255,107,107,0.12); border-left: 4px solid #ff6b6b; padding: 10px 12px; margin: 10px 0; border-radius: 0 8px 8px 0; }
    .suggestion { background: rgba(110,231,183,0.12); border-left: 4px solid #6ee7b7; padding: 10px 12px; margin: 10px 0; border-radius: 0 8px 8px 0; }
    .ai-foot { text-align: center; color: var(--outline); margin-top: 24px; font-size: 12px; }
  `;

  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${getGuardrailPanelHead(aiCss)}
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell ai-pad">
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

  <p class="ai-foot">
    Context Enhanced by guardrail AI
  </p>
  </div>
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

async function runDoctorCli(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
    void vscode.window.showWarningMessage("Open a workspace to run guardrail doctor.");
    return;
  }
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Guardrail doctor…",
      cancellable: false,
    },
    async () => {
      const result = await cli.runDoctor();
      showCliResultInOutputChannel("guardrail doctor", result);
      if (result.exitCode === 0) {
        void vscode.window.showInformationMessage("Doctor finished — see Guardrail CLI output.");
      } else {
        void vscode.window.showWarningMessage(
          `Doctor exited with code ${result.exitCode}. See Guardrail CLI output.`,
        );
      }
    },
  );
}

async function runWhoamiCli(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
    void vscode.window.showWarningMessage("Open a workspace to run guardrail whoami.");
    return;
  }
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Guardrail whoami…",
      cancellable: false,
    },
    async () => {
      const result = await cli.runWhoami();
      showCliResultInOutputChannel("guardrail whoami", result);
      if (result.exitCode === 0) {
        void vscode.window.showInformationMessage("Whoami — see Guardrail CLI output.");
      } else {
        void vscode.window.showWarningMessage(
          `whoami exited with code ${result.exitCode}. See Guardrail CLI output.`,
        );
      }
    },
  );
}

async function runGateCli(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
    void vscode.window.showWarningMessage("Open a workspace to run guardrail gate.");
    return;
  }
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Guardrail gate…",
      cancellable: false,
    },
    async () => {
      const raw = await cli.executeCommand({
        args: ["gate", "--json"],
        options: { timeout: 300000 },
      });
      const data = extractJsonObject(raw.stdout);
      if (data && typeof data === "object") {
        cliOutputChannel.clear();
        cliOutputChannel.appendLine("=== guardrail gate --json ===");
        cliOutputChannel.appendLine(raw.command);
        cliOutputChannel.appendLine("");
        cliOutputChannel.appendLine(JSON.stringify(data, null, 2));
        cliOutputChannel.show(true);
        const blocked = (data as Record<string, unknown>)["blocked"];
        void vscode.window.showInformationMessage(
          typeof blocked === "boolean"
            ? blocked
              ? "Gate: blocked — see Guardrail CLI output."
              : "Gate: pass — see Guardrail CLI output."
            : raw.exitCode === 0
              ? "Gate finished — see Guardrail CLI output."
              : `Gate exited with code ${raw.exitCode}. See Guardrail CLI output.`,
        );
      } else {
        showCliResultInOutputChannel("guardrail gate --json", raw);
        void vscode.window.showErrorMessage(
          raw.exitCode === 0
            ? "Gate did not return JSON. See Guardrail CLI output."
            : `Gate failed (exit ${raw.exitCode}). See Guardrail CLI output.`,
        );
      }
    },
  );
}

/**
 * Scan for Secrets command — uses legacy `security` → `scan --only=security` (see bin/_router.js).
 */
async function scanSecrets(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
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
        const result = await cli.executeCommand({
          args: ["security", "--json"],
          options: { timeout: 300000 },
        });
        showCliResultInOutputChannel("guardrail security --json", result);
        if (result.exitCode === 0) {
          void vscode.window.showInformationMessage(
            "Secrets scan completed — see Guardrail CLI output.",
          );
        } else {
          void vscode.window.showErrorMessage(
            `Secrets scan failed (exit ${result.exitCode}). See Guardrail CLI output.`,
          );
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Secrets scan failed: ${msg}`);
      }
    },
  );
}

/**
 * Scan Vulnerabilities command — full `guardrail scan --json` (includes dependency / vuln signals in scan JSON).
 */
async function scanVulnerabilities(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
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
        const parsed = await cli.runScanJson();
        if (parsed.success && parsed.data) {
          cliOutputChannel.clear();
          cliOutputChannel.appendLine("=== guardrail scan --json ===");
          cliOutputChannel.appendLine(parsed.command);
          cliOutputChannel.appendLine("");
          cliOutputChannel.appendLine(JSON.stringify(parsed.data, null, 2));
          cliOutputChannel.show(true);
          void vscode.window.showInformationMessage(
            "Scan completed — see Guardrail CLI output.",
          );
        } else {
          void vscode.window.showErrorMessage(
            parsed.error || "Vulnerability scan produced no JSON.",
          );
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Vulnerability scan failed: ${msg}`);
      }
    },
  );
}

/**
 * Analyze Code Smells — legacy `hygiene` → `scan --only=hygiene` (see bin/_router.js).
 */
async function runSmells(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
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
        const result = await cli.executeCommand({
          args: ["hygiene", "--json"],
          options: { timeout: 300000 },
        });
        showCliResultInOutputChannel("guardrail hygiene --json", result);
        if (result.exitCode === 0) {
          void vscode.window.showInformationMessage(
            "Hygiene scan completed — see Guardrail CLI output.",
          );
        } else {
          void vscode.window.showErrorMessage(
            `Hygiene scan failed (exit ${result.exitCode}). See Guardrail CLI output.`,
          );
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Code smells analysis failed: ${msg}`);
      }
    },
  );
}

/**
 * Open Web Dashboard command
 */
async function openWebDashboard(): Promise<void> {
  const config = vscode.workspace.getConfiguration("guardrail");
  const configured = config
    .get<string>("webAppUrl", "https://app.guardrail.dev")
    .replace(/\/$/, "");
  const preferLocal = config.get<boolean>("openLocalWebAppFirst", false);

  let target = `${configured}/?source=vscode`;
  if (preferLocal) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      const r = await fetch("http://localhost:3000/", {
        method: "HEAD",
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.ok) {
        target = "http://localhost:3000/?source=vscode";
      }
    } catch {
      /* use configured remote */
    }
  }

  await vscode.env.openExternal(vscode.Uri.parse(target));
  void vscode.window.showInformationMessage("Opening Guardrail web app…");
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
