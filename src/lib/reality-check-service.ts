/**
 * Reality Check Service - "Explain My Code Like I'm Lying to Myself"
 *
 * Detects mismatches between developer intent and actual code behavior.
 * This is NOT linting or best practices - it's a self-deception detector.
 *
 * Key insight: Every tool today assumes code is wrong. This tool targets
 * the gap between what developers BELIEVE their code does vs what it ACTUALLY does.
 */

export interface RealityCheckResult {
  file: string;
  timestamp: string;
  overallScore: number; // 0-100, lower = more self-deception detected
  findings: RealityFinding[];
  summary: {
    critical: number;
    warnings: number;
    suggestions: number;
  };
}

export interface RealityFinding {
  type: "critical" | "warning" | "suggestion";
  category: RealityCategory;
  line?: number;
  endLine?: number;
  code: string;
  intent: string; // What the developer THINKS it does
  reality: string; // What it ACTUALLY does
  explanation: string; // Why this matters
  confidence: number; // 0-1, how confident we are in this finding
}

export type RealityCategory =
  | "naming-mismatch" // Name implies X but does Y
  | "error-handling-illusion" // Looks safe but isn't
  | "scope-assumption" // Assumes runs once but runs multiple times
  | "stale-comment" // Comment no longer matches code
  | "silent-failure" // Error gets swallowed
  | "type-coercion-trap" // Implicit conversions cause bugs
  | "async-timing-illusion" // Assumes sync but is async (or vice versa)
  | "boundary-blindness" // Doesn't handle edge cases
  | "mutation-surprise" // Modifies something unexpectedly
  | "return-path-gap" // Missing return paths
  | "condition-inversion" // Logic is opposite of what name suggests
  | "dependency-assumption"; // Assumes something about external data;

interface ParsedFunction {
  name: string;
  params: string[];
  returnType?: string;
  body: string;
  startLine: number;
  endLine: number;
  isAsync: boolean;
  comments: string[];
  jsdoc?: {
    description?: string;
    params: { name: string; description: string }[];
    returns?: string;
    throws?: string[];
  };
}

interface ParsedClass {
  name: string;
  methods: ParsedFunction[];
  properties: { name: string; type?: string }[];
  startLine: number;
  endLine: number;
}

interface IntentSignals {
  nameImplies: string[];
  commentsImply: string[];
  structureImplies: string[];
  jsdocImplies: string[];
}

interface BehaviorAnalysis {
  actualReturns: string[];
  actualThrows: boolean;
  hasErrorHandling: boolean;
  hasSideEffects: boolean;
  modifiesParams: boolean;
  isActuallyAsync: boolean;
  controlFlowPaths: number;
  earlyReturns: boolean;
  callsExternal: string[];
  mutatesState: boolean;
}

// Intent keywords that imply specific behaviors
const INTENT_KEYWORDS = {
  validation: [
    "validate",
    "check",
    "verify",
    "ensure",
    "assert",
    "is",
    "has",
    "can",
  ],
  retrieval: [
    "get",
    "fetch",
    "load",
    "find",
    "search",
    "query",
    "read",
    "retrieve",
  ],
  mutation: [
    "set",
    "update",
    "save",
    "store",
    "write",
    "create",
    "delete",
    "remove",
    "add",
    "insert",
  ],
  transformation: [
    "transform",
    "convert",
    "parse",
    "format",
    "map",
    "filter",
    "reduce",
    "process",
  ],
  guard: ["guard", "protect", "secure", "sanitize", "escape", "clean"],
  calculation: ["calculate", "compute", "count", "sum", "average", "total"],
  initialization: ["init", "initialize", "setup", "configure", "bootstrap"],
  cleanup: ["cleanup", "dispose", "destroy", "close", "teardown", "reset"],
  notification: [
    "notify",
    "emit",
    "dispatch",
    "publish",
    "broadcast",
    "trigger",
  ],
  authorization: [
    "authorize",
    "authenticate",
    "login",
    "logout",
    "permit",
    "allow",
    "deny",
  ],
};

