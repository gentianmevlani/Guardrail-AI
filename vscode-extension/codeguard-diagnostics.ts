/**
 * CodeGuard Diagnostics Provider with Quick Fixes
 * 
 * Detects fake features, mock data, and AI hallucinations
 * with one-click fixes via CodeActionProvider.
 */

import * as vscode from 'vscode';

// Diagnostic codes with documentation links
export const CODEGUARD_RULES = {
  CG001: { 
    title: 'Hardcoded Mock Data',
    severity: vscode.DiagnosticSeverity.Error,
    docs: 'https://docs.codeguard.dev/rules/CG001'
  },
  CG002: { 
    title: 'Fake Feature - No Implementation',
    severity: vscode.DiagnosticSeverity.Error,
    docs: 'https://docs.codeguard.dev/rules/CG002'
  },
  CG003: { 
    title: 'TODO in Production Path',
    severity: vscode.DiagnosticSeverity.Warning,
    docs: 'https://docs.codeguard.dev/rules/CG003'
  },
  CG004: { 
    title: 'Silent Error Swallowing',
    severity: vscode.DiagnosticSeverity.Error,
    docs: 'https://docs.codeguard.dev/rules/CG004'
  },
  CG005: { 
    title: 'Hallucinated Import',
    severity: vscode.DiagnosticSeverity.Error,
    docs: 'https://docs.codeguard.dev/rules/CG005'
  },
  CG006: { 
    title: 'Validation Function Returns Non-Boolean',
    severity: vscode.DiagnosticSeverity.Warning,
    docs: 'https://docs.codeguard.dev/rules/CG006'
  },
  CG007: { 
    title: 'Async Without Await',
    severity: vscode.DiagnosticSeverity.Warning,
    docs: 'https://docs.codeguard.dev/rules/CG007'
  },
  CG008: { 
    title: 'Unprotected JSON.parse',
    severity: vscode.DiagnosticSeverity.Warning,
    docs: 'https://docs.codeguard.dev/rules/CG008'
  },
  CG009: { 
    title: 'Hardcoded Secret',
    severity: vscode.DiagnosticSeverity.Error,
    docs: 'https://docs.codeguard.dev/rules/CG009'
  },
  CG010: { 
    title: 'Console Statement in Production',
    severity: vscode.DiagnosticSeverity.Information,
    docs: 'https://docs.codeguard.dev/rules/CG010'
  },
} as const;

type RuleCode = keyof typeof CODEGUARD_RULES;

interface CodeGuardDiagnostic extends vscode.Diagnostic {
  ruleCode: RuleCode;
  fixData?: {
    type: 'replace' | 'delete' | 'insert' | 'wrap';
    replacement?: string;
    insertPosition?: 'before' | 'after';
    wrapWith?: { before: string; after: string };
  };
}

