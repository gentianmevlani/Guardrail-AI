/**
 * Guardrail Quick-Fix Code Actions
 *
 * Provides ESLint-style lightbulb menu with auto-fix options
 * for each finding type. Appears when the user clicks a diagnostic.
 */

import * as vscode from "vscode";

const GUARDRAIL_SOURCE = "guardrail Reality Check";

export class GuardrailQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== GUARDRAIL_SOURCE) continue;

      const category = diagnostic.code as string;
      const fixes = this.getFixesForCategory(category, document, diagnostic);
      actions.push(...fixes);
    }

    return actions;
  }

  private getFixesForCategory(
    category: string,
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // ── Leaked secrets ──
    if (
      category === "hardcoded-secret" ||
      category === "api-key-leak" ||
      category === "exposed-credentials"
    ) {
      // Fix 1: Move to .env
      const moveToEnv = new vscode.CodeAction(
        "Move to .env file",
        vscode.CodeActionKind.QuickFix,
      );
      moveToEnv.diagnostics = [diagnostic];
      moveToEnv.command = {
        title: "Move secret to .env",
        command: "guardrail.moveSecretToEnv",
        arguments: [document.uri, diagnostic.range],
      };
      moveToEnv.isPreferred = true;
      actions.push(moveToEnv);

      // Fix 2: Replace with env var reference
      const replaceWithEnv = new vscode.CodeAction(
        "Replace with process.env reference",
        vscode.CodeActionKind.QuickFix,
      );
      replaceWithEnv.diagnostics = [diagnostic];
      replaceWithEnv.edit = this.createEnvVarReplacement(
        document,
        diagnostic.range,
      );
      actions.push(replaceWithEnv);
    }

    // ── Mock data in production ──
    if (
      category === "mock-data" ||
      category === "test-data-leak" ||
      category === "fake-domain"
    ) {
      const replaceWithEnv = new vscode.CodeAction(
        "Replace with environment variable",
        vscode.CodeActionKind.QuickFix,
      );
      replaceWithEnv.diagnostics = [diagnostic];
      replaceWithEnv.edit = this.createEnvVarReplacement(
        document,
        diagnostic.range,
      );
      replaceWithEnv.isPreferred = true;
      actions.push(replaceWithEnv);

      const addTodo = new vscode.CodeAction(
        "Add TODO to replace before deploy",
        vscode.CodeActionKind.QuickFix,
      );
      addTodo.diagnostics = [diagnostic];
      addTodo.edit = this.createTodoComment(
        document,
        diagnostic.range,
        "Replace mock data with real values before deploy",
      );
      actions.push(addTodo);
    }

    // ── Missing auth ──
    if (
      category === "missing-auth" ||
      category === "unprotected-endpoint" ||
      category === "auth-bypass"
    ) {
      const addAuthMiddleware = new vscode.CodeAction(
        "Add auth middleware",
        vscode.CodeActionKind.QuickFix,
      );
      addAuthMiddleware.diagnostics = [diagnostic];
      addAuthMiddleware.edit = this.createAuthMiddleware(
        document,
        diagnostic.range,
      );
      addAuthMiddleware.isPreferred = true;
      actions.push(addAuthMiddleware);
    }

    // ── Dead route / placeholder handler ──
    if (
      category === "dead-route" ||
      category === "placeholder-handler" ||
      category === "ghost-route"
    ) {
      const addTodo = new vscode.CodeAction(
        "Mark as TODO: implement handler",
        vscode.CodeActionKind.QuickFix,
      );
      addTodo.diagnostics = [diagnostic];
      addTodo.edit = this.createTodoComment(
        document,
        diagnostic.range,
        "TODO(guardrail): Implement this route handler — currently a placeholder",
      );
      actions.push(addTodo);

      const removeRoute = new vscode.CodeAction(
        "Remove dead route",
        vscode.CodeActionKind.QuickFix,
      );
      removeRoute.diagnostics = [diagnostic];
      removeRoute.edit = this.createLineDeletion(
        document,
        diagnostic.range,
      );
      actions.push(removeRoute);
    }

    // ── Contract drift ──
    if (
      category === "contract-drift" ||
      category === "api-mismatch"
    ) {
      const openDiff = new vscode.CodeAction(
        "Show API contract diff",
        vscode.CodeActionKind.QuickFix,
      );
      openDiff.diagnostics = [diagnostic];
      openDiff.command = {
        title: "Show contract diff",
        command: "guardrail.showContractDiff",
        arguments: [document.uri, diagnostic.range],
      };
      actions.push(openDiff);
    }

    // ── Universal: Explain this finding ──
    const explain = new vscode.CodeAction(
      "Explain this finding",
      vscode.CodeActionKind.QuickFix,
    );
    explain.diagnostics = [diagnostic];
    explain.command = {
      title: "Explain finding",
      command: "guardrail.explainFinding",
      arguments: [document.uri, diagnostic],
    };
    actions.push(explain);

    // ── Universal: Suppress this finding ──
    const suppress = new vscode.CodeAction(
      "Suppress: guardrail-ignore",
      vscode.CodeActionKind.QuickFix,
    );
    suppress.diagnostics = [diagnostic];
    suppress.edit = this.createSuppressionComment(
      document,
      diagnostic.range,
      category,
    );
    actions.push(suppress);

    return actions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT BUILDERS
  // ─────────────────────────────────────────────────────────────────────────

  private createEnvVarReplacement(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const text = document.getText(range);

    // Try to extract a variable name from context
    const line = document.lineAt(range.start.line).text;
    const varMatch = line.match(
      /(?:const|let|var)\s+(\w+)|(\w+)\s*[=:]/,
    );
    const envName = varMatch
      ? (varMatch[1] || varMatch[2]).replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()
      : "SECRET_VALUE";

    edit.replace(
      document.uri,
      range,
      `process.env.${envName}`,
    );
    return edit;
  }

  private createTodoComment(
    document: vscode.TextDocument,
    range: vscode.Range,
    message: string,
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(range.start.line);
    const indent = line.text.match(/^(\s*)/)?.[1] || "";
    edit.insert(
      document.uri,
      new vscode.Position(range.start.line, 0),
      `${indent}// ${message}\n`,
    );
    return edit;
  }

  private createAuthMiddleware(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(range.start.line);
    const indent = line.text.match(/^(\s*)/)?.[1] || "";

    // Detect Express/Fastify/NestJS pattern and insert auth middleware
    const lineText = line.text;
    if (lineText.includes(".get(") || lineText.includes(".post(") || lineText.includes(".put(") || lineText.includes(".delete(") || lineText.includes(".patch(")) {
      // Express-style: router.get('/path', handler) → router.get('/path', requireAuth, handler)
      const routeMatch = lineText.match(
        /(\.(?:get|post|put|delete|patch))\s*\(\s*(['"`][^'"`]+['"`])\s*,/,
      );
      if (routeMatch) {
        const insertPos = lineText.indexOf(routeMatch[0]) + routeMatch[0].length;
        edit.insert(
          document.uri,
          new vscode.Position(range.start.line, insertPos),
          " requireAuth,",
        );
        return edit;
      }
    }

    // Fallback: add a TODO comment
    edit.insert(
      document.uri,
      new vscode.Position(range.start.line, 0),
      `${indent}// TODO(guardrail): Add authentication middleware to this endpoint\n`,
    );
    return edit;
  }

  private createLineDeletion(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const fullLineRange = new vscode.Range(
      new vscode.Position(range.start.line, 0),
      new vscode.Position(range.end.line + 1, 0),
    );
    edit.delete(document.uri, fullLineRange);
    return edit;
  }

  private createSuppressionComment(
    document: vscode.TextDocument,
    range: vscode.Range,
    category: string,
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(range.start.line);
    const indent = line.text.match(/^(\s*)/)?.[1] || "";
    edit.insert(
      document.uri,
      new vscode.Position(range.start.line, 0),
      `${indent}// guardrail-ignore ${category}\n`,
    );
    return edit;
  }
}
