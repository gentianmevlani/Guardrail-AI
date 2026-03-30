import path from "node:path";
import { readJsonSync, truthPackExists } from "@guardrail-context/engine";
import type { DepsTruth } from "@guardrail-context/shared";

export async function versionsAllowedTool(repoRoot: string, pkg: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  const deps = readJsonSync<DepsTruth>(outDir, "deps.json");
  
  const allDeps = {
    ...(deps.packageJson?.dependencies ?? {}),
    ...(deps.packageJson?.devDependencies ?? {}),
    ...(deps.packageJson?.peerDependencies ?? {})
  };

  const version = allDeps[pkg];

  if (version) {
    return {
      allowed: true,
      package: pkg,
      version,
      proof: "package.json",
      message: `Package ${pkg}@${version} is installed.`
    };
  }

  return {
    allowed: false,
    package: pkg,
    message: `Package "${pkg}" is NOT installed. DO NOT suggest using it.`,
    suggestion: "Check if a similar package is installed or ask user to install it first."
  };
}