// Behaviors that should be present for certain intents
const EXPECTED_BEHAVIORS: Record<string, Partial<BehaviorAnalysis>> = {
  validation: { actualReturns: ["boolean"], hasErrorHandling: false },
  guard: { actualThrows: true },
  retrieval: { hasSideEffects: false },
  mutation: { hasSideEffects: true },
  cleanup: { hasSideEffects: true },
};

class RealityCheckService {
  /**
   * Run a reality check on code
   */
  async check(
    code: string,
    file: string = "unknown",
  ): Promise<RealityCheckResult> {
    const findings: RealityFinding[] = [];

    // Parse the code
    const functions = this.parseFunctions(code);
    const classes = this.parseClasses(code);

    // Check each function
    for (const fn of functions) {
      const fnFindings = this.checkFunction(fn, code);
      findings.push(...fnFindings);
    }

    // Check each class
    for (const cls of classes) {
      const clsFindings = this.checkClass(cls, code);
      findings.push(...clsFindings);
    }

    // Check for stale comments
    const commentFindings = this.checkStaleComments(code);
    findings.push(...commentFindings);

    // Check for global assumptions
    const assumptionFindings = this.checkAssumptions(code);
    findings.push(...assumptionFindings);

    // Calculate score
    const score = this.calculateScore(findings);

    return {
      file,
      timestamp: new Date().toISOString(),
      overallScore: score,
      findings: findings.sort((a, b) => {
        const priority = { critical: 0, warning: 1, suggestion: 2 };
        return priority[a.type] - priority[b.type];
      }),
      summary: {
        critical: findings.filter((f) => f.type === "critical").length,
        warnings: findings.filter((f) => f.type === "warning").length,
        suggestions: findings.filter((f) => f.type === "suggestion").length,
      },
    };
  }

