/**
 * Static Analysis Engine for Fake Feature Detection
 *
 * Uses AST parsing to detect:
 * - Unused exports/functions
 * - Empty function bodies / stub implementations
 * - Console.log-only functions
 * - Hardcoded return values
 * - TODO/FIXME without implementation
 * - Mock data that never gets replaced
 * - API calls to non-existent endpoints
 * - Dead code paths (unreachable)
 */

import * as fs from "fs";
import * as path from "path";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

// ============================================================================
// TYPES
// ============================================================================

export interface Finding {
  type: FindingType;
  severity: "critical" | "warning" | "info";
  category: "fake_feature" | "code_quality" | "security" | "best_practice";
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  title: string;
  message: string;
  codeSnippet?: string;
  suggestion?: string;
  confidence: number;
  ruleId: string;
  metadata?: Record<string, unknown>;
}

export type FindingType =
  | "fake_feature"
  | "unused_export"
  | "empty_function"
  | "console_only"
  | "hardcoded_return"
  | "todo_without_impl"
  | "mock_data"
  | "dead_endpoint"
  | "unreachable_code"
  | "stub_implementation"
  | "placeholder_string"
  | "fake_api_call";

export interface AnalysisResult {
  findings: Finding[];
  filesScanned: number;
  linesScanned: number;
  duration: number;
  errors: Array<{ file: string; error: string }>;
}

export interface AnalysisConfig {
  excludeDirs: string[];
  includeExtensions: string[];
  maxFileSize: number;
  enabledRules: string[];
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: AnalysisConfig = {
  excludeDirs: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    "__tests__",
    "__mocks__",
    "test",
    "tests",
    ".turbo",
    ".cache",
  ],
  includeExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
  maxFileSize: 500000, // 500KB
  enabledRules: [
    "empty-function",
    "console-only-function",
    "hardcoded-return",
    "todo-without-impl",
    "mock-data-patterns",
    "stub-implementation",
    "placeholder-strings",
    "fake-api-calls",
    "unused-exports",
    "unreachable-after-return",
  ],
};

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

const MOCK_DATA_PATTERNS = [
  /fake[-_]?data/i,
  /mock[-_]?data/i,
  /test[-_]?data/i,
  /dummy[-_]?data/i,
  /sample[-_]?data/i,
  /placeholder/i,
  /lorem\s*ipsum/i,
  /john\.?doe/i,
  /jane\.?doe/i,
  /example\.com/i,
  /test@test/i,
  /foo@bar/i,
  /123-?456-?7890/,
  /\$\d+\.\d{2}/, // Price patterns like $19.99
];

const FAKE_API_PATTERNS = [
  /jsonplaceholder\.typicode\.com/i,
  /reqres\.in/i,
  /httpbin\.org/i,
  /mockapi\.io/i,
  /mocky\.io/i,
  /localhost:\d+/,
  /127\.0\.0\.1:\d+/,
  /fake[-_]?api/i,
  /mock[-_]?api/i,
  /api\.example\.com/i,
];

const PLACEHOLDER_STRINGS = [
  "TODO",
  "FIXME",
  "HACK",
  "XXX",
  "TEMP",
  "TEMPORARY",
  "PLACEHOLDER",
  "NOT IMPLEMENTED",
  "NOT YET IMPLEMENTED",
  "IMPLEMENT ME",
  "COMING SOON",
  "UNDER CONSTRUCTION",
];

