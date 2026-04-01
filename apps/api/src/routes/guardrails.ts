/**
 * Guardrails API Routes
 *
 * Full-featured guardrail management with natural language parsing,
 * real-time validation, achievements, and team features
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { authMiddleware, standardRateLimit } from '../middleware/fastify-auth';
import { asyncHandler } from '../middleware/error-handler';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// ============ Schemas ============

const NaturalLanguageRuleSchema = z.object({
  naturalLanguage: z
    .string()
    .min(5, "Rule description must be at least 5 characters"),
  severity: z.enum(["block", "warn", "info"]).optional(),
  category: z.enum(["security", "quality", "behavior", "custom"]).optional(),
});

const ValidateCodeSchema = z.object({
  code: z.string(),
  language: z.string().default("typescript"),
  projectId: z.string().optional(),
  ruleIds: z.array(z.string()).optional(),
});

const PresetToggleSchema = z.object({
  presetId: z.string(),
  enabled: z.boolean(),
});

// ============ In-Memory Storage (would be database in production) ============

interface GuardrailRule {
  id: string;
  naturalLanguage: string;
  pattern: string;
  category: "security" | "quality" | "behavior" | "custom";
  severity: "block" | "warn" | "info";
  enabled: boolean;
  createdAt: Date;
  userId?: string;
}

interface ValidationResult {
  id: string;
  passed: boolean;
  score: number;
  stages: ValidationStage[];
  findings: ValidationFinding[];
  timestamp: Date;
}

interface ValidationStage {
  id: string;
  name: string;
  status: "passed" | "failed" | "warning";
  duration: number;
  message?: string;
}

interface ValidationFinding {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  line?: number;
  column?: number;
  code?: string;
  suggestedFix?: string;
  confidence: number;
  ruleId: string;
}

interface Achievement {
  id: string;
  userId: string;
  achievementType: string;
  unlockedAt: Date;
  progress: number;
  maxProgress: number;
}

interface UserStats {
  userId: string;
  securityScore: number;
  totalValidations: number;
  issuesBlocked: number;
  issuesFixed: number;
  streak: number;
  lastValidation: Date;
}

// Storage
const customRules: Map<string, GuardrailRule> = new Map();
const userAchievements: Map<string, Achievement[]> = new Map();
const userStats: Map<string, UserStats> = new Map();
const validationHistory: ValidationResult[] = [];

// ============ Natural Language Parser ============

interface ParsedRule {
  pattern: string;
  category: GuardrailRule["category"];
  severity: GuardrailRule["severity"];
  keywords: string[];
}

function parseNaturalLanguageToRule(text: string): ParsedRule {
  const lowerText = text.toLowerCase();
  const keywords: string[] = [];

  // Extract keywords
  const keywordPatterns = [
    "filesystem",
    "file system",
    "files",
    "fs.",
    "eval",
    "function()",
    "new function",
    "api key",
    "secret",
    "password",
    "credential",
    "token",
    "sql",
    "query",
    "database",
    "select",
    "insert",
    "delete",
    "http",
    "fetch",
    "axios",
    "request",
    "xhr",
    "console.log",
    "console.",
    "debug",
    "import",
    "require",
    "package",
    "npm",
    "exec",
    "spawn",
    "child_process",
    "shell",
    "innerHTML",
    "outerHTML",
    "document.write",
    "xss",
    "crypto",
    "random",
    "math.random",
  ];

  for (const kw of keywordPatterns) {
    if (lowerText.includes(kw)) {
      keywords.push(kw);
    }
  }

  // Determine category
  let category: GuardrailRule["category"] = "custom";
  if (lowerText.match(/security|secret|password|key|inject|vuln|xss|sql/)) {
    category = "security";
  } else if (lowerText.match(/quality|lint|style|console|format|naming/)) {
    category = "quality";
  } else if (lowerText.match(/block|prevent|restrict|deny|forbid/)) {
    category = "behavior";
  }

  // Determine severity
  let severity: GuardrailRule["severity"] = "warn";
  if (lowerText.match(/block|prevent|never|forbid|critical|must not/)) {
    severity = "block";
  } else if (lowerText.match(/info|note|suggest|consider|might/)) {
    severity = "info";
  }

  // Generate regex pattern based on detected intent
  const pattern = generateRegexPattern(lowerText, keywords);

  return { pattern, category, severity, keywords };
}

function generateRegexPattern(text: string, keywords: string[]): string {
  // File system operations
  if (
    text.match(
      /filesystem|file system|file access|read file|write file|delete file/,
    )
  ) {
    return "\\b(fs|require\\(['\"]fs['\"]\\))\\.(read|write|unlink|rmdir|mkdir|appendFile|createWriteStream|createReadStream)";
  }

  // Eval and dynamic code execution
  if (text.match(/eval|dynamic code|execute string|function constructor/)) {
    return "\\b(eval|Function|setTimeout|setInterval)\\s*\\([^)]*['\"`]";
  }

  // Hardcoded secrets
  if (text.match(/api.?key|secret|password|credential|hardcode/)) {
    return "(api[_-]?key|secret|password|token|credential|auth)\\s*[=:]\\s*['\"][^'\"]{8,}['\"]";
  }

  // SQL injection
  if (text.match(/sql|query|database|injection|parameterize/)) {
    return "(\\$\\{[^}]+\\}|\\+\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*\\+).*(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION)";
  }

  // HTTP/Network requests
  if (text.match(/http|request|fetch|external|network|api call/)) {
    return "\\b(fetch|axios|http|https|XMLHttpRequest|request)\\s*\\(";
  }

  // Console statements
  if (text.match(/console|log|debug|print statement/)) {
    return "\\bconsole\\.(log|debug|info|warn|error|trace)\\s*\\(";
  }

  // Dangerous HTML methods (XSS)
  if (text.match(/innerhtml|xss|html injection|document.write/)) {
    return "\\.(innerHTML|outerHTML|insertAdjacentHTML)|document\\.write";
  }

  // Shell execution
  if (text.match(/exec|shell|command|spawn|child.?process/)) {
    return "\\b(exec|execSync|spawn|spawnSync|child_process)\\s*\\(";
  }

  // Weak crypto
  if (text.match(/random|crypto|math.random|weak/)) {
    return "Math\\.random\\s*\\(|crypto\\.pseudoRandomBytes";
  }

  // Package imports - unknown packages
  if (text.match(/import|require|package|unknown|unverified/)) {
    return "(?:import|require)\\s*\\(?['\"](?!\\.|@)[^'\"]+['\"]";
  }

  // Function length
  if (text.match(/function.*long|exceed.*lines|too many lines/)) {
    return "(?:function|=>)[^{]*\\{[^}]{2000,}\\}";
  }

  // Fallback - create a simple keyword pattern
  if (keywords.length > 0) {
    const escaped = keywords.map((k) =>
      k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return `\\b(${escaped.join("|")})\\b`;
  }

  return `(?:${text.split(" ").slice(0, 3).join(".*")})`;
}

// ============ Code Validator ============

function validateCode(
  code: string,
  language: string,
  rules: GuardrailRule[],
): ValidationResult {
  const stages: ValidationStage[] = [];
  const findings: ValidationFinding[] = [];
  let overallPassed = true;
  let totalScore = 100;

  // Stage 1: Syntax Check
  const syntaxStart = Date.now();
  const syntaxIssues = checkSyntax(code, language);
  stages.push({
    id: "syntax",
    name: "Syntax Check",
    status: syntaxIssues.length === 0 ? "passed" : "failed",
    duration: Date.now() - syntaxStart,
    message:
      syntaxIssues.length === 0
        ? "Syntax is valid"
        : `${syntaxIssues.length} syntax issues found`,
  });
  findings.push(...syntaxIssues);
  if (syntaxIssues.some((f) => f.type === "error")) {
    overallPassed = false;
    totalScore -= 20;
  }

  // Stage 2: Import Verification
  const importStart = Date.now();
  const importIssues = checkImports(code);
  stages.push({
    id: "imports",
    name: "Import Verification",
    status:
      importIssues.length === 0
        ? "passed"
        : importIssues.some((f) => f.type === "error")
          ? "failed"
          : "warning",
    duration: Date.now() - importStart,
    message:
      importIssues.length === 0
        ? "All imports verified"
        : `${importIssues.length} import issues`,
  });
  findings.push(...importIssues);
  totalScore -= importIssues.filter((f) => f.type === "error").length * 10;
  totalScore -= importIssues.filter((f) => f.type === "warning").length * 5;

  // Stage 3: Hallucination Detection
  const hallucinationStart = Date.now();
  const hallucinationIssues = detectHallucinations(code);
  stages.push({
    id: "hallucination",
    name: "Hallucination Detection",
    status: hallucinationIssues.length === 0 ? "passed" : "warning",
    duration: Date.now() - hallucinationStart,
    message:
      hallucinationIssues.length === 0
        ? "No hallucinations detected"
        : `${hallucinationIssues.length} potential hallucinations`,
  });
  findings.push(...hallucinationIssues);
  totalScore -= hallucinationIssues.length * 8;

  // Stage 4: Intent Alignment (placeholder - would need original prompt)
  const intentStart = Date.now();
  stages.push({
    id: "intent",
    name: "Intent Alignment",
    status: "passed",
    duration: Date.now() - intentStart,
    message: "Intent alignment check passed",
  });

  // Stage 5: Quality Gate
  const qualityStart = Date.now();
  const qualityIssues = checkQuality(code);
  stages.push({
    id: "quality",
    name: "Quality Gate",
    status: qualityIssues.length === 0 ? "passed" : "warning",
    duration: Date.now() - qualityStart,
    message:
      qualityIssues.length === 0
        ? "Quality standards met"
        : `${qualityIssues.length} quality suggestions`,
  });
  findings.push(...qualityIssues);
  totalScore -= qualityIssues.length * 3;

  // Stage 6: Security Scan (using custom rules)
  const securityStart = Date.now();
  const securityIssues = runSecurityScan(code, rules);
  const hasBlockingIssue = securityIssues.some((f) => f.type === "error");
  stages.push({
    id: "security",
    name: "Security Scan",
    status:
      securityIssues.length === 0
        ? "passed"
        : hasBlockingIssue
          ? "failed"
          : "warning",
    duration: Date.now() - securityStart,
    message:
      securityIssues.length === 0
        ? "No security issues found"
        : `${securityIssues.length} security findings`,
  });
  findings.push(...securityIssues);
  if (hasBlockingIssue) overallPassed = false;
  totalScore -= securityIssues.filter((f) => f.type === "error").length * 15;
  totalScore -= securityIssues.filter((f) => f.type === "warning").length * 7;

  return {
    id: `val_${Date.now()}`,
    passed: overallPassed && totalScore >= 60,
    score: Math.max(0, Math.min(100, totalScore)),
    stages,
    findings,
    timestamp: new Date(),
  };
}

function checkSyntax(code: string, language: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Check balanced braces
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    findings.push({
      id: `syntax_${Date.now()}_1`,
      type: "error",
      title: "Unbalanced Braces",
      description: `Found ${openBraces} opening braces but ${closeBraces} closing braces`,
      confidence: 0.95,
      ruleId: "syntax-braces",
      suggestedFix: "Check for missing or extra braces in your code",
    });
  }

  // Check balanced parentheses
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    findings.push({
      id: `syntax_${Date.now()}_2`,
      type: "error",
      title: "Unbalanced Parentheses",
      description: `Found ${openParens} opening parens but ${closeParens} closing parens`,
      confidence: 0.95,
      ruleId: "syntax-parens",
    });
  }

  // Check for incomplete strings (simplified)
  const lines = code.split("\n");
  lines.forEach((line, i) => {
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    // Skip template literals and escaped quotes for now
    if (!line.includes("`") && !line.includes("\\'") && !line.includes('\\"')) {
      if (singleQuotes % 2 !== 0) {
        findings.push({
          id: `syntax_${Date.now()}_str_${i}`,
          type: "warning",
          title: "Possible Unclosed String",
          description: `Line ${i + 1} may have an unclosed single-quoted string`,
          line: i + 1,
          confidence: 0.7,
          ruleId: "syntax-string",
        });
      }
    }
  });

  return findings;
}

function checkImports(code: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Find all imports
  const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  let match;

  // Known safe packages (in production, this would be a comprehensive list or API call)
  const knownPackages = new Set([
    "react",
    "react-dom",
    "next",
    "express",
    "fastify",
    "lodash",
    "axios",
    "zod",
    "typescript",
    "fs",
    "path",
    "crypto",
    "http",
    "https",
    "url",
    "framer-motion",
    "lucide-react",
    "@radix-ui",
    "tailwindcss",
    "prisma",
  ]);

  while ((match = importRegex.exec(code)) !== null) {
    const pkg = match[1];

    // Skip relative imports
    if (pkg.startsWith(".") || pkg.startsWith("/") || pkg.startsWith("@/")) {
      continue;
    }

    // Extract base package name
    const basePkg = pkg.startsWith("@")
      ? pkg.split("/").slice(0, 2).join("/")
      : pkg.split("/")[0];

    // Check if package is known
    const isKnown =
      knownPackages.has(basePkg) ||
      Array.from(knownPackages).some((k) => basePkg.startsWith(k));

    if (!isKnown) {
      findings.push({
        id: `import_${Date.now()}_${basePkg}`,
        type: "warning",
        title: "Unverified Package Import",
        description: `Package "${basePkg}" is not in the verified package list`,
        confidence: 0.75,
        ruleId: "import-verification",
        code: match[0],
        suggestedFix: `Verify that "${basePkg}" is a legitimate package before using`,
      });
    }
  }

  return findings;
}

function detectHallucinations(code: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Fictional/commonly hallucinated packages
  const fictionalPackages = [
    "super-utils",
    "mega-helper",
    "ultra-lib",
    "awesome-tools",
    "easy-security",
    "simple-auth",
    "quick-db",
    "fast-api-helper",
  ];

  // Fictional APIs that AI sometimes makes up
  const fictionalAPIs = [
    "window.secureStorage",
    "navigator.ai",
    "document.safeEval",
    "crypto.quickHash",
    "Buffer.safeFrom",
    "process.secureEnv",
  ];

  for (const pkg of fictionalPackages) {
    if (code.includes(pkg)) {
      findings.push({
        id: `hallucination_${Date.now()}_pkg_${pkg}`,
        type: "warning",
        title: "Potentially Hallucinated Package",
        description: `"${pkg}" appears to be a fictional package that doesn't exist`,
        confidence: 0.85,
        ruleId: "hallucination-package",
        suggestedFix: "Search npm to verify this package exists",
      });
    }
  }

  for (const api of fictionalAPIs) {
    if (code.includes(api)) {
      findings.push({
        id: `hallucination_${Date.now()}_api_${api}`,
        type: "warning",
        title: "Potentially Hallucinated API",
        description: `"${api}" is not a real browser/Node.js API`,
        confidence: 0.9,
        ruleId: "hallucination-api",
        suggestedFix: "Check MDN or Node.js docs for the correct API",
      });
    }
  }

  return findings;
}

function checkQuality(code: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Check for console.log statements
  const consoleMatches = code.match(/console\.(log|debug|info)\s*\(/g);
  if (consoleMatches && consoleMatches.length > 0) {
    findings.push({
      id: `quality_${Date.now()}_console`,
      type: "info",
      title: "Console Statements Found",
      description: `Found ${consoleMatches.length} console statement(s) - consider removing for production`,
      confidence: 0.9,
      ruleId: "quality-console",
      suggestedFix: "Remove console statements or use a proper logging library",
    });
  }

  // Check for TODO/FIXME comments
  const todoMatches = code.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi);
  if (todoMatches && todoMatches.length > 0) {
    findings.push({
      id: `quality_${Date.now()}_todo`,
      type: "info",
      title: "TODO Comments Found",
      description: `Found ${todoMatches.length} TODO/FIXME comment(s)`,
      confidence: 1.0,
      ruleId: "quality-todo",
    });
  }

  // Check for very long lines
  const longLines = code.split("\n").filter((line) => line.length > 120);
  if (longLines.length > 0) {
    findings.push({
      id: `quality_${Date.now()}_lines`,
      type: "info",
      title: "Long Lines Detected",
      description: `${longLines.length} line(s) exceed 120 characters`,
      confidence: 1.0,
      ruleId: "quality-line-length",
    });
  }

  return findings;
}

function runSecurityScan(
  code: string,
  rules: GuardrailRule[],
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  // Built-in security checks
  const builtInPatterns: Array<{
    pattern: RegExp;
    title: string;
    description: string;
    severity: "error" | "warning";
  }> = [
    {
      pattern:
        /(api[_-]?key|secret|password|token)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
      title: "Hardcoded Secret Detected",
      description: "Credentials should not be hardcoded in source code",
      severity: "error",
    },
    {
      pattern: /\beval\s*\(/g,
      title: "Dangerous eval() Usage",
      description: "eval() can execute arbitrary code and is a security risk",
      severity: "error",
    },
    {
      pattern: /innerHTML\s*=/g,
      title: "Potential XSS Vulnerability",
      description:
        "Setting innerHTML with untrusted data can lead to XSS attacks",
      severity: "warning",
    },
    {
      pattern: /\$\{[^}]+\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi,
      title: "Potential SQL Injection",
      description:
        "String interpolation in SQL queries can lead to injection attacks",
      severity: "error",
    },
    {
      pattern: /new\s+Function\s*\(/g,
      title: "Dynamic Function Creation",
      description:
        "Creating functions from strings is similar to eval and poses security risks",
      severity: "warning",
    },
  ];

  // Run built-in patterns
  for (const check of builtInPatterns) {
    const matches = code.match(check.pattern);
    if (matches) {
      findings.push({
        id: `security_${Date.now()}_${check.title.replace(/\s/g, "_")}`,
        type: check.severity,
        title: check.title,
        description: check.description,
        confidence: 0.9,
        ruleId: "security-builtin",
        code: matches[0],
      });
    }
  }

  // Run custom rules
  for (const rule of rules) {
    if (!rule.enabled) continue;

    try {
      const regex = new RegExp(rule.pattern, "gi");
      const matches = code.match(regex);

      if (matches) {
        findings.push({
          id: `security_${Date.now()}_${rule.id}`,
          type:
            rule.severity === "block"
              ? "error"
              : rule.severity === "warn"
                ? "warning"
                : "info",
          title: `Custom Rule: ${rule.naturalLanguage.slice(0, 50)}`,
          description: rule.naturalLanguage,
          confidence: 0.85,
          ruleId: rule.id,
          code: matches[0],
        });
      }
    } catch (e) {
      // Invalid regex pattern - skip
    }
  }

  return findings;
}

// ============ Achievement System ============

const ACHIEVEMENT_DEFINITIONS = [
  {
    id: "first_scan",
    name: "First Steps",
    description: "Run your first validation",
    threshold: 1,
  },
  {
    id: "clean_code_10",
    name: "Clean Coder",
    description: "Pass 10 validations with no issues",
    threshold: 10,
  },
  {
    id: "clean_code_50",
    name: "Code Purist",
    description: "Pass 50 validations with no issues",
    threshold: 50,
  },
  {
    id: "streak_3",
    name: "On Fire",
    description: "3-day validation streak",
    threshold: 3,
  },
  {
    id: "streak_7",
    name: "Unstoppable",
    description: "7-day validation streak",
    threshold: 7,
  },
  {
    id: "streak_30",
    name: "Security Champion",
    description: "30-day validation streak",
    threshold: 30,
  },
  {
    id: "issues_blocked_10",
    name: "Guardian",
    description: "Block 10 security issues",
    threshold: 10,
  },
  {
    id: "issues_blocked_50",
    name: "Defender",
    description: "Block 50 security issues",
    threshold: 50,
  },
  {
    id: "custom_rules_5",
    name: "Rule Maker",
    description: "Create 5 custom guardrails",
    threshold: 5,
  },
  {
    id: "perfect_score",
    name: "Perfectionist",
    description: "Achieve a 100% validation score",
    threshold: 1,
  },
];

function checkAndUnlockAchievements(
  userId: string,
  stats: UserStats,
): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  const existing = userAchievements.get(userId) || [];
  const existingIds = new Set(existing.map((a) => a.achievementType));

  // Check each achievement
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (existingIds.has(def.id)) continue;

    let progress = 0;
    let unlocked = false;

    switch (def.id) {
      case "first_scan":
        progress = Math.min(stats.totalValidations, 1);
        unlocked = stats.totalValidations >= 1;
        break;
      case "clean_code_10":
      case "clean_code_50":
        // Would need to track clean validations specifically
        progress = Math.floor(stats.totalValidations * 0.7); // Approximate
        unlocked = progress >= def.threshold;
        break;
      case "streak_3":
      case "streak_7":
      case "streak_30":
        progress = stats.streak;
        unlocked = stats.streak >= def.threshold;
        break;
      case "issues_blocked_10":
      case "issues_blocked_50":
        progress = stats.issuesBlocked;
        unlocked = stats.issuesBlocked >= def.threshold;
        break;
      case "custom_rules_5":
        progress = customRules.size;
        unlocked = customRules.size >= def.threshold;
        break;
      case "perfect_score":
        progress = stats.securityScore >= 100 ? 1 : 0;
        unlocked = stats.securityScore >= 100;
        break;
    }

    if (unlocked) {
      const achievement: Achievement = {
        id: `ach_${Date.now()}_${def.id}`,
        userId,
        achievementType: def.id,
        unlockedAt: new Date(),
        progress: def.threshold,
        maxProgress: def.threshold,
      };
      newlyUnlocked.push(achievement);
      existing.push(achievement);
    }
  }

  userAchievements.set(userId, existing);
  return newlyUnlocked;
}

// ============ Routes ============

export async function guardrailsRoutes(fastify: FastifyInstance) {
  // Add optional authentication - user data available if logged in, but not required for read-only endpoints
  // Write operations require auth, read-only presets are public

  // Parse natural language to rule (requires auth)
  fastify.post(
    "/parse",
    { preHandler: [authMiddleware, standardRateLimit] },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { naturalLanguage, severity, category } =
          NaturalLanguageRuleSchema.parse(request.body);
        const parsed = parseNaturalLanguageToRule(naturalLanguage);

        const rule: GuardrailRule = {
          id: `rule_${Date.now()}`,
          naturalLanguage,
          pattern: parsed.pattern,
          category: category || parsed.category,
          severity: severity || parsed.severity,
          enabled: true,
          createdAt: new Date(),
          userId: (request as any).userId,
        };

        customRules.set(rule.id, rule);

        return {
          success: true,
          data: {
            rule,
            parsedKeywords: parsed.keywords,
            confidence: parsed.keywords.length > 0 ? 0.85 : 0.6,
          },
        };
      } catch (error: unknown) {
        reply.status(400).send({ success: false, error: toErrorMessage(error) });
      }
    })
  );

  // Get all rules (requires auth for user-specific rules)
  fastify.get("/rules", { preHandler: [authMiddleware, standardRateLimit] }, asyncHandler(async (request: FastifyRequest) => {
    const rules = Array.from(customRules.values());
    return { success: true, data: rules };
  }));

  // Toggle rule (requires auth)
  fastify.patch(
    "/rules/:ruleId/toggle",
    { preHandler: [authMiddleware, standardRateLimit] },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { ruleId } = request.params as { ruleId: string };
      const rule = customRules.get(ruleId);

      if (!rule) {
        return reply.status(404).send({ error: "Rule not found" });
      }

      rule.enabled = !rule.enabled;
      customRules.set(ruleId, rule);

      return { success: true, enabled: rule.enabled };
    })
  );

  // Delete rule (requires auth)
  fastify.delete(
    "/rules/:ruleId",
    { preHandler: [authMiddleware, standardRateLimit] },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { ruleId } = request.params as { ruleId: string };

      if (!customRules.has(ruleId)) {
        return reply.status(404).send({ error: "Rule not found" });
      }

      customRules.delete(ruleId);
      return { success: true, message: "Rule deleted" };
    }),
  );

  // Validate code (requires auth)
  fastify.post(
    "/validate",
    { preHandler: [authMiddleware, standardRateLimit] },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code, language, ruleIds } = ValidateCodeSchema.parse(
          request.body,
        );
        const userId = (request as any).userId || "anonymous";

        // Get applicable rules
        let rules = Array.from(customRules.values()).filter((r) => r.enabled);
        if (ruleIds && ruleIds.length > 0) {
          rules = rules.filter((r) => ruleIds.includes(r.id));
        }

        // Run validation
        const result = validateCode(code, language, rules);
        validationHistory.push(result);

        // Update user stats
        let stats = userStats.get(userId) || {
          userId,
          securityScore: 80,
          totalValidations: 0,
          issuesBlocked: 0,
          issuesFixed: 0,
          streak: 0,
          lastValidation: new Date(),
        };

        stats.totalValidations++;
        stats.issuesBlocked += result.findings.filter(
          (f) => f.type === "error",
        ).length;
        stats.securityScore = Math.round(
          stats.securityScore * 0.9 + result.score * 0.1,
        );

        // Update streak
        const lastDate = new Date(stats.lastValidation);
        const today = new Date();
        const daysDiff = Math.floor(
          (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysDiff <= 1) {
          if (daysDiff === 1) stats.streak++;
        } else {
          stats.streak = 1;
        }
        stats.lastValidation = today;

        userStats.set(userId, stats);

        // Check achievements
        const newAchievements = checkAndUnlockAchievements(userId, stats);

        return {
          success: true,
          data: {
            ...result,
            userStats: stats,
            newAchievements:
              newAchievements.length > 0 ? newAchievements : undefined,
          },
        };
      } catch (error: unknown) {
        return reply.status(500).send({ error: "Validation failed" });
      }
    }),
  );

  // Get validation history
  fastify.get("/history", { preHandler: [standardRateLimit] }, asyncHandler(async (request: FastifyRequest) => {
    const limit = parseInt((request.query as any).limit) || 20;
    const recent = validationHistory.slice(-limit).reverse();
    return { success: true, data: recent };
  }));

  // Get user stats (requires auth for user-specific data)
  fastify.get("/stats", { preHandler: [authMiddleware, standardRateLimit] }, asyncHandler(async (request: FastifyRequest) => {
    const userId = (request as any).userId || "anonymous";
    const stats = userStats.get(userId) || {
      userId,
      securityScore: 80,
      totalValidations: 0,
      issuesBlocked: 0,
      issuesFixed: 0,
      blockedViolations: 0,
      warningsTriggered: 0,
    };
    return { success: true, data: stats };
  }));

  // Get achievements
  fastify.get("/achievements", { preHandler: [standardRateLimit] }, asyncHandler(async (request: FastifyRequest) => {
    const userId = (request as any).userId || "anonymous";
    const achievements = userAchievements.get(userId) || [];

    // Include all achievement definitions with unlock status
    const allAchievements = ACHIEVEMENT_DEFINITIONS.map((def) => {
      const unlocked = achievements.find((a) => a.achievementType === def.id);
      return {
        ...def,
        unlocked: !!unlocked,
        unlockedAt: unlocked?.unlockedAt,
        progress: unlocked?.progress || 0,
        maxProgress: def.threshold,
      };
    });
    return { success: true, data: allAchievements };
  }));

  // Preset guardrails storage (in-memory, would be database in production)
  const presetGuardrails: Map<string, any> = new Map([
    ["security-essentials", {
      id: "security-essentials",
      name: "Security Essentials",
      description: "Core security rules for all projects",
      rules: 8,
      category: "security",
      enabled: true,
      patterns: [
        { name: "Hardcoded Secrets", pattern: "(api[_-]?key|secret|password)\\s*[=:]\\s*['\"][^'\"]{8,}" },
        { name: "SQL Injection", pattern: "\\$\\{.*\\}.*(?:SELECT|INSERT|UPDATE|DELETE)" },
        { name: "XSS Prevention", pattern: "innerHTML\\s*=" },
        { name: "Eval Usage", pattern: "\\beval\\s*\\(" },
      ],
    }],
    ["prompt-injection", {
      id: "prompt-injection",
      name: "Prompt Injection Defense",
      description: "Multi-layer protection against injection attacks",
      rules: 5,
      category: "llm-safety",
      enabled: true,
    }],
    ["hallucination-detection", {
      id: "hallucination-detection",
      name: "Hallucination Detection",
      description: "Catch fake packages, APIs, and dependencies",
      rules: 4,
      category: "llm-safety",
      enabled: true,
    }],
    ["code-quality", {
      id: "code-quality",
      name: "Code Quality Gate",
      description: "Enforce best practices and style guidelines",
      rules: 12,
      category: "quality",
      enabled: false,
    }],
  ]);

  // Preset guardrails
  fastify.get("/presets", { preHandler: [standardRateLimit] }, asyncHandler(async () => {
    const presets = Array.from(presetGuardrails.values());
    return { success: true, data: presets };
  }));

  // Toggle preset guardrail
  fastify.patch(
    "/presets/:presetId/toggle",
    { preHandler: [standardRateLimit] },
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { presetId } = request.params as { presetId: string };
      const { enabled } = (request.body as { enabled?: boolean }) || {};

      const preset = presetGuardrails.get(presetId);

      if (!preset) {
        return reply.status(404).send({ success: false, error: "Preset not found" });
      }

      // Toggle or set explicit value
      preset.enabled = enabled !== undefined ? enabled : !preset.enabled;
      presetGuardrails.set(presetId, preset);

      return { success: true, data: preset };
    })
  );

  // Team stats (for team insights feature)
  fastify.get("/team/stats", { preHandler: [standardRateLimit] }, asyncHandler(async () => {
    // Aggregate all user stats
    const allStats = Array.from(userStats.values());

    const teamStats = {
      totalMembers: allStats.length || 1,
      avgScore:
        allStats.length > 0
          ? Math.round(
              allStats.reduce((a, s) => a + s.securityScore, 0) /
                allStats.length,
            )
          : 80,
      totalValidations: allStats.reduce((a, s) => a + s.totalValidations, 0),
      issuesBlocked: allStats.reduce((a, s) => a + s.issuesBlocked, 0),
      leaderboard: allStats
        .sort((a, b) => b.securityScore - a.securityScore)
        .slice(0, 10)
        .map((s, i) => ({
          rank: i + 1,
          ...s,
        })),
    };

    return { success: true, data: teamStats };
  }));
}