  /**
   * Check a single function for reality mismatches
   */
  private checkFunction(
    fn: ParsedFunction,
    fullCode: string,
  ): RealityFinding[] {
    const findings: RealityFinding[] = [];

    // Infer intent from name, comments, JSDoc
    const intent = this.inferIntent(fn);

    // Analyze actual behavior
    const behavior = this.analyzeBehavior(fn);

    // Check: Name implies validation but doesn't return boolean
    if (this.nameImpliesValidation(fn.name)) {
      if (!this.returnsBoolean(fn.body) && !this.throwsOnInvalid(fn.body)) {
        findings.push({
          type: "critical",
          category: "naming-mismatch",
          line: fn.startLine,
          endLine: fn.endLine,
          code: `function ${fn.name}`,
          intent: `Function named "${fn.name}" implies it validates something and returns true/false`,
          reality: `This function does not return a boolean or throw on invalid input - it ${this.describeActualBehavior(fn)}`,
          explanation:
            "Callers will assume this returns true/false for validation. Silent non-validation causes bugs.",
          confidence: 0.85,
        });
      }
    }

    // Check: Name implies it "gets" something but has side effects
    if (this.nameImpliesRetrieval(fn.name)) {
      if (behavior.hasSideEffects) {
        findings.push({
          type: "warning",
          category: "naming-mismatch",
          line: fn.startLine,
          code: `function ${fn.name}`,
          intent: `Function named "${fn.name}" implies a pure read operation`,
          reality:
            "This function modifies state, writes data, or has other side effects",
          explanation:
            "Getters should be idempotent. Side effects in getters cause hard-to-track bugs.",
          confidence: 0.8,
        });
      }
    }

    // Check: Has try-catch but silently swallows errors
    if (this.hasSilentCatch(fn.body)) {
      findings.push({
        type: "critical",
        category: "silent-failure",
        line: fn.startLine,
        code: this.extractCatchBlock(fn.body),
        intent: "Error handling suggests failures are being managed",
        reality:
          "Errors are caught but silently ignored - failures will go unnoticed",
        explanation:
          "Silent catches hide bugs. Log, rethrow, or handle meaningfully.",
        confidence: 0.95,
      });
    }

    // Check: Async function but no await
    if (fn.isAsync && !this.hasAwait(fn.body)) {
      findings.push({
        type: "warning",
        category: "async-timing-illusion",
        line: fn.startLine,
        code: `async function ${fn.name}`,
        intent: "Marked async implies asynchronous operations inside",
        reality:
          "This async function never awaits anything - the async keyword is unnecessary",
        explanation:
          "Unnecessary async adds overhead and confuses readers about timing.",
        confidence: 0.9,
      });
    }

    // Check: Name implies authorization but doesn't check roles/permissions
    if (this.nameImpliesAuthorization(fn.name)) {
      if (!this.checksPermissions(fn.body)) {
        findings.push({
          type: "critical",
          category: "naming-mismatch",
          line: fn.startLine,
          code: `function ${fn.name}`,
          intent: `Function named "${fn.name}" implies it checks authorization/permissions`,
          reality:
            "No role, permission, or access level checks found in the implementation",
          explanation:
            "Security-named functions that don't actually secure are dangerous.",
          confidence: 0.85,
        });
      }
    }

    // Check: Error handler that returns undefined instead of throwing
    if (this.hasErrorHandlerReturningUndefined(fn.body)) {
      findings.push({
        type: "warning",
        category: "error-handling-illusion",
        line: fn.startLine,
        code: this.extractCatchBlock(fn.body),
        intent: "Error handling suggests graceful degradation",
        reality:
          "Returns undefined on error - callers expecting data will fail silently",
        explanation:
          "Return a default value, throw, or use Result type. Undefined propagates bugs.",
        confidence: 0.85,
      });
    }

    // Check: Uses == instead of === with potential type coercion issues
    const coercionIssues = this.findTypeCoercionTraps(fn.body);
    for (const issue of coercionIssues) {
      findings.push({
        type: "warning",
        category: "type-coercion-trap",
        line: fn.startLine,
        code: issue.code,
        intent: `Comparison "${issue.code}" looks like an equality check`,
        reality: `Using == allows type coercion: ${issue.example}`,
        explanation:
          "Use === for predictable comparisons. == has surprising behaviors.",
        confidence: 0.9,
      });
    }

    // Check: Function name suggests it handles arrays but no array check
    if (this.nameImpliesArrayOperation(fn.name)) {
      if (!this.checksArrayInput(fn.body)) {
        findings.push({
          type: "suggestion",
          category: "boundary-blindness",
          line: fn.startLine,
          code: `function ${fn.name}`,
          intent: `Name "${fn.name}" suggests it operates on arrays/collections`,
          reality: "No check for empty arrays, null, or non-array inputs",
          explanation:
            "Array operations should handle empty and invalid inputs explicitly.",
          confidence: 0.75,
        });
      }
    }

    // Check: JSDoc promises don't match actual throws
    if (fn.jsdoc?.throws && fn.jsdoc.throws.length > 0) {
      if (!this.throwsExceptions(fn.body)) {
        findings.push({
          type: "warning",
          category: "stale-comment",
          line: fn.startLine,
          code: `@throws ${fn.jsdoc.throws.join(", ")}`,
          intent: `JSDoc says this throws: ${fn.jsdoc.throws.join(", ")}`,
          reality: "Function body has no throw statements",
          explanation:
            "Documented exceptions that never throw mislead error handling.",
          confidence: 0.9,
        });
      }
    }

    // Check: Multiple return paths with inconsistent types
    const returnPaths = this.analyzeReturnPaths(fn.body);
    if (returnPaths.hasInconsistentTypes) {
      findings.push({
        type: "warning",
        category: "return-path-gap",
        line: fn.startLine,
        code: `function ${fn.name}`,
        intent: "Function should return consistent types",
        reality: `Returns different types: ${returnPaths.types.join(", ")}`,
        explanation:
          'Inconsistent return types cause "undefined is not a function" errors.',
        confidence: 0.8,
      });
    }

    return findings;
  }

