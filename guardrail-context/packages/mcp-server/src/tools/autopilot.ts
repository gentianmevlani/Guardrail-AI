import path from "node:path";
import { readJsonSync, truthPackExists, classifyIntent, generateAutopilotContext } from "@guardrail-context/engine";
import type { PatternsMap, RoutesMap } from "@guardrail-context/engine";
import type { SymbolRecord, RiskMap } from "@guardrail-context/shared";

export async function autopilotTool(repoRoot: string, prompt: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  try {
    const patterns = readJsonSync<PatternsMap>(outDir, "patterns.json");
    const routes = readJsonSync<RoutesMap>(outDir, "routes.json");
    const symbols = readJsonSync<SymbolRecord[]>(outDir, "symbols.json");
    const risk = readJsonSync<RiskMap>(outDir, "risk.json");

    const context = generateAutopilotContext(prompt, patterns, routes, symbols, risk);

    return {
      intent: context.intent,
      confidence: Math.round(context.confidence * 100) + "%",
      riskLevel: context.riskLevel,
      pattern: context.suggestedPattern ? {
        name: context.suggestedPattern.name,
        file: context.suggestedPattern.file,
        code: context.suggestedPattern.code.substring(0, 400)
      } : null,
      requiredFiles: context.requiredFiles,
      forbiddenFiles: context.forbiddenFiles,
      requiredTests: context.requiredTests,
      warnings: context.warnings,
      proof: context.proof,
      message: formatAutopilotMessage(context)
    };
  } catch (e: any) {
    return { error: `Autopilot failed: ${e.message}` };
  }
}

export async function intentTool(repoRoot: string, prompt: string) {
  const { intent, confidence } = classifyIntent(prompt);
  
  return {
    intent,
    confidence: Math.round(confidence * 100) + "%",
    message: confidence > 0.5 
      ? `Detected intent: ${intent} (${Math.round(confidence * 100)}% confident)`
      : `Low confidence intent: ${intent}. Please clarify your request.`
  };
}

function formatAutopilotMessage(context: any): string {
  const lines: string[] = [];
  
  lines.push(`🎯 Intent: ${context.intent} (${Math.round(context.confidence * 100)}% confident)`);
  lines.push(`🚦 Risk Level: ${context.riskLevel.toUpperCase()}`);
  
  if (context.warnings.length > 0) {
    lines.push("");
    lines.push("⚠️ WARNINGS:");
    for (const w of context.warnings) {
      lines.push(`  ${w}`);
    }
  }

  if (context.suggestedPattern) {
    lines.push("");
    lines.push(`📋 Use pattern from: ${context.suggestedPattern.file}`);
  }

  if (context.requiredTests.length > 0) {
    lines.push("");
    lines.push(`🧪 Required tests: ${context.requiredTests.join(", ")}`);
  }

  return lines.join("\n");
}
