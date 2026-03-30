import type { DepsTruth } from "@guardrail-context/shared";
import type { GateResult } from "./scope.js";

export function versionsGate(referencedPackages: string[], deps: DepsTruth): GateResult {
  const allDeps = {
    ...(deps.packageJson?.dependencies ?? {}),
    ...(deps.packageJson?.devDependencies ?? {}),
    ...(deps.packageJson?.peerDependencies ?? {})
  };

  const missing: string[] = [];

  for (const pkg of referencedPackages) {
    if (!allDeps[pkg]) {
      missing.push(pkg);
    }
  }

  if (missing.length) {
    return {
      ok: false,
      details: `Missing packages (not installed):\n${missing.slice(0, 30).join(", ")}`
    };
  }

  return { ok: true, details: "All referenced packages are installed" };
}

export function findMissingPackages(referencedPackages: string[], deps: DepsTruth): string[] {
  const allDeps = {
    ...(deps.packageJson?.dependencies ?? {}),
    ...(deps.packageJson?.devDependencies ?? {}),
    ...(deps.packageJson?.peerDependencies ?? {})
  };
  
  return referencedPackages.filter(pkg => !allDeps[pkg]);
}
