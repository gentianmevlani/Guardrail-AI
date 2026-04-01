/**
 * Guardrail Hub — The nerve center.
 *
 * A webview panel with interactive service cards. Each card represents a
 * guardrail service (Context Engine, Template/Vibe, Security, etc.) and can
 * be drilled into to manage rules, browse templates, view findings, etc.
 *
 * The Hub receives live updates from {@link LiveActivityEngine} so it always
 * feels alive — pulsing indicators, real-time activity feed, animated transitions.
 */

import * as vscode from "vscode";
import {
  GUARDRAIL_VERSION,
  getGuardrailCssBlock,
  getGuardrailFontLinks,
} from "../guardrail-styles";
import { getLastScanResult } from "../scan-state";
import { getLastVibeCheckSnapshot } from "../vibe-check-state";
import { getTierDisplayCached, getCachedTierId } from "../tier-ui-cache";
import { getGuardrailWebUrl } from "../guardrail-web-urls";
import type { PlatformBridge } from "../services/platform-bridge";
import type {
  LiveActivityEngine,
  LiveSnapshot,
  ServiceId,
  ActivityEvent,
} from "../services/live-activity-engine";

/**
 * Tier gating rules for Hub panel features.
 * Free: see services pulsing but metrics/details blurred. Upgrade CTAs.
 * Starter/Pro: full metrics, all core actions. Enterprise panels show upgrade.
 * Compliance: everything unlocked.
 */
type HubTier = "free" | "starter" | "pro" | "compliance";

function hubTierGates(tier: HubTier) {
  return {
    /** Can see full metric values (not blurred) */
    showMetrics: tier !== "free",
    /** Can expand cards to manage rules/details */
    canExpand: tier !== "free",
    /** Can use action buttons (scan, apply, etc.) */
    canAct: tier !== "free",
    /** Can see full file paths in activity feed */
    showFilePaths: tier !== "free",
    /** Can access enterprise panels (compliance, perf, change-impact, etc.) */
    enterpriseAccess: tier === "compliance",
    /** Display label */
    label: tier,
    /** Upgrade URL */
    upgradeUrl: getGuardrailWebUrl("/billing"),
  };
}

export class GuardrailHubPanel {
  public static currentPanel: GuardrailHubPanel | undefined;
  private static _liveEngine: LiveActivityEngine | undefined;
  private static _platformBridge: PlatformBridge | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static registerLiveEngine(engine: LiveActivityEngine): void {
    GuardrailHubPanel._liveEngine = engine;
  }

  public static registerPlatformBridge(bridge: PlatformBridge): void {
    GuardrailHubPanel._platformBridge = bridge;
  }

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (GuardrailHubPanel.currentPanel) {
      GuardrailHubPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "guardrailHub",
      "Guardrail Hub",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    GuardrailHubPanel.currentPanel = new GuardrailHubPanel(panel, extensionUri);
  }

  public static refreshIfOpen(): void {
    if (GuardrailHubPanel.currentPanel) {
      GuardrailHubPanel.currentPanel._sendSnapshot();
    }
  }

  /** Send trust score data to the radar visualization */
  public static sendTrustScore(trustScore: Record<string, unknown>): void {
    if (GuardrailHubPanel.currentPanel) {
      void GuardrailHubPanel.currentPanel._panel.webview.postMessage({
        type: "trustScore",
        data: trustScore,
      });
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtml();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg),
      null,
      this._disposables,
    );

    // Subscribe to live engine updates
    if (GuardrailHubPanel._liveEngine) {
      const sub = GuardrailHubPanel._liveEngine.onSnapshot((snap) => {
        void this._panel.webview.postMessage({ type: "snapshot", data: snap });
      });
      this._disposables.push(sub);

      const actSub = GuardrailHubPanel._liveEngine.onActivity((evt) => {
        void this._panel.webview.postMessage({ type: "activity", data: evt });
      });
      this._disposables.push(actSub);
    }

