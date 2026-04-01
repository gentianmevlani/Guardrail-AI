import path from "node:path";
import { readJsonSync, truthPackExists } from "@guardrail-context/engine";
import type { TruthPack, RiskMap, Importance } from "@guardrail-context/shared";

export async function repoMapTool(repoRoot: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return {
      error: "Truth Pack not found. Run 'guardrail-context index' first.",
      indexed: false
    };
  }

  const pack = readJsonSync<TruthPack>(outDir, "truthpack.json");
  const risk = readJsonSync<RiskMap>(outDir, "risk.json");
  const importance = readJsonSync<Importance>(outDir, "importance.json");

  // Get top critical files
  const topFiles = Object.entries(importance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([file, score]) => ({ file, score: Math.round(score * 100) / 100 }));

  // Get high-risk files by category
  const riskByTag: Record<string, string[]> = {};
  for (const [file, r] of Object.entries(risk)) {
    for (const tag of r.tags) {
      if (!riskByTag[tag]) riskByTag[tag] = [];
      if (riskByTag[tag].length < 5) riskByTag[tag].push(file);
    }
  }

  return {
    indexed: true,
    generatedAt: pack.generatedAt,
    repoRoot: pack.repoRoot,
    stack: pack.stack,
    files: pack.files,
    criticalFiles: topFiles,
    riskMap: riskByTag,
  };
}
