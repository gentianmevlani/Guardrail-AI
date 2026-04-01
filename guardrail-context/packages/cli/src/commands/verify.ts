import { verifyFast, truthPackExists } from "@guardrail-context/engine";
import { execSync } from "node:child_process";

export async function cmdVerify(repoRoot: string) {
  console.log("🔍 Running verification gates...\n");

  if (!truthPackExists(repoRoot)) {
    console.error("❌ No Truth Pack found. Run 'guardrail-context index' first.");
    process.exit(1);
  }

  // Get changed files from git
  const changedFiles = getChangedFiles(repoRoot);
  if (changedFiles.length > 0) {
    console.log(`  Changed files: ${changedFiles.length}`);
  }

  const result = await verifyFast(repoRoot, {
    changedFiles,
    skipCommands: false,
  });

  console.log("\n📋 Gate Results:\n");

  for (const gate of result.gates) {
    const icon = gate.ok ? "✅" : "❌";
    console.log(`  ${icon} ${gate.name}`);
    if (gate.details && !gate.ok) {
      console.log(`     ${gate.details.split("\n")[0]}`);
    }
  }

  console.log("");

  if (result.ok) {
    console.log("✅ All verification gates passed!\n");
    process.exit(0);
  } else {
    console.log("❌ Verification failed. Fix the issues above.\n");
    process.exit(1);
  }
}

function getChangedFiles(cwd: string): string[] {
  try {
    const staged = execSync("git diff --cached --name-only", { cwd, encoding: "utf8" });
    const unstaged = execSync("git diff --name-only", { cwd, encoding: "utf8" });
    const files = new Set([
      ...staged.split("\n").filter(Boolean),
      ...unstaged.split("\n").filter(Boolean),
    ]);
    return [...files];
  } catch {
    return [];
  }
}
