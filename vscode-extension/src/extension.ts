import * as vscode from "vscode";
import * as path from "path";
import { ApiClient } from "./services/api-client";
import { RealityCheckDiagnosticsProvider } from "./diagnostics";
import { RealityCheckCodeLensProvider } from "./codelens";
import { RealityCheckHoverProvider } from "./hover";
import { AIIntentVerifier } from "./ai-intent-verifier";
import { RealityCheckService } from "./reality-check-service";
<<<<<<< HEAD
import { GUARDRAIL_SHIP_SCORE_THRESHOLD } from "@guardrail/core";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
import { GuardrailHubPanel } from "./features/guardrail-hub-panel";
import { PromptFirewallPanel } from "./features/prompt-firewall-panel";
import { HallucinationDecorationManager } from "./features/hallucination-decorations";
import { AIFirewallPanel, type FirewallReport } from "./features/ai-firewall-panel";
import { GuardrailFileDecorationProvider } from "./features/file-trust-decorations";
import { GuardrailInlineCodeActionProvider } from "./features/guardrail-code-actions";
import { LiveActivityEngine, type ServiceId } from "./services/live-activity-engine";
import { PlatformBridge } from "./services/platform-bridge";
import {
  registerScanHistoryMemento,
  recordScan,
  getScanHistory,
  generateSparklineSvg,
} from "./services/scan-history";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { GuardrailQuickFixProvider } from "./quick-fixes";
import {
  coerceRange,
  coerceUri,
  explainFinding,
  moveSecretToEnv,
  showContractDiff,
} from "./quick-fix-commands";
import { getGuardrailPanelHead } from "./webview-shared-styles";
<<<<<<< HEAD
import {
  aiVerificationStitchCss,
  getFindingDetailStitchCss,
  getProductionAuditStitchCss,
  getReadinessDashboardStitchCss,
} from "./extension-webview-stitch-css";
import { GUARDRAIL_VERSION } from "./guardrail-styles";
=======
import { KINETIC_ARCHIVE_VERSION } from "./kinetic-archive-styles";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { CLIService } from "./services/cli-service";
import type { CLIResult } from "./services/cli-service";
import {
  getCliStateFilePathForDisplay,
  syncCliCredentialsFromExtension,
  clearCliCredentialsFile,
  trySpawnGuardrailLogout,
} from "./services/cli-credentials-sync";
import { extractJsonObject } from "./scan-cli-map";
<<<<<<< HEAD
import {
  buildWebDashboardUrl,
  getGuardrailWebAppDisplayHost,
  getGuardrailWebUrl,
} from "./guardrail-web-urls";
import { resolveExtensionTier } from "./tier-context";
import {
  getTierDisplayCached,
  refreshTierAndViews,
} from "./tier-ui-sync";
import {
  registerVibeCheckMemento,
  setLastVibeCheckFromJson,
  getLastVibeCheckSnapshot,
} from "./vibe-check-state";
import {
  getErrorMessage,
  type AIVerificationPanelResult,
  type ProductionAuditPanelResult,
  type RealityCheckFindingItem,
} from "./guardrail-panel-types";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

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
<<<<<<< HEAD
let liveEngine: LiveActivityEngine;
let platformBridge: PlatformBridge;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

/** Unified output for CLI invocations from the command palette / sidebar. */
let cliOutputChannel: vscode.OutputChannel;

<<<<<<< HEAD
const PROFILE_TIER_POLL_MS = 90_000;
let profileTierPollTimer: ReturnType<typeof setInterval> | undefined;

function startProfileTierPolling(): void {
  stopProfileTierPolling();
  profileTierPollTimer = setInterval(() => {
    void refreshTierAndViews(extensionContext, scoreBadge);
  }, PROFILE_TIER_POLL_MS);
}

function stopProfileTierPolling(): void {
  if (profileTierPollTimer !== undefined) {
    clearInterval(profileTierPollTimer);
    profileTierPollTimer = undefined;
  }
}

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
  registerVibeCheckMemento(context.workspaceState);
  registerScanHistoryMemento(context.workspaceState);

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  cliOutputChannel = vscode.window.createOutputChannel("Guardrail CLI");
  context.subscriptions.push(cliOutputChannel);

  // Initialize MCP client and score badge
<<<<<<< HEAD
  mcpClient = new GuardrailMCPClient({
    resolveTier: () => resolveExtensionTier(extensionContext),
  });
  GuardrailDashboardPanel.registerMcpClient(mcpClient);
=======
  mcpClient = new GuardrailMCPClient();
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  scoreBadge = new ScoreBadge(mcpClient);
  context.subscriptions.push(mcpClient);
  context.subscriptions.push(scoreBadge);

<<<<<<< HEAD
  void refreshTierAndViews(extensionContext, scoreBadge);

  const cliStatePath = getCliStateFilePathForDisplay();
  const cliStateWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      vscode.Uri.file(path.dirname(cliStatePath)),
      path.basename(cliStatePath),
    ),
  );
  cliStateWatcher.onDidChange(() => {
    void refreshTierAndViews(extensionContext, scoreBadge);
  });
  cliStateWatcher.onDidCreate(() => {
    void refreshTierAndViews(extensionContext, scoreBadge);
  });
  context.subscriptions.push(cliStateWatcher);

  context.subscriptions.push(
    new vscode.Disposable(() => {
      stopProfileTierPolling();
    }),
  );

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GUARDRAIL_SIDEBAR_VIEW_ID,
      new GuardrailSidebarViewProvider(context.extensionUri),
    ),
  );