export class CodeGuardDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codeguard');
    this.disposables.push(this.diagnosticCollection);
  }

  /**
   * Analyze a document and return diagnostics
   */
  async analyze(document: vscode.TextDocument): Promise<CodeGuardDiagnostic[]> {
    const text = document.getText();
    const diagnostics: CodeGuardDiagnostic[] = [];

    // Run all detection rules
    diagnostics.push(...this.detectMockData(document, text));
    diagnostics.push(...this.detectFakeFeatures(document, text));
    diagnostics.push(...this.detectSilentCatches(document, text));
    diagnostics.push(...this.detectTodos(document, text));
    diagnostics.push(...this.detectHallucinatedImports(document, text));
    diagnostics.push(...this.detectValidationIssues(document, text));
    diagnostics.push(...this.detectAsyncWithoutAwait(document, text));
    diagnostics.push(...this.detectUnprotectedJsonParse(document, text));
    diagnostics.push(...this.detectHardcodedSecrets(document, text));
    diagnostics.push(...this.detectConsoleStatements(document, text));

    this.diagnosticCollection.set(document.uri, diagnostics);
    return diagnostics;
  }

  private createDiagnostic(
    document: vscode.TextDocument,
    range: vscode.Range,
    message: string,
    ruleCode: RuleCode,
    fixData?: CodeGuardDiagnostic['fixData']
  ): CodeGuardDiagnostic {
    const rule = CODEGUARD_RULES[ruleCode];
    
    const diagnostic = new vscode.Diagnostic(
      range,
      message,
      rule.severity
    ) as CodeGuardDiagnostic;

    diagnostic.code = {
      value: ruleCode,
      target: vscode.Uri.parse(rule.docs),
    };
    diagnostic.source = 'CodeGuard';
    diagnostic.ruleCode = ruleCode;
    diagnostic.fixData = fixData;

    // Add tags for special rendering
    if (ruleCode === 'CG003' || ruleCode === 'CG010') {
      diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    }

    return diagnostic;
  }

  private detectMockData(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    // Detect hardcoded arrays with fake data patterns
    const mockPatterns = [
      // Hardcoded user arrays
      /const\s+\w*(?:users?|data|items|list)\w*\s*=\s*\[[\s\S]*?(?:John|Jane|test|mock|fake|example|dummy)/gi,
      // Return statements with hardcoded arrays
      /return\s*\[[\s\S]*?(?:id:\s*['"]\d+['"]|name:\s*['"][A-Z][a-z]+['"])/gi,
      // Mock email patterns
      /['"](?:test|mock|fake|example)@(?:test|example|mock)\.(?:com|org)['"]/gi,
      // Lorem ipsum
      /lorem\s+ipsum/gi,
      // Placeholder prices
      /price:\s*(?:9\.99|19\.99|99\.99|100)/g,
    ];

    for (const pattern of mockPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        diagnostics.push(this.createDiagnostic(
          document,
          range,
          `Hardcoded mock data detected. This looks like placeholder data that shouldn't ship to production.`,
          'CG001',
          {
            type: 'replace',
            replacement: '// TODO: Replace with real data source\n  []',
          }
        ));
      }
    }

    return diagnostics;
  }

  private detectFakeFeatures(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];

    // Functions that look like they do something but don't
    const fakePatterns = [
      // Empty async functions
      /async\s+(?:function\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*Promise<[^>]+>)?\s*\{\s*\}/g,
      // Functions returning hardcoded success
      /(?:function\s+)?(\w+)\s*\([^)]*\)\s*\{[\s\n]*return\s+(?:true|'success'|"success"|\{ success: true \})\s*;?\s*\}/g,
      // Event handlers that do nothing
      /on(?:Click|Submit|Change|Press)\s*=\s*\{?\s*\(\)\s*=>\s*\{\s*\}\s*\}?/g,
    ];

    for (const pattern of fakePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        const fnName = match[1] || 'handler';

        diagnostics.push(this.createDiagnostic(
          document,
          range,
          `"${fnName}" appears to be a fake feature - it has no real implementation.`,
          'CG002',
          {
            type: 'insert',
            insertPosition: 'after',
            replacement: `\n  // TODO: Implement ${fnName}\n  throw new Error('Not implemented');`,
          }
        ));
      }
    }

    return diagnostics;
  }

  private detectSilentCatches(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    // Empty catch blocks or catches that only log
    const pattern = /catch\s*\(\s*(\w*)\s*\)\s*\{\s*(?:\/\/[^\n]*\n\s*)?\}/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      const errorVar = match[1] || 'error';

      diagnostics.push(this.createDiagnostic(
        document,
        range,
        `Silent catch block swallows errors. Errors should be logged, rethrown, or handled meaningfully.`,
        'CG004',
        {
          type: 'replace',
          replacement: `catch (${errorVar}) {\n    console.error('Error:', ${errorVar});\n    throw ${errorVar};\n  }`,
        }
      ));
    }

    return diagnostics;
  }

  private detectTodos(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    const pattern = /\/\/\s*(TODO|FIXME|XXX|HACK|BUG):\s*(.+)/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);
      const todoType = match[1].toUpperCase();
      const todoText = match[2];

      diagnostics.push(this.createDiagnostic(
        document,
        range,
        `${todoType} found: "${todoText.substring(0, 50)}${todoText.length > 50 ? '...' : ''}"`,
        'CG003',
        {
          type: 'delete',
        }
      ));
    }

    return diagnostics;
  }

  private detectHallucinatedImports(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    // Suspicious import patterns that AI often hallucinates
    const suspiciousPackages = [
      // Overly specific scoped packages
      /@[a-z]+\/[a-z]+-[a-z]+-[a-z]+-[a-z]+/,
      // Version suffixes in package names
      /[a-z]+-v\d+$/,
      // Made-up React hooks packages
      /react-use-[a-z]+-[a-z]+-[a-z]+/,
      // Non-existent Next.js packages
      /next-[a-z]+-[a-z]+-[a-z]+/,
    ];

    const importPattern = /import\s+.*\s+from\s+['"]([^'"./][^'"]*)['"]/g;
    
    let match;
    while ((match = importPattern.exec(text)) !== null) {
      const pkg = match[1];
      
      for (const suspicious of suspiciousPackages) {
        if (suspicious.test(pkg)) {
          const startPos = document.positionAt(match.index);
          const endPos = document.positionAt(match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);

          diagnostics.push(this.createDiagnostic(
            document,
            range,
            `Import "${pkg}" may be hallucinated by AI. Verify this package exists on npm.`,
            'CG005',
            {
              type: 'delete',
            }
          ));
          break;
        }
      }
    }

    return diagnostics;
  }

  private detectValidationIssues(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    // Functions named validate/check/verify that don't return boolean
    const pattern = /(?:async\s+)?function\s+(validate|check|verify|is|has|can)\w*\s*\([^)]*\)\s*(?::\s*(\w+))?\s*\{/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fnName = match[0].match(/function\s+(\w+)/)?.[1] || 'validate';
      const returnType = match[2];
      
      // If there's an explicit non-boolean return type, flag it
      if (returnType && !['boolean', 'Promise<boolean>', 'Bool'].includes(returnType)) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        diagnostics.push(this.createDiagnostic(
          document,
          range,
          `Function "${fnName}" implies validation but returns "${returnType}" instead of boolean.`,
          'CG006'
        ));
      }
    }

    return diagnostics;
  }

  private detectAsyncWithoutAwait(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    // Match async functions and check if they contain await
    const pattern = /async\s+(?:function\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fnName = match[1];
      const fnBody = match[2];
      
      if (!/await\s+/.test(fnBody) && fnBody.trim().length > 0) {
        const startPos = document.positionAt(match.index);
        const line = document.lineAt(startPos.line);
        const range = new vscode.Range(startPos, new vscode.Position(startPos.line, line.text.length));

        diagnostics.push(this.createDiagnostic(
          document,
          range,
          `Async function "${fnName}" never uses await. Consider removing async keyword.`,
          'CG007',
          {
            type: 'replace',
            replacement: match[0].replace(/async\s+/, ''),
          }
        ));
      }
    }

    return diagnostics;
  }

  private detectUnprotectedJsonParse(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    const pattern = /JSON\.parse\s*\([^)]+\)/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Check if it's inside a try block
      const before = text.substring(Math.max(0, match.index - 500), match.index);
      const isInTry = /try\s*\{[^}]*$/.test(before);
      
      if (!isInTry) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        const parseCall = match[0];

        diagnostics.push(this.createDiagnostic(
          document,
          range,
          `JSON.parse without try-catch. Invalid JSON will crash at runtime.`,
          'CG008',
          {
            type: 'wrap',
            wrapWith: {
              before: 'try {\n    const result = ',
              after: ';\n  } catch (e) {\n    console.error("Invalid JSON:", e);\n    return null;\n  }',
            },
          }
        ));
      }
    }

    return diagnostics;
  }

  private detectHardcodedSecrets(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    const patterns = [
      // API keys
      /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi,
      // AWS keys
      /(?:aws[_-]?(?:access[_-]?key|secret))\s*[:=]\s*['"][A-Za-z0-9/+=]{20,}['"]/gi,
      // Generic secrets
      /(?:password|secret|token|credential)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      // Private keys
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        diagnostics.push(this.createDiagnostic(
          document,
          range,
          `Hardcoded secret detected. Move to environment variable or secrets manager.`,
          'CG009',
          {
            type: 'replace',
            replacement: `process.env.SECRET_KEY // TODO: Add to .env`,
          }
        ));
      }
    }

    return diagnostics;
  }

  private detectConsoleStatements(document: vscode.TextDocument, text: string): CodeGuardDiagnostic[] {
    const diagnostics: CodeGuardDiagnostic[] = [];
    
    // Skip if file looks like a test file
    if (/\.(?:test|spec)\.[jt]sx?$/.test(document.fileName)) {
      return diagnostics;
    }

    const pattern = /console\.(log|debug|info|warn|error)\s*\([^)]*\)\s*;?/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const method = match[1];
      
      // Allow console.error and console.warn in production
      if (method === 'error' || method === 'warn') {
        continue;
      }

      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      diagnostics.push(this.createDiagnostic(
        document,
        range,
        `console.${method} statement. Remove before production or use a proper logger.`,
        'CG010',
        {
          type: 'delete',
        }
      ));
    }

    return diagnostics;
  }

  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/**
 * CodeGuard Quick Fix Provider
 */