    // Send initial snapshot and platform status
    setTimeout(() => {
      this._sendSnapshot();
      this._sendPlatformStatus();
    }, 200);
  }

  private async _sendPlatformStatus(): Promise<void> {
    if (GuardrailHubPanel._platformBridge) {
      const status = await GuardrailHubPanel._platformBridge.getFullStatus();
      void this._panel.webview.postMessage({ type: "platformStatus", data: status });
    }
  }

  private _sendSnapshot(): void {
    if (GuardrailHubPanel._liveEngine) {
      const snap = GuardrailHubPanel._liveEngine.getSnapshot();
      void this._panel.webview.postMessage({ type: "snapshot", data: snap });
    }
  }

  private _handleMessage(msg: { command?: string; cardId?: string; action?: string; payload?: unknown; link?: string }): void {
    switch (msg.command) {
      case "executeCommand":
        if (msg.action) {
          void vscode.commands.executeCommand(msg.action);
        }
        break;
      case "cardAction":
        this._handleCardAction(msg.cardId!, msg.action!, msg.payload);
        break;
      case "openSettings":
        void vscode.commands.executeCommand("workbench.action.openSettings", "guardrail");
        break;
      case "openDeepLink": {
        const links = GuardrailHubPanel._platformBridge?.getDeepLinks();
        const linkMap = links?.deepLinks ?? {};
        const url = (linkMap as Record<string, string>)[msg.link ?? ""] ?? getGuardrailWebUrl("/");
        void vscode.env.openExternal(vscode.Uri.parse(url));
        break;
      }
    }
  }

  private _handleCardAction(cardId: string, action: string, payload: unknown): void {
    switch (`${cardId}:${action}`) {
      case "context-engine:refresh":
        void vscode.commands.executeCommand("guardrail.scanWorkspace");
        break;
      case "context-engine:viewRules":
        // Send context rules to the panel
        this._sendContextRules();
        break;
      case "template-engine:browse":
        void vscode.commands.executeCommand("guardrail.applyTemplate");
        break;
      case "template-engine:applyTemplate":
        void vscode.commands.executeCommand("guardrail.applyTemplate");
        break;
      case "vibe-check:run":
        void vscode.commands.executeCommand("guardrail.runVibeCheck");
        break;
      case "security-scanner:scan":
        void vscode.commands.executeCommand("guardrail.openSecurityScanner");
        break;
      case "security-scanner:scanSecrets":
        void vscode.commands.executeCommand("guardrail.scanSecrets");
        break;
      case "security-scanner:scanVulns":
        void vscode.commands.executeCommand("guardrail.scanVulnerabilities");
        break;
      case "compliance:open":
        void vscode.commands.executeCommand("guardrail.openComplianceDashboard");
        break;
      case "performance:open":
        void vscode.commands.executeCommand("guardrail.openPerformanceMonitor");
        break;
      case "change-impact:open":
        void vscode.commands.executeCommand("guardrail.openChangeImpactAnalyzer");
        break;
      case "ai-explainer:open":
        void vscode.commands.executeCommand("guardrail.openAIExplainer");
        break;
      case "production-integrity:open":
        void vscode.commands.executeCommand("guardrail.openProductionIntegrity");
        break;
      case "mdc-generator:open":
        void vscode.commands.executeCommand("guardrail.openMDCGenerator");
        break;
      case "reality-check:scan":
        void vscode.commands.executeCommand("guardrail.scanWorkspace");
        break;
      case "reality-check:ship":
        void vscode.commands.executeCommand("guardrail.runShip");
        break;
      case "code-health:analyze":
        void vscode.commands.executeCommand("guardrail.analyzeCodeHealth");
        break;
      case "code-health:smells":
        void vscode.commands.executeCommand("guardrail.runSmells");
        break;
      case "code-health:drift":
        void vscode.commands.executeCommand("guardrail.scanWorkspace");
        break;
      case "hallucination-guard:scan":
        void vscode.commands.executeCommand("guardrail.scanWorkspace");
        break;
      case "hallucination-guard:versions":
        void vscode.commands.executeCommand("guardrail.scanWorkspace");
        break;
      case "accessibility:check":
        void vscode.commands.executeCommand("guardrail.checkAccessibility");
        break;
      case "doc-coverage:check":
        void vscode.commands.executeCommand("guardrail.checkDocCoverage");
        break;
      case "code-dna:analyze":
        void vscode.commands.executeCommand("guardrail.analyzeCodeDNA");
        break;
      case "dep-impact:analyze":
        void vscode.commands.executeCommand("guardrail.analyzeDependencyImpact");
        break;
      case "duplicate-detector:scan":
        void vscode.commands.executeCommand("guardrail.scanDuplicates");
        break;
    }
  }

  private _sendContextRules(): void {
    // Send a structured list of context engine rules/state to the webview
    const scan = getLastScanResult();
    const vibe = getLastVibeCheckSnapshot();
    void this._panel.webview.postMessage({
      type: "contextRules",
      data: {
        lastScan: scan ? {
          score: scan.score,
          grade: scan.grade,
          canShip: scan.canShip,
          issueCount: scan.issues?.length ?? 0,
          categories: scan.cliSummary ?? null,
        } : null,
        vibeCheck: vibe,
        rules: [
          { id: "drift-detection", name: "Drift Detection", enabled: true, description: "Detect when code drifts from original patterns" },
          { id: "hallucination-guard", name: "Hallucination Guard", enabled: true, description: "Flag AI-generated code that doesn't match project context" },
          { id: "pattern-enforcement", name: "Pattern Enforcement", enabled: true, description: "Enforce consistent coding patterns across the project" },
          { id: "mock-detection", name: "Mock Data Detection", enabled: true, description: "Find hardcoded mock data and fake implementations" },
          { id: "secret-scanning", name: "Secret Scanning", enabled: true, description: "Detect exposed API keys, tokens, and credentials" },
          { id: "dead-code", name: "Dead Code Detection", enabled: true, description: "Find unused exports, unreachable code, and dead routes" },
          { id: "api-contract", name: "API Contract Validation", enabled: true, description: "Verify API endpoints match their contracts" },
          { id: "auth-coverage", name: "Auth Coverage Check", enabled: true, description: "Ensure protected routes have proper authentication" },
        ],
      },
    });
  }

  private _getHtml(): string {
    const nonce = getNonce();
    const fonts = getGuardrailFontLinks();
    const baseTheme = getGuardrailCssBlock();
    const scan = getLastScanResult();
    const vibe = getLastVibeCheckSnapshot();
    const tier = getTierDisplayCached();
    const tierId = getCachedTierId() as HubTier;
    const gates = hubTierGates(tierId);

    const scorePct = scan?.score != null ? Math.round(scan.score) : null;
    const vibeScore = vibe?.score ?? null;

    // Blurred display for free tier
    const m = (val: string | number | null) => gates.showMetrics ? String(val ?? "—") : "—";
    const blurClass = gates.showMetrics ? "" : "gated-blur";
    const enterpriseClass = gates.enterpriseAccess ? "" : "gated-enterprise";

    return `<!DOCTYPE html>
<html class="dark" data-tier="${tierId}" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Guardrail Hub</title>
  ${fonts}
  <style>
    ${baseTheme}
    ${getHubCss()}
  </style>
</head>
<body class="ka-hub-body">
  <div class="ka-hub-ambient" id="hubAmbient"></div>

  <header class="ka-hub-topbar">
    <div class="ka-hub-brand">
      <span class="material-symbols-outlined" style="color: var(--cyan-glow); font-size: 26px;">shield_lock</span>
      <div>
        <h1 class="ka-hub-title">GUARDRAIL HUB</h1>
        <span class="ka-hub-subtitle">Nerve Center &middot; ${tier}</span>
      </div>
    </div>
    <div class="ka-hub-topbar-actions">
      <span class="ka-hub-tier-badge" data-tier="${tierId}">${tier}</span>
      <div class="ka-hub-scan-indicator" id="scanIndicator">
        <span class="ka-hub-scan-dot"></span>
        <span class="ka-hub-scan-label" id="scanLabel">Systems Online</span>
      </div>
      <button class="ka-hub-topbar-btn" data-cmd="guardrail.scanWorkspace" title="Full Scan">
        <span class="material-symbols-outlined">radar</span>
      </button>
      <button class="ka-hub-topbar-btn" data-cmd="openSettings" title="Settings">
        <span class="material-symbols-outlined">tune</span>
      </button>
    </div>
  </header>

  <!-- Scanning progress bar -->
  <div class="ka-hub-scan-bar" id="scanBar">
    <div class="ka-hub-scan-fill"></div>
  </div>

  <main class="ka-hub-main">
    <!-- Live Stats Strip -->
    <section class="ka-hub-stats-strip">
      <div class="ka-hub-stat">
        <span class="ka-hub-stat-val" id="statScore">${scorePct ?? "—"}</span>
        <span class="ka-hub-stat-lbl">Score</span>
      </div>
      <div class="ka-hub-stat">
        <span class="ka-hub-stat-val" id="statFindings">${scan?.issues?.length ?? "—"}</span>
        <span class="ka-hub-stat-lbl">Findings</span>
      </div>
      <div class="ka-hub-stat">
        <span class="ka-hub-stat-val" id="statVibe">${vibeScore ?? "—"}</span>
        <span class="ka-hub-stat-lbl">Vibe</span>
      </div>
      <div class="ka-hub-stat">
        <span class="ka-hub-stat-val" id="statContext">0</span>
        <span class="ka-hub-stat-lbl">Context</span>
      </div>
      <div class="ka-hub-stat">
        <span class="ka-hub-stat-val" id="statLastScan">—</span>
        <span class="ka-hub-stat-lbl">Last Scan</span>
      </div>
    </section>

    <!-- Trust Score Radar -->
    <section class="ka-hub-section">
      <h2 class="ka-hub-section-title">
        <span class="material-symbols-outlined">verified_user</span>
        Trust Score
      </h2>
      <div class="ka-hub-trust-panel" id="trustPanel">
        <div class="ka-hub-trust-radar-wrap">
          <svg class="ka-hub-trust-radar" viewBox="0 0 240 240" id="trustRadar">
            <!-- Grid lines -->
            <polygon class="trust-grid" points="120,30 210,120 120,210 30,120"/>
            <polygon class="trust-grid trust-grid-mid" points="120,52.5 187.5,120 120,187.5 52.5,120"/>
            <polygon class="trust-grid trust-grid-inner" points="120,75 165,120 120,165 75,120"/>
            <!-- Axes -->
            <line class="trust-axis" x1="120" y1="30" x2="120" y2="210"/>
            <line class="trust-axis" x1="30" y1="120" x2="210" y2="120"/>
            <!-- Score polygon -->
            <polygon class="trust-fill" id="trustFill" points="120,120 120,120 120,120 120,120"/>
            <polygon class="trust-stroke" id="trustStroke" points="120,120 120,120 120,120 120,120"/>
            <!-- Dots -->
            <circle class="trust-dot" id="trustDotTop" cx="120" cy="120" r="4"/>
            <circle class="trust-dot" id="trustDotRight" cx="120" cy="120" r="4"/>
            <circle class="trust-dot" id="trustDotBottom" cx="120" cy="120" r="4"/>
            <circle class="trust-dot" id="trustDotLeft" cx="120" cy="120" r="4"/>
            <!-- Labels -->
            <text class="trust-label" x="120" y="22" text-anchor="middle">API Integrity</text>
            <text class="trust-label" x="222" y="124" text-anchor="start">Dep Safety</text>
            <text class="trust-label" x="120" y="228" text-anchor="middle">Env Coverage</text>
            <text class="trust-label" x="18" y="124" text-anchor="end">Contracts</text>
          </svg>
        </div>
        <div class="ka-hub-trust-info">
          <div class="ka-hub-trust-grade" id="trustGrade">—</div>
          <div class="ka-hub-trust-decision" id="trustDecision">
            <span class="ka-hub-trust-decision-dot"></span>
            <span id="trustDecisionText">No scan yet</span>
          </div>
          <div class="ka-hub-trust-overall">
            <span class="ka-hub-trust-overall-val" id="trustOverall">—</span>
            <span class="ka-hub-trust-overall-lbl">/100</span>
          </div>
          <div class="ka-hub-trust-dims" id="trustDims">
            <div class="ka-hub-trust-dim">
              <span class="ka-hub-trust-dim-lbl">API Integrity</span>
              <div class="ka-hub-trust-dim-bar"><div class="ka-hub-trust-dim-fill" id="dimApi" style="width:0%"></div></div>
              <span class="ka-hub-trust-dim-val" id="dimApiVal">—</span>
            </div>
            <div class="ka-hub-trust-dim">
              <span class="ka-hub-trust-dim-lbl">Dep Safety</span>
              <div class="ka-hub-trust-dim-bar"><div class="ka-hub-trust-dim-fill" id="dimDep" style="width:0%"></div></div>
              <span class="ka-hub-trust-dim-val" id="dimDepVal">—</span>
            </div>
            <div class="ka-hub-trust-dim">
              <span class="ka-hub-trust-dim-lbl">Env Coverage</span>
              <div class="ka-hub-trust-dim-bar"><div class="ka-hub-trust-dim-fill" id="dimEnv" style="width:0%"></div></div>
              <span class="ka-hub-trust-dim-val" id="dimEnvVal">—</span>
            </div>
            <div class="ka-hub-trust-dim">
              <span class="ka-hub-trust-dim-lbl">Contract Health</span>
              <div class="ka-hub-trust-dim-bar"><div class="ka-hub-trust-dim-fill" id="dimContract" style="width:0%"></div></div>
              <span class="ka-hub-trust-dim-val" id="dimContractVal">—</span>
            </div>
          </div>
          <div class="ka-hub-trust-trend" id="trustTrend"></div>
          <div class="ka-hub-trust-reducers" id="trustReducers"></div>
          <div class="ka-hub-trust-meta">
            <span id="trustAutofix">0 auto-fixable</span>
            <span id="trustScope">—</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Scan History Timeline -->
    <section class="ka-hub-section">
      <h2 class="ka-hub-section-title">
        <span class="material-symbols-outlined">show_chart</span>
        Score Trend
      </h2>
      <div class="ka-hub-history-panel" id="historyPanel">
        <div class="ka-hub-history-chart" id="historyChart">
          <div style="text-align:center;padding:20px;color:var(--outline);font-size:11px;">Run scans to see your trend</div>
        </div>
        <div class="ka-hub-history-stats" id="historyStats">
          <div class="ka-hub-history-stat">
            <span class="ka-hub-history-stat-val" id="histBest">—</span>
            <span class="ka-hub-history-stat-lbl">Best</span>
          </div>
          <div class="ka-hub-history-stat">
            <span class="ka-hub-history-stat-val" id="histAvg">—</span>
            <span class="ka-hub-history-stat-lbl">Avg</span>
          </div>
          <div class="ka-hub-history-stat">
            <span class="ka-hub-history-stat-val" id="histDelta">—</span>
            <span class="ka-hub-history-stat-lbl">Delta</span>
          </div>
          <div class="ka-hub-history-stat">
            <span class="ka-hub-history-stat-val" id="histTrend">—</span>
            <span class="ka-hub-history-stat-lbl">Trend</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Service Cards Grid -->
    <section class="ka-hub-section">
      <h2 class="ka-hub-section-title">
        <span class="material-symbols-outlined">hub</span>
        Services
      </h2>
      <div class="ka-hub-cards" id="serviceCards">

        <!-- Context Engine Card -->
        <div class="ka-hub-card ${blurClass}" data-card="context-engine" data-status="watching">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: var(--cyan-glow);">
              <span class="material-symbols-outlined">psychology</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Context Engine</h3>
              <span class="ka-hub-card-status" id="status-context-engine">Watching</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-context-engine"></span>
          </div>
          <p class="ka-hub-card-desc">Real-time drift detection, hallucination guard, and pattern enforcement. Manages the rules that keep your AI-generated code honest.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ctx-rules">${m(8)}</span>
              <span class="ka-hub-card-metric-lbl">Rules</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ctx-patterns">${m("—")}</span>
              <span class="ka-hub-card-metric-lbl">Patterns</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ctx-drift">${m("0%")}</span>
              <span class="ka-hub-card-metric-lbl">Drift</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="context-engine:viewRules">
              <span class="material-symbols-outlined">rule</span> Manage Rules
            </button>
            <button class="ka-hub-card-btn" data-card-action="context-engine:refresh">
              <span class="material-symbols-outlined">refresh</span> Re-index
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Context Engine rules, drift metrics, and pattern management are available on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade to Unlock</button>
          </div>
          <!-- Expandable rules panel -->
          <div class="ka-hub-card-expand" id="expand-context-engine">
            <div class="ka-hub-rules-list" id="contextRulesList"></div>
          </div>
        </div>

        <!-- Template / Vibe Card -->
        <div class="ka-hub-card ${blurClass}" data-card="template-engine" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: var(--secondary);">
              <span class="material-symbols-outlined">auto_fix_high</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Templates &amp; Vibes</h3>
              <span class="ka-hub-card-status" id="status-template-engine">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-template-engine"></span>
          </div>
          <p class="ka-hub-card-desc">Browse and apply production-ready templates. Vibe scoring tells you what's missing — templates fix it instantly.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val">7</span>
              <span class="ka-hub-card-metric-lbl">Categories</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="tpl-count">30+</span>
              <span class="ka-hub-card-metric-lbl">Templates</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="tpl-applied">—</span>
              <span class="ka-hub-card-metric-lbl">Applied</span>
            </div>
          </div>
          <div class="ka-hub-card-template-grid" id="templateGrid">
            <div class="ka-hub-tpl-chip" data-tpl="components">
              <span class="material-symbols-outlined">widgets</span>
              <span>Components</span>
            </div>
            <div class="ka-hub-tpl-chip" data-tpl="backend">
              <span class="material-symbols-outlined">dns</span>
              <span>Backend</span>
            </div>
            <div class="ka-hub-tpl-chip" data-tpl="pages">
              <span class="material-symbols-outlined">web</span>
              <span>Pages</span>
            </div>
            <div class="ka-hub-tpl-chip" data-tpl="hooks">
              <span class="material-symbols-outlined">link</span>
              <span>Hooks</span>
            </div>
            <div class="ka-hub-tpl-chip" data-tpl="infrastructure">
              <span class="material-symbols-outlined">cloud</span>
              <span>Infra</span>
            </div>
            <div class="ka-hub-tpl-chip" data-tpl="animations">
              <span class="material-symbols-outlined">animation</span>
              <span>Animations</span>
            </div>
            <div class="ka-hub-tpl-chip" data-tpl="vibecoder">
              <span class="material-symbols-outlined">music_note</span>
              <span>Vibecoder</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="template-engine:browse">
              <span class="material-symbols-outlined">category</span> Browse Templates
            </button>
            <button class="ka-hub-card-btn" data-card-action="vibe-check:run">
              <span class="material-symbols-outlined">rocket_launch</span> Run Vibe Check
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Template browsing, vibe scoring, and auto-application available on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade to Unlock</button>
          </div>
        </div>

        <!-- Security Scanner Card -->
        <div class="ka-hub-card ${blurClass}" data-card="security-scanner" data-status="watching">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: var(--error);">
              <span class="material-symbols-outlined">security</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Security Scanner</h3>
              <span class="ka-hub-card-status" id="status-security-scanner">Watching</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-security-scanner"></span>
          </div>
          <p class="ka-hub-card-desc">OWASP scanning, secret detection, vulnerability analysis, and auth coverage. Your code's immune system.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="sec-secrets">0</span>
              <span class="ka-hub-card-metric-lbl">Secrets</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="sec-vulns">0</span>
              <span class="ka-hub-card-metric-lbl">Vulns</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="sec-auth">—</span>
              <span class="ka-hub-card-metric-lbl">Auth</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="security-scanner:scan">
              <span class="material-symbols-outlined">shield</span> Full Scan
            </button>
            <button class="ka-hub-card-btn" data-card-action="security-scanner:scanSecrets">
              <span class="material-symbols-outlined">key</span> Secrets
            </button>
            <button class="ka-hub-card-btn" data-card-action="security-scanner:scanVulns">
              <span class="material-symbols-outlined">bug_report</span> Vulns
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Detailed vulnerability reports, secret locations, and remediation guidance available on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade to Unlock</button>
          </div>
        </div>

        <!-- Reality Check Card -->
        <div class="ka-hub-card" data-card="reality-check" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #6bcb77;">
              <span class="material-symbols-outlined">verified</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Reality Check</h3>
              <span class="ka-hub-card-status" id="status-reality-check">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-reality-check"></span>
          </div>
          <p class="ka-hub-card-desc">Mock data detection, fake feature scanning, and production readiness verification. The truth detector.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="rc-score">${scorePct ?? "—"}</span>
              <span class="ka-hub-card-metric-lbl">Score</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="rc-grade">${scan?.grade ?? "—"}</span>
              <span class="ka-hub-card-metric-lbl">Grade</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="rc-ship">${scan?.canShip ? "GO" : scan ? "NO" : "—"}</span>
              <span class="ka-hub-card-metric-lbl">Ship</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="reality-check:scan">
              <span class="material-symbols-outlined">search</span> Scan Workspace
            </button>
            <button class="ka-hub-card-btn" data-card-action="reality-check:ship">
              <span class="material-symbols-outlined">rocket_launch</span> Ship Check
            </button>
          </div>
        </div>

        <!-- Code Health Insights Card -->
        <div class="ka-hub-card ${blurClass}" data-card="code-health" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #10b981;">
              <span class="material-symbols-outlined">monitor_heart</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Code Health</h3>
              <span class="ka-hub-card-status" id="status-code-health">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-code-health"></span>
          </div>
          <p class="ka-hub-card-desc">Predictive quality scoring, technical debt forecasting, code smell detection, and architecture drift warnings — before problems happen.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ch-health">${m("—")}</span>
              <span class="ka-hub-card-metric-lbl">Health</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ch-smells">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Smells</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ch-drift">${m("0%")}</span>
              <span class="ka-hub-card-metric-lbl">Drift</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="ch-debt">${m("Low")}</span>
              <span class="ka-hub-card-metric-lbl">Debt</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="code-health:analyze">
              <span class="material-symbols-outlined">analytics</span> Analyze Health
            </button>
            <button class="ka-hub-card-btn" data-card-action="code-health:smells">
              <span class="material-symbols-outlined">bug_report</span> Code Smells
            </button>
            <button class="ka-hub-card-btn" data-card-action="code-health:drift">
              <span class="material-symbols-outlined">trending_down</span> Drift Check
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Predictive quality scores, smell forecasts, and drift analysis available on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade to Unlock</button>
          </div>
        </div>

        <!-- Hallucination Guard Card -->
        <div class="ka-hub-card ${blurClass}" data-card="hallucination-guard" data-status="watching">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #f472b6;">
              <span class="material-symbols-outlined">neurology</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Hallucination Guard</h3>
              <span class="ka-hub-card-status" id="status-hallucination-guard">Watching</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-hallucination-guard"></span>
          </div>
          <p class="ka-hub-card-desc">Detects AI hallucinations in real-time — wrong APIs, version mismatches, phantom dependencies, fake features, and ghost routes.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="hg-hallucinations">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Hallucinations</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="hg-ghosts">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Ghost Routes</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="hg-phantoms">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Phantom Deps</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="hg-fakes">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Fake Features</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="hallucination-guard:scan">
              <span class="material-symbols-outlined">search</span> Deep Scan
            </button>
            <button class="ka-hub-card-btn" data-card-action="hallucination-guard:versions">
              <span class="material-symbols-outlined">history</span> Version Check
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Hallucination details, version mismatch reports, and auto-fix suggestions on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade to Unlock</button>
          </div>
        </div>

        <!-- Accessibility Card -->
        <div class="ka-hub-card ka-hub-card-sm ${blurClass}" data-card="accessibility" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #60a5fa;">
              <span class="material-symbols-outlined">accessibility_new</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Accessibility</h3>
              <span class="ka-hub-card-status" id="status-accessibility">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-accessibility"></span>
          </div>
          <p class="ka-hub-card-desc">WCAG compliance, aria validation, color contrast checking.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="a11y-score">${m("—")}</span>
              <span class="ka-hub-card-metric-lbl">Score</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="a11y-issues">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Issues</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="accessibility:check">
              <span class="material-symbols-outlined">accessibility_new</span> Check A11y
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>WCAG details and remediation guidance on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade</button>
          </div>
        </div>

        <!-- Documentation Coverage Card -->
        <div class="ka-hub-card ka-hub-card-sm ${blurClass}" data-card="doc-coverage" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #fbbf24;">
              <span class="material-symbols-outlined">menu_book</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Doc Coverage</h3>
              <span class="ka-hub-card-status" id="status-doc-coverage">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-doc-coverage"></span>
          </div>
          <p class="ka-hub-card-desc">Documentation coverage analysis and gap detection.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="doc-coverage">${m("—%")}</span>
              <span class="ka-hub-card-metric-lbl">Coverage</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="doc-gaps">${m("0")}</span>
              <span class="ka-hub-card-metric-lbl">Gaps</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="doc-coverage:check">
              <span class="material-symbols-outlined">fact_check</span> Check Docs
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Doc coverage details and auto-generation on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade</button>
          </div>
        </div>

        <!-- Code DNA Card -->
        <div class="ka-hub-card ka-hub-card-sm ${blurClass}" data-card="code-dna" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #c084fc;">
              <span class="material-symbols-outlined">fingerprint</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Code DNA</h3>
              <span class="ka-hub-card-status" id="status-code-dna">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-code-dna"></span>
          </div>
          <p class="ka-hub-card-desc">Pattern fingerprinting, evolution tracking, and relationship mapping.</p>
          <div class="ka-hub-card-metrics">
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="dna-patterns">${m("—")}</span>
              <span class="ka-hub-card-metric-lbl">Patterns</span>
            </div>
            <div class="ka-hub-card-metric">
              <span class="ka-hub-card-metric-val" id="dna-trend">${m("—")}</span>
              <span class="ka-hub-card-metric-lbl">Trend</span>
            </div>
          </div>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="code-dna:analyze">
              <span class="material-symbols-outlined">hub</span> Map DNA
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Pattern DNA analysis and evolution tracking on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade</button>
          </div>
        </div>

        <!-- Dependency Impact Card -->
        <div class="ka-hub-card ka-hub-card-sm ${blurClass}" data-card="dep-impact" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #fb923c;">
              <span class="material-symbols-outlined">package_2</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Dependency Impact</h3>
              <span class="ka-hub-card-status" id="status-dep-impact">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-dep-impact"></span>
          </div>
          <p class="ka-hub-card-desc">Predict how dependency updates affect your code before you upgrade.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="dep-impact:analyze">
              <span class="material-symbols-outlined">update</span> Analyze Deps
            </button>
          </div>
          <div class="ka-hub-card-gate">
            <span class="material-symbols-outlined">lock</span>
            <p>Dependency impact predictions on paid plans.</p>
            <button class="ka-hub-upgrade-btn" data-cmd="upgrade"><span class="material-symbols-outlined" style="font-size:16px;">bolt</span> Upgrade</button>
          </div>
        </div>

        <!-- Duplicate Detector Card -->
        <div class="ka-hub-card ka-hub-card-sm" data-card="duplicate-detector" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #94a3b8;">
              <span class="material-symbols-outlined">content_copy</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Duplicate Detector</h3>
              <span class="ka-hub-card-status" id="status-duplicate-detector">Ready</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-duplicate-detector"></span>
          </div>
          <p class="ka-hub-card-desc">Find duplicate files, similar code blocks, and unused files.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="duplicate-detector:scan">
              <span class="material-symbols-outlined">search</span> Find Duplicates
            </button>
          </div>
        </div>

        <!-- Compliance Card -->
        <div class="ka-hub-card ka-hub-card-sm ${enterpriseClass}" data-card="compliance" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: var(--tertiary);">
              <span class="material-symbols-outlined">policy</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Compliance</h3>
              <span class="ka-hub-card-status" id="status-compliance">Idle</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-compliance"></span>
          </div>
          <p class="ka-hub-card-desc">SOC2, HIPAA, GDPR, PCI-DSS compliance checking.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="compliance:open">
              <span class="material-symbols-outlined">open_in_new</span> Open
            </button>
          </div>
          <div class="ka-hub-enterprise-gate">
            <span class="material-symbols-outlined">lock</span>
            <span>Compliance requires Enterprise plan</span>
          </div>
        </div>

        <!-- Performance Card -->
        <div class="ka-hub-card ka-hub-card-sm ${enterpriseClass}" data-card="performance" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #fbbf24;">
              <span class="material-symbols-outlined">speed</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Performance</h3>
              <span class="ka-hub-card-status" id="status-performance">Idle</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-performance"></span>
          </div>
          <p class="ka-hub-card-desc">Bundle size, render perf, memory leak detection.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="performance:open">
              <span class="material-symbols-outlined">open_in_new</span> Open
            </button>
          </div>
          <div class="ka-hub-enterprise-gate">
            <span class="material-symbols-outlined">lock</span>
            <span>Performance requires Enterprise plan</span>
          </div>
        </div>

        <!-- Change Impact Card -->
        <div class="ka-hub-card ka-hub-card-sm ${enterpriseClass}" data-card="change-impact" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #a78bfa;">
              <span class="material-symbols-outlined">account_tree</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Change Impact</h3>
              <span class="ka-hub-card-status" id="status-change-impact">Idle</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-change-impact"></span>
          </div>
          <p class="ka-hub-card-desc">Blast radius analysis for code changes.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="change-impact:open">
              <span class="material-symbols-outlined">open_in_new</span> Open
            </button>
          </div>
          <div class="ka-hub-enterprise-gate">
            <span class="material-symbols-outlined">lock</span>
            <span>Change Impact requires Enterprise plan</span>
          </div>
        </div>

        <!-- AI Explainer Card -->
        <div class="ka-hub-card ka-hub-card-sm ${enterpriseClass}" data-card="ai-explainer" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #f472b6;">
              <span class="material-symbols-outlined">auto_awesome</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>AI Explainer</h3>
              <span class="ka-hub-card-status" id="status-ai-explainer">Idle</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-ai-explainer"></span>
          </div>
          <p class="ka-hub-card-desc">Explain AI-generated code in plain language.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="ai-explainer:open">
              <span class="material-symbols-outlined">open_in_new</span> Open
            </button>
          </div>
          <div class="ka-hub-enterprise-gate">
            <span class="material-symbols-outlined">lock</span>
            <span>AI Explainer requires Enterprise plan</span>
          </div>
        </div>

        <!-- MDC Generator Card -->
        <div class="ka-hub-card ka-hub-card-sm ${enterpriseClass}" data-card="mdc-generator" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #34d399;">
              <span class="material-symbols-outlined">description</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>MDC Generator</h3>
              <span class="ka-hub-card-status" id="status-mdc-generator">Idle</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-mdc-generator"></span>
          </div>
          <p class="ka-hub-card-desc">Generate Cursor MDC rules from your codebase.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="mdc-generator:open">
              <span class="material-symbols-outlined">open_in_new</span> Open
            </button>
          </div>
          <div class="ka-hub-enterprise-gate">
            <span class="material-symbols-outlined">lock</span>
            <span>MDC Generator requires Enterprise plan</span>
          </div>
        </div>

        <!-- Production Integrity Card -->
        <div class="ka-hub-card ka-hub-card-sm ${enterpriseClass}" data-card="production-integrity" data-status="idle">
          <div class="ka-hub-card-header">
            <div class="ka-hub-card-icon-wrap" style="--card-accent: #f97316;">
              <span class="material-symbols-outlined">dns</span>
            </div>
            <div class="ka-hub-card-title-block">
              <h3>Production Integrity</h3>
              <span class="ka-hub-card-status" id="status-production-integrity">Idle</span>
            </div>
            <span class="ka-hub-card-pulse" id="pulse-production-integrity"></span>
          </div>
          <p class="ka-hub-card-desc">API connectivity, auth coverage, route validation.</p>
          <div class="ka-hub-card-actions">
            <button class="ka-hub-card-btn primary" data-card-action="production-integrity:open">
              <span class="material-symbols-outlined">open_in_new</span> Open
            </button>
          </div>
          <div class="ka-hub-enterprise-gate">
            <span class="material-symbols-outlined">lock</span>
            <span>Production Integrity requires Enterprise plan</span>
          </div>
        </div>

      </div>
    </section>

    <!-- Connected Platforms -->
    <section class="ka-hub-section">
      <h2 class="ka-hub-section-title">
        <span class="material-symbols-outlined">lan</span>
        Connected Platforms
        <span class="ka-hub-live-dot"></span>
      </h2>
      <div class="ka-hub-platforms" id="platformsGrid">
        <div class="ka-hub-platform-card" data-platform="cli">
          <div class="ka-hub-platform-header">
            <span class="material-symbols-outlined" style="color: #10b981;">terminal</span>
            <div>
              <h4>CLI</h4>
              <span class="ka-hub-platform-status" id="platform-cli-status">Detecting...</span>
            </div>
            <span class="ka-hub-platform-dot" id="platform-cli-dot"></span>
          </div>
          <div class="ka-hub-platform-info">
            <span id="platform-cli-path" class="ka-hub-platform-detail">—</span>
          </div>
          <div class="ka-hub-platform-actions">
            <button class="ka-hub-card-btn" data-cmd="guardrail.runDoctor"><span class="material-symbols-outlined">stethoscope</span> Doctor</button>
            <button class="ka-hub-card-btn" data-cmd="guardrail.runWhoami"><span class="material-symbols-outlined">person</span> Whoami</button>
          </div>
        </div>

        <div class="ka-hub-platform-card" data-platform="mcp">
          <div class="ka-hub-platform-header">
            <span class="material-symbols-outlined" style="color: var(--secondary);">smart_toy</span>
            <div>
              <h4>MCP Server</h4>
              <span class="ka-hub-platform-status" id="platform-mcp-status">Detecting...</span>
            </div>
            <span class="ka-hub-platform-dot" id="platform-mcp-dot"></span>
          </div>
          <div class="ka-hub-platform-info">
            <span id="platform-mcp-tools" class="ka-hub-platform-detail">—</span>
          </div>
          <div class="ka-hub-platform-tools" id="mcpToolsList"></div>
        </div>

        <div class="ka-hub-platform-card" data-platform="api">
          <div class="ka-hub-platform-header">
            <span class="material-symbols-outlined" style="color: var(--primary-fixed-dim);">cloud</span>
            <div>
              <h4>Web API</h4>
              <span class="ka-hub-platform-status" id="platform-api-status">—</span>
            </div>
            <span class="ka-hub-platform-dot" id="platform-api-dot"></span>
          </div>
          <div class="ka-hub-platform-info">
            <span id="platform-api-endpoint" class="ka-hub-platform-detail">—</span>
          </div>
          <div class="ka-hub-platform-actions">
            <button class="ka-hub-card-btn" data-cmd="guardrail.login"><span class="material-symbols-outlined">login</span> Login</button>
            <button class="ka-hub-card-btn" data-cmd="guardrail.syncCliCredentials"><span class="material-symbols-outlined">sync</span> Sync</button>
          </div>
        </div>

        <div class="ka-hub-platform-card" data-platform="web">
          <div class="ka-hub-platform-header">
            <span class="material-symbols-outlined" style="color: var(--cyan-glow);">language</span>
            <div>
              <h4>Web Dashboard</h4>
              <span class="ka-hub-platform-status" id="platform-web-status">Available</span>
            </div>
            <span class="ka-hub-platform-dot" id="platform-web-dot" data-status="watching"></span>
          </div>
          <div class="ka-hub-platform-links" id="webLinks">
            <button class="ka-hub-link-btn" data-link="dashboard"><span class="material-symbols-outlined">dashboard</span> Dashboard</button>
            <button class="ka-hub-link-btn" data-link="findings"><span class="material-symbols-outlined">list_alt</span> Findings</button>
            <button class="ka-hub-link-btn" data-link="docs"><span class="material-symbols-outlined">menu_book</span> Docs</button>
            <button class="ka-hub-link-btn" data-link="billing"><span class="material-symbols-outlined">payments</span> Billing</button>
            <button class="ka-hub-link-btn" data-link="settings"><span class="material-symbols-outlined">settings</span> Settings</button>
          </div>
        </div>
        <div class="ka-hub-platform-card" data-platform="github">
          <div class="ka-hub-platform-header">
            <span class="material-symbols-outlined" style="color: #e2e2e6;">code</span>
            <div>
              <h4>GitHub</h4>
              <span class="ka-hub-platform-status" id="platform-github-status">Checking...</span>
            </div>
            <span class="ka-hub-platform-dot" id="platform-github-dot"></span>
          </div>
          <div class="ka-hub-platform-info">
            <span id="platform-github-detail" class="ka-hub-platform-detail">—</span>
          </div>
          <div class="ka-hub-platform-actions" id="githubActions">
            <button class="ka-hub-card-btn primary" data-cmd="guardrail.connectGitHub">
              <span class="material-symbols-outlined">install_desktop</span> Install App
            </button>
            <button class="ka-hub-card-btn" data-link="githubConnect">
              <span class="material-symbols-outlined">open_in_new</span> Web Setup
            </button>
          </div>
          <div class="ka-hub-platform-tools" id="githubInstallations"></div>
        </div>
      </div>
    </section>

    <!-- Live Activity Feed -->
    <section class="ka-hub-section">
      <h2 class="ka-hub-section-title">
        <span class="material-symbols-outlined">timeline</span>
        Live Activity
        <span class="ka-hub-live-dot"></span>
      </h2>
      <div class="ka-hub-feed" id="activityFeed">
        <div class="ka-hub-feed-empty">
          <span class="material-symbols-outlined">radio_button_unchecked</span>
          <p>Waiting for activity... Save a file or run a scan to get started.</p>
        </div>
      </div>
    </section>
  </main>

  <script nonce="${nonce}">
  (function() {
    const vscode = acquireVsCodeApi();

    // ── Command routing ──
    document.querySelectorAll("[data-cmd]").forEach(el => {
      el.addEventListener("click", () => {
        const cmd = el.getAttribute("data-cmd");
        if (cmd === "openSettings") {
          vscode.postMessage({ command: "openSettings" });
        } else if (cmd) {
          vscode.postMessage({ command: "executeCommand", action: cmd });
        }
      });
    });

    // ── Card action routing ──
    document.querySelectorAll("[data-card-action]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = el.getAttribute("data-card-action");
        if (!action) return;
        const [cardId, act] = action.split(":");
        vscode.postMessage({ command: "cardAction", cardId, action: act });
      });
    });

    // ── Template chip clicks ──
    document.querySelectorAll(".ka-hub-tpl-chip").forEach(el => {
      el.addEventListener("click", () => {
        vscode.postMessage({ command: "cardAction", cardId: "template-engine", action: "browse" });
      });
    });

    // ── Upgrade button ──
    document.querySelectorAll('[data-cmd="upgrade"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: "executeCommand", action: "guardrail.openWebDashboard" });
      });
    });

    // ── Card expand/collapse on click ──
    var tier = document.documentElement.getAttribute("data-tier");
    document.querySelectorAll(".ka-hub-card").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest(".ka-hub-tpl-chip")) return;
        if (tier === "free") return; // No expand for free tier
        card.classList.toggle("expanded");
      });
    });

    // ── Live updates ──
    const feed = document.getElementById("activityFeed");
    const scanBar = document.getElementById("scanBar");
    const scanIndicator = document.getElementById("scanIndicator");
    const scanLabel = document.getElementById("scanLabel");
    const hubAmbient = document.getElementById("hubAmbient");

    function formatTime(ts) {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function animateValue(el, newVal) {
      if (!el) return;
      const old = el.textContent;
      if (old === String(newVal)) return;
      el.textContent = String(newVal);
      el.classList.add("counting");
      setTimeout(() => el.classList.remove("counting"), 400);
    }

    function updateServiceStatus(serviceId, status) {
      const statusEl = document.getElementById("status-" + serviceId);
      const pulseEl = document.getElementById("pulse-" + serviceId);
      const card = document.querySelector('[data-card="' + serviceId + '"]');
      if (statusEl) {
        const labels = { idle: "Idle", active: "Active", watching: "Watching", alert: "Alert", success: "OK", error: "Error" };
        statusEl.textContent = labels[status] || status;
        statusEl.setAttribute("data-status", status);
      }
      if (pulseEl) pulseEl.setAttribute("data-status", status);
      if (card) card.setAttribute("data-status", status);
    }

    function addActivityItem(evt) {
      const empty = feed.querySelector(".ka-hub-feed-empty");
      if (empty) empty.remove();

      const item = document.createElement("div");
      item.className = "ka-hub-feed-item";
      item.innerHTML =
        '<span class="material-symbols-outlined ka-hub-feed-icon" style="color:' + (evt.accent || "var(--primary-fixed-dim)") + '">' + evt.icon + '</span>' +
        '<div class="ka-hub-feed-body">' +
          '<span class="ka-hub-feed-msg">' + escapeHtml(evt.message) + '</span>' +
          '<span class="ka-hub-feed-time">' + formatTime(evt.timestamp) + '</span>' +
        '</div>';

      feed.insertBefore(item, feed.firstChild);

      // Keep max 25 items
      while (feed.children.length > 25) {
        feed.removeChild(feed.lastChild);
      }
    }

    function escapeHtml(s) {
      const div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    // ── Context rules panel ──
    function renderContextRules(data) {
      const list = document.getElementById("contextRulesList");
      if (!list) return;
      list.innerHTML = "";
      if (data.rules) {
        data.rules.forEach(rule => {
          const row = document.createElement("div");
          row.className = "ka-hub-rule-row";
          row.innerHTML =
            '<div class="ka-hub-rule-toggle ' + (rule.enabled ? "on" : "off") + '" data-rule="' + rule.id + '">' +
              '<span class="ka-hub-rule-dot"></span>' +
            '</div>' +
            '<div class="ka-hub-rule-info">' +
              '<span class="ka-hub-rule-name">' + escapeHtml(rule.name) + '</span>' +
              '<span class="ka-hub-rule-desc">' + escapeHtml(rule.description) + '</span>' +
            '</div>';
          list.appendChild(row);
        });
      }
      // Expand the context engine card
      const card = document.querySelector('[data-card="context-engine"]');
      if (card) card.classList.add("expanded");
    }

    // ── Trust Score Radar ──
    function updateTrustRadar(ts) {
      if (!ts) return;
      var overall = ts.overall || 0;
      var grade = ts.grade || "—";
      var decision = ts.decision || "NO_SHIP";
      var dims = ts.dimensions || {};

      // Update grade + decision
      document.getElementById("trustGrade").textContent = grade;
      document.getElementById("trustOverall").textContent = String(overall);
      var decEl = document.getElementById("trustDecision");
      decEl.setAttribute("data-decision", decision);
      document.getElementById("trustDecisionText").textContent =
        decision === "SHIP" ? "Ready to Ship" : decision === "REVIEW" ? "Review Required" : "Do Not Ship";

      // Update dimension bars
      var dimMap = {
        api_integrity: { bar: "dimApi", val: "dimApiVal" },
        dependency_safety: { bar: "dimDep", val: "dimDepVal" },
        env_coverage: { bar: "dimEnv", val: "dimEnvVal" },
        contract_health: { bar: "dimContract", val: "dimContractVal" },
      };
      for (var key in dimMap) {
        var d = dims[key];
        var score = d ? d.score : 0;
        var barEl = document.getElementById(dimMap[key].bar);
        var valEl = document.getElementById(dimMap[key].val);
        if (barEl) barEl.style.width = score + "%";
        if (valEl) valEl.textContent = String(Math.round(score));
      }

      // Update radar polygon
      var api = (dims.api_integrity ? dims.api_integrity.score : 0) / 100;
      var dep = (dims.dependency_safety ? dims.dependency_safety.score : 0) / 100;
      var env = (dims.env_coverage ? dims.env_coverage.score : 0) / 100;
      var con = (dims.contract_health ? dims.contract_health.score : 0) / 100;

      var cx = 120, cy = 120, r = 90;
      var topY = cy - r * api;
      var rightX = cx + r * dep;
      var botY = cy + r * env;
      var leftX = cx - r * con;

      var pts = cx + "," + topY + " " + rightX + "," + cy + " " + cx + "," + botY + " " + leftX + "," + cy;
      document.getElementById("trustFill").setAttribute("points", pts);
      document.getElementById("trustStroke").setAttribute("points", pts);
      document.getElementById("trustDotTop").setAttribute("cy", String(topY));
      document.getElementById("trustDotRight").setAttribute("cx", String(rightX));
      document.getElementById("trustDotBottom").setAttribute("cy", String(botY));
      document.getElementById("trustDotLeft").setAttribute("cx", String(leftX));

      // Trend
      if (ts.trend) {
        var trendIcon = ts.trend.direction === "improving" ? "trending_up" : ts.trend.direction === "degrading" ? "trending_down" : "trending_flat";
        var trendColor = ts.trend.direction === "improving" ? "#6bcb77" : ts.trend.direction === "degrading" ? "#ef4444" : "var(--outline)";
        document.getElementById("trustTrend").innerHTML =
          '<span class="material-symbols-outlined" style="font-size:14px;color:' + trendColor + '">' + trendIcon + '</span> ' +
          '<span style="color:' + trendColor + '">' + (ts.trend.delta > 0 ? "+" : "") + ts.trend.delta + ' since last scan</span>';
      }

      // Reducers
      var reducersEl = document.getElementById("trustReducers");
      if (reducersEl && ts.reducers && ts.reducers.length) {
        reducersEl.innerHTML = ts.reducers.slice(0, 5).map(function(r) {
          return '<div class="ka-hub-trust-reducer">' +
            '<span class="ka-hub-trust-reducer-impact" data-severity="' + r.severity + '">-' + r.impact + '</span>' +
            '<span>' + escapeHtml(r.description) + '</span></div>';
        }).join("");
      }

      // Meta
      document.getElementById("trustAutofix").textContent = (ts.autoFixableCount || 0) + " auto-fixable";
      document.getElementById("trustScope").textContent = ts.scope || "—";
    }

    // ── Platform deep-link buttons ──
    document.querySelectorAll(".ka-hub-link-btn").forEach(el => {
      el.addEventListener("click", () => {
        const link = el.getAttribute("data-link");
        if (link) {
          vscode.postMessage({ command: "openDeepLink", link: link });
        }
      });
    });

    // ── Platform status update ──
    function updatePlatformStatus(data) {
      if (data.cli) {
        var cliStatus = document.getElementById("platform-cli-status");
        var cliDot = document.getElementById("platform-cli-dot");
        var cliPath = document.getElementById("platform-cli-path");
        if (cliStatus) cliStatus.textContent = data.cli.available ? "Available" : "Not found";
        if (cliDot) cliDot.setAttribute("data-status", data.cli.available ? "watching" : "idle");
        if (cliPath) cliPath.textContent = data.cli.path || "—";
      }
      if (data.mcp) {
        var mcpStatus = document.getElementById("platform-mcp-status");
        var mcpDot = document.getElementById("platform-mcp-dot");
        var mcpTools = document.getElementById("platform-mcp-tools");
        var mcpList = document.getElementById("mcpToolsList");
        if (mcpStatus) mcpStatus.textContent = data.mcp.available ? data.mcp.toolCount + " tool modules" : "Not found";
        if (mcpDot) mcpDot.setAttribute("data-status", data.mcp.available ? "active" : "idle");
        if (mcpTools) mcpTools.textContent = data.mcp.available ? data.mcp.path : "—";
        if (mcpList && data.mcp.tools && data.mcp.tools.length) {
          mcpList.innerHTML = data.mcp.tools.map(function(t) {
            return '<span class="ka-hub-mcp-tool-chip">' + escapeHtml(t) + '</span>';
          }).join("");
        }
      }
      if (data.api) {
        var apiStatus = document.getElementById("platform-api-status");
        var apiDot = document.getElementById("platform-api-dot");
        var apiEp = document.getElementById("platform-api-endpoint");
        if (apiStatus) apiStatus.textContent = data.api.authenticated ? "Authenticated (" + data.api.tier + ")" : "Not signed in";
        if (apiDot) apiDot.setAttribute("data-status", data.api.authenticated ? "active" : "idle");
        if (apiEp) apiEp.textContent = data.api.baseUrl || "—";
      }
      if (data.github) {
        var ghStatus = document.getElementById("platform-github-status");
        var ghDot = document.getElementById("platform-github-dot");
        var ghDetail = document.getElementById("platform-github-detail");
        var ghInstalls = document.getElementById("githubInstallations");
        var ghConnected = data.github.appInstalled || data.github.oauthConnected;
        if (ghStatus) {
          if (data.github.appInstalled) {
            ghStatus.textContent = data.github.repoCount + " repos via GitHub App";
          } else if (data.github.oauthConnected) {
            ghStatus.textContent = data.github.repoCount + " repos via OAuth";
          } else {
            ghStatus.textContent = "Not connected";
          }
        }
        if (ghDot) ghDot.setAttribute("data-status", ghConnected ? "active" : "idle");
        if (ghDetail) {
          if (data.github.appInstalled) {
            ghDetail.textContent = data.github.installations.map(function(i) { return i.accountLogin; }).join(", ");
          } else {
            ghDetail.textContent = "Install the GitHub App for native integration";
          }
        }
        if (ghInstalls && data.github.installations.length) {
          ghInstalls.innerHTML = data.github.installations.map(function(i) {
            return '<span class="ka-hub-mcp-tool-chip">' + escapeHtml(i.accountLogin) + ' (' + i.repoCount + ' repos)</span>';
          }).join("");
        }
      }
    }

    // ── Message handler ──
    window.addEventListener("message", (event) => {
      const msg = event.data;
      switch (msg.type) {
        case "snapshot": {
          const snap = msg.data;
          // Update stats
          animateValue(document.getElementById("statContext"), snap.contextScore);
          animateValue(document.getElementById("statFindings"), snap.findingsLive);
          document.getElementById("statLastScan").textContent = snap.lastScanAge;

          // Update scanning state
          if (snap.isScanning) {
            scanBar.classList.add("active");
            scanIndicator.classList.add("scanning");
            scanLabel.textContent = "Scanning...";
            hubAmbient.className = "ka-hub-ambient scanning";
          } else {
            scanBar.classList.remove("active");
            scanIndicator.classList.remove("scanning");
            scanLabel.textContent = "Systems Online";
            hubAmbient.className = "ka-hub-ambient";
          }

          // Update service statuses
          if (snap.services) {
            snap.services.forEach(svc => {
              updateServiceStatus(svc.id, svc.status);
            });
          }
          break;
        }
        case "activity": {
          addActivityItem(msg.data);
          break;
        }
        case "contextRules": {
          renderContextRules(msg.data);
          break;
        }
        case "platformStatus": {
          updatePlatformStatus(msg.data);
          break;
        }
        case "trustScore": {
          updateTrustRadar(msg.data);
          // Also update history if included
          if (msg.data.history) {
            var h = msg.data.history;
            document.getElementById("histBest").textContent = String(h.bestScore || "—");
            document.getElementById("histAvg").textContent = String(h.averageScore || "—");
            document.getElementById("histDelta").textContent = (h.delta > 0 ? "+" : "") + String(h.delta || 0);
            document.getElementById("histTrend").textContent = h.trend === "improving" ? "Up" : h.trend === "declining" ? "Down" : "Stable";
            var deltaEl = document.getElementById("histDelta");
            if (deltaEl) deltaEl.style.color = h.delta > 0 ? "#10b981" : h.delta < 0 ? "#ef4444" : "var(--outline)";
          }
          if (msg.data.sparklineSvg) {
            document.getElementById("historyChart").innerHTML = msg.data.sparklineSvg;
          }
          break;
        }
      }
    });
  })();
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    GuardrailHubPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function getHubCss(): string {
  return `
    body.ka-hub-body {
      font-family: 'Inter', sans-serif;
      background: var(--background);
      color: var(--on-surface);
      margin: 0;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Ambient glow */
    .ka-hub-ambient {
      position: fixed;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 400px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      opacity: 0;
      transition: opacity 1.5s ease;
    }
    .ka-hub-ambient.scanning {
      background: radial-gradient(ellipse, rgba(0, 229, 255, 0.07), transparent 70%);
      opacity: 1;
      animation: hub-ambient-breathe 3s ease-in-out infinite;
    }
    @keyframes hub-ambient-breathe {
      0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
      50% { opacity: 1; transform: translateX(-50%) scale(1.03); }
    }

    /* Top bar */
    .ka-hub-topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: rgba(17, 19, 22, 0.92);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
    }
    .ka-hub-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ka-hub-title {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -0.02em;
      color: var(--cyan-glow);
      margin: 0;
    }
    .ka-hub-subtitle {
      font-size: 11px;
      color: var(--outline);
      letter-spacing: 0.04em;
    }
    .ka-hub-topbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ka-hub-topbar-btn {
      border: none;
      background: var(--surface-container);
      color: var(--on-surface-variant);
      padding: 8px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: all 0.15s;
    }
    .ka-hub-topbar-btn:hover {
      background: var(--surface-container-high);
      color: var(--on-surface);
    }

    /* Scan indicator */
    .ka-hub-scan-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      transition: all 0.4s ease;
    }
    .ka-hub-scan-indicator.scanning {
      background: rgba(0, 229, 255, 0.1);
      border-color: rgba(0, 229, 255, 0.3);
    }
    .ka-hub-scan-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
      animation: hub-dot-breathe 3s ease-in-out infinite;
    }
    .ka-hub-scan-indicator.scanning .ka-hub-scan-dot {
      background: var(--cyan-glow);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.7);
      animation: hub-dot-pulse 1s ease-in-out infinite;
    }
    .ka-hub-scan-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #10b981;
      transition: color 0.3s;
    }
    .ka-hub-scan-indicator.scanning .ka-hub-scan-label {
      color: var(--primary-fixed-dim);
    }

    @keyframes hub-dot-breathe {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    @keyframes hub-dot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.7); }
    }

    /* Scan bar */
    .ka-hub-scan-bar {
      height: 2px;
      background: transparent;
      overflow: hidden;
      position: sticky;
      top: 69px;
      z-index: 49;
    }
    .ka-hub-scan-bar.active {
      background: var(--surface-container-highest);
    }
    .ka-hub-scan-bar.active .ka-hub-scan-fill {
      animation: hub-scan-slide 1.6s ease-in-out infinite;
    }
    .ka-hub-scan-fill {
      height: 100%;
      width: 30%;
      background: linear-gradient(90deg, transparent, var(--primary-container), var(--secondary-container), transparent);
      border-radius: 2px;
    }
    @keyframes hub-scan-slide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }

    /* Main layout */
    .ka-hub-main {
      position: relative;
      z-index: 1;
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    /* Stats strip */
    .ka-hub-stats-strip {
      display: flex;
      gap: 8px;
      margin-bottom: 32px;
    }
    .ka-hub-stat {
      flex: 1;
      text-align: center;
      padding: 14px 8px;
      border-radius: 10px;
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      transition: border-color 0.3s;
    }
    .ka-hub-stat:hover {
      border-color: rgba(0, 229, 255, 0.15);
    }
    .ka-hub-stat-val {
      display: block;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: var(--primary-fixed-dim);
      line-height: 1;
      transition: transform 0.3s, color 0.3s;
    }
    .ka-hub-stat-val.counting {
      animation: hub-count-pop 0.35s ease;
    }
    .ka-hub-stat-lbl {
      display: block;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--outline);
      margin-top: 6px;
    }
    @keyframes hub-count-pop {
      0% { transform: scale(1); }
      40% { transform: scale(1.2); color: var(--primary-container); }
      100% { transform: scale(1); }
    }

    /* Section */
    .ka-hub-section {
      margin-bottom: 32px;
    }
    .ka-hub-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--outline);
      margin: 0 0 16px;
    }
    .ka-hub-section-title .material-symbols-outlined {
      font-size: 18px;
      color: var(--primary-fixed-dim);
    }

    /* Live dot */
    .ka-hub-live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
      animation: hub-dot-breathe 2s ease-in-out infinite;
      margin-left: 4px;
    }

    /* Cards grid */
    .ka-hub-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    /* Card */
    .ka-hub-card {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 20px;
      cursor: default;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    .ka-hub-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: transparent;
      transition: background 0.4s ease;
    }
    .ka-hub-card[data-status="active"]::before {
      background: linear-gradient(90deg, transparent, var(--card-accent, var(--cyan-glow)), transparent);
      animation: hub-card-glow-sweep 2s ease-in-out infinite;
    }
    .ka-hub-card[data-status="watching"]::before {
      background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.5), transparent);
    }
    .ka-hub-card[data-status="alert"]::before {
      background: linear-gradient(90deg, transparent, var(--error), transparent);
      animation: hub-card-glow-sweep 1s ease-in-out infinite;
    }
    .ka-hub-card:hover {
      border-color: rgba(255, 255, 255, 0.08);
      background: var(--surface-container);
    }

    @keyframes hub-card-glow-sweep {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    .ka-hub-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .ka-hub-card-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--card-accent, var(--cyan-glow)) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--card-accent, var(--cyan-glow)) 20%, transparent);
      flex-shrink: 0;
    }
    .ka-hub-card-icon-wrap .material-symbols-outlined {
      font-size: 22px;
      color: var(--card-accent, var(--cyan-glow));
    }
    .ka-hub-card-title-block {
      flex: 1;
      min-width: 0;
    }
    .ka-hub-card-title-block h3 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: var(--on-surface);
      margin: 0;
      line-height: 1.2;
    }
    .ka-hub-card-status {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--outline);
      transition: color 0.3s;
    }
    .ka-hub-card-status[data-status="active"] { color: var(--primary-fixed-dim); }
    .ka-hub-card-status[data-status="watching"] { color: #10b981; }
    .ka-hub-card-status[data-status="alert"] { color: var(--error); }
    .ka-hub-card-status[data-status="success"] { color: #6bcb77; }

    /* Pulse indicator */
    .ka-hub-card-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--outline-variant);
      flex-shrink: 0;
      transition: all 0.3s;
    }
    .ka-hub-card-pulse[data-status="active"] {
      background: var(--cyan-glow);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.7);
      animation: hub-dot-pulse 1.5s ease-in-out infinite;
    }
    .ka-hub-card-pulse[data-status="watching"] {
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
      animation: hub-dot-breathe 3s ease-in-out infinite;
    }
    .ka-hub-card-pulse[data-status="alert"] {
      background: var(--error);
      box-shadow: 0 0 10px rgba(255, 180, 171, 0.6);
      animation: hub-dot-pulse 0.8s ease-in-out infinite;
    }
    .ka-hub-card-pulse[data-status="success"] {
      background: #6bcb77;
      box-shadow: 0 0 6px rgba(107, 203, 119, 0.5);
    }

    .ka-hub-card-desc {
      font-size: 12px;
      line-height: 1.5;
      color: var(--on-surface-variant);
      margin: 0 0 14px;
    }

    /* Card metrics */
    .ka-hub-card-metrics {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }
    .ka-hub-card-metric {
      flex: 1;
      text-align: center;
      padding: 8px 4px;
      border-radius: 8px;
      background: var(--surface-container-lowest);
      border: 1px solid rgba(255, 255, 255, 0.02);
    }
    .ka-hub-card-metric-val {
      display: block;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: var(--primary-fixed-dim);
      line-height: 1;
    }
    .ka-hub-card-metric-lbl {
      display: block;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--outline);
      margin-top: 4px;
    }

    /* Card actions */
    .ka-hub-card-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ka-hub-card-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 7px;
      border: 1px solid var(--border-light);
      background: var(--surface-container);
      color: var(--on-surface-variant);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .ka-hub-card-btn .material-symbols-outlined {
      font-size: 16px;
    }
    .ka-hub-card-btn:hover {
      background: var(--surface-container-high);
      color: var(--on-surface);
      border-color: rgba(255, 255, 255, 0.1);
    }
    .ka-hub-card-btn.primary {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 104, 237, 0.1));
      border-color: rgba(0, 229, 255, 0.2);
      color: var(--primary-fixed);
    }
    .ka-hub-card-btn.primary:hover {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.22), rgba(0, 104, 237, 0.15));
      box-shadow: 0 0 16px rgba(0, 229, 255, 0.12);
    }

    /* Template grid */
    .ka-hub-card-template-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }
    .ka-hub-tpl-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--surface-container-lowest);
      border: 1px solid rgba(255, 255, 255, 0.03);
      font-size: 11px;
      color: var(--on-surface-variant);
      cursor: pointer;
      transition: all 0.15s;
    }
    .ka-hub-tpl-chip:hover {
      background: var(--surface-container);
      border-color: rgba(0, 229, 255, 0.15);
      color: var(--primary-fixed);
    }
    .ka-hub-tpl-chip .material-symbols-outlined {
      font-size: 14px;
    }

    /* Card expand area */
    .ka-hub-card-expand {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.4s ease, margin 0.3s ease;
      margin-top: 0;
    }
    .ka-hub-card.expanded .ka-hub-card-expand {
      max-height: 400px;
      margin-top: 14px;
    }

    /* Rules list */
    .ka-hub-rules-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ka-hub-rule-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--surface-container-lowest);
      border: 1px solid rgba(255, 255, 255, 0.02);
      transition: background 0.15s;
    }
    .ka-hub-rule-row:hover {
      background: var(--surface-container);
    }
    .ka-hub-rule-toggle {
      width: 28px;
      height: 16px;
      border-radius: 8px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .ka-hub-rule-toggle.on {
      background: rgba(0, 229, 255, 0.3);
    }
    .ka-hub-rule-toggle.off {
      background: var(--surface-container-highest);
    }
    .ka-hub-rule-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      position: absolute;
      top: 2px;
      transition: all 0.2s;
    }
    .ka-hub-rule-toggle.on .ka-hub-rule-dot {
      left: 14px;
      background: var(--cyan-glow);
      box-shadow: 0 0 6px rgba(0, 229, 255, 0.5);
    }
    .ka-hub-rule-toggle.off .ka-hub-rule-dot {
      left: 2px;
      background: var(--outline);
    }
    .ka-hub-rule-info {
      flex: 1;
      min-width: 0;
    }
    .ka-hub-rule-name {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--on-surface);
    }
    .ka-hub-rule-desc {
      display: block;
      font-size: 10px;
      color: var(--outline);
      margin-top: 2px;
    }

    /* Small cards */
    .ka-hub-card-sm .ka-hub-card-desc {
      margin-bottom: 10px;
    }

    /* Activity feed */
    .ka-hub-feed {
      border-radius: 10px;
      background: var(--surface-container-lowest);
      border: 1px solid var(--border-subtle);
      max-height: 300px;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .ka-hub-feed-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.02);
      animation: hub-feed-in 0.35s ease-out;
      transition: background 0.15s;
    }
    .ka-hub-feed-item:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    .ka-hub-feed-item:last-child {
      border-bottom: none;
    }
    .ka-hub-feed-icon {
      font-size: 16px !important;
      margin-top: 1px;
      flex-shrink: 0;
    }
    .ka-hub-feed-body {
      flex: 1;
      min-width: 0;
    }
    .ka-hub-feed-msg {
      display: block;
      font-size: 12px;
      line-height: 1.4;
      color: var(--on-surface-variant);
    }
    .ka-hub-feed-time {
      display: block;
      font-size: 10px;
      color: var(--outline);
      margin-top: 2px;
    }
    .ka-hub-feed-empty {
      padding: 32px;
      text-align: center;
      color: var(--outline);
    }
    .ka-hub-feed-empty .material-symbols-outlined {
      display: block;
      font-size: 32px;
      margin: 0 auto 8px;
      opacity: 0.25;
    }
    .ka-hub-feed-empty p {
      font-size: 12px;
      margin: 0;
    }

    @keyframes hub-feed-in {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Stagger entry animations */
    .ka-hub-card {
      animation: hub-card-enter 0.4s ease backwards;
    }
    .ka-hub-card:nth-child(1) { animation-delay: 0.05s; }
    .ka-hub-card:nth-child(2) { animation-delay: 0.1s; }
    .ka-hub-card:nth-child(3) { animation-delay: 0.15s; }
    .ka-hub-card:nth-child(4) { animation-delay: 0.2s; }
    .ka-hub-card:nth-child(5) { animation-delay: 0.25s; }
    .ka-hub-card:nth-child(6) { animation-delay: 0.28s; }
    .ka-hub-card:nth-child(7) { animation-delay: 0.31s; }
    .ka-hub-card:nth-child(8) { animation-delay: 0.34s; }
    .ka-hub-card:nth-child(9) { animation-delay: 0.37s; }
    .ka-hub-card:nth-child(10) { animation-delay: 0.4s; }

    @keyframes hub-card-enter {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .ka-hub-stat {
      animation: hub-stat-enter 0.3s ease backwards;
    }
    .ka-hub-stat:nth-child(1) { animation-delay: 0.0s; }
    .ka-hub-stat:nth-child(2) { animation-delay: 0.05s; }
    .ka-hub-stat:nth-child(3) { animation-delay: 0.1s; }
    .ka-hub-stat:nth-child(4) { animation-delay: 0.15s; }
    .ka-hub-stat:nth-child(5) { animation-delay: 0.2s; }

    @keyframes hub-stat-enter {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ══════════ TRUST SCORE RADAR ══════════ */

    .ka-hub-trust-panel {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      padding: 20px;
      border-radius: 14px;
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      position: relative;
      overflow: hidden;
    }
    .ka-hub-trust-panel::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -20%;
      width: 60%;
      height: 200%;
      background: radial-gradient(ellipse, rgba(0, 229, 255, 0.04), transparent 70%);
      pointer-events: none;
    }
    .ka-hub-trust-radar-wrap {
      flex-shrink: 0;
      width: 200px;
      position: relative;
    }
    .ka-hub-trust-radar {
      width: 200px;
      height: 200px;
    }
    .trust-grid {
      fill: none;
      stroke: rgba(255, 255, 255, 0.06);
      stroke-width: 1;
    }
    .trust-grid-mid { stroke: rgba(255, 255, 255, 0.04); }
    .trust-grid-inner { stroke: rgba(255, 255, 255, 0.03); }
    .trust-axis {
      stroke: rgba(255, 255, 255, 0.05);
      stroke-width: 1;
    }
    .trust-fill {
      fill: rgba(0, 229, 255, 0.12);
      transition: points 0.8s ease;
    }
    .trust-stroke {
      fill: none;
      stroke: var(--cyan-glow);
      stroke-width: 2;
      filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.4));
      transition: points 0.8s ease;
    }
    .trust-dot {
      fill: var(--cyan-glow);
      filter: drop-shadow(0 0 4px rgba(0, 229, 255, 0.6));
      transition: cx 0.8s ease, cy 0.8s ease;
    }
    .trust-label {
      fill: var(--outline);
      font-size: 9px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    .ka-hub-trust-info {
      flex: 1;
      min-width: 0;
      position: relative;
    }
    .ka-hub-trust-grade {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 56px;
      font-weight: 700;
      line-height: 1;
      color: var(--primary-fixed);
      letter-spacing: -0.04em;
    }
    .ka-hub-trust-decision {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 14px;
      border-radius: 999px;
      margin: 8px 0 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .ka-hub-trust-decision[data-decision="SHIP"] {
      background: rgba(107, 203, 119, 0.12);
      color: #6bcb77;
      border: 1px solid rgba(107, 203, 119, 0.25);
    }
    .ka-hub-trust-decision[data-decision="REVIEW"] {
      background: rgba(251, 191, 36, 0.12);
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.25);
    }
    .ka-hub-trust-decision[data-decision="NO_SHIP"] {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .ka-hub-trust-decision-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: hub-dot-pulse 1.5s ease-in-out infinite;
    }
    .ka-hub-trust-overall {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 14px;
    }
    .ka-hub-trust-overall-val {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 32px;
      font-weight: 700;
      color: var(--on-surface);
    }
    .ka-hub-trust-overall-lbl {
      font-size: 14px;
      color: var(--outline);
    }
    .ka-hub-trust-dims {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .ka-hub-trust-dim {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ka-hub-trust-dim-lbl {
      font-size: 11px;
      color: var(--on-surface-variant);
      width: 100px;
      flex-shrink: 0;
    }
    .ka-hub-trust-dim-bar {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--surface-container-highest);
      overflow: hidden;
    }
    .ka-hub-trust-dim-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, var(--primary-container), var(--secondary-container));
      transition: width 0.8s ease;
    }
    .ka-hub-trust-dim-val {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: var(--primary-fixed-dim);
      width: 28px;
      text-align: right;
    }
    .ka-hub-trust-trend {
      font-size: 11px;
      color: var(--outline);
      margin-bottom: 8px;
    }
    .ka-hub-trust-reducers {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 100px;
      overflow-y: auto;
      margin-bottom: 8px;
    }
    .ka-hub-trust-reducer {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--surface-container-lowest);
      font-size: 11px;
      color: var(--on-surface-variant);
    }
    .ka-hub-trust-reducer-impact {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      min-width: 28px;
    }
    .ka-hub-trust-reducer-impact[data-severity="critical"] { color: #ef4444; }
    .ka-hub-trust-reducer-impact[data-severity="major"] { color: #f97316; }
    .ka-hub-trust-reducer-impact[data-severity="minor"] { color: #fbbf24; }
    .ka-hub-trust-reducer-impact[data-severity="info"] { color: var(--outline); }
    .ka-hub-trust-meta {
      display: flex;
      gap: 16px;
      font-size: 10px;
      color: var(--outline);
    }

    @media (max-width: 600px) {
      .ka-hub-trust-panel { flex-direction: column; align-items: center; }
      .ka-hub-trust-radar-wrap { width: 160px; }
      .ka-hub-trust-radar { width: 160px; height: 160px; }
    }

    /* ══════════ SCAN HISTORY ══════════ */

    .ka-hub-history-panel {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      overflow: hidden;
    }
    .ka-hub-history-chart {
      padding: 12px 16px 8px;
    }
    .ka-hub-history-chart svg {
      width: 100%;
      height: 60px;
    }
    .ka-hub-history-stats {
      display: flex;
      border-top: 1px solid var(--border-subtle);
    }
    .ka-hub-history-stat {
      flex: 1;
      text-align: center;
      padding: 10px 4px;
      border-right: 1px solid var(--border-subtle);
    }
    .ka-hub-history-stat:last-child { border-right: none; }
    .ka-hub-history-stat-val {
      display: block;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--primary-fixed-dim);
    }
    .ka-hub-history-stat-lbl {
      display: block;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--outline);
      margin-top: 2px;
    }

    /* ══════════ CONNECTED PLATFORMS ══════════ */

    .ka-hub-platforms {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .ka-hub-platform-card {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 16px;
      transition: all 0.3s ease;
    }
    .ka-hub-platform-card:hover {
      border-color: rgba(255, 255, 255, 0.08);
      background: var(--surface-container);
    }
    .ka-hub-platform-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .ka-hub-platform-header .material-symbols-outlined {
      font-size: 24px;
    }
    .ka-hub-platform-header h4 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: var(--on-surface);
      margin: 0;
    }
    .ka-hub-platform-status {
      font-size: 10px;
      font-weight: 500;
      color: var(--outline);
      display: block;
    }
    .ka-hub-platform-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--outline-variant);
      margin-left: auto;
      flex-shrink: 0;
      transition: all 0.3s;
    }
    .ka-hub-platform-dot[data-status="active"] {
      background: var(--cyan-glow);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
      animation: hub-dot-pulse 1.5s ease-in-out infinite;
    }
    .ka-hub-platform-dot[data-status="watching"] {
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
      animation: hub-dot-breathe 3s ease-in-out infinite;
    }
    .ka-hub-platform-info {
      margin-bottom: 10px;
    }
    .ka-hub-platform-detail {
      font-size: 11px;
      color: var(--outline);
      font-family: 'SF Mono', 'Fira Code', monospace;
      word-break: break-all;
    }
    .ka-hub-platform-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ka-hub-platform-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ka-hub-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.04);
      background: var(--surface-container-lowest);
      color: var(--on-surface-variant);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .ka-hub-link-btn .material-symbols-outlined {
      font-size: 14px;
    }
    .ka-hub-link-btn:hover {
      background: var(--surface-container);
      color: var(--primary-fixed);
      border-color: rgba(0, 229, 255, 0.15);
    }
    .ka-hub-platform-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }
    .ka-hub-mcp-tool-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(0, 229, 255, 0.06);
      border: 1px solid rgba(0, 229, 255, 0.1);
      color: var(--primary-fixed-dim);
      font-size: 10px;
      font-weight: 500;
    }

    /* ══════════ TIER GATING ══════════ */

    /* Blurred metrics for free tier */
    .gated-blur .ka-hub-card-metric-val,
    .gated-blur .ka-hub-card-metrics {
      filter: blur(6px);
      user-select: none;
      pointer-events: none;
    }

    /* Free tier: card expand disabled */
    html[data-tier="free"] .ka-hub-card-expand {
      display: none;
    }
    html[data-tier="free"] .ka-hub-card {
      cursor: default;
    }

    /* Gated overlay on cards */
    .ka-hub-card-gate {
      display: none;
    }
    html[data-tier="free"] .ka-hub-card-gate {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.04), rgba(0, 104, 237, 0.03));
      border: 1px dashed rgba(0, 229, 255, 0.15);
      margin-top: 12px;
      text-align: center;
    }
    .ka-hub-card-gate .material-symbols-outlined {
      font-size: 28px;
      color: var(--primary-fixed-dim);
      opacity: 0.6;
    }
    .ka-hub-card-gate p {
      font-size: 11px;
      color: var(--on-surface-variant);
      margin: 0;
      line-height: 1.4;
    }
    .ka-hub-card-gate .ka-hub-upgrade-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.04em;
      color: #001f24;
      background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
      box-shadow: 0 0 16px rgba(0, 229, 255, 0.12);
      transition: all 0.2s;
    }
    .ka-hub-card-gate .ka-hub-upgrade-btn:hover {
      box-shadow: 0 0 24px rgba(0, 229, 255, 0.2);
      transform: translateY(-1px);
    }

    /* Hide action buttons for free tier, show upgrade gate instead */
    html[data-tier="free"] .ka-hub-card-actions {
      display: none;
    }

    /* Enterprise-gated cards */
    .gated-enterprise .ka-hub-card-actions {
      display: none;
    }
    .ka-hub-enterprise-gate {
      display: none;
    }
    .gated-enterprise .ka-hub-enterprise-gate {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(255, 255, 255, 0.06);
      margin-top: 8px;
    }
    .ka-hub-enterprise-gate .material-symbols-outlined {
      font-size: 16px;
      color: var(--outline);
    }
    .ka-hub-enterprise-gate span {
      font-size: 11px;
      color: var(--outline);
    }

    /* Activity feed: redacted paths for free tier */
    html[data-tier="free"] .ka-hub-feed-msg .file-path {
      filter: blur(4px);
      user-select: none;
    }

    /* Tier badge in topbar */
    .ka-hub-tier-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .ka-hub-tier-badge[data-tier="free"] {
      background: rgba(255, 255, 255, 0.05);
      color: var(--outline);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .ka-hub-tier-badge[data-tier="starter"] {
      background: rgba(0, 229, 255, 0.08);
      color: var(--primary-fixed-dim);
      border: 1px solid rgba(0, 229, 255, 0.15);
    }
    .ka-hub-tier-badge[data-tier="pro"] {
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.12), rgba(0, 104, 237, 0.08));
      color: var(--primary-fixed);
      border: 1px solid rgba(0, 229, 255, 0.2);
    }
    .ka-hub-tier-badge[data-tier="compliance"] {
      background: linear-gradient(135deg, rgba(107, 203, 119, 0.12), rgba(0, 229, 255, 0.08));
      color: #6bcb77;
      border: 1px solid rgba(107, 203, 119, 0.2);
    }
  `;
}