const STUB_PATTERNS = [
  /throw\s+new\s+Error\s*\(\s*['"`]Not\s+implemented/i,
  /throw\s+new\s+Error\s*\(\s*['"`]TODO/i,
  /console\.(log|warn|error)\s*\(\s*['"`]TODO/i,
  /\/\/\s*TODO.*implement/i,
  /pass\s*;?\s*\/\/\s*stub/i,
];

// ============================================================================
// STATIC ANALYZER CLASS
// ============================================================================

export class StaticAnalyzer {
  private config: AnalysisConfig;
  private findings: Finding[] = [];
  private exportedNames: Map<
    string,
    { file: string; line: number; used: boolean }
  > = new Map();
  private fileContents: Map<string, string> = new Map();

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze a project directory for fake features
   */
  async analyzeProject(projectPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.findings = [];
    this.exportedNames.clear();
    this.fileContents.clear();
    const errors: Array<{ file: string; error: string }> = [];
    let linesScanned = 0;

    // Find all source files
    const files = await this.findSourceFiles(projectPath);

    // First pass: collect all exports
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, "utf-8");
        this.fileContents.set(file, content);
        linesScanned += content.split("\n").length;
        this.collectExports(content, file);
      } catch (error) {
        errors.push({ file, error: String(error) });
      }
    }

    // Second pass: analyze each file
    for (const file of files) {
      try {
        const content = this.fileContents.get(file);
        if (content) {
          await this.analyzeFile(content, file, projectPath);
        }
      } catch (error) {
        errors.push({ file, error: String(error) });
      }
    }

    // Check for unused exports
    this.checkUnusedExports(projectPath);

    return {
      findings: this.findings,
      filesScanned: files.length,
      linesScanned,
      duration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Find all source files in the project
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (
              !this.config.excludeDirs.includes(entry.name) &&
              !entry.name.startsWith(".")
            ) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (this.config.includeExtensions.includes(ext)) {
              const stat = await fs.promises.stat(fullPath);
              if (stat.size <= this.config.maxFileSize) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    await walk(projectPath);
    return files;
  }

  /**
   * Parse file and collect exports
   */
  private collectExports(content: string, filePath: string): void {
    try {
      const ast = this.parseCode(content, filePath);
      if (!ast) return;

      traverse(ast, {
        ExportNamedDeclaration: (path) => {
          const node = path.node;
          if (node.declaration) {
            if (
              t.isFunctionDeclaration(node.declaration) &&
              node.declaration.id
            ) {
              this.exportedNames.set(node.declaration.id.name, {
                file: filePath,
                line: node.loc?.start.line || 0,
                used: false,
              });
            } else if (t.isVariableDeclaration(node.declaration)) {
              for (const decl of node.declaration.declarations) {
                if (t.isIdentifier(decl.id)) {
                  this.exportedNames.set(decl.id.name, {
                    file: filePath,
                    line: node.loc?.start.line || 0,
                    used: false,
                  });
                }
              }
            }
          }
        },
        ExportDefaultDeclaration: (path) => {
          const node = path.node;
          if (
            t.isFunctionDeclaration(node.declaration) &&
            node.declaration.id
          ) {
            this.exportedNames.set(node.declaration.id.name, {
              file: filePath,
              line: node.loc?.start.line || 0,
              used: false,
            });
          }
        },
      });
    } catch {
      // Skip files that can't be parsed
    }
  }

  /**
   * Parse TypeScript/JavaScript code
   */
  private parseCode(content: string, filePath: string): t.File | null {
    try {
      const isTS = filePath.endsWith(".ts") || filePath.endsWith(".tsx");
      const isJSX = filePath.endsWith(".tsx") || filePath.endsWith(".jsx");

      return parser.parse(content, {
        sourceType: "module",
        plugins: [
          isTS ? "typescript" : null,
          isJSX ? "jsx" : null,
          "decorators-legacy",
          "classProperties",
          "classPrivateProperties",
          "classPrivateMethods",
          "exportDefaultFrom",
          "dynamicImport",
          "nullishCoalescingOperator",
          "optionalChaining",
        ].filter(Boolean) as parser.ParserPlugin[],
        errorRecovery: true,
      });
    } catch {
      return null;
    }
  }

  /**
   * Analyze a single file for issues
   */
  private async analyzeFile(
    content: string,
    filePath: string,
    projectPath: string,
  ): Promise<void> {
    const ast = this.parseCode(content, filePath);
    if (!ast) return;

    const relativePath = path.relative(projectPath, filePath);
    const lines = content.split("\n");

    // Track imports for usage analysis
    const importedNames = new Set<string>();

    traverse(ast, {
      // Track imports
      ImportDeclaration: (path) => {
        for (const spec of path.node.specifiers) {
          if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
            importedNames.add(spec.imported.name);
            // Mark export as used
            const exportInfo = this.exportedNames.get(spec.imported.name);
            if (exportInfo) {
              exportInfo.used = true;
            }
          }
        }
      },

      // Check function declarations
      FunctionDeclaration: (nodePath) => {
        this.checkFunction(nodePath, relativePath, lines);
      },

      // Check arrow functions
      ArrowFunctionExpression: (nodePath) => {
        this.checkArrowFunction(nodePath, relativePath, lines);
      },

      // Check method definitions
      ClassMethod: (nodePath) => {
        this.checkClassMethod(nodePath, relativePath, lines);
      },

      // Check string literals for mock data
      StringLiteral: (nodePath) => {
        this.checkStringLiteral(nodePath, relativePath, content);
      },

      // Check template literals
      TemplateLiteral: (nodePath) => {
        this.checkTemplateLiteral(nodePath, relativePath, content);
      },

      // Check call expressions for fake APIs
      CallExpression: (nodePath) => {
        this.checkCallExpression(nodePath, relativePath, content);
      },

      // Check for unreachable code after return
      ReturnStatement: (nodePath) => {
        this.checkUnreachableAfterReturn(nodePath, relativePath, lines);
      },
    });

    // Check for TODO/FIXME comments
    this.checkTodoComments(content, relativePath);
  }

  /**
   * Check function for issues
   */
  private checkFunction(
    nodePath: NodePath<t.FunctionDeclaration>,
    file: string,
    lines: string[],
  ): void {
    const node = nodePath.node;
    if (!node.body || !node.loc) return;

    const funcName = node.id?.name || "anonymous";
    const startLine = node.loc.start.line;
    const bodyStatements = node.body.body;

    // Check for empty function
    if (bodyStatements.length === 0) {
      this.addFinding({
        type: "empty_function",
        severity: "warning",
        category: "fake_feature",
        file,
        line: startLine,
        column: node.loc.start.column,
        title: `Empty function: ${funcName}`,
        message: `Function "${funcName}" has an empty body. This may indicate unfinished implementation.`,
        codeSnippet: this.getCodeSnippet(lines, startLine, 3),
        suggestion: "Implement the function body or remove if not needed.",
        confidence: 0.9,
        ruleId: "empty-function",
      });
      return;
    }

    // Check for console-only function
    if (this.isConsoleOnlyFunction(bodyStatements)) {
      this.addFinding({
        type: "console_only",
        severity: "warning",
        category: "fake_feature",
        file,
        line: startLine,
        column: node.loc.start.column,
        title: `Console-only function: ${funcName}`,
        message: `Function "${funcName}" only contains console statements. This is likely a placeholder.`,
        codeSnippet: this.getCodeSnippet(lines, startLine, 5),
        suggestion: "Replace console statements with actual implementation.",
        confidence: 0.85,
        ruleId: "console-only-function",
      });
      return;
    }

    // Check for hardcoded return
    if (bodyStatements.length === 1 && t.isReturnStatement(bodyStatements[0])) {
      const returnArg = bodyStatements[0].argument;
      if (this.isHardcodedValue(returnArg)) {
        this.addFinding({
          type: "hardcoded_return",
          severity: "warning",
          category: "fake_feature",
          file,
          line: startLine,
          column: node.loc.start.column,
          title: `Hardcoded return: ${funcName}`,
          message: `Function "${funcName}" always returns a hardcoded value. This may be a stub implementation.`,
          codeSnippet: this.getCodeSnippet(lines, startLine, 3),
          suggestion: "Replace hardcoded value with actual logic.",
          confidence: 0.75,
          ruleId: "hardcoded-return",
        });
      }
    }

    // Check for stub patterns in function body
    const funcCode = this.getCodeSnippet(
      lines,
      startLine,
      node.loc.end.line - startLine + 1,
    );
    for (const pattern of STUB_PATTERNS) {
      if (pattern.test(funcCode)) {
        this.addFinding({
          type: "stub_implementation",
          severity: "critical",
          category: "fake_feature",
          file,
          line: startLine,
          column: node.loc.start.column,
          title: `Stub implementation: ${funcName}`,
          message: `Function "${funcName}" contains stub/placeholder code that will fail at runtime.`,
          codeSnippet: funcCode,
          suggestion: "Implement the actual functionality.",
          confidence: 0.95,
          ruleId: "stub-implementation",
        });
        break;
      }
    }
  }

  /**
   * Check arrow function for issues
   */
  private checkArrowFunction(
    nodePath: NodePath<t.ArrowFunctionExpression>,
    file: string,
    lines: string[],
  ): void {
    const node = nodePath.node;
    if (!node.loc) return;

    const startLine = node.loc.start.line;

    // Check if body is a block statement
    if (t.isBlockStatement(node.body)) {
      const bodyStatements = node.body.body;

      if (bodyStatements.length === 0) {
        // Get parent to find variable name
        const parent = nodePath.parent;
        let name = "arrow function";
        if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
          name = parent.id.name;
        }

        this.addFinding({
          type: "empty_function",
          severity: "warning",
          category: "fake_feature",
          file,
          line: startLine,
          column: node.loc.start.column,
          title: `Empty arrow function: ${name}`,
          message: `Arrow function "${name}" has an empty body.`,
          codeSnippet: this.getCodeSnippet(lines, startLine, 2),
          suggestion: "Implement the function body or remove if not needed.",
          confidence: 0.85,
          ruleId: "empty-function",
        });
      }
    }
  }

  /**
   * Check class method for issues
   */
  private checkClassMethod(
    nodePath: NodePath<t.ClassMethod>,
    file: string,
    lines: string[],
  ): void {
    const node = nodePath.node;
    if (!node.loc || !t.isIdentifier(node.key)) return;

    const methodName = node.key.name;
    const startLine = node.loc.start.line;
    const bodyStatements = node.body.body;

    if (bodyStatements.length === 0 && methodName !== "constructor") {
      this.addFinding({
        type: "empty_function",
        severity: "warning",
        category: "fake_feature",
        file,
        line: startLine,
        column: node.loc.start.column,
        title: `Empty method: ${methodName}`,
        message: `Method "${methodName}" has an empty body.`,
        codeSnippet: this.getCodeSnippet(lines, startLine, 3),
        suggestion: "Implement the method body or remove if not needed.",
        confidence: 0.9,
        ruleId: "empty-function",
      });
    }
  }

  /**
   * Check string literal for mock data patterns
   */
  private checkStringLiteral(
    nodePath: NodePath<t.StringLiteral>,
    file: string,
    content: string,
  ): void {
    const node = nodePath.node;
    if (!node.loc) return;

    const value = node.value;

    // Check for mock data patterns
    for (const pattern of MOCK_DATA_PATTERNS) {
      if (pattern.test(value)) {
        this.addFinding({
          type: "mock_data",
          severity: "info",
          category: "fake_feature",
          file,
          line: node.loc.start.line,
          column: node.loc.start.column,
          title: "Mock data detected",
          message: `String "${value.substring(0, 50)}..." appears to be mock/test data.`,
          codeSnippet: value.substring(0, 100),
          suggestion: "Replace with real data or use proper test fixtures.",
          confidence: 0.7,
          ruleId: "mock-data-patterns",
        });
        break;
      }
    }

    // Check for placeholder strings
    for (const placeholder of PLACEHOLDER_STRINGS) {
      if (value.toUpperCase().includes(placeholder)) {
        this.addFinding({
          type: "placeholder_string",
          severity: "warning",
          category: "fake_feature",
          file,
          line: node.loc.start.line,
          column: node.loc.start.column,
          title: `Placeholder string: ${placeholder}`,
          message: `String contains "${placeholder}" - likely incomplete implementation.`,
          codeSnippet: value.substring(0, 100),
          suggestion: "Complete the implementation and remove placeholder.",
          confidence: 0.85,
          ruleId: "placeholder-strings",
        });
        break;
      }
    }
  }

  /**
   * Check template literal for patterns
   */
  private checkTemplateLiteral(
    nodePath: NodePath<t.TemplateLiteral>,
    file: string,
    content: string,
  ): void {
    const node = nodePath.node;
    if (!node.loc) return;

    // Combine quasis to get full string
    const fullString = node.quasis.map((q) => q.value.raw).join("");

    for (const pattern of FAKE_API_PATTERNS) {
      if (pattern.test(fullString)) {
        this.addFinding({
          type: "fake_api_call",
          severity: "critical",
          category: "fake_feature",
          file,
          line: node.loc.start.line,
          column: node.loc.start.column,
          title: "Fake API endpoint detected",
          message: `Template literal contains fake/mock API URL: "${fullString.substring(0, 50)}..."`,
          codeSnippet: fullString.substring(0, 100),
          suggestion: "Replace with real API endpoint.",
          confidence: 0.9,
          ruleId: "fake-api-calls",
        });
        break;
      }
    }
  }

  /**
   * Check call expression for fake API calls
   */
  private checkCallExpression(
    nodePath: NodePath<t.CallExpression>,
    file: string,
    content: string,
  ): void {
    const node = nodePath.node;
    if (!node.loc) return;

    // Check for fetch/axios calls with fake URLs
    const callee = node.callee;
    const isFetch = t.isIdentifier(callee) && callee.name === "fetch";
    const isAxios =
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      callee.object.name === "axios";

    if ((isFetch || isAxios) && node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (t.isStringLiteral(firstArg)) {
        for (const pattern of FAKE_API_PATTERNS) {
          if (pattern.test(firstArg.value)) {
            this.addFinding({
              type: "fake_api_call",
              severity: "critical",
              category: "fake_feature",
              file,
              line: node.loc.start.line,
              column: node.loc.start.column,
              title: "Fake API call detected",
              message: `API call to fake/mock endpoint: "${firstArg.value}"`,
              codeSnippet: firstArg.value,
              suggestion:
                "Replace with real API endpoint or use environment variables.",
              confidence: 0.95,
              ruleId: "fake-api-calls",
            });
            break;
          }
        }
      }
    }
  }

  /**
   * Check for unreachable code after return
   */
  private checkUnreachableAfterReturn(
    nodePath: NodePath<t.ReturnStatement>,
    file: string,
    lines: string[],
  ): void {
    const parent = nodePath.parentPath;
    if (!parent || !t.isBlockStatement(parent.node)) return;

    const siblings = parent.node.body;
    const returnIndex = siblings.indexOf(nodePath.node);

    if (returnIndex < siblings.length - 1) {
      const nextStatement = siblings[returnIndex + 1];
      if (nextStatement.loc) {
        this.addFinding({
          type: "unreachable_code",
          severity: "warning",
          category: "code_quality",
          file,
          line: nextStatement.loc.start.line,
          column: nextStatement.loc.start.column,
          title: "Unreachable code",
          message: "Code after return statement will never execute.",
          codeSnippet: this.getCodeSnippet(
            lines,
            nextStatement.loc.start.line,
            2,
          ),
          suggestion: "Remove unreachable code or fix control flow.",
          confidence: 1.0,
          ruleId: "unreachable-after-return",
        });
      }
    }
  }

  /**
   * Check for TODO/FIXME comments
   */
  private checkTodoComments(content: string, file: string): void {
    const lines = content.split("\n");
    const todoPattern = /\/\/\s*(TODO|FIXME|HACK|XXX|TEMP)[\s:]+(.+)/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      while ((match = todoPattern.exec(line)) !== null) {
        const tag = match[1].toUpperCase();
        const comment = match[2].trim();

        // Check if this TODO has implementation nearby
        const hasImplementation = this.hasNearbyImplementation(lines, i);

        if (!hasImplementation) {
          this.addFinding({
            type: "todo_without_impl",
            severity: tag === "FIXME" ? "critical" : "warning",
            category: "fake_feature",
            file,
            line: i + 1,
            column: match.index,
            title: `${tag} without implementation`,
            message: `"${tag}: ${comment}" - no implementation found nearby.`,
            codeSnippet: this.getCodeSnippet(lines, i + 1, 3),
            suggestion: "Implement the TODO or remove if no longer needed.",
            confidence: 0.8,
            ruleId: "todo-without-impl",
          });
        }
      }
    }
  }

  /**
   * Check unused exports
   */
  private checkUnusedExports(projectPath: string): void {
    for (const [name, info] of this.exportedNames) {
      if (!info.used) {
        const relativePath = path.relative(projectPath, info.file);
        this.addFinding({
          type: "unused_export",
          severity: "info",
          category: "code_quality",
          file: relativePath,
          line: info.line,
          column: 0,
          title: `Unused export: ${name}`,
          message: `Export "${name}" is not imported by any other file in the project.`,
          suggestion:
            "Remove unused export or ensure it is imported where needed.",
          confidence: 0.7,
          ruleId: "unused-exports",
        });
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private isConsoleOnlyFunction(statements: t.Statement[]): boolean {
    return statements.every((stmt) => {
      if (t.isExpressionStatement(stmt)) {
        const expr = stmt.expression;
        if (t.isCallExpression(expr) && t.isMemberExpression(expr.callee)) {
          const obj = expr.callee.object;
          return t.isIdentifier(obj) && obj.name === "console";
        }
      }
      return false;
    });
  }

  private isHardcodedValue(node: t.Expression | null | undefined): boolean {
    if (!node) return false;
    return (
      t.isStringLiteral(node) ||
      t.isNumericLiteral(node) ||
      t.isBooleanLiteral(node) ||
      t.isNullLiteral(node) ||
      (t.isArrayExpression(node) && node.elements.length < 5) ||
      (t.isObjectExpression(node) && node.properties.length < 5)
    );
  }

  private hasNearbyImplementation(lines: string[], todoLine: number): boolean {
    // Check 10 lines after the TODO for actual code
    const checkRange = Math.min(todoLine + 10, lines.length);
    for (let i = todoLine + 1; i < checkRange; i++) {
      const line = lines[i].trim();
      // Skip empty lines and comments
      if (line && !line.startsWith("//") && !line.startsWith("*")) {
        // Check for actual code statements
        if (
          line.includes("=") ||
          line.includes("return") ||
          line.includes("(") ||
          line.includes("{")
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private getCodeSnippet(
    lines: string[],
    startLine: number,
    count: number,
  ): string {
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, start + count);
    return lines.slice(start, end).join("\n");
  }

  private addFinding(finding: Finding): void {
    // Deduplicate by file + line + type
    const key = `${finding.file}:${finding.line}:${finding.type}`;
    const existing = this.findings.find(
      (f) => `${f.file}:${f.line}:${f.type}` === key,
    );
    if (!existing) {
      this.findings.push(finding);
    }
  }
}

// Export singleton instance
export const staticAnalyzer = new StaticAnalyzer();
