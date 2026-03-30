import path from "node:path";
import { readJsonSync, truthPackExists, pickPattern } from "@guardrail-context/engine";
import type { PatternsMap } from "@guardrail-context/engine";

export async function patternsPickTool(repoRoot: string, intent: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const patterns = readJsonSync<PatternsMap>(outDir, "patterns.json");
  const pattern = pickPattern(patterns, intent);

  if (pattern) {
    return {
      found: true,
      intent,
      pattern: {
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        file: pattern.file,
        code: pattern.code,
        tags: pattern.tags
      },
      message: `Use this verified pattern from ${pattern.file}. Follow the existing style.`
    };
  }

  return {
    found: false,
    intent,
    availablePatterns: Object.keys(patterns),
    message: `No pattern found for "${intent}". Available patterns: ${Object.keys(patterns).join(", ")}`,
    suggestion: "Try a different intent or check the available patterns list."
  };
}