  /**
   * Check a class for reality mismatches
   */
  private checkClass(cls: ParsedClass, fullCode: string): RealityFinding[] {
    const findings: RealityFinding[] = [];

    // Check each method
    for (const method of cls.methods) {
      const methodFindings = this.checkFunction(method, fullCode);
      findings.push(...methodFindings);
    }

    // Check: Class name implies singleton but can be instantiated multiple times
    if (this.nameImpliesSingleton(cls.name)) {
      if (!this.isSingleton(cls)) {
        findings.push({
          type: "suggestion",
          category: "naming-mismatch",
          line: cls.startLine,
          code: `class ${cls.name}`,
          intent: `Class named "${cls.name}" implies singleton pattern`,
          reality:
            "No singleton enforcement - multiple instances can be created",
          explanation: "Either enforce singleton or rename to avoid confusion.",
          confidence: 0.7,
        });
      }
    }

    return findings;
  }

  /**
   * Check for stale comments that no longer match the code
   */
  private checkStaleComments(code: string): RealityFinding[] {
    const findings: RealityFinding[] = [];
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1] || "";

      // Check: TODO comments that are old
      const todoMatch = line.match(/\/\/\s*TODO:?\s*(.+)/i);
      if (todoMatch) {
        // If the TODO is followed by implemented code, it might be stale
        if (this.looksImplemented(nextLine, todoMatch[1])) {
          findings.push({
            type: "suggestion",
            category: "stale-comment",
            line: i + 1,
            code: line.trim(),
            intent: "TODO indicates work needed",
            reality:
              "The code below appears to implement what the TODO describes",
            explanation:
              "Remove completed TODOs to reduce noise and confusion.",
            confidence: 0.6,
          });
        }
      }

      // Check: Comments saying "this should never happen"
      if (/should\s*n[o']?t\s*(ever\s*)?happen/i.test(line)) {
        findings.push({
          type: "warning",
          category: "boundary-blindness",
          line: i + 1,
          code: line.trim(),
          intent: "Comment claims this code path is impossible",
          reality:
            "If it truly can't happen, the code shouldn't exist. If it can, handle it.",
          explanation:
            '"Should never happen" comments often precede production incidents.',
          confidence: 0.85,
        });
      }

      // Check: Comments that say "temporary" or "hack"
      if (
        /\b(temporary|temp|hack|workaround|fixme)\b/i.test(line) &&
        line.includes("//")
      ) {
        findings.push({
          type: "suggestion",
          category: "stale-comment",
          line: i + 1,
          code: line.trim(),
          intent: "Marked as temporary/hack to be fixed later",
          reality: "Temporary code tends to become permanent. Track or fix it.",
          explanation:
            'Create a ticket or fix it. "Temporary" code causes technical debt.',
          confidence: 0.7,
        });
      }
    }

