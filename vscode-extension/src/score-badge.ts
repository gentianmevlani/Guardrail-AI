/**
 * guardrail Score Badge
 *
 * Traffic light status bar showing workspace health score.
 * - 🔴 Red: Score < 50 (critical issues)
 * - 🟡 Yellow: Score 50-79 (warnings)
 * - 🟢 Green: Score 80+ (ship ready)
 */

import * as vscode from "vscode";
import { GuardrailMCPClient, ScanResult } from "./mcp-client";
import { setLastScanResult } from "./scan-state";

export class ScoreBadge {
  private statusBarItem: vscode.StatusBarItem;
  private mcpClient: GuardrailMCPClient;
  private currentScore: number = -1;
  private isScanning: boolean = false;

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

  private setInitialState(): void {
    this.statusBarItem.text = "$(shield) guardrail";
    this.statusBarItem.tooltip = "Click to scan workspace";
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Update badge to show scanning state
   */
  setScanning(): void {
    this.isScanning = true;
    this.statusBarItem.text = "$(sync~spin) Scanning...";
    this.statusBarItem.tooltip = "guardrail is analyzing your workspace";
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Update badge with scan results
   */
  updateScore(result: ScanResult): void {
    this.isScanning = false;
    this.currentScore = result.score;
    setLastScanResult(result);

    const { icon, color, bgColor } = this.getScoreDisplay(result.score);

    this.statusBarItem.text = `${icon} Score: ${result.score}/100`;
    this.statusBarItem.tooltip = this.buildTooltip(result);
    this.statusBarItem.backgroundColor = bgColor;
    this.statusBarItem.color = color;
  }

  /**
   * Update badge to show error state
   */
  setError(message: string): void {
    this.isScanning = false;
    this.statusBarItem.text = "$(error) guardrail Error";
    this.statusBarItem.tooltip = message;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
  }

  /**
   * Update badge to show no workspace state
   */
  setNoWorkspace(): void {
    this.statusBarItem.text = "$(shield) guardrail";
    this.statusBarItem.tooltip = "Open a workspace to scan";
    this.statusBarItem.backgroundColor = undefined;
  }

  private getScoreDisplay(score: number): {
    icon: string;
    color: string | undefined;
    bgColor: vscode.ThemeColor | undefined;
  } {
    if (score >= 80) {
      return {
        icon: "$(pass-filled)",
        color: "#6bcb77",
        bgColor: undefined,
      };
    } else if (score >= 50) {
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

    const statusEmoji =
      result.score >= 80 ? "🟢" : result.score >= 50 ? "🟡" : "🔴";
    const verdict = result.canShip ? "✅ Ready to ship" : "🚫 Not ready";

    md.appendMarkdown(
      `## ${statusEmoji} guardrail Score: ${result.score}/100\n\n`,
    );
    md.appendMarkdown(`**Grade:** ${result.grade}\n\n`);
    md.appendMarkdown(`**Verdict:** ${verdict}\n\n`);

    if (result.counts) {
      md.appendMarkdown(`### Issues Found\n\n`);
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
  getScore(): number {
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
