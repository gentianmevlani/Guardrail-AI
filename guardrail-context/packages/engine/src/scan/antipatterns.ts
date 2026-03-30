import fs from "node:fs";
import path from "node:path";

export type AntiPattern = {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  pattern: RegExp;
  suggestedFix: string;
};

export type AntiPatternInstance = {
  patternId: string;
  patternName: string;
  severity: AntiPattern["severity"];
  file: string;
  line: number;
  match: string;
  suggestedFix: string;
  proof: string;
};

export type AntiPatternMuseum = {
  instances: AntiPatternInstance[];
  byPattern: Record<string, AntiPatternInstance[]>;
  bySeverity: Record<string, AntiPatternInstance[]>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

const ANTI_PATTERNS: AntiPattern[] = [
  {
    id: "any-type",
    name: "TypeScript 'any' usage",
    description: "Using 'any' defeats TypeScript's type safety",
    severity: "medium",
    pattern: /:\s*any\b|as\s+any\b|<any>/g,
    suggestedFix: "Use specific types, 'unknown', or generic type parameters instead of 'any'"
  },
  {
    id: "console-log",
    name: "Console statements in production",
    description: "Console statements should be removed before production",
    severity: "low",
    pattern: /console\.(log|warn|error|info|debug)\s*\(/g,
    suggestedFix: "Use a proper logging library or remove console statements"
  },
  {
    id: "hardcoded-secret",
    name: "Hardcoded secrets",
    description: "Secrets should never be hardcoded in source code",
    severity: "critical",
    pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    suggestedFix: "Use environment variables via process.env or a secrets manager"
  },
  {
    id: "todo-fixme",
    name: "TODO/FIXME comments",
    description: "Unresolved TODO/FIXME comments indicate incomplete work",
    severity: "low",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)[\s:]/gi,
    suggestedFix: "Address the TODO/FIXME or create a ticket and remove the comment"
  },
  {
    id: "empty-catch",
    name: "Empty catch blocks",
    description: "Empty catch blocks silently swallow errors",
    severity: "high",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    suggestedFix: "Log the error or re-throw it, never silently ignore exceptions"
  },
  {
    id: "no-await",
    name: "Missing await on async call",
    description: "Async functions called without await may cause race conditions",
    severity: "high",
    pattern: /(?<!await\s)(?:fetch|axios\.(?:get|post|put|delete)|\.save\(\)|\.create\(\)|\.update\(\)|\.delete\(\))\s*\(/g,
    suggestedFix: "Add 'await' before async function calls"
  },
  {
    id: "magic-number",
    name: "Magic numbers",
    description: "Unexplained numeric literals make code hard to maintain",
    severity: "low",
    pattern: /(?<![0-9a-zA-Z_.])[1-9]\d{2,}(?![0-9])/g,
    suggestedFix: "Extract magic numbers into named constants"
  },
  {
    id: "sql-injection",
    name: "Potential SQL injection",
    description: "String concatenation in SQL queries is vulnerable to injection",
    severity: "critical",
    pattern: /(?:query|execute)\s*\(\s*['"`].*\$\{|(?:query|execute)\s*\(\s*.*\+\s*(?:req\.|input|user)/gi,
    suggestedFix: "Use parameterized queries or prepared statements"
  },
  {
    id: "dangerouslySetInnerHTML",
    name: "Dangerous innerHTML",
    description: "dangerouslySetInnerHTML can lead to XSS vulnerabilities",
    severity: "high",
    pattern: /dangerouslySetInnerHTML/g,
    suggestedFix: "Sanitize HTML content or use a safe alternative"
  },
  {
    id: "eval-usage",
    name: "eval() usage",
    description: "eval() is a security risk and performance problem",
    severity: "critical",
    pattern: /\beval\s*\(/g,
    suggestedFix: "Avoid eval() - use JSON.parse(), Function constructor, or refactor logic"
  },
  {
    id: "no-error-handling",
    name: "No error handling in async",
    description: "Async functions without try/catch can crash the application",
    severity: "medium",
    pattern: /async\s+(?:function\s+)?\w+\s*\([^)]*\)\s*\{(?:(?!try\s*\{).)*\}/gs,
    suggestedFix: "Wrap async logic in try/catch or use .catch() on promises"
  },
  {
    id: "hardcoded-url",
    name: "Hardcoded URLs",
    description: "URLs should be configurable via environment variables",
    severity: "medium",
    pattern: /['"]https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.|10\.)/g,
    suggestedFix: "Use environment variables for URLs (process.env.API_URL)"
  },
  {
    id: "disabled-eslint",
    name: "Disabled ESLint rules",
    description: "Disabling linting rules may hide real problems",
    severity: "low",
    pattern: /\/[/*]\s*eslint-disable(?:-next-line)?/g,
    suggestedFix: "Fix the underlying issue instead of disabling the rule"
  },
  {
    id: "ts-ignore",
    name: "@ts-ignore usage",
    description: "@ts-ignore hides type errors that may cause runtime issues",
    severity: "medium",
    pattern: /@ts-ignore|@ts-nocheck/g,
    suggestedFix: "Fix the type error or use @ts-expect-error with explanation"
  },
];

export async function scanAntiPatterns(repoRoot: string, files: string[]): Promise<AntiPatternMuseum> {
  const instances: AntiPatternInstance[] = [];
  const tsFiles = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));

  for (const file of tsFiles) {
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const lines = content.split("\n");
      const relativePath = path.relative(repoRoot, file);

      for (const pattern of ANTI_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          pattern.pattern.lastIndex = 0;
          let match;
          
          while ((match = pattern.pattern.exec(line)) !== null) {
            instances.push({
              patternId: pattern.id,
              patternName: pattern.name,
              severity: pattern.severity,
              file: relativePath,
              line: i + 1,
              match: match[0].substring(0, 50),
              suggestedFix: pattern.suggestedFix,
              proof: `${relativePath}:${i + 1}`
            });
          }
        }
      }
    } catch {}
  }

  // Group by pattern
  const byPattern: Record<string, AntiPatternInstance[]> = {};
  for (const inst of instances) {
    if (!byPattern[inst.patternId]) byPattern[inst.patternId] = [];
    byPattern[inst.patternId].push(inst);
  }

  // Group by severity
  const bySeverity: Record<string, AntiPatternInstance[]> = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };
  for (const inst of instances) {
    bySeverity[inst.severity].push(inst);
  }

  return {
    instances,
    byPattern,
    bySeverity,
    summary: {
      total: instances.length,
      critical: bySeverity.critical.length,
      high: bySeverity.high.length,
      medium: bySeverity.medium.length,
      low: bySeverity.low.length,
    }
  };
}

export function getAntiPatternDefinitions(): AntiPattern[] {
  return ANTI_PATTERNS;
}