    return findings;
  }

  /**
   * Check for dangerous assumptions in the code
   */
  private checkAssumptions(code: string): RealityFinding[] {
    const findings: RealityFinding[] = [];
    const lines = code.split("\n");

    // Check: process.env without fallback
    const envMatches = code.matchAll(/process\.env\.(\w+)(?!\s*\|\||\s*\?\?)/g);
    for (const match of envMatches) {
      const lineNum = this.getLineNumber(code, match.index || 0);
      findings.push({
        type: "warning",
        category: "dependency-assumption",
        line: lineNum,
        code: match[0],
        intent: `Assumes ${match[1]} environment variable always exists`,
        reality: "No fallback if env var is missing - will be undefined",
        explanation: 'Use process.env.VAR ?? "default" or validate at startup.',
        confidence: 0.85,
      });
    }

    // Check: JSON.parse without try-catch
    if (
      /JSON\.parse\s*\(/.test(code) &&
      !this.isWrappedInTryCatch(code, "JSON.parse")
    ) {
      const lineNum = this.getLineNumber(code, code.indexOf("JSON.parse"));
      findings.push({
        type: "warning",
        category: "error-handling-illusion",
        line: lineNum,
        code: "JSON.parse(...)",
        intent: "Assumes input is always valid JSON",
        reality: "Invalid JSON will throw and likely crash if uncaught",
        explanation: "Wrap JSON.parse in try-catch or use a safe parser.",
        confidence: 0.9,
      });
    }

    // Check: Array access without bounds check
    const arrayAccessMatches = code.matchAll(/(\w+)\[(\w+)\]/g);
    for (const match of arrayAccessMatches) {
      const arrayName = match[1];
      const indexVar = match[2];
      // Skip if it looks like an object property access with string literal
      if (/['"]/.test(match[0])) continue;
      // Skip if there's a length check nearby
      const surroundingCode = this.getSurroundingCode(
        code,
        match.index || 0,
        100,
      );
      if (
        !surroundingCode.includes(".length") &&
        !surroundingCode.includes("?.")
      ) {
        const lineNum = this.getLineNumber(code, match.index || 0);
        findings.push({
          type: "suggestion",
          category: "boundary-blindness",
          line: lineNum,
          code: match[0],
          intent: `Assumes ${arrayName}[${indexVar}] always exists`,
          reality:
            "No bounds check - will return undefined if index is out of range",
          explanation:
            "Check array length or use optional chaining for safety.",
          confidence: 0.6,
        });
      }
    }

    // Check: Using `this` in callbacks without binding
    if (
      /\.then\s*\(\s*function\s*\(/.test(code) ||
      /\.forEach\s*\(\s*function\s*\(/.test(code)
    ) {
      if (!/\.bind\(this\)/.test(code) && !/\.then\s*\(\s*\(/.test(code)) {
        findings.push({
          type: "warning",
          category: "scope-assumption",
          line: 1,
          code: "function() in callback",
          intent: "Assumes `this` refers to the class/object instance",
          reality:
            "`this` in regular function callbacks is undefined or window",
          explanation:
            "Use arrow functions or .bind(this) to preserve context.",
          confidence: 0.85,
        });
      }
    }

    return findings;
  }

  // ============= Intent Inference Helpers =============

  private inferIntent(fn: ParsedFunction): IntentSignals {
    return {
      nameImplies: this.parseNameIntent(fn.name),
      commentsImply: this.parseCommentIntent(fn.comments),
      structureImplies: this.parseStructureIntent(fn),
      jsdocImplies: fn.jsdoc ? this.parseJSDocIntent(fn.jsdoc) : [],
    };
  }

  private parseNameIntent(name: string): string[] {
    const intents: string[] = [];
    const lowerName = name.toLowerCase();

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (keywords.some((kw) => lowerName.includes(kw))) {
        intents.push(intent);
      }
    }

    return intents;
  }

  private parseCommentIntent(comments: string[]): string[] {
    // Extract intent from comments
    return comments
      .map((c) => c.toLowerCase())
      .filter(
        (c) =>
          c.includes("returns") ||
          c.includes("validates") ||
          c.includes("checks"),
      );
  }

  private parseStructureIntent(fn: ParsedFunction): string[] {
    const intents: string[] = [];

    if (fn.isAsync) intents.push("asynchronous");
    if (fn.params.length === 0) intents.push("no-input");
    if (fn.returnType === "void") intents.push("side-effect-only");
    if (fn.returnType === "boolean") intents.push("predicate");

    return intents;
  }

  private parseJSDocIntent(jsdoc: ParsedFunction["jsdoc"]): string[] {
    const intents: string[] = [];
    if (!jsdoc) return intents;

    if (jsdoc.throws && jsdoc.throws.length > 0) intents.push("throws-errors");
    if (jsdoc.returns?.includes("Promise")) intents.push("async-return");
    if (jsdoc.returns?.includes("boolean")) intents.push("returns-boolean");

    return intents;
  }

  // ============= Behavior Analysis Helpers =============

  private analyzeBehavior(fn: ParsedFunction): BehaviorAnalysis {
    const body = fn.body;

    return {
      actualReturns: this.extractReturnTypes(body),
      actualThrows: this.throwsExceptions(body),
      hasErrorHandling: /try\s*{/.test(body),
      hasSideEffects: this.detectSideEffects(body),
      modifiesParams: this.modifiesParameters(body, fn.params),
      isActuallyAsync: this.hasAwait(body),
      controlFlowPaths: this.countControlFlowPaths(body),
      earlyReturns: /return\s+[^;]+;[\s\S]*return/.test(body),
      callsExternal: this.extractExternalCalls(body),
      mutatesState:
        /this\.\w+\s*=/.test(body) || /\.set\(|\.push\(|\.splice\(/.test(body),
    };
  }

  private detectSideEffects(body: string): boolean {
    const sideEffectPatterns = [
      /console\.\w+\(/,
      /localStorage\./,
      /sessionStorage\./,
      /document\./,
      /window\./,
      /fetch\(/,
      /XMLHttpRequest/,
      /\.write\(/,
      /\.save\(/,
      /\.update\(/,
      /\.delete\(/,
      /\.insert\(/,
      /\.emit\(/,
      /\.dispatch\(/,
      /this\.\w+\s*=/,
    ];

    return sideEffectPatterns.some((p) => p.test(body));
  }

  private modifiesParameters(body: string, params: string[]): boolean {
    for (const param of params) {
      // Check if parameter is mutated
      if (
        new RegExp(
          `${param}\\s*\\.\\s*(push|pop|shift|splice|sort)\\s*\\(`,
        ).test(body)
      ) {
        return true;
      }
      if (new RegExp(`${param}\\s*\\[.*\\]\\s*=`).test(body)) {
        return true;
      }
    }
    return false;
  }

  private extractReturnTypes(body: string): string[] {
    const types: string[] = [];
    const returnMatches = body.matchAll(/return\s+([^;]+);/g);

    for (const match of returnMatches) {
      const expr = match[1].trim();
      if (expr === "true" || expr === "false") types.push("boolean");
      else if (/^\d+$/.test(expr)) types.push("number");
      else if (/^['"`]/.test(expr)) types.push("string");
      else if (expr === "null") types.push("null");
      else if (expr === "undefined" || expr === "") types.push("undefined");
      else if (/^\[/.test(expr)) types.push("array");
      else if (/^\{/.test(expr)) types.push("object");
      else types.push("unknown");
    }

    // Check for implicit undefined return
    if (!body.includes("return") || /}\s*$/.test(body)) {
      types.push("undefined");
    }

    return [...new Set(types)];
  }

  private extractExternalCalls(body: string): string[] {
    const calls: string[] = [];
    const callMatches = body.matchAll(/(\w+)\s*\(/g);

    for (const match of callMatches) {
      if (
        !["if", "for", "while", "switch", "catch", "function"].includes(
          match[1],
        )
      ) {
        calls.push(match[1]);
      }
    }

    return [...new Set(calls)];
  }

  private countControlFlowPaths(body: string): number {
    let paths = 1;
    paths += (body.match(/if\s*\(/g) || []).length;
    paths += (body.match(/\?\s*[^:]+:/g) || []).length; // ternary
    paths += (body.match(/case\s+/g) || []).length;
    paths += (body.match(/catch\s*\(/g) || []).length;
    return paths;
  }

  // ============= Detection Helpers =============

  private nameImpliesValidation(name: string): boolean {
    return /^(validate|check|verify|is|has|can|should|must|ensure|assert)/i.test(
      name,
    );
  }

  private nameImpliesRetrieval(name: string): boolean {
    return /^(get|fetch|load|find|search|query|read|retrieve)/i.test(name);
  }

  private nameImpliesAuthorization(name: string): boolean {
    return /^(authorize|authenticate|checkAuth|verifyAuth|isAuthorized|hasPermission|canAccess)/i.test(
      name,
    );
  }

  private nameImpliesArrayOperation(name: string): boolean {
    return /(all|each|every|some|filter|map|reduce|find|list|array|items|collection)/i.test(
      name,
    );
  }

  private nameImpliesSingleton(name: string): boolean {
    return /(singleton|instance|manager|registry|factory)/i.test(name);
  }

  private returnsBoolean(body: string): boolean {
    return (
      /return\s+(true|false)\s*;/.test(body) ||
      /return\s+[^;]+\s*(===|!==|==|!=|<|>|<=|>=|&&|\|\|)/.test(body)
    );
  }

  private throwsOnInvalid(body: string): boolean {
    return /throw\s+new\s+\w*Error/.test(body);
  }

  private throwsExceptions(body: string): boolean {
    return /throw\s+/.test(body);
  }

  private checksPermissions(body: string): boolean {
    return /(role|permission|access|admin|user\.|auth\.|isAdmin|isUser|hasRole|canDo)/i.test(
      body,
    );
  }

  private hasSilentCatch(body: string): boolean {
    // Match catch blocks that don't do anything meaningful
    const catchMatch = body.match(/catch\s*\([^)]*\)\s*\{([^}]*)\}/);
    if (!catchMatch) return false;

    const catchBody = catchMatch[1].trim();
    // Silent if empty, only comments, or just console.log
    return (
      catchBody === "" ||
      /^\s*\/\//.test(catchBody) ||
      /^\s*console\.(log|warn)\s*\(/.test(catchBody)
    );
  }

  private hasErrorHandlerReturningUndefined(body: string): boolean {
    const catchMatch = body.match(/catch\s*\([^)]*\)\s*\{([^}]*)\}/);
    if (!catchMatch) return false;

    const catchBody = catchMatch[1].trim();
    return (
      catchBody === "" ||
      /return\s*;/.test(catchBody) ||
      !catchBody.includes("return")
    );
  }

  private hasAwait(body: string): boolean {
    return /await\s+/.test(body);
  }

  private findTypeCoercionTraps(
    body: string,
  ): { code: string; example: string }[] {
    const traps: { code: string; example: string }[] = [];
    const matches = body.matchAll(/([^=!])={2}([^=])/g);

    for (const match of matches) {
      const fullMatch = `${match[1]}==${match[2]}`;
      traps.push({
        code: fullMatch.trim(),
        example: '0 == "" is true, null == undefined is true',
      });
    }

    return traps;
  }

  private checksArrayInput(body: string): boolean {
    return /Array\.isArray|\.length\s*(===|>|<|!==)|(\?\.)/.test(body);
  }

  private analyzeReturnPaths(body: string): {
    hasInconsistentTypes: boolean;
    types: string[];
  } {
    const types = this.extractReturnTypes(body);
    const uniqueTypes = [...new Set(types.filter((t) => t !== "unknown"))];

    return {
      hasInconsistentTypes:
        uniqueTypes.length > 1 &&
        !uniqueTypes.every((t) => t === uniqueTypes[0]),
      types: uniqueTypes,
    };
  }

  private isSingleton(cls: ParsedClass): boolean {
    // Check for common singleton patterns
    return (
      cls.methods.some((m) => m.name === "getInstance") ||
      cls.properties.some((p) => p.name === "instance")
    );
  }

  private looksImplemented(nextLine: string, todoText: string): boolean {
    // Very basic heuristic - if next line has code that matches TODO keywords
    const keywords = todoText.toLowerCase().match(/\w+/g) || [];
    return keywords.some((kw) => nextLine.toLowerCase().includes(kw));
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split("\n").length;
  }

  private getSurroundingCode(
    code: string,
    index: number,
    range: number,
  ): string {
    const start = Math.max(0, index - range);
    const end = Math.min(code.length, index + range);
    return code.substring(start, end);
  }

  private isWrappedInTryCatch(code: string, pattern: string): boolean {
    const index = code.indexOf(pattern);
    if (index === -1) return false;

    // Look backwards for try {
    const before = code.substring(Math.max(0, index - 200), index);
    const after = code.substring(index, Math.min(code.length, index + 200));

    return /try\s*\{[^}]*$/.test(before) || /^[^}]*\}\s*catch/.test(after);
  }

  private extractCatchBlock(body: string): string {
    const match = body.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/);
    return match ? match[0] : "catch block";
  }

  private describeActualBehavior(fn: ParsedFunction): string {
    const returns = this.extractReturnTypes(fn.body);
    if (returns.includes("undefined") && returns.length === 1) {
      return "returns nothing (undefined)";
    }
    return `returns: ${returns.join(" or ")}`;
  }

  // ============= Parsing Helpers =============

  private parseFunctions(code: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];
    const lines = code.split("\n");

    // Match function declarations and arrow functions
    const functionPatterns = [
      /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?\s*\{/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*(\w+))?\s*=>\s*\{?/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)(?:\s*:\s*(\w+))?\s*\{/g,
    ];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const startIndex = match.index;
        const lineNum = this.getLineNumber(code, startIndex);
        const name = match[1];
        const params = match[2]
          .split(",")
          .map((p) => p.trim().split(":")[0].trim())
          .filter(Boolean);
        const returnType = match[3];
        const isAsync = match[0].includes("async");

        // Extract function body (simplified - doesn't handle nested braces perfectly)
        const bodyStart = code.indexOf("{", startIndex);
        let braceCount = 1;
        let bodyEnd = bodyStart + 1;
        while (braceCount > 0 && bodyEnd < code.length) {
          if (code[bodyEnd] === "{") braceCount++;
          if (code[bodyEnd] === "}") braceCount--;
          bodyEnd++;
        }
        const body = code.substring(bodyStart + 1, bodyEnd - 1);
        const endLine = this.getLineNumber(code, bodyEnd);

        // Extract preceding comments
        const comments = this.extractPrecedingComments(code, startIndex);
        const jsdoc = this.parseJSDoc(comments);

        functions.push({
          name,
          params,
          returnType,
          body,
          startLine: lineNum,
          endLine,
          isAsync,
          comments,
          jsdoc,
        });
      }
    }

    return functions;
  }

  private parseClasses(code: string): ParsedClass[] {
    const classes: ParsedClass[] = [];
    const classPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/g;

    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const startIndex = match.index;
      const lineNum = this.getLineNumber(code, startIndex);
      const name = match[1];

      // Extract class body
      const bodyStart = code.indexOf("{", startIndex);
      let braceCount = 1;
      let bodyEnd = bodyStart + 1;
      while (braceCount > 0 && bodyEnd < code.length) {
        if (code[bodyEnd] === "{") braceCount++;
        if (code[bodyEnd] === "}") braceCount--;
        bodyEnd++;
      }
      const body = code.substring(bodyStart + 1, bodyEnd - 1);
      const endLine = this.getLineNumber(code, bodyEnd);

      // Parse methods from class body
      const methods = this.parseFunctions(body);

      classes.push({
        name,
        methods,
        properties: [],
        startLine: lineNum,
        endLine,
      });
    }

    return classes;
  }

  private extractPrecedingComments(code: string, index: number): string[] {
    const before = code.substring(Math.max(0, index - 500), index);
    const lines = before.split("\n").reverse();
    const comments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        comments.unshift(trimmed);
      } else if (trimmed && !trimmed.startsWith("*/")) {
        break;
      }
    }

    return comments;
  }

  private parseJSDoc(comments: string[]): ParsedFunction["jsdoc"] | undefined {
    const jsdocText = comments.join("\n");
    if (!jsdocText.includes("@")) return undefined;

    const jsdoc: ParsedFunction["jsdoc"] = {
      params: [],
    };

    // Extract description
    const descMatch = jsdocText.match(/\*\s*([^@*][^\n]*)/);
    if (descMatch) jsdoc.description = descMatch[1].trim();

    // Extract @param
    const paramMatches = jsdocText.matchAll(
      /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*(.+)?/g,
    );
    for (const match of paramMatches) {
      jsdoc.params.push({
        name: match[1],
        description: match[2]?.trim() || "",
      });
    }

    // Extract @returns
    const returnsMatch = jsdocText.match(
      /@returns?\s+(?:\{([^}]+)\}\s+)?(.+)?/,
    );
    if (returnsMatch) jsdoc.returns = returnsMatch[1] || returnsMatch[2];

    // Extract @throws
    const throwsMatches = jsdocText.matchAll(
      /@throws?\s+(?:\{([^}]+)\}\s+)?(.+)?/g,
    );
    jsdoc.throws = [];
    for (const match of throwsMatches) {
      jsdoc.throws.push(match[1] || match[2] || "Error");
    }

    return jsdoc;
  }

  private calculateScore(findings: RealityFinding[]): number {
    let score = 100;

    for (const finding of findings) {
      const penalty =
        finding.confidence *
        (finding.type === "critical" ? 15 : finding.type === "warning" ? 8 : 3);
      score -= penalty;
    }

    return Math.max(0, Math.round(score));
  }
}

// Export singleton instance
export const realityCheck = new RealityCheckService();

// Export class for testing
export { RealityCheckService };
