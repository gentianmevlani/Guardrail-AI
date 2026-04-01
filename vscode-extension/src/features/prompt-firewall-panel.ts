/**
 * Prompt Firewall Panel
 *
 * Interactive webview for analyzing prompts through the Advanced Prompt
 * Firewall and safety detectors (injection, PII, unicode anomalies).
 */

import * as vscode from "vscode";
import * as path from "path";
import { getGuardrailPanelHead } from "../webview-shared-styles";
import { promptFirewallStitchCss } from "./prompt-firewall-stitch-css";
import { getPromptFirewallStitchHtml } from "./prompt-firewall-webview-html";
import {
  resolveExtensionTier,
  shouldHideIssueDetailsForTier,
} from "../tier-context";
import { getGuardrailWebUrl } from "../guardrail-web-urls";

export class PromptFirewallPanel {
  public static currentPanel: PromptFirewallPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _workspacePath: string;
  private _isAnalyzing: boolean = false;
  private readonly _extensionContext: vscode.ExtensionContext;

  private constructor(
    panel: vscode.WebviewPanel,
    workspacePath: string,
    extensionContext: vscode.ExtensionContext,
  ) {
    this._panel = panel;
    this._workspacePath = workspacePath;
    this._extensionContext = extensionContext;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "analyze":
            await this._runAnalysis(message.prompt, message.options);
            break;
          case "applyFix":
            await this._applyFix(message.fixId, message.fix);
            break;
          case "openBilling":
            await vscode.env.openExternal(
              vscode.Uri.parse(getGuardrailWebUrl("/billing")),
            );
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  public static createOrShow(
    workspacePath: string,
    extensionContext: vscode.ExtensionContext,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PromptFirewallPanel.currentPanel) {
      PromptFirewallPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "promptFirewall",
      "Prompt Firewall",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    PromptFirewallPanel.currentPanel = new PromptFirewallPanel(
      panel,
      workspacePath,
      extensionContext,
    );
  }

  private async _runAnalysis(
    prompt: string,
    options: {
      autoBreakdown?: boolean;
      autoVerify?: boolean;
      autoFix?: boolean;
      includeVersionControl?: boolean;
      generatePlan?: boolean;
    },
  ): Promise<void> {
    if (this._isAnalyzing) return;

    this._isAnalyzing = true;
    this._panel.webview.postMessage({ type: "analyzing", progress: 0 });

    try {
      let firewallResult: any = null;

      // Step 1: Run Advanced Prompt Firewall
      this._panel.webview.postMessage({
        type: "progress",
        message: "Running prompt firewall analysis...",
        progress: 20,
      });

      try {
        const firewallMod = await import(
          "@guardrail/ai-guardrails/firewall/advanced-prompt-firewall"
        );
        const firewall = firewallMod.createPromptFirewall(this._workspacePath);
        firewallResult = await firewall.process(prompt, options);
      } catch {
        // ai-guardrails package may not be available in the extension context;
        // fall through to inline detectors below.
      }

      // Step 2: Run inline safety detectors
      this._panel.webview.postMessage({
        type: "progress",
        message: "Running injection and safety checks...",
        progress: 60,
      });

      const injection = this._detectInjection(prompt);
      const pii = this._detectPII(prompt);
      const unicodeAnomalies = this._detectUnicodeAnomalies(prompt);

      // If firewall was unavailable, build a basic verification result
      if (!firewallResult) {
        const checks: any[] = [];

        checks.push({
          name: "Prompt Injection",
          status: injection ? "fail" : "pass",
          message: injection
            ? "Injection pattern detected"
            : "No injection patterns found",
          evidence: injection ? injection.snippet : undefined,
        });

        checks.push({
          name: "PII Exposure",
          status: pii.length > 0 ? "warning" : "pass",
          message:
            pii.length > 0
              ? `${pii.length} PII match(es) found`
              : "No PII detected",
        });

        checks.push({
          name: "Unicode Anomalies",
          status: unicodeAnomalies.length > 0 ? "warning" : "pass",
          message:
            unicodeAnomalies.length > 0
              ? unicodeAnomalies.map((a: any) => a.detail).join("; ")
              : "No unicode anomalies",
        });

        const passedChecks = checks.filter((c) => c.status === "pass").length;
        const score = Math.round((passedChecks / checks.length) * 100);

        firewallResult = {
          prompt,
          taskBreakdown: [],
          verification: {
            passed: !injection,
            checks,
            score,
            blockers: injection ? ["Injection pattern detected"] : [],
          },
          versionControl: { branch: "unknown", commit: "unknown", changes: [], conflicts: [] },
          immediateFixes: [],
          futurePlan: { phase: "immediate", tasks: [], milestones: [], risks: [] },
          context: {
            projectPath: this._workspacePath,
            timestamp: new Date().toISOString(),
            confidence: 0.5,
          },
          recommendations: injection
            ? ["Sanitize or reject the prompt before sending to an LLM"]
            : ["Prompt passed basic safety checks"],
        };
      }

      // Step 3: Apply tier gating (free tier: scores + verdict only, details locked)
      this._panel.webview.postMessage({
        type: "progress",
        message: "Finalizing results...",
        progress: 90,
      });

      const detailsLocked = await this._shouldLockDetails();

      this._panel.webview.postMessage({
        type: "complete",
        result: {
          firewallResult: detailsLocked
            ? {
                ...firewallResult,
                // Free tier: keep score and check statuses, redact details
                taskBreakdown: [],
                immediateFixes: [],
                futurePlan: { phase: "immediate", tasks: [], milestones: [], risks: [] },
                verification: {
                  ...firewallResult.verification,
                  // Keep check names and statuses but strip evidence
                  checks: firewallResult.verification.checks.map((c: any) => ({
                    name: c.name,
                    status: c.status,
                    message: c.message,
                  })),
                },
              }
            : firewallResult,
          injection,
          // Free tier: show PII count only, not actual matched text
          pii: detailsLocked ? pii.map((p: any) => ({ type: p.type })) : pii,
          unicodeAnomalies,
          detailsLocked,
          upgradeUrl: detailsLocked ? getGuardrailWebUrl("/billing") : undefined,
        },
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        type: "error",
        message: `Analysis failed: ${error.message}`,
      });
    } finally {
      this._isAnalyzing = false;
    }
  }

  private async _applyFix(fixId: string, fix: any): Promise<void> {
    try {
      const firewallMod = await import(
        "@guardrail/ai-guardrails/firewall/advanced-prompt-firewall"
      );
      const firewall = firewallMod.createPromptFirewall(this._workspacePath);
      const result = await firewall.applyFix(fix);
      this._panel.webview.postMessage({
        type: "fixApplied",
        fixId,
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        type: "fixApplied",
        fixId,
        success: false,
        message: `Failed to apply fix: ${error.message}`,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Tier gating (same as SecurityScannerPanel._shouldLockIssueDetails)
  // -----------------------------------------------------------------------

  /** Free tier: show scores/verdicts only — lock detailed findings, task breakdowns, fixes. */
  private async _shouldLockDetails(): Promise<boolean> {
    try {
      const tier = await resolveExtensionTier(this._extensionContext);
      return shouldHideIssueDetailsForTier(tier);
    } catch {
      return true; // fail closed: lock by default
    }
  }

  // -----------------------------------------------------------------------
  // Inline detectors (mirrors @guardrail/llm-safety detectors)
  // -----------------------------------------------------------------------

  private _detectInjection(
    text: string,
  ): { patternIndex: number; snippet: string } | null {
    const patterns: RegExp[] = [
      /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)\b/i,
      /\bdisregard\s+(the\s+)?(system|developer)\s+message\b/i,
      /\byou\s+are\s+now\s+(a|an|in)\s+/i,
      /\bnew\s+instructions?\s*:/i,
      /\boverride\s+(the\s+)?(safety|policy|rules?)\b/i,
      /\bjailbreak\b/i,
      /\bDAN\b.*\bmode\b/i,
      /\[SYSTEM\]/i,
      /<\|im_start\|>assistant/i,
    ];
    const t = text.slice(0, 50_000);
    for (let i = 0; i < patterns.length; i++) {
      const m = patterns[i]?.exec(t);
      if (m && m[0]) {
        const start = Math.max(0, (m.index ?? 0) - 20);
        return { patternIndex: i, snippet: t.slice(start, start + 120) };
      }
    }
    return null;
  }

  private _detectPII(
    text: string,
  ): Array<{ type: string; start: number; end: number; text: string }> {
    const out: Array<{ type: string; start: number; end: number; text: string }> = [];
    const t = text.slice(0, 200_000);
    const defs: Array<{ re: RegExp; type: string }> = [
      { re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, type: "phone" },
      { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, type: "email" },
      { re: /\b\d{3}-\d{2}-\d{4}\b/g, type: "ssn" },
      { re: /\b(?:\d[ -]*?){13,19}\b/g, type: "credit-card" },
    ];
    for (const { re, type } of defs) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        if (m[0]) {
          out.push({ type, start: m.index, end: m.index + m[0].length, text: m[0] });
        }
      }
    }
    return out;
  }

  private _detectUnicodeAnomalies(
    text: string,
  ): Array<{ kind: string; detail: string }> {
    const anomalies: Array<{ kind: string; detail: string }> = [];
    if (/[\u200B-\u200D\uFEFF\u2060\u180E]/.test(text)) {
      anomalies.push({ kind: "invisible", detail: "Zero-width or invisible characters detected" });
    }
    if (/[\u0400-\u04FF].*[\u0041-\u005A\u0061-\u007A]/.test(text)) {
      anomalies.push({ kind: "mixed-script-suspicious", detail: "Cyrillic + Latin mix — possible homoglyph attack" });
    }
    return anomalies;
  }

  // -----------------------------------------------------------------------

  private _update() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private _getHtmlContent(): string {
    return getPromptFirewallStitchHtml(
      getGuardrailPanelHead(promptFirewallStitchCss),
    );
  }

  public dispose() {
    PromptFirewallPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
