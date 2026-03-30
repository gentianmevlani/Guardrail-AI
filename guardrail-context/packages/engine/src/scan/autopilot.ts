import type { PatternsMap, GoldenPattern } from "./patterns.js";
import type { RoutesMap } from "./routes.js";
import type { SymbolRecord, RiskMap } from "@guardrail-context/shared";

export type Intent = 
  | "new-endpoint"
  | "new-component"
  | "new-hook"
  | "new-table"
  | "new-schema"
  | "fix-bug"
  | "refactor"
  | "add-test"
  | "update-auth"
  | "update-payment"
  | "unknown";

export type AutopilotContext = {
  intent: Intent;
  confidence: number;
  suggestedPattern?: GoldenPattern;
  requiredFiles: string[];
  forbiddenFiles: string[];
  requiredTests: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  warnings: string[];
  proof: string[];
};

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  "new-endpoint": ["endpoint", "route", "api", "rest", "controller", "handler"],
  "new-component": ["component", "ui", "page", "view", "screen", "modal", "dialog"],
  "new-hook": ["hook", "usehook", "custom hook", "state hook"],
  "new-table": ["table", "database", "schema", "model", "entity", "drizzle", "prisma"],
  "new-schema": ["schema", "validation", "zod", "yup", "type"],
  "fix-bug": ["fix", "bug", "issue", "error", "broken", "not working"],
  "refactor": ["refactor", "clean", "improve", "optimize", "restructure"],
  "add-test": ["test", "spec", "coverage", "unit test", "integration test"],
  "update-auth": ["auth", "login", "logout", "session", "permission", "role", "jwt"],
  "update-payment": ["payment", "stripe", "billing", "subscription", "checkout"],
  "unknown": []
};

export function classifyIntent(prompt: string): { intent: Intent; confidence: number } {
  const lowerPrompt = prompt.toLowerCase();
  let bestIntent: Intent = "unknown";
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "unknown") continue;
    
    let score = 0;
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        score += 1;
        // Bonus for exact phrase matches
        if (lowerPrompt.includes(` ${keyword} `) || 
            lowerPrompt.startsWith(`${keyword} `) ||
            lowerPrompt.endsWith(` ${keyword}`)) {
          score += 0.5;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as Intent;
    }
  }

  // Normalize confidence (0-1)
  const maxPossibleScore = Math.max(...Object.values(INTENT_KEYWORDS).map(k => k.length * 1.5));
  const confidence = Math.min(1, bestScore / 3); // Require at least 3 matches for full confidence

  return { intent: bestIntent, confidence };
}

export function generateAutopilotContext(
  prompt: string,
  patterns: PatternsMap,
  routes: RoutesMap,
  symbols: SymbolRecord[],
  risk: RiskMap
): AutopilotContext {
  const { intent, confidence } = classifyIntent(prompt);
  
  const context: AutopilotContext = {
    intent,
    confidence,
    requiredFiles: [],
    forbiddenFiles: [],
    requiredTests: [],
    riskLevel: "low",
    warnings: [],
    proof: []
  };

  // Get suggested pattern
  context.suggestedPattern = getPatternForIntent(intent, patterns);
  if (context.suggestedPattern) {
    context.proof.push(`Pattern from: ${context.suggestedPattern.file}`);
  }

  // Determine required files based on intent
  switch (intent) {
    case "new-endpoint":
      context.requiredFiles = findRouteFiles(symbols);
      context.forbiddenFiles = ["**/schema.*", "**/auth/**"];
      context.requiredTests.push("API endpoint test");
      context.riskLevel = "medium";
      break;

    case "new-component":
      context.requiredFiles = findComponentFiles(symbols);
      context.requiredTests.push("Component test");
      context.riskLevel = "low";
      break;

    case "new-hook":
      context.requiredFiles = findHookFiles(symbols);
      context.requiredTests.push("Hook test");
      context.riskLevel = "low";
      break;

    case "new-table":
    case "new-schema":
      context.requiredFiles = findSchemaFiles(symbols);
      context.forbiddenFiles = ["**/auth/**", "**/payment/**"];
      context.requiredTests.push("Migration test", "Schema validation test");
      context.riskLevel = "high";
      context.warnings.push("⚠️ Database changes require migration and backup");
      break;

    case "update-auth":
      context.requiredFiles = findAuthFiles(risk);
      context.forbiddenFiles = ["**/payment/**"];
      context.requiredTests.push("Auth flow test", "Permission test");
      context.riskLevel = "critical";
      context.warnings.push("🚨 Auth changes are CRITICAL - require thorough testing");
      break;

    case "update-payment":
      context.requiredFiles = findPaymentFiles(risk);
      context.forbiddenFiles = ["**/auth/**"];
      context.requiredTests.push("Payment flow test", "Webhook test");
      context.riskLevel = "critical";
      context.warnings.push("🚨 Payment changes are CRITICAL - require staging testing");
      break;

    case "fix-bug":
    case "refactor":
      context.riskLevel = "medium";
      context.warnings.push("Run existing tests before and after changes");
      break;

    case "add-test":
      context.riskLevel = "low";
      break;
  }

  // Add proof for route existence if relevant
  if (intent === "new-endpoint" && routes.routes.length > 0) {
    context.proof.push(`Existing routes: ${routes.summary.total} (check for conflicts)`);
  }

  return context;
}

function getPatternForIntent(intent: Intent, patterns: PatternsMap): GoldenPattern | undefined {
  const intentToPattern: Record<Intent, string[]> = {
    "new-endpoint": ["api-route", "route"],
    "new-component": ["component"],
    "new-hook": ["hook"],
    "new-table": ["drizzle-table", "prisma-model"],
    "new-schema": ["zod-schema", "schema"],
    "fix-bug": [],
    "refactor": [],
    "add-test": ["test"],
    "update-auth": ["auth"],
    "update-payment": ["payment"],
    "unknown": []
  };

  const patternIds = intentToPattern[intent] || [];
  for (const id of patternIds) {
    if (patterns[id]) return patterns[id];
  }
  return undefined;
}

function findRouteFiles(symbols: SymbolRecord[]): string[] {
  return [...new Set(
    symbols
      .filter(s => s.file.includes("route") || s.file.includes("api"))
      .map(s => s.file)
  )].slice(0, 5);
}

function findComponentFiles(symbols: SymbolRecord[]): string[] {
  return [...new Set(
    symbols
      .filter(s => s.kind === "component")
      .map(s => s.file)
  )].slice(0, 5);
}

function findHookFiles(symbols: SymbolRecord[]): string[] {
  return [...new Set(
    symbols
      .filter(s => s.kind === "hook")
      .map(s => s.file)
  )].slice(0, 5);
}

function findSchemaFiles(symbols: SymbolRecord[]): string[] {
  return [...new Set(
    symbols
      .filter(s => s.file.includes("schema"))
      .map(s => s.file)
  )].slice(0, 5);
}

function findAuthFiles(risk: RiskMap): string[] {
  return Object.entries(risk)
    .filter(([_, r]) => r && r.tags && r.tags.includes("auth"))
    .map(([f]) => f)
    .slice(0, 10);
}

function findPaymentFiles(risk: RiskMap): string[] {
  return Object.entries(risk)
    .filter(([_, r]) => r && r.tags && r.tags.includes("payments"))
    .map(([f]) => f)
    .slice(0, 10);
}
