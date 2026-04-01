/**
 * Team Collaboration Panel
 *
 * Data comes only from the CLI (`guardrail team --format json`) or
 * `.guardrail/team-conventions.json` after `guardrail context`. No mock users or reviews.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { CLIService } from "../services/cli-service";
import { getGuardrailPanelHead } from "../webview-shared-styles";
import { teamCollaborationStitchCss } from "./team-collaboration-stitch-css";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "online" | "offline" | "busy" | "away";
  lastActive: string;
  expertise: string[];
}

/** Reserved for future server-backed features; always empty when using local CLI only. */
export interface CodeReview {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export class TeamCollaborationPanel {
  public static currentPanel: TeamCollaborationPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private readonly _workspacePath: string;
  private _currentView: "dashboard" | "reviews" | "knowledge" | "activity" =
    "dashboard";
  private readonly _cliService: CLIService;

  private _members: TeamMember[] = [];
  private _reviews: CodeReview[] = [];
  private _hint =
    "Loading team data from guardrail CLI…";
  private _dataSource: "cli" | "file" | "none" = "none";

  private constructor(
    panel: vscode.WebviewPanel,
    workspacePath: string,
    _extensionContext: vscode.ExtensionContext,
  ) {
    this._panel = panel;
    this._workspacePath = workspacePath;
    this._cliService = new CLIService(workspacePath);

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "switchView":
            this._switchView(message.view);
            break;
          case "createReview":
            await this._notAvailableLocally(
              "Code reviews are not part of the local guardrail CLI. Use your Git host (PRs) or connect Guardrail Cloud when available.",
            );
            break;
          case "shareKnowledge":
            await this._notAvailableLocally(
              "Knowledge sharing is not part of the local CLI. Run `guardrail context` to refresh `.guardrail/team-conventions.json` from git.",
            );
            break;
          case "startMeeting":
            await this._notAvailableLocally(
              "Meetings are not triggered from the local guardrail CLI.",
            );
            break;
          case "inviteMember":
            await this._notAvailableLocally(
              "Invites are not managed by the local CLI.",
            );
            break;
          case "exportReport":
            await this._exportTeamReport();
            break;
          case "refresh":
            await this._reloadData();
            break;
        }
      },
      null,
      this._disposables,
    );

    void this._bootstrapData();
  }

  private async _notAvailableLocally(detail: string): Promise<void> {
    await vscode.window.showInformationMessage(detail);
  }

  public static createOrShow(
    workspacePath: string,
    extensionContext: vscode.ExtensionContext,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TeamCollaborationPanel.currentPanel) {
      TeamCollaborationPanel.currentPanel._panel.reveal(column);
      void TeamCollaborationPanel.currentPanel._reloadData();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "teamCollaboration",
      "Team Collaboration",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    TeamCollaborationPanel.currentPanel = new TeamCollaborationPanel(
      panel,
      workspacePath,
      extensionContext,
    );
  }

  private _switchView(view: string) {
    this._currentView = view as typeof this._currentView;
    this._update();
  }

  private async _bootstrapData(): Promise<void> {
    await this._reloadData();
  }

  private async _reloadData(): Promise<void> {
    this._hint = "Loading…";
    this._update();

    const fromCli = await this._tryLoadFromCli();
    if (fromCli) {
      return;
    }

    const fromFile = this._tryLoadFromTeamConventionsFile();
    if (fromFile) {
      return;
    }

    this._members = [];
    this._reviews = [];
    this._dataSource = "none";
    this._hint =
      "No team data yet. Run `guardrail team --format json` or `guardrail context` in this workspace (requires git history).";
    this._update();
  }

  private async _tryLoadFromCli(): Promise<boolean> {
    try {
      const cliResult = await this._cliService.getTeamData();
      if (cliResult.data) {
        const r = cliResult.data as Record<string, unknown>;
        if (r.available === false) {
          return false;
        }
        this._applyReport(r);
        this._dataSource = "cli";
        this._hint =
          "Data from `guardrail team` (git contributors). Code reviews / knowledge tabs are empty until a server integration exists.";
        this._update();
        return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  }

  private _tryLoadFromTeamConventionsFile(): boolean {
    const p = path.join(
      this._workspacePath,
      ".guardrail",
      "team-conventions.json",
    );
    if (!fs.existsSync(p)) {
      return false;
    }
    try {
      const raw = fs.readFileSync(p, "utf8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      this._applyReport(data);
      this._dataSource = "file";
      this._hint =
        "Loaded `.guardrail/team-conventions.json` (from `guardrail context`).";
      this._update();
      return true;
    } catch {
      return false;
    }
  }

  private _applyReport(report: Record<string, unknown>): void {
    if (!report || report.available === false) {
      this._members = [];
      return;
    }

    const contributors = report.contributors as
      | Array<{
          name: string;
          filesContributed?: number;
          style?: {
            typescript?: { usesExplicitTypes?: boolean; prefersInterfaces?: boolean };
            formatting?: { usesSemicolons?: boolean; prefersSingleQuotes?: boolean };
          };
        }>
      | undefined;

    if (!Array.isArray(contributors)) {
      this._members = [];
      return;
    }

    this._members = contributors.map((c, i) => {
      const expertise: string[] = [];
      const st = c.style;
      if (st?.typescript?.usesExplicitTypes) {
        expertise.push("explicit TypeScript types");
      }
      if (st?.typescript?.prefersInterfaces) {
        expertise.push("interfaces");
      }
      if (st?.formatting?.usesSemicolons) {
        expertise.push("semicolons");
      }
      if (st?.formatting?.prefersSingleQuotes) {
        expertise.push("single quotes");
      }

      const files = c.filesContributed ?? 0;
      return {
        id: `git-${i}-${c.name}`,
        name: c.name,
        email: "",
        role: "member" as const,
        status: "offline" as const,
        lastActive: files ? `${files} files touched` : "git history",
        expertise,
      };
    });

    this._reviews = [];
  }

  private async _exportTeamReport(): Promise<void> {
    if (this._members.length === 0) {
      vscode.window.showWarningMessage(
        "Nothing to export — load team data with `guardrail team` or `guardrail context` first.",
      );
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        path.join(this._workspacePath, "team-conventions-export.md"),
      ),
      filters: { Markdown: ["md"] },
    });

    if (!uri) {
      return;
    }

    const lines: string[] = [
      "# Team conventions (guardrail)",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Source: ${this._dataSource}`,
      "",
      "## Contributors (from git)",
      "",
    ];

    for (const m of this._members) {
      lines.push(`### ${m.name}`);
      lines.push(`- Activity: ${m.lastActive}`);
      if (m.expertise.length) {
        lines.push(`- Style signals: ${m.expertise.join(", ")}`);
      }
      lines.push("");
    }

    fs.writeFileSync(uri.fsPath, lines.join("\n"), "utf8");
    vscode.window.showInformationMessage(`Exported team report to ${uri.fsPath}`);
  }

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    const teamMembers = this._members;
    const codeReviews = this._reviews;
    const knowledgeShares: { title: string; author: string }[] = [];
    const activities: { title: string; timestamp: string; author: string; description: string; type: string }[] = [];
    const hint = this._hint;
    const view = this._currentView;

    const tabClass = (v: string) =>
      v === view ? "tab active" : "tab";

    const spotlightAvatars =
      teamMembers.length === 0
        ? '<span style="font-size:12px;color:var(--on-surface-variant)">No contributors loaded yet.</span>'
        : teamMembers
            .slice(0, 6)
            .map(
              (m) =>
                `<div class="tc-avatar" title="${escapeHtml(m.name)}">${initials(m.name)}</div>`,
            )
            .join("");

    const dashboardDisplay = view === "dashboard" ? "grid" : "none";
    const reviewsDisplay = view === "reviews" ? "block" : "none";
    const knowledgeDisplay = view === "knowledge" ? "block" : "none";
    const activityDisplay = view === "activity" ? "block" : "none";

    return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulse Collaboration</title>
  ${getGuardrailPanelHead(teamCollaborationStitchCss)}
</head>
<body class="ka-dashboard-body ka-panel-page tc-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <div class="ka-shell">
  <header class="tc-head">
    <div class="tc-head-left">
      <span class="material-symbols-outlined" style="font-size:28px;color:var(--cyan-glow);" aria-hidden="true">groups</span>
      <div>
        <h1 class="tc-head-title">Pulse Collaboration</h1>
        <div style="font-size:11px;color:var(--on-surface-variant);letter-spacing:0.06em;text-transform:uppercase;">Git signal · guardrail team / context</div>
      </div>
    </div>
    <div class="tc-head-actions">
      <button type="button" class="btn secondary" onclick="refresh()">Refresh</button>
      <button type="button" class="btn secondary" onclick="exportReport()">Export</button>
    </div>
  </header>

  <div class="hint">${escapeHtml(hint)}</div>

  <div class="tabs" style="margin:16px 20px 0;">
    <button class="${tabClass("dashboard")}" onclick="switchView('dashboard')">Dashboard</button>
    <button class="${tabClass("reviews")}" onclick="switchView('reviews')">Code Reviews</button>
    <button class="${tabClass("knowledge")}" onclick="switchView('knowledge')">Knowledge</button>
    <button class="${tabClass("activity")}" onclick="switchView('activity')">Activity</button>
  </div>

  <div class="actions" style="margin:12px 20px 0;">
    <button class="btn" onclick="createReview()">Create review</button>
    <button class="btn" onclick="shareKnowledge()">Share knowledge</button>
    <button class="btn secondary" onclick="startMeeting()">Meeting</button>
    <button class="btn secondary" onclick="inviteMember()">Invite</button>
  </div>

  <div class="tc-bento">
    <div class="tc-spotlight">
      <div class="tc-spot-inner">
        <div class="tc-spot-kicker">Live signal</div>
        <h2 class="tc-spot-h3">Contributor orbit from git history</h2>
        <div class="tc-avatar-row">${spotlightAvatars}</div>
      </div>
    </div>
    <div class="tc-pulse-card">
      <div class="tc-spot-kicker" style="margin-bottom:4px;">Pulse map</div>
      <div style="font-size:12px;color:var(--on-surface-variant);line-height:1.4;">Synthetic topology — ties to contributor activity when data loads.</div>
      <div class="tc-pulse-svg-wrap">
        <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="tcPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#00e5ff;stop-opacity:0.2" />
              <stop offset="100%" style="stop-color:#c3f5ff;stop-opacity:0.9" />
            </linearGradient>
          </defs>
          <path class="tc-pulse-line" d="M20 90 C 80 20, 120 120, 180 70 S 280 40, 380 80" fill="none" stroke="url(#tcPulseGrad)" stroke-width="2" />
          <circle class="tc-node" cx="20" cy="90" r="6" fill="#00e5ff" />
          <circle class="tc-node" cx="180" cy="70" r="6" fill="#00e5ff" style="animation-delay:0.3s" />
          <circle class="tc-node" cx="380" cy="80" r="6" fill="#00e5ff" style="animation-delay:0.6s" />
        </svg>
      </div>
    </div>
  </div>

  <div class="tc-main-pad">
  <div id="dashboardView" class="content-grid" style="display:${dashboardDisplay};">
    <div class="team-sidebar">
      <div class="section-title">Contributors (${teamMembers.length})</div>
      ${
        teamMembers.length === 0
          ? '<div class="empty">No git contributors loaded.</div>'
          : teamMembers
              .map(
                (m) => `
        <div class="member-item">
          <div class="member-avatar">${initials(m.name)}</div>
          <div>
            <div style="font-weight:600">${escapeHtml(m.name)}</div>
            <div style="font-size:12px;color:var(--on-surface-variant)">${escapeHtml(m.lastActive)}</div>
            ${m.expertise.length ? `<div style="font-size:11px;margin-top:4px">${escapeHtml(m.expertise.join(", "))}</div>` : ""}
          </div>
        </div>`,
              )
              .join("")
      }
    </div>
    <div class="main-content">
      <div class="section-title">Overview</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${teamMembers.length}</div>
          <div class="stat-label">Contributors</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${codeReviews.length}</div>
          <div class="stat-label">Reviews (local)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${knowledgeShares.length}</div>
          <div class="stat-label">Knowledge</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activities.length}</div>
          <div class="stat-label">Activity feed</div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--on-surface-variant)">
        Reviews, knowledge, and activity feeds are not populated by the open-source CLI — only git-based contributors are shown.
      </p>
    </div>
  </div>

  <div id="reviewsView" style="display:${reviewsDisplay};">
    <div class="main-content panel-block">
      <div class="section-title">Code reviews</div>
      <div class="empty">No data — not part of local CLI. Use your Git forges for PRs.</div>
    </div>
  </div>

  <div id="knowledgeView" style="display:${knowledgeDisplay};">
    <div class="main-content panel-block">
      <div class="section-title">Knowledge</div>
      <div class="empty">No data — not part of local CLI.</div>
    </div>
  </div>

  <div id="activityView" style="display:${activityDisplay};">
    <div class="main-content panel-block">
      <div class="section-title">Activity</div>
      <div class="empty">No data — use git log in the terminal for history.</div>
    </div>
  </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function switchView(view) {
      vscode.postMessage({ command: 'switchView', view: view });
    }
    function refresh() { vscode.postMessage({ command: 'refresh' }); }
    function createReview() { vscode.postMessage({ command: 'createReview' }); }
    function shareKnowledge() { vscode.postMessage({ command: 'shareKnowledge' }); }
    function startMeeting() { vscode.postMessage({ command: 'startMeeting' }); }
    function inviteMember() { vscode.postMessage({ command: 'inviteMember' }); }
    function exportReport() { vscode.postMessage({ command: 'exportReport' }); }
  </script>
  </div>
</body>
</html>`;
  }

  public dispose() {
    TeamCollaborationPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
