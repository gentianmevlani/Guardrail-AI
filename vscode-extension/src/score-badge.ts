/**
 * guardrail Score Badge
 *
 * Traffic light status bar showing workspace health score.
 * - 🔴 Red: Score < 50 (critical issues)
 * - 🟡 Yellow: Score 50-79 (warnings)
 * - 🟢 Green: Score 80+ (ship ready)
 */

import * as vscode from "vscode";
<<<<<<< HEAD
import { GUARDRAIL_SHIP_SCORE_THRESHOLD } from "@guardrail/core";
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { GuardrailMCPClient, ScanResult } from "./mcp-client";
import { GuardrailSidebarViewProvider } from "./features/guardrail-sidebar-view";
import { setLastScanResult } from "./scan-state";

export class ScoreBadge {
  private statusBarItem: vscode.StatusBarItem;
  private mcpClient: GuardrailMCPClient;
<<<<<<< HEAD
  /** Last scan score; `null` until a run completes or when CLI omitted a score. */
  private currentScore: number | null = null;
  private isScanning: boolean = false;
  /** Short label, e.g. "Free", "Pro" — from {@link setTierLabel}. */
  private tierShort = "";
  private lastResult: ScanResult | null = null;
=======
  private currentScore: number = -1;
  private isScanning: boolean = false;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

  constructor(mcpClient: GuardrailMCPClient) {
    this.mcpClient = mcpClient;

    // Create status bar item with high priority (appears on the right)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      1000,
    );

    this.statusBarItem.command = "guardrail.showDashboard";
    this.statusBarItem.name = "guardrail Score";

    this.setInitialState();
    this.statusBarItem.show();
  }

<<<<<<< HEAD
  /**
   * Updates plan suffix on the status bar (e.g. after login or profile poll).
   * Re-applies the last score row if a scan result is cached.
   */
  setTierLabel(displayLabel: string): void {
    this.tierShort = displayLabel.trim();
    if (this.isScanning) {
      return;
    }
    if (this.lastResult) {
      this.updateScore(this.lastResult);
    } else {
      this.setInitialState();
    }
  }

  private tierSuffix(): string {
    return this.tierShort ? ` · ${this.tierShort}` : "";
  }

  private setInitialState(): void {
    this.statusBarItem.text = `$(shield) Guardrail — Ready${this.tierSuffix()}`;
    this.statusBarItem.tooltip = this.buildReadyTooltip();
    this.statusBarItem.backgroundColor = undefined;
  }

  private buildReadyTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown("Click to open Guardrail dashboard");
    if (this.tierShort) {
      md.appendMarkdown(`\n\n**Plan:** ${this.tierShort}`);
    }
    return md;
  }

=======
  private setInitialState(): void {
    this.statusBarItem.text = "$(shield) Guardrail — Ready";
    this.statusBarItem.tooltip = "Click to open Guardrail dashboard";
    this.statusBarItem.backgroundColor = undefined;
  }