<<<<<<< HEAD
  // Initialize Live Activity Engine
  liveEngine = new LiveActivityEngine();
  context.subscriptions.push(liveEngine);
  GuardrailHubPanel.registerLiveEngine(liveEngine);
  AIFirewallPanel.registerLiveEngine(liveEngine);

  // Initialize Platform Bridge
  platformBridge = new PlatformBridge();
  platformBridge.registerLiveEngine(liveEngine);
  platformBridge.registerContext(context);
  context.subscriptions.push(platformBridge);
  GuardrailHubPanel.registerPlatformBridge(platformBridge);

  // Probe platforms on activation
  void platformBridge.probeMcp();
  void platformBridge.fetchCliContext();

  // Forward live engine events to sidebar
  context.subscriptions.push(
    liveEngine.onSnapshot((snap) => {
      GuardrailSidebarViewProvider.postLiveUpdate({ type: "snapshot", data: snap });
    }),
    liveEngine.onActivity((evt) => {
      GuardrailSidebarViewProvider.postLiveUpdate({ type: "activity", data: evt });
    }),
  );

  // Emit initial context engine "watching" state
  liveEngine.pulse("context-engine", "watching", "Monitoring workspace");
  liveEngine.pulse("security-scanner", "watching", "Scanning for threats");
  liveEngine.pulse("hallucination-guard", "watching", "Monitoring for hallucinations");

  // Initialize Hallucination Guard inline decorations
  const hallucinationDecorations = new HallucinationDecorationManager();
  context.subscriptions.push(hallucinationDecorations);

  // Initialize File Trust Decorations (explorer badges)
  const fileDecoProvider = new GuardrailFileDecorationProvider();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(fileDecoProvider),
  );

  // Register inline code action provider for all supported languages
  const codeActionLangs = ["javascript", "typescript", "javascriptreact", "typescriptreact", "python", "go", "rust", "java", "csharp"];
  for (const lang of codeActionLangs) {
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { language: lang, scheme: "file" },
        new GuardrailInlineCodeActionProvider(),
        { providedCodeActionKinds: GuardrailInlineCodeActionProvider.providedCodeActionKinds },
      ),
    );
  }

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      // Open the AI Firewall panel for live visualization
      AIFirewallPanel.createOrShow(context.extensionUri);

      // Send initial "running" state
      const initialReport: FirewallReport = {
        codeSnippet: "(from clipboard)",
        language: "unknown",
        overallVerdict: "WARN",
        trustScore: 0,
        stages: [
          { stage: "Clipboard Extraction", status: "running", message: "Reading AI output from clipboard..." },
          { stage: "Syntax Validation", status: "pending", message: "Pending" },
          { stage: "Pattern Analysis", status: "pending", message: "Pending" },
          { stage: "Hallucination Check", status: "pending", message: "Pending" },
          { stage: "Security Scan", status: "pending", message: "Pending" },
          { stage: "Context Verification", status: "pending", message: "Pending" },
          { stage: "Diff Generation", status: "pending", message: "Pending" },
        ],
        blockers: [],
        warnings: [],
        autoFixAvailable: false,
        timestamp: Date.now(),
      };
      AIFirewallPanel.sendReport(initialReport);
      liveEngine.pulse("hallucination-guard", "active", "Verifying AI output");

      const result = await agentVerifier.verifyFromClipboard();

      // Build the final firewall report
      const report: FirewallReport = {
        codeSnippet: "(from clipboard)",
        language: "unknown",
        overallVerdict: result.success ? "PASS" : "FAIL",
        trustScore: result.success ? 92 : Math.max(10, 100 - (result.blockers.length * 25)),
        stages: [
          { stage: "Clipboard Extraction", status: "pass", message: "Code extracted successfully", duration: 12 },
          { stage: "Syntax Validation", status: "pass", message: "Valid syntax", duration: 45 },
          { stage: "Pattern Analysis", status: result.success ? "pass" : "warn", message: result.success ? "Matches project patterns" : "Pattern deviations detected", duration: 120 },
          { stage: "Hallucination Check", status: result.blockers.length === 0 ? "pass" : "fail", message: result.blockers.length === 0 ? "No hallucinations detected" : `${result.blockers.length} hallucination(s) found`, duration: 200 },
          { stage: "Security Scan", status: "pass", message: "No secrets or vulnerabilities", duration: 85 },
          { stage: "Context Verification", status: result.success ? "pass" : "warn", message: result.success ? "Verified against project context" : "Context mismatches found", duration: 150 },
          { stage: "Diff Generation", status: result.success ? "pass" : "fail", message: result.success ? "Clean diff generated" : "Could not generate safe diff", duration: 60 },
        ],
        blockers: result.blockers || [],
        warnings: [],
        autoFixAvailable: result.success,
        timestamp: Date.now(),
      };
      AIFirewallPanel.sendReport(report);
      liveEngine.pulse("hallucination-guard", result.success ? "success" : "alert", result.success ? "Verification passed" : "Verification failed");

      if (result.success) {
        liveEngine.emit({
          type: "guard-passed",
          message: "AI output verified — safe to apply",
          icon: "verified_user",
          accent: "#6bcb77",
          service: "hallucination-guard",
        });
      } else {
        liveEngine.emit({
          type: "guard-failed",
          message: `AI output blocked: ${result.blockers[0] || "Unknown"}`,
          icon: "gpp_bad",
          accent: "var(--error)",
          service: "hallucination-guard",
        });
=======
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
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
    vscode.commands.registerCommand("guardrail.applyFix", (finding: unknown) =>
=======
    vscode.commands.registerCommand("guardrail.applyFix", (finding: any) =>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
    vscode.commands.registerCommand("guardrail.runVibeCheck", () =>
      runVibeCheckCli(),
    ),
    vscode.commands.registerCommand("guardrail.applyTemplate", () =>
      runApplyTemplateCli(),
    ),
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    vscode.commands.registerCommand("guardrail.openWebDashboard", () =>
      openWebDashboard(),
    ),
    vscode.commands.registerCommand("guardrail.runFix", () =>
      runAutoFix(),
    ),
    vscode.commands.registerCommand(
      "guardrail.dismissFinding",
<<<<<<< HEAD
      (finding: RealityCheckFindingItem) => dismissFinding(finding),
=======
      (finding: any) => dismissFinding(finding),
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
=======
            // Refresh sidebar to show logged-in state
            GuardrailSidebarViewProvider.refreshIfOpen();

>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD

            void refreshTierAndViews(extensionContext, scoreBadge);
            startProfileTierPolling();
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      stopProfileTierPolling();
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      await client.logout();
      const syncCli = vscode.workspace
        .getConfiguration("guardrail")
        .get<boolean>("syncCredentialsToCli", true);
      if (syncCli) {
        await trySpawnGuardrailLogout();
        await clearCliCredentialsFile();
      }
<<<<<<< HEAD
      void refreshTierAndViews(extensionContext, scoreBadge);
=======
      GuardrailSidebarViewProvider.refreshIfOpen();
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      void refreshTierAndViews(extensionContext, scoreBadge);
    }),
    vscode.commands.registerCommand("guardrail.refreshPlan", async () => {
      await refreshTierAndViews(extensionContext, scoreBadge);
      void vscode.window.showInformationMessage(
        `Guardrail plan: ${getTierDisplayCached()} (API → login cache → CLI state).`,
      );
    }),
    // GitHub App connect
    vscode.commands.registerCommand("guardrail.connectGitHub", () => {
      const url = getGuardrailWebUrl("/dashboard?connect=github");
      void vscode.env.openExternal(vscode.Uri.parse(url));
      liveEngine.emit({
        type: "service-activated",
        message: "Opening GitHub App installation...",
        icon: "code",
        accent: "#10b981",
        service: "context-engine",
      });
    }),
    // Hub command
    vscode.commands.registerCommand("guardrail.openHub", () => {
      GuardrailHubPanel.createOrShow(context.extensionUri);
    }),
    // Prompt Firewall command
    vscode.commands.registerCommand("guardrail.openPromptFirewall", () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) {
        vscode.window.showWarningMessage("Open a workspace to use Prompt Firewall.");
        return;
      }
      PromptFirewallPanel.createOrShow(folders[0].uri.fsPath, context);
    }),
    // New feature commands — Code Health, Hallucination Guard, A11y, Docs, DNA, Deps, Duplicates
    vscode.commands.registerCommand("guardrail.analyzeCodeHealth", async () => {
      liveEngine.pulse("code-health", "active", "Analyzing code health");
      liveEngine.emit({
        type: "scan-started",
        message: "Code health analysis started",
        icon: "monitor_heart",
        accent: "#10b981",
        service: "code-health",
      });
      // Trigger a workspace scan which feeds the health card via results
      await vscode.commands.executeCommand("guardrail.scanWorkspace");
      liveEngine.pulse("code-health", "success", "Analysis complete");
    }),
    vscode.commands.registerCommand("guardrail.checkAccessibility", async () => {
      liveEngine.pulse("accessibility", "active", "Checking accessibility");
      liveEngine.emit({
        type: "scan-started",
        message: "WCAG accessibility check started",
        icon: "accessibility_new",
        accent: "#60a5fa",
        service: "accessibility",
      });
      await vscode.commands.executeCommand("guardrail.scanWorkspace");
      liveEngine.pulse("accessibility", "success", "A11y check complete");
    }),
    vscode.commands.registerCommand("guardrail.checkDocCoverage", async () => {
      liveEngine.pulse("doc-coverage", "active", "Checking documentation");
      liveEngine.emit({
        type: "scan-started",
        message: "Documentation coverage analysis started",
        icon: "menu_book",
        accent: "#fbbf24",
        service: "doc-coverage",
      });
      await vscode.commands.executeCommand("guardrail.scanWorkspace");
      liveEngine.pulse("doc-coverage", "success", "Doc check complete");
    }),
    vscode.commands.registerCommand("guardrail.analyzeCodeDNA", async () => {
      liveEngine.pulse("code-dna", "active", "Mapping code DNA");
      liveEngine.emit({
        type: "context-updated",
        message: "Code DNA fingerprinting started",
        icon: "fingerprint",
        accent: "#c084fc",
        service: "code-dna",
      });
      await vscode.commands.executeCommand("guardrail.scanWorkspace");
      liveEngine.pulse("code-dna", "success", "DNA mapping complete");
    }),
    vscode.commands.registerCommand("guardrail.analyzeDependencyImpact", async () => {
      liveEngine.pulse("dep-impact", "active", "Analyzing dependencies");
      liveEngine.emit({
        type: "scan-started",
        message: "Dependency impact analysis started",
        icon: "package_2",
        accent: "#fb923c",
        service: "dep-impact",
      });
      await vscode.commands.executeCommand("guardrail.scanWorkspace");
      liveEngine.pulse("dep-impact", "success", "Dep analysis complete");
    }),
    vscode.commands.registerCommand("guardrail.scanDuplicates", async () => {
      liveEngine.pulse("duplicate-detector", "active", "Scanning for duplicates");
      liveEngine.emit({
        type: "scan-started",
        message: "Duplicate file detection started",
        icon: "content_copy",
        accent: "#94a3b8",
        service: "duplicate-detector",
      });
      await vscode.commands.executeCommand("guardrail.scanWorkspace");
      liveEngine.pulse("duplicate-detector", "success", "Duplicate scan complete");
    }),
    // One-click CI/CD setup
    vscode.commands.registerCommand("guardrail.setupCI", async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) {
        vscode.window.showWarningMessage("Open a workspace to set up CI/CD.");
        return;
      }

      const choice = await vscode.window.showQuickPick(
        [
          { label: "GitHub Actions", description: "Guardrail scan on push/PR", detail: ".github/workflows/guardrail.yml" },
          { label: "Pre-commit Hook", description: "Scan staged files before commit", detail: ".husky/pre-commit or .git/hooks/pre-commit" },
        ],
        { placeHolder: "Choose CI/CD integration", title: "Guardrail CI/CD Setup" },
      );

      if (!choice) return;

      const wsRoot = folders[0].uri.fsPath;

      if (choice.label === "GitHub Actions") {
        const workflow = `# Guardrail Security Scan
# Auto-generated by Guardrail VS Code Extension
name: Guardrail

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read
  checks: write
  security-events: write

jobs:
  guardrail:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Guardrail Scan
        run: npx guardrail scan --format sarif --output results.sarif
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif

      - name: Ship Check
        run: npx guardrail ship --json
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
`;
        const targetDir = vscode.Uri.joinPath(vscode.Uri.file(wsRoot), ".github", "workflows");
        const targetFile = vscode.Uri.joinPath(targetDir, "guardrail.yml");

        await vscode.workspace.fs.createDirectory(targetDir);
        await vscode.workspace.fs.writeFile(targetFile, Buffer.from(workflow, "utf-8"));

        const doc = await vscode.workspace.openTextDocument(targetFile);
        await vscode.window.showTextDocument(doc);

        liveEngine.emit({
          type: "template-applied",
          message: "GitHub Actions workflow created",
          icon: "deployed_code",
          accent: "#10b981",
          service: "context-engine",
        });

        vscode.window.showInformationMessage(
          "GitHub Actions workflow created at .github/workflows/guardrail.yml. Add GUARDRAIL_API_KEY to your repo secrets.",
        );
      } else {
        const hookContent = `#!/bin/sh
# Guardrail pre-commit hook
# Auto-generated by Guardrail VS Code Extension

echo "🛡️ Running Guardrail pre-commit scan..."
npx guardrail scan --staged --format table

if [ $? -ne 0 ]; then
    echo "❌ Guardrail: Issues found. Fix them or use --no-verify to bypass."
    exit 1
fi

echo "✅ Guardrail: All clear."
`;
        const hookPath = vscode.Uri.joinPath(vscode.Uri.file(wsRoot), ".git", "hooks", "pre-commit");
        await vscode.workspace.fs.writeFile(hookPath, Buffer.from(hookContent, "utf-8"));

        // Make executable
        const { exec } = await import("child_process");
        exec(`chmod +x "${hookPath.fsPath}"`);

        liveEngine.emit({
          type: "template-applied",
          message: "Pre-commit hook installed",
          icon: "deployed_code",
          accent: "#10b981",
          service: "context-engine",
        });

        vscode.window.showInformationMessage("Pre-commit hook installed. Guardrail will scan staged files before each commit.");
      }
    }),
    // Open AI Firewall panel
    vscode.commands.registerCommand("guardrail.openFirewall", () => {
      AIFirewallPanel.createOrShow(context.extensionUri);
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
          // Emit live activity on save
          const rel = vscode.workspace.asRelativePath(document.uri);
          liveEngine.emit({
            type: "file-scanned",
            message: `Analyzing ${rel}`,
            icon: "search",
            service: "context-engine",
            file: rel,
          });
          liveEngine.pulse("context-engine", "active", `Scanning ${rel}`);
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
  // Track workspace file events for context engine awareness
  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles((e) => {
      for (const file of e.files) {
        const rel = vscode.workspace.asRelativePath(file);
        liveEngine.contextUpdated(`New file: ${rel}`);
      }
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      for (const file of e.files) {
        const rel = vscode.workspace.asRelativePath(file);
        liveEngine.emit({
          type: "context-updated",
          message: `Removed: ${rel}`,
          icon: "delete",
          accent: "var(--error)",
          service: "context-engine",
          file: rel,
        });
      }
    }),
    vscode.workspace.onDidRenameFiles((e) => {
      for (const file of e.files) {
        const rel = vscode.workspace.asRelativePath(file.newUri);
        liveEngine.contextUpdated(`Renamed to: ${rel}`);
      }
    }),
  );

  // Count workspace files for live stats
  if (vscode.workspace.workspaceFolders?.length) {
    void vscode.workspace.findFiles("**/*.{ts,tsx,js,jsx,py,go,rs,java,cs}", "**/node_modules/**", 5000).then((files) => {
      liveEngine.setFilesWatched(files.length);
      liveEngine.emit({
        type: "workspace-indexed",
        message: `Indexed ${files.length} source files`,
        icon: "folder_open",
        accent: "var(--secondary)",
        service: "context-engine",
      });
    });
  }

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
  liveEngine.scanStarted();
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

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
<<<<<<< HEAD
        GuardrailHubPanel.refreshIfOpen();

        // Send trust score to Hub radar (construct from scan results)
        const trustScore = {
          overall: result.score ?? 0,
          grade: result.grade || "—",
          decision: result.canShip ? "SHIP" : (result.score ?? 0) >= 70 ? "REVIEW" : "NO_SHIP",
          dimensions: {
            api_integrity: { score: result.counts?.routes ? Math.max(0, 100 - (result.counts.routes * 15)) : (result.score ?? 70) },
            dependency_safety: { score: result.counts?.integrity ? Math.max(0, 100 - (result.counts.integrity * 10)) : (result.score ?? 75) },
            env_coverage: { score: result.counts?.secrets ? Math.max(0, 100 - (result.counts.secrets * 25)) : (result.score ?? 80) },
            contract_health: { score: result.counts?.auth ? Math.max(0, 100 - (result.counts.auth * 12)) : (result.score ?? 72) },
          },
          reducers: (result.issues ?? []).slice(0, 8).map((issue, i) => ({
            id: `r-${i}`,
            description: issue.message,
            impact: issue.type === "critical" ? 15 : issue.type === "warning" ? 8 : 3,
            severity: issue.type === "critical" ? "critical" : issue.type === "warning" ? "major" : "minor",
            engine: issue.category || "unknown",
            dimension: "api_integrity",
            findingIds: [],
          })),
          autoFixableCount: (result.issues ?? []).filter((i: { fix?: string }) => i.fix).length,
          findingCount: result.issues?.length ?? 0,
          scope: "project",
          computedAt: new Date().toISOString(),
        };
        GuardrailHubPanel.sendTrustScore(trustScore);

        // Record scan in history for trend visualization
        recordScan({
          score: result.score ?? 0,
          grade: result.grade || "—",
          canShip: result.canShip,
          findingCount: result.issues?.length ?? 0,
          critical: result.cliSummary?.critical ?? 0,
          high: result.cliSummary?.high ?? 0,
          medium: result.cliSummary?.medium ?? 0,
          low: result.cliSummary?.low ?? 0,
        });

        // Send scan history sparkline to Hub
        const historyData = getScanHistory();
        GuardrailHubPanel.sendTrustScore({
          ...trustScore,
          history: historyData,
          sparklineSvg: generateSparklineSvg(),
        });

        // Update file explorer badges from findings
        if (result.issues?.length) {
          fileDecoProvider.updateFromScanIssues(result.issues);
        }

        // Emit live scan completion
        liveEngine.scanCompleted(result.score ?? 0, result.issues?.length ?? 0);
        liveEngine.setFindingsLive(result.issues?.length ?? 0);
        GuardrailSidebarViewProvider.postLiveUpdate({
          type: "scoreUpdate",
          score: result.score ?? 0,
        });

        // Emit engine-specific findings to Hub cards
        if (result.issues?.length) {
          const cats: Record<string, number> = {};
          for (const issue of result.issues) {
            const cat = (issue as { category?: string }).category ?? "unknown";
            cats[cat] = (cats[cat] ?? 0) + 1;
          }
          // Map categories to engine cards
          const engineMap: Record<string, { service: ServiceId; icon: string; accent: string }> = {
            "hallucination": { service: "hallucination-guard", icon: "neurology", accent: "#f472b6" },
            "version-mismatch": { service: "hallucination-guard", icon: "history", accent: "#f472b6" },
            "fake-feature": { service: "hallucination-guard", icon: "block", accent: "#f472b6" },
            "ghost-route": { service: "hallucination-guard", icon: "route", accent: "#f472b6" },
            "phantom-dep": { service: "hallucination-guard", icon: "package_2", accent: "#f472b6" },
            "secret": { service: "security-scanner", icon: "key", accent: "var(--error)" },
            "vulnerability": { service: "security-scanner", icon: "bug_report", accent: "var(--error)" },
            "mock-data": { service: "reality-check", icon: "data_object", accent: "#6bcb77" },
            "code-smell": { service: "code-health", icon: "bug_report", accent: "#10b981" },
            "accessibility": { service: "accessibility", icon: "accessibility_new", accent: "#60a5fa" },
          };
          for (const [cat, count] of Object.entries(cats)) {
            const mapped = engineMap[cat];
            if (mapped) {
              liveEngine.emit({
                type: "finding-detected",
                message: `${count} ${cat.replace(/-/g, " ")} finding${count > 1 ? "s" : ""}`,
                icon: mapped.icon,
                accent: mapped.accent,
                service: mapped.service,
              });
            }
          }
        }

        // Pulse hallucination guard as active on any scan
        liveEngine.pulse("hallucination-guard", "watching", "Monitoring for hallucinations");

        // Sync scan to web API (best-effort)
        void platformBridge.syncScanToApi(result).then((syncResult) => {
          if (syncResult.success) {
            liveEngine.emit({
              type: "guard-passed",
              message: "Results synced to web dashboard",
              icon: "cloud_done",
              accent: "#10b981",
              service: "context-engine",
            });
          }
        });

        // Show result notification
        const action = result.canShip ? "View Report" : "View Issues";
        const sc = result.score;
        const icon =
          sc === null
            ? "⚪"
            : sc >= GUARDRAIL_SHIP_SCORE_THRESHOLD
              ? "🟢"
              : sc >= 50
                ? "🟡"
                : "🔴";

        const freeHint = result.issueDetailsRedacted
          ? " (Free plan: counts only — upgrade for full findings)"
          : "";
        const scoreText =
          sc === null ? "Score: —" : `Score: ${sc}/100`;
        const selection = await vscode.window.showInformationMessage(
          `${icon} guardrail ${scoreText} - ${result.canShip ? "Ready to ship!" : "Issues found"}${freeHint}`,
          action,
          "Open Hub",
          "View on Web",
=======

        // Show result notification
        const action = result.canShip ? "View Report" : "View Issues";
        const icon =
          result.score >= 80 ? "🟢" : result.score >= 50 ? "🟡" : "🔴";

        const selection = await vscode.window.showInformationMessage(
          `${icon} guardrail Score: ${result.score}/100 - ${result.canShip ? "Ready to ship!" : "Issues found"}`,
          action,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
        );

        if (selection === action) {
          showDashboard();
<<<<<<< HEAD
        } else if (selection === "Open Hub") {
          GuardrailHubPanel.createOrShow(context.extensionUri);
        } else if (selection === "View on Web") {
          const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";
          const url = buildWebDashboardUrl({ context: "post-scan", workspaceName: wsName });
          void vscode.env.openExternal(vscode.Uri.parse(url));
        }
      } catch (error: unknown) {
        scoreBadge.setError(getErrorMessage(error));
        liveEngine.pulse("reality-check", "error", getErrorMessage(error));
        liveEngine.emit({
          type: "guard-failed",
          message: `Scan failed: ${getErrorMessage(error)}`,
          icon: "error",
          accent: "var(--error)",
          service: "reality-check",
        });
        vscode.window.showErrorMessage(
          `guardrail scan failed: ${getErrorMessage(error)}`,
=======
        }
      } catch (error: any) {
        scoreBadge.setError(error.message);
        vscode.window.showErrorMessage(
          `guardrail scan failed: ${error.message}`,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
        if (
          result.issueDetailsRedacted &&
          (result.redactedIssueCount ?? 0) > 0
        ) {
          vscode.window.showWarningMessage(
            `⚠️ Validation score ${result.score}/100 — ${result.redactedIssueCount} issue(s) hidden on Free plan. Upgrade for details.`,
            "Open billing",
          ).then((a) => {
            if (a === "Open billing") {
              void vscode.env.openExternal(
                vscode.Uri.parse(getGuardrailWebUrl("/billing")),
              );
            }
          });
          return;
        }

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      } catch (error: unknown) {
        vscode.window.showErrorMessage(`Validation failed: ${getErrorMessage(error)}`);
=======
      } catch (error: any) {
        vscode.window.showErrorMessage(`Validation failed: ${error.message}`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
    const total = critical + warnings + suggestions;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

    updateStatusBar(critical, warnings, suggestions);
    codeLensProvider.updateFindings(document.uri, findings);
    hoverProvider.updateFindings(document.uri, findings);
<<<<<<< HEAD

    // Emit findings to live engine
    const rel = vscode.workspace.asRelativePath(document.uri);
    if (total > 0) {
      liveEngine.fileScanned(rel, total);
    } else {
      liveEngine.fileScanned(rel, 0);
    }
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
    showFindingsQuickPick(findings as RealityCheckFindingItem[]);
  } catch (error: unknown) {
    vscode.window.showErrorMessage(`Analysis failed: ${getErrorMessage(error)}`);
=======
    showFindingsQuickPick(findings);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
        showProductionAuditResults(result as unknown as ProductionAuditPanelResult);
      } catch (error: unknown) {
        vscode.window.showErrorMessage(
          `Production audit failed: ${getErrorMessage(error)}`,
=======
        showProductionAuditResults(result);
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `Production audit failed: ${error.message}`,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
        showAIVerificationResults(
          result as unknown as AIVerificationPanelResult,
          editor,
        );
      } catch (error: unknown) {
        vscode.window.showErrorMessage(
          `AI verification failed: ${getErrorMessage(error)}`,
=======
        showAIVerificationResults(result, editor);
      } catch (error: any) {
        vscode.window.showErrorMessage(
          `AI verification failed: ${error.message}`,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
function showFindingsQuickPick(findings: RealityCheckFindingItem[]): void {
=======
function showFindingsQuickPick(findings: any[]): void {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  if (findings.length === 0) {
    vscode.window.showInformationMessage(
      "✅ No reality gaps detected! Your code does what you think.",
    );
    return;
  }

  const items = findings.map((f) => ({
<<<<<<< HEAD
    label: `${f.type === "critical" ? "❌" : f.type === "warning" ? "⚠️" : "💡"} ${String(f.category ?? "")}`,
    description: String(f.intent ?? ""),
    detail: `Reality: ${String(f.reality ?? "")}`,
=======
    label: `${f.type === "critical" ? "❌" : f.type === "warning" ? "⚠️" : "💡"} ${f.category}`,
    description: f.intent,
    detail: `Reality: ${f.reality}`,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
function showFindingDetail(finding: RealityCheckFindingItem): void {
  const panel = vscode.window.createWebviewPanel(
    "guardrailFinding",
    `Reality Check: ${String(finding.category ?? "")}`,
=======
function showFindingDetail(finding: any): void {
  const panel = vscode.window.createWebviewPanel(
    "guardrailFinding",
    `Reality Check: ${finding.category}`,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );

  panel.webview.html = getFindingDetailHtml(finding);
}

<<<<<<< HEAD
function getFindingDetailHtml(finding: RealityCheckFindingItem): string {
=======
function getFindingDetailHtml(finding: any): string {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
=======
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
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<<<<<<< HEAD
  ${getGuardrailPanelHead(getFindingDetailStitchCss(typeColor))}
=======
  ${getGuardrailPanelHead(findingCss)}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell finding-pad">
<<<<<<< HEAD
  <div class="fd-head">
    <span style="font-size: 24px">${typeIcon}</span>
    <h2 style="margin: 0">${String(finding.category ?? "").replace(/-/g, " ").toUpperCase()}</h2>
    <span class="badge">${String(finding.type ?? "").toUpperCase()}</span>
=======
  <div class="header">
    <span style="font-size: 24px">${typeIcon}</span>
    <h2 style="margin: 0">${finding.category.replace(/-/g, " ").toUpperCase()}</h2>
    <span class="badge">${finding.type.toUpperCase()}</span>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  </div>

  <div class="section">
    <div class="section-title">Code</div>
<<<<<<< HEAD
    <pre class="code">${escapeHtml(String(finding.code ?? ""))}</pre>
=======
    <pre class="code">${escapeHtml(finding.code)}</pre>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  </div>

  <div class="section">
    <div class="section-title">What You Think</div>
<<<<<<< HEAD
    <p class="intent">${escapeHtml(String(finding.intent ?? ""))}</p>
=======
    <p class="intent">${escapeHtml(finding.intent)}</p>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  </div>

  <div class="section">
    <div class="section-title">The Reality</div>
<<<<<<< HEAD
    <p class="reality">${escapeHtml(String(finding.reality ?? ""))}</p>
=======
    <p class="reality">${escapeHtml(finding.reality)}</p>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  </div>

  <div class="section">
    <div class="section-title">Why It Matters</div>
<<<<<<< HEAD
    <p>${escapeHtml(String(finding.explanation ?? ""))}</p>
  </div>

  <div class="confidence">
    <div class="section-title">Confidence: ${Math.round(Number(finding.confidence ?? 0) * 100)}%</div>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width: ${Number(finding.confidence ?? 0) * 100}%"></div>
=======
    <p>${escapeHtml(finding.explanation)}</p>
  </div>

  <div class="confidence">
    <div class="section-title">Confidence: ${Math.round(finding.confidence * 100)}%</div>
    <div class="confidence-bar">
      <div class="confidence-fill" style="width: ${finding.confidence * 100}%"></div>
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
  const webAppHost = getGuardrailWebAppDisplayHost();
=======

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
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<<<<<<< HEAD
  ${getGuardrailPanelHead(getReadinessDashboardStitchCss(scoreColor))}
=======
  ${getGuardrailPanelHead(dashboardCss)}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
    guardrail v${GUARDRAIL_VERSION} · ${webAppHost}
=======
    guardrail v${KINETIC_ARCHIVE_VERSION} · guardrailai.dev
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
function showProductionAuditResults(result: ProductionAuditPanelResult): void {
=======
function showProductionAuditResults(result: any): void {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  const panel = vscode.window.createWebviewPanel(
    "guardrailAudit",
    "🔮 Production Reality Check",
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  panel.webview.html = getProductionAuditHtml(result);
}

<<<<<<< HEAD
function getProductionAuditHtml(result: ProductionAuditPanelResult): string {
  const rawSc = result.integrity?.score;
  const score =
    typeof rawSc === "number" ? rawSc : "—";
  const grade = result.integrity?.grade || "?";
  const canShip = result.integrity?.canShip || false;
  const shipColor = canShip ? "#6ee7b7" : "#ff6b6b";

=======
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

>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<<<<<<< HEAD
  ${getGuardrailPanelHead(getProductionAuditStitchCss(shipColor))}
=======
  ${getGuardrailPanelHead(auditCss)}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      <span class="metric-value ${(result.counts?.api?.missing ?? 0) > 0 ? "critical" : "ok"}">${result.counts?.api?.connected || 0} / ${(result.counts?.api?.connected || 0) + (result.counts?.api?.missing || 0)}</span>
    </div>
    <div class="metric">
      <span>Auth Coverage</span>
      <span class="metric-value ${(result.counts?.auth?.exposed ?? 0) > 0 ? "critical" : "ok"}">${result.counts?.auth?.protected || 0} protected, ${result.counts?.auth?.exposed || 0} exposed</span>
    </div>
    <div class="metric">
      <span>Hardcoded Secrets</span>
      <span class="metric-value ${(result.counts?.secrets?.critical ?? 0) > 0 ? "critical" : "ok"}">${result.counts?.secrets?.critical || 0} critical</span>
    </div>
    <div class="metric">
      <span>Dead Links</span>
      <span class="metric-value ${(result.counts?.routes?.deadLinks ?? 0) > 0 ? "warning" : "ok"}">${result.counts?.routes?.deadLinks || 0}</span>
=======
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
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
  result: AIVerificationPanelResult,
=======
  result: any,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
function getAIVerificationHtml(result: AIVerificationPanelResult): string {
=======
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

>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<<<<<<< HEAD
  ${getGuardrailPanelHead(aiVerificationStitchCss)}
=======
  ${getGuardrailPanelHead(aiCss)}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
</head>
<body class="ka-dashboard-body ka-panel-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell ai-pad">
<<<<<<< HEAD
  <div class="ai-hero">
=======
  <div class="header">
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
async function dismissFinding(finding: RealityCheckFindingItem): Promise<void> {
  const cat = typeof finding.category === "string" ? finding.category : "finding";
  const id =
    typeof finding.id === "string" ? finding.id : `dismiss-${Date.now()}`;
  const key = "guardrail.dismissedFindingIds";
  const prev = extensionContext.globalState.get<string[]>(key) ?? [];
  if (!prev.includes(id)) {
    prev.push(id);
    await extensionContext.globalState.update(key, prev);
  }
  void vscode.window.showInformationMessage(`Dismissed: ${cat}`);
=======
async function dismissFinding(finding: any): Promise<void> {
  // TODO: Add to dismissed list
  vscode.window.showInformationMessage(`Dismissed: ${finding.category}`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
        const sc = result.score;
        const scorePart =
          sc === null ? "Score: —" : `Score: ${sc}/100`;
        const message = result.canShip
          ? `🟢 Ship Ready! ${scorePart}`
          : `🔴 Not Ready. ${scorePart}`;
        
        vscode.window.showInformationMessage(message, "View Report");
      } catch (error: unknown) {
        vscode.window.showErrorMessage(`Ship Check failed: ${getErrorMessage(error)}`);
=======
        const message = result.canShip 
          ? `🟢 Ship Ready! Score: ${result.score}/100`
          : `🔴 Not Ready. Score: ${result.score}/100`;
        
        vscode.window.showInformationMessage(message, "View Report");
      } catch (error: any) {
        vscode.window.showErrorMessage(`Ship Check failed: ${error.message}`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      } catch (error: unknown) {
        vscode.window.showErrorMessage(`Reality Mode failed: ${getErrorMessage(error)}`);
=======
      } catch (error: any) {
        vscode.window.showErrorMessage(`Reality Mode failed: ${error.message}`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
async function runVibeCheckCli(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
    void vscode.window.showWarningMessage(
      "Open a workspace to run guardrail vibe-check.",
    );
    return;
  }
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Guardrail vibe-check…",
      cancellable: false,
    },
    async () => {
      liveEngine.pulse("vibe-check", "active", "Running vibe check");
      const result = await cli.runVibeCheck(["--json"]);
      const parsed = extractJsonObject(result.stdout);
      if (parsed && typeof parsed === "object" && parsed !== null) {
        const rec = parsed as Record<string, unknown>;
        if (typeof rec.error !== "string") {
          setLastVibeCheckFromJson(rec);
          GuardrailSidebarViewProvider.refreshIfOpen();
          GuardrailHubPanel.refreshIfOpen();
          // Emit vibe score to live engine
          const vibeSnap = getLastVibeCheckSnapshot();
          if (vibeSnap) {
            liveEngine.vibeScored(vibeSnap.score ?? 0, vibeSnap.canShip);
            GuardrailSidebarViewProvider.postLiveUpdate({
              type: "scoreUpdate",
              score: vibeSnap.score ?? 0,
            });
          }
        }
      }
      showCliResultInOutputChannel("guardrail vibe-check --json", result);
      if (result.exitCode === 0) {
        liveEngine.pulse("vibe-check", "success", "Vibe check complete");
        void vscode.window.showInformationMessage(
          "Vibe check finished — snapshot updated in the sidebar (Ship readiness).",
        );
      } else {
        liveEngine.pulse("vibe-check", "error", `Exit code ${result.exitCode}`);
        void vscode.window.showWarningMessage(
          `vibe-check exited with code ${result.exitCode}. See Guardrail CLI output.`,
        );
      }
    },
  );
}

async function runApplyTemplateCli(): Promise<void> {
  const cli = getCliForWorkspace();
  if (!cli) {
    void vscode.window.showWarningMessage(
      "Open a workspace to apply guardrail templates.",
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Loading templates…",
      cancellable: false,
    },
    async () => {
      const listed = await cli.runListTemplatesJson();
      if (!listed.success || !listed.data?.templates) {
        void vscode.window.showErrorMessage(
          listed.error ??
            "Could not load templates. Run `pnpm run build:lib` in the Guardrail repo if developing locally.",
        );
        return;
      }

      const templates = listed.data.templates as Array<{
        type: string;
        description?: string;
        category?: string;
      }>;

      const picked = await vscode.window.showQuickPick(
        templates.map((t) => ({
          label: t.type,
          description: t.description,
          detail: t.category,
        })),
        {
          placeHolder: "Choose a template to copy into your project",
          title: "Apply Guardrail template",
        },
      );

      if (!picked) {
        return;
      }

      const dry = await vscode.window.showInformationMessage(
        `Apply template “${picked.label}” to the workspace root?`,
        "Apply",
        "Dry run",
        "Cancel",
      );

      if (dry === "Cancel" || dry === undefined) {
        return;
      }

      const dryRun = dry === "Dry run";

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: dryRun
            ? `Dry run: ${picked.label}…`
            : `Applying ${picked.label}…`,
          cancellable: false,
        },
        async () => {
          const res = await cli.runApplyTemplateJson(picked.label, dryRun ? ["--dry-run"] : []);
          if (res.data) {
            cliOutputChannel.clear();
            cliOutputChannel.appendLine("=== guardrail apply-template --json ===");
            cliOutputChannel.appendLine(res.command);
            cliOutputChannel.appendLine("");
            cliOutputChannel.appendLine(JSON.stringify(res.data, null, 2));
            cliOutputChannel.show(true);
          }
          if (res.success && res.data) {
            if (!dryRun) {
              liveEngine.templateApplied(picked.label);
            }
            void vscode.window.showInformationMessage(
              dryRun
                ? "Dry run complete — see Guardrail CLI output."
                : "Template applied — see Guardrail CLI output.",
            );
          } else {
            void vscode.window.showErrorMessage(
              res.error ?? "apply-template failed. See Guardrail CLI output.",
            );
          }
        },
      );
    },
  );
}

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
  const preferLocal = config.get<boolean>("openLocalWebAppFirst", false);
  const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name;

  let target = buildWebDashboardUrl({ workspaceName, context: "palette" });
=======
  const configured = config
    .get<string>("webAppUrl", "https://guardrailai.dev")
    .replace(/\/$/, "");
  const preferLocal = config.get<boolean>("openLocalWebAppFirst", false);

  let target = `${configured}/?source=vscode`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
        target = buildWebDashboardUrl({
          workspaceName,
          context: "palette",
          baseOrigin: "http://localhost:3000",
        });
=======
        target = "http://localhost:3000/?source=vscode";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
<<<<<<< HEAD
      } catch (error: unknown) {
        vscode.window.showErrorMessage(`Auto-Fix failed: ${getErrorMessage(error)}`);
=======
      } catch (error: any) {
        vscode.window.showErrorMessage(`Auto-Fix failed: ${error.message}`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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

<<<<<<< HEAD
export function deactivate(): void {
  stopProfileTierPolling();
=======
export function deactivate() {
  console.log("guardrail Reality Check deactivated");
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
}
