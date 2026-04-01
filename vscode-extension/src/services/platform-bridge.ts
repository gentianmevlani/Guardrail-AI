/**
 * Platform Bridge — Unified connector for CLI, MCP, Web API, and Web Dashboard.
 *
 * Keeps all Guardrail platforms in sync:
 * - Pushes scan results to the API so they appear on the web dashboard
 * - Generates deep-link URLs to specific findings/reports on the web
 * - Monitors MCP server availability and exposes tool metadata
 * - Bridges CLI context data (routes, env, schemas) into the Hub
 * - Emits cross-platform activity events to the live engine
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  buildWebDashboardUrl,
  getGuardrailWebUrl,
} from "../guardrail-web-urls";
import type { ScanResult } from "../mcp-client";
import type { LiveActivityEngine } from "./live-activity-engine";

// ── Types ──

export interface PlatformStatus {
  cli: {
    available: boolean;
    path: string;
    version: string | null;
    lastUsed: number | null;
  };
  mcp: {
    available: boolean;
    path: string;
    toolCount: number;
    tools: string[];
    lastProbe: number | null;
  };
  api: {
    connected: boolean;
    authenticated: boolean;
    baseUrl: string;
    tier: string;
    lastSync: number | null;
  };
  github: {
    appInstalled: boolean;
    oauthConnected: boolean;
    installations: Array<{
      installationId: string;
      accountLogin: string;
      repoCount: number;
    }>;
    repoCount: number;
    installUrl: string;
  };
  web: {
    url: string;
    deepLinks: {
      dashboard: string;
      findings: string;
      billing: string;
      docs: string;
      settings: string;
      githubConnect: string;
    };
  };
}

export interface SyncResult {
  success: boolean;
  message: string;
  webUrl?: string;
}

// ── Platform Bridge ──

export class PlatformBridge implements vscode.Disposable {
  private _liveEngine: LiveActivityEngine | undefined;
  private _extensionContext: vscode.ExtensionContext | undefined;
  private _lastSyncedScan: ScanResult | null = null;
  private _mcpToolsCache: string[] = [];
  private _mcpProbeTime: number | null = null;
  private _cliVersion: string | null = null;
  private _disposables: vscode.Disposable[] = [];

  registerLiveEngine(engine: LiveActivityEngine): void {
    this._liveEngine = engine;
  }

  registerContext(context: vscode.ExtensionContext): void {
    this._extensionContext = context;
  }

  // ── CLI Bridge ──

  async probeCli(): Promise<PlatformStatus["cli"]> {
    const folders = vscode.workspace.workspaceFolders;
    const wsPath = folders?.[0]?.uri.fsPath ?? "";

    // Check for CLI binary
    const candidates = [
      path.join(wsPath, "bin", "guardrail.js"),
      path.join(wsPath, "node_modules", ".bin", "guardrail"),
      path.join(wsPath, "packages", "cli", "dist", "index.js"),
    ];

    let cliPath = "guardrail";
    let available = false;

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        cliPath = p;
        available = true;
        break;
      }
    }

    return {
      available,
      path: cliPath,
      version: this._cliVersion,
      lastUsed: null,
    };
  }

  // ── MCP Bridge ──

  async probeMcp(): Promise<PlatformStatus["mcp"]> {
    const folders = vscode.workspace.workspaceFolders;
    const wsPath = folders?.[0]?.uri.fsPath ?? "";

    const mcpCandidates = [
      path.join(wsPath, "mcp-server", "index.js"),
      path.join(wsPath, "..", "mcp-server", "index.js"),
    ];

    let mcpPath = "";
    let available = false;
    const tools: string[] = [];

    for (const p of mcpCandidates) {
      if (fs.existsSync(p)) {
        mcpPath = p;
        available = true;
        break;
      }
    }

    // Discover MCP tool files
    if (available && mcpPath) {
      const mcpDir = path.dirname(mcpPath);
      try {
        const files = fs.readdirSync(mcpDir).filter(
          (f) => f.endsWith("-tools.js") || f.endsWith("-tools.ts"),
        );
        for (const f of files) {
          const name = f
            .replace(/-tools\.(js|ts)$/, "")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          tools.push(name);
        }
      } catch {
        // ignore read errors
      }
    }

    this._mcpToolsCache = tools;
    this._mcpProbeTime = Date.now();

    if (this._liveEngine && available) {
      this._liveEngine.emit({
        type: "service-activated",
        message: `MCP server found with ${tools.length} tool modules`,
        icon: "terminal",
        accent: "var(--secondary)",
        service: "context-engine",
      });
    }

    return {
      available,
      path: mcpPath,
      toolCount: tools.length,
      tools,
      lastProbe: this._mcpProbeTime,
    };
  }

  // ── API Bridge ──

  getApiStatus(): PlatformStatus["api"] {
    const config = vscode.workspace.getConfiguration("guardrail");
    const baseUrl = config.get<string>("apiEndpoint", "https://api.guardrailai.dev");

    return {
      connected: true,
      authenticated: false, // Will be updated by caller
      baseUrl,
      tier: "free",
      lastSync: this._lastSyncedScan ? Date.now() : null,
    };
  }

  /**
   * Push scan results to the web API so they appear on the web dashboard.
   * Returns a deep-link URL to the scan report.
   */
  async syncScanToApi(result: ScanResult): Promise<SyncResult> {
    this._lastSyncedScan = result;

    if (!this._extensionContext) {
      return { success: false, message: "Extension context not available" };
    }

    const apiKey = await this._extensionContext.secrets.get("guardrail.apiKey");
    if (!apiKey) {
      // Not authenticated — can't sync, but still generate deep link
      const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";
      const url = buildWebDashboardUrl({ context: "post-scan", workspaceName: wsName });
      return {
        success: false,
        message: "Sign in to sync results to web dashboard",
        webUrl: url,
      };
    }

    try {
      const config = vscode.workspace.getConfiguration("guardrail");
      const baseUrl = config.get<string>("apiEndpoint", "https://api.guardrailai.dev");
      const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";

      // Push scan summary to API
      const response = await fetch(`${baseUrl}/api/scans/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "User-Agent": "guardrail-vscode/2.0.0",
        },
        body: JSON.stringify({
          source: "vscode-extension",
          workspace: wsName,
          score: result.score,
          grade: result.grade,
          canShip: result.canShip,
          counts: result.counts,
          cliSummary: result.cliSummary,
          issueCount: result.issues?.length ?? 0,
          timestamp: new Date().toISOString(),
        }),
      });

      const url = buildWebDashboardUrl({ context: "synced-scan", workspaceName: wsName });

      if (response.ok) {
        this._liveEngine?.emit({
          type: "guard-passed",
          message: "Scan synced to web dashboard",
          icon: "cloud_done",
          accent: "#10b981",
          service: "context-engine",
        });
        return { success: true, message: "Synced to web dashboard", webUrl: url };
      } else {
        return { success: false, message: `API returned ${response.status}`, webUrl: url };
      }
    } catch (error) {
      const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";
      return {
        success: false,
        message: error instanceof Error ? error.message : "Sync failed",
        webUrl: buildWebDashboardUrl({ context: "post-scan", workspaceName: wsName }),
      };
    }
  }

  // ── Web Deep Links ──

  getDeepLinks(): PlatformStatus["web"] {
    const wsName = vscode.workspace.workspaceFolders?.[0]?.name ?? "";
    return {
      url: getGuardrailWebUrl("/"),
      deepLinks: {
        dashboard: buildWebDashboardUrl({ context: "hub", workspaceName: wsName }),
        findings: buildWebDashboardUrl({ context: "findings", workspaceName: wsName }),
        billing: getGuardrailWebUrl("/billing"),
        docs: getGuardrailWebUrl("/docs"),
        settings: getGuardrailWebUrl("/settings"),
        githubConnect: getGuardrailWebUrl("/dashboard?connect=github"),
      },
    };
  }

  /**
   * Fetch GitHub connection status from the API.
   */
  async getGitHubStatus(): Promise<PlatformStatus["github"]> {
    const defaultStatus: PlatformStatus["github"] = {
      appInstalled: false,
      oauthConnected: false,
      installations: [],
      repoCount: 0,
      installUrl: "https://github.com/apps/guardrail-app/installations/new",
    };

    if (!this._extensionContext) return defaultStatus;

    const apiKey = await this._extensionContext.secrets.get("guardrail.apiKey");
    if (!apiKey) return defaultStatus;

    try {
      const config = vscode.workspace.getConfiguration("guardrail");
      const baseUrl = config.get<string>("apiEndpoint", "https://api.guardrailai.dev");

      const response = await fetch(`${baseUrl}/api/github/app/connection`, {
        headers: {
          "X-API-Key": apiKey,
          "User-Agent": "guardrail-vscode/2.0.0",
        },
      });

      if (response.ok) {
        const json = await response.json() as {
          success: boolean;
          data: {
            oauth: { connected: boolean };
            app: { installed: boolean; installations: Array<{ installationId: string; accountLogin: string; repoCount: number }> };
            repositories: unknown[];
            installUrl: string;
          };
        };

        if (json.success && json.data) {
          const status: PlatformStatus["github"] = {
            appInstalled: json.data.app.installed,
            oauthConnected: json.data.oauth.connected,
            installations: json.data.app.installations,
            repoCount: json.data.repositories.length,
            installUrl: json.data.installUrl,
          };

          if (status.appInstalled) {
            this._liveEngine?.emit({
              type: "service-activated",
              message: `GitHub App: ${status.repoCount} repos connected`,
              icon: "code",
              accent: "#10b981",
              service: "context-engine",
            });
          }

          return status;
        }
      }
    } catch {
      // API not reachable — return defaults
    }

    return defaultStatus;
  }

  // ── Full Status ──

  async getFullStatus(): Promise<PlatformStatus> {
    const [cli, mcp, github] = await Promise.all([
      this.probeCli(),
      this.probeMcp(),
      this.getGitHubStatus(),
    ]);
    return {
      cli,
      mcp,
      api: this.getApiStatus(),
      github,
      web: this.getDeepLinks(),
    };
  }

  // ── CLI Context Fetch ──

  /**
   * Fetch structured context from CLI (routes, env, schemas) and emit to live engine.
   */
  async fetchCliContext(): Promise<Record<string, unknown> | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return null;

    try {
      const { CLIService } = await import("./cli-service");
      const cli = new CLIService(folders[0].uri.fsPath);
      const result = await cli.runContextStdoutJson();

      if (result.success && result.data) {
        this._liveEngine?.emit({
          type: "context-updated",
          message: "CLI context loaded (routes, env, schemas)",
          icon: "data_object",
          accent: "var(--cyan-glow)",
          service: "context-engine",
        });
        return result.data;
      }
    } catch {
      // CLI not available — that's fine
    }
    return null;
  }

  dispose(): void {
    this._disposables.forEach((d) => d.dispose());
  }
}
