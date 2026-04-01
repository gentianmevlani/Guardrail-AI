/**
 * Guardrail Code Actions — Quick fixes from hallucination decorations.
 *
 * When the hallucination decorator highlights an issue, this provider
 * shows lightbulb actions to fix it inline:
 * - Remove mock/placeholder data
 * - Move secret to .env
 * - Replace empty handler with TODO
 * - Remove fake async delays
 * - Flag for AI re-generation
 */

import * as vscode from "vscode";

export class GuardrailInlineCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const line = document.lineAt(range.start.line);
    const text = line.text;

    // Empty handler → replace with console.warn
    if (/=>\s*\{\s*\}\s*[;,)]/.test(text)) {
      const fix = new vscode.CodeAction(
        "Guardrail: Replace empty handler with TODO",
        vscode.CodeActionKind.QuickFix,
      );
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(
        document.uri,
        line.range,
        text.replace(/=>\s*\{\s*\}/, "=> { /* TODO: implement handler */ }"),
      );
      fix.isPreferred = true;
      actions.push(fix);
    }

    // setTimeout fake async → flag
    if (/setTimeout\(/.test(text) && /\d{3,5}/.test(text)) {
      const flag = new vscode.CodeAction(
        "Guardrail: Flag fake async for replacement",
        vscode.CodeActionKind.QuickFix,
      );
      flag.edit = new vscode.WorkspaceEdit();
      const indent = text.match(/^(\s*)/)?.[1] ?? "";
      flag.edit.insert(
        document.uri,
        new vscode.Position(range.start.line, 0),
        `${indent}// GUARDRAIL: Replace this fake delay with real async logic\n`,
      );
      actions.push(flag);
    }

    // Exposed secret → move to .env
    if (/(?:api[_-]?key|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]/i.test(text)) {
      const moveToEnv = new vscode.CodeAction(
        "Guardrail: Move secret to .env file",
        vscode.CodeActionKind.QuickFix,
      );
      moveToEnv.command = {
        command: "guardrail.moveSecretToEnv",
        title: "Move to .env",
        arguments: [document.uri, range],
      };
      moveToEnv.isPreferred = true;
      actions.push(moveToEnv);
    }

    // Stripe/GitHub/AWS key → remove and add env reference
    if (/(?:sk[-_](?:live|test)|ghp_|AKIA)[A-Za-z0-9]{16,}/.test(text)) {
      const remove = new vscode.CodeAction(
        "Guardrail: Replace hardcoded key with env variable",
        vscode.CodeActionKind.QuickFix,
      );
      remove.edit = new vscode.WorkspaceEdit();
      const replaced = text.replace(
        /(['"`])(?:sk[-_](?:live|test)[-_][A-Za-z0-9]+|ghp_[A-Za-z0-9]+|AKIA[A-Z0-9]+)\1/g,
        "process.env.API_SECRET_KEY",
      );
      remove.edit.replace(document.uri, line.range, replaced);
      remove.isPreferred = true;
      actions.push(remove);
    }

    // Mock data variable → flag
    if (/(?:const|let|var)\s+(?:mock|fake|dummy|placeholder|hardcoded)\w*\s*=/i.test(text)) {
      const flag = new vscode.CodeAction(
        "Guardrail: Flag mock data for replacement",
        vscode.CodeActionKind.QuickFix,
      );
      flag.edit = new vscode.WorkspaceEdit();
      const indent = text.match(/^(\s*)/)?.[1] ?? "";
      flag.edit.insert(
        document.uri,
        new vscode.Position(range.start.line, 0),
        `${indent}// GUARDRAIL: Replace this mock/placeholder data with real implementation\n`,
      );
      actions.push(flag);
    }

    // Lorem ipsum → remove
    if (/lorem\s+ipsum/i.test(text)) {
      const fix = new vscode.CodeAction(
        "Guardrail: Replace lorem ipsum with TODO",
        vscode.CodeActionKind.QuickFix,
      );
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(
        document.uri,
        line.range,
        text.replace(/(['"`])lorem\s+ipsum[^'"`]*\1/gi, '"TODO: Add real content"'),
      );
      actions.push(fix);
    }

    // Placeholder email → replace
    if (/['"`](?:user@example\.com|test@test\.com|admin@admin\.com)['"`]/i.test(text)) {
      const fix = new vscode.CodeAction(
        "Guardrail: Replace placeholder email",
        vscode.CodeActionKind.QuickFix,
      );
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(
        document.uri,
        line.range,
        text.replace(
          /['"`](?:user@example\.com|test@test\.com|admin@admin\.com|john@doe\.com)['"`]/gi,
          "process.env.DEFAULT_EMAIL || ''",
        ),
      );
      actions.push(fix);
    }

    // TODO/FIXME → offer to create a GitHub issue (via command)
    if (/\/\/\s*(?:TODO|FIXME|HACK|XXX)\s*:?\s*(.+)/i.test(text)) {
      const scanAction = new vscode.CodeAction(
        "Guardrail: Scan workspace for all TODOs",
        vscode.CodeActionKind.QuickFix,
      );
      scanAction.command = {
        command: "guardrail.scanWorkspace",
        title: "Scan Workspace",
      };
      actions.push(scanAction);
    }

    // "Not implemented" throws → offer template
    if (/throw\s+(?:new\s+)?Error\(\s*['"`](?:Not implemented|TODO)/i.test(text)) {
      const fix = new vscode.CodeAction(
        "Guardrail: Mark as needs implementation",
        vscode.CodeActionKind.QuickFix,
      );
      fix.edit = new vscode.WorkspaceEdit();
      const indent = text.match(/^(\s*)/)?.[1] ?? "";
      fix.edit.replace(
        document.uri,
        line.range,
        `${indent}// GUARDRAIL: This function needs a real implementation\n${indent}throw new Error("Not implemented — see guardrail findings");`,
      );
      actions.push(fix);
    }

    // General: open Hub for any guardrail-related line
    if (actions.length > 0) {
      const hubAction = new vscode.CodeAction(
        "Guardrail: Open Hub for full analysis",
        vscode.CodeActionKind.QuickFix,
      );
      hubAction.command = {
        command: "guardrail.openHub",
        title: "Open Hub",
      };
      actions.push(hubAction);
    }

    return actions;
  }
}
