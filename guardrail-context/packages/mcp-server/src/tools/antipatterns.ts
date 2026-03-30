import path from "node:path";
import { readJsonSync, truthPackExists } from "@guardrail-context/engine";
import type { AntiPatternMuseum } from "@guardrail-context/engine";

export async function antipatternsScanTool(repoRoot: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  try {
    const museum = readJsonSync<AntiPatternMuseum>(outDir, "antipatterns.json");
    
    return {
      summary: museum.summary,
      critical: museum.bySeverity.critical.slice(0, 10).map(formatInstance),
      high: museum.bySeverity.high.slice(0, 10).map(formatInstance),
      message: museum.summary.critical > 0 
        ? `🚨 CRITICAL: ${museum.summary.critical} critical anti-patterns found! Fix immediately.`
        : museum.summary.high > 0
        ? `⚠️ WARNING: ${museum.summary.high} high-severity anti-patterns found.`
        : `✅ No critical anti-patterns found. ${museum.summary.total} total issues.`
    };
  } catch {
    return { 
      error: "Anti-patterns not indexed. Run 'guardrail-context index' to scan.",
      indexed: false
    };
  }
}

export async function antipatternsCheckTool(repoRoot: string, file: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  try {
    const museum = readJsonSync<AntiPatternMuseum>(outDir, "antipatterns.json");
    const fileInstances = museum.instances.filter(i => 
      i.file === file || i.file.endsWith(file)
    );

    if (fileInstances.length === 0) {
      return {
        file,
        clean: true,
        message: `✅ No anti-patterns found in ${file}`
      };
    }

    return {
      file,
      clean: false,
      issues: fileInstances.map(formatInstance),
      message: `⚠️ Found ${fileInstances.length} anti-patterns in ${file}. Fix before committing.`
    };
  } catch {
    return { error: "Anti-patterns not indexed." };
  }
}

function formatInstance(inst: any) {
  return {
    pattern: inst.patternName,
    severity: inst.severity,
    line: inst.line,
    match: inst.match,
    fix: inst.suggestedFix,
    proof: inst.proof
  };
}
