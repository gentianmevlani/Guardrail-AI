import fs from "node:fs";
import path from "node:path";
import { truthPackExists } from "@guardrail-context/engine";

export async function cmdDoctor(repoRoot: string) {
  console.log("🩺 Diagnosing guardrail Context Engine setup...\n");

  const checks: Array<{ name: string; ok: boolean; details?: string }> = [];

  // Check Truth Pack
  const hasTruthPack = truthPackExists(repoRoot);
  checks.push({
    name: "Truth Pack exists",
    ok: hasTruthPack,
    details: hasTruthPack ? ".guardrail-context/ found" : "Run 'guardrail-context index'"
  });

  // Check individual Truth Pack files
  if (hasTruthPack) {
    const outDir = path.join(repoRoot, ".guardrail-context");
    const files = ["truthpack.json", "symbols.json", "deps.json", "graph.json", "patterns.json"];
    
    for (const file of files) {
      const exists = fs.existsSync(path.join(outDir, file));
      checks.push({
        name: `${file} exists`,
        ok: exists,
        details: exists ? undefined : "Missing - run 'guardrail-context index'"
      });
    }
  }

  // Check rules files
  const rulesFiles = [
    ".github/copilot-instructions.md",
    ".windsurf/rules/guardrail.md",
    ".cursor/rules.md",
  ];

  for (const file of rulesFiles) {
    const exists = fs.existsSync(path.join(repoRoot, file));
    checks.push({
      name: `${file} exists`,
      ok: exists,
      details: exists ? undefined : "Run 'guardrail-context init'"
    });
  }

  // Check package.json
  const pkgPath = path.join(repoRoot, "package.json");
  const hasPkg = fs.existsSync(pkgPath);
  checks.push({
    name: "package.json exists",
    ok: hasPkg,
    details: hasPkg ? undefined : "Not a Node.js project"
  });

  // Print results
  console.log("📋 Diagnostic Results:\n");

  let allOk = true;
  for (const check of checks) {
    const icon = check.ok ? "✅" : "❌";
    console.log(`  ${icon} ${check.name}`);
    if (check.details) {
      console.log(`     ${check.details}`);
    }
    if (!check.ok) allOk = false;
  }

  console.log("");

  if (allOk) {
    console.log("✅ All checks passed! guardrail Context Engine is ready.\n");
    console.log("Start the MCP server with: guardrail-context serve\n");
  } else {
    console.log("⚠️  Some checks failed. Follow the suggestions above.\n");
  }
}