export class CodeGuardQuickFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'CodeGuard') continue;

      const codeguardDiag = diagnostic as CodeGuardDiagnostic;
      
      // Create fix based on fixData
      if (codeguardDiag.fixData) {
        const fix = this.createFix(document, codeguardDiag);
        if (fix) {
          actions.push(fix);
        }
      }

      // Always add "Ignore this rule" option
      const ignoreAction = this.createIgnoreAction(document, codeguardDiag);
      actions.push(ignoreAction);

      // Add "Learn more" action
      const learnMore = this.createLearnMoreAction(codeguardDiag);
      actions.push(learnMore);
    }

    return actions;
  }

  private createFix(
    document: vscode.TextDocument,
    diagnostic: CodeGuardDiagnostic
  ): vscode.CodeAction | null {
    const fixData = diagnostic.fixData!;
    const rule = CODEGUARD_RULES[diagnostic.ruleCode];
    
    const action = new vscode.CodeAction(
      `Fix: ${rule.title}`,
      vscode.CodeActionKind.QuickFix
    );
    
    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();

    switch (fixData.type) {
      case 'replace':
        edit.replace(document.uri, diagnostic.range, fixData.replacement || '');
        break;
      
      case 'delete':
        // Delete the line if it's the only content
        const line = document.lineAt(diagnostic.range.start.line);
        if (line.text.trim() === document.getText(diagnostic.range).trim()) {
          edit.delete(document.uri, line.rangeIncludingLineBreak);
        } else {
          edit.delete(document.uri, diagnostic.range);
        }
        break;
      
      case 'insert':
        const insertPos = fixData.insertPosition === 'before' 
          ? diagnostic.range.start 
          : diagnostic.range.end;
        edit.insert(document.uri, insertPos, fixData.replacement || '');
        break;
      
      case 'wrap':
        if (fixData.wrapWith) {
          const originalText = document.getText(diagnostic.range);
          const wrapped = fixData.wrapWith.before + originalText + fixData.wrapWith.after;
          edit.replace(document.uri, diagnostic.range, wrapped);
        }
        break;
    }

    action.edit = edit;
    return action;
  }

  private createIgnoreAction(
    document: vscode.TextDocument,
    diagnostic: CodeGuardDiagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Ignore ${diagnostic.ruleCode} on this line`,
      vscode.CodeActionKind.QuickFix
    );
    
    action.diagnostics = [diagnostic];

    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(diagnostic.range.start.line);
    const insertPos = new vscode.Position(diagnostic.range.start.line, line.firstNonWhitespaceCharacterIndex);
    
    edit.insert(document.uri, insertPos, `// codeguard-disable-next-line ${diagnostic.ruleCode}\n${' '.repeat(line.firstNonWhitespaceCharacterIndex)}`);
    
    action.edit = edit;
    return action;
  }

  private createLearnMoreAction(diagnostic: CodeGuardDiagnostic): vscode.CodeAction {
    const rule = CODEGUARD_RULES[diagnostic.ruleCode];
    
    const action = new vscode.CodeAction(
      `Learn more about ${diagnostic.ruleCode}`,
      vscode.CodeActionKind.Empty
    );
    
    action.command = {
      command: 'vscode.open',
      title: 'Open Documentation',
      arguments: [vscode.Uri.parse(rule.docs)],
    };

    return action;
  }
}