>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  /**
   * Update badge to show scanning state
   */
  setScanning(): void {
    this.isScanning = true;
<<<<<<< HEAD
    this.statusBarItem.text = `$(sync~spin) Guardrail — Scanning${this.tierSuffix()}`;
=======
    this.statusBarItem.text = "$(sync~spin) Guardrail — Scanning";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    this.statusBarItem.tooltip = "Guardrail is analyzing your workspace…";
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Update badge with scan results
   */
  updateScore(result: ScanResult): void {
    this.isScanning = false;
    this.currentScore = result.score;
<<<<<<< HEAD
    this.lastResult = result;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    setLastScanResult(result);
    GuardrailSidebarViewProvider.refreshIfOpen();

    const { icon, color, bgColor } = this.getScoreDisplay(result.score);

<<<<<<< HEAD
    const grade = result.grade && result.grade !== "?" ? result.grade : "";
    const gradeLabel = grade ? ` ${grade}` : "";
    const shipIcon = result.canShip ? "$(check)" : "$(x)";
    const scoreLabel = result.score === null ? "—" : String(result.score);
    this.statusBarItem.text = `${icon} ${scoreLabel}${gradeLabel} ${shipIcon}${this.tierSuffix()}`;
=======
    const grade = result.grade || '';
    const gradeLabel = grade ? ` ${grade}` : '';
    const shipIcon = result.canShip ? '$(check)' : '$(x)';
    this.statusBarItem.text = `${icon} ${result.score}${gradeLabel} ${shipIcon}`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    this.statusBarItem.tooltip = this.buildTooltip(result);
    this.statusBarItem.backgroundColor = bgColor;
    this.statusBarItem.color = color;
  }

  /**
   * Update badge to show error state
   */
  setError(message: string): void {
    this.isScanning = false;
<<<<<<< HEAD
    this.statusBarItem.text = `$(error) Guardrail — Error${this.tierSuffix()}`;
=======
    this.statusBarItem.text = "$(error) Guardrail — Error";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    this.statusBarItem.tooltip = message;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
  }

  /**
   * Update badge to show no workspace state
   */
  setNoWorkspace(): void {
<<<<<<< HEAD
    this.lastResult = null;
    this.currentScore = null;
    this.statusBarItem.text = `$(shield) Guardrail${this.tierSuffix()}`;
=======
    this.statusBarItem.text = "$(shield) Guardrail";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    this.statusBarItem.tooltip = "Open a workspace to begin scanning";
    this.statusBarItem.backgroundColor = undefined;
  }

<<<<<<< HEAD
  private getScoreDisplay(score: number | null): {
=======
  private getScoreDisplay(score: number): {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    icon: string;
    color: string | undefined;
    bgColor: vscode.ThemeColor | undefined;
  } {
<<<<<<< HEAD
    if (score === null) {
      return {
        icon: "$(question)",
        color: undefined,
        bgColor: undefined,
      };
    }
    if (score >= GUARDRAIL_SHIP_SCORE_THRESHOLD) {
=======
    if (score >= 80) {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      return {
        icon: "$(pass-filled)",
        color: "#6bcb77",
        bgColor: undefined,
      };
<<<<<<< HEAD
    } else if (score >= 50 && score < GUARDRAIL_SHIP_SCORE_THRESHOLD) {
=======
    } else if (score >= 50) {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      return {
        icon: "$(warning)",
        color: undefined,
        bgColor: new vscode.ThemeColor("statusBarItem.warningBackground"),
      };
    } else {
      return {
        icon: "$(error)",
        color: undefined,
        bgColor: new vscode.ThemeColor("statusBarItem.errorBackground"),
      };
    }
  }

  private buildTooltip(result: ScanResult): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

<<<<<<< HEAD
    const sc = result.score;
    const statusEmoji =
      sc === null
        ? "⚪"
        : sc >= GUARDRAIL_SHIP_SCORE_THRESHOLD
          ? "🟢"
          : sc >= 50
            ? "🟡"
            : "🔴";
    const verdict = result.canShip ? "✅ Ready to ship" : "🚫 Not ready";

    const scoreLine =
      sc === null
        ? "## ⚪ guardrail Score: — (unknown)\n\n"
        : `## ${statusEmoji} guardrail Score: ${sc}/100\n\n`;
    md.appendMarkdown(scoreLine);
    md.appendMarkdown(`**Grade:** ${result.grade}\n\n`);
    md.appendMarkdown(`**Verdict:** ${verdict}\n\n`);
    if (this.tierShort) {
      md.appendMarkdown(`**Plan:** ${this.tierShort}\n\n`);
    }
=======
    const statusEmoji =
      result.score >= 80 ? "🟢" : result.score >= 50 ? "🟡" : "🔴";
    const verdict = result.canShip ? "✅ Ready to ship" : "🚫 Not ready";

    md.appendMarkdown(
      `## ${statusEmoji} guardrail Score: ${result.score}/100\n\n`,
    );
    md.appendMarkdown(`**Grade:** ${result.grade}\n\n`);
    md.appendMarkdown(`**Verdict:** ${verdict}\n\n`);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

    if (result.cliSummary) {
      const c = result.cliSummary;
      md.appendMarkdown(`### Findings (last scan)\n\n`);
      md.appendMarkdown(
        `- Critical: ${c.critical} · High: ${c.high} · Medium: ${c.medium} · Low: ${c.low} · **Total: ${c.totalFindings}**\n\n`,
      );
    }

    if (result.counts) {
      md.appendMarkdown(`### Summary counts\n\n`);
      const counts = result.counts;
      if (counts.secrets)
        md.appendMarkdown(`- 🔑 Secrets: ${counts.secrets}\n`);
      if (counts.auth) md.appendMarkdown(`- 🔐 Auth: ${counts.auth}\n`);
      if (counts.mocks) md.appendMarkdown(`- 🎭 Mocks: ${counts.mocks}\n`);
      if (counts.routes) md.appendMarkdown(`- 🔗 Routes: ${counts.routes}\n`);
    }

    md.appendMarkdown(`\n---\n`);
    md.appendMarkdown(`[Scan Again](command:guardrail.scanWorkspace) | `);
    md.appendMarkdown(`[View Report](command:guardrail.showDashboard)`);

    return md;
  }

  /**
   * Get current score
   */
<<<<<<< HEAD
  getScore(): number | null {
=======
  getScore(): number {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    return this.currentScore;
  }

  /**
   * Check if currently scanning
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
