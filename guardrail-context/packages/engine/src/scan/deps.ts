import fs from "node:fs";
import path from "node:path";
import type { DepsTruth } from "@guardrail-context/shared";

export async function scanDeps(repoRoot: string): Promise<DepsTruth> {
  const out: DepsTruth = { lockfile: { type: "unknown" } };

  // Check multiple possible package.json locations (monorepo support)
  const pkgPaths = [
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "client", "package.json"),
    path.join(repoRoot, "server", "package.json"),
    path.join(repoRoot, "packages", "app", "package.json"),
  ];

  const allDeps: Record<string, string> = {};
  const allDevDeps: Record<string, string> = {};
  const allPeerDeps: Record<string, string> = {};

  for (const pkgPath of pkgPaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf8"));
        Object.assign(allDeps, pkg.dependencies ?? {});
        Object.assign(allDevDeps, pkg.devDependencies ?? {});
        Object.assign(allPeerDeps, pkg.peerDependencies ?? {});
      } catch {}
    }
  }

  out.packageJson = {
    dependencies: allDeps,
    devDependencies: allDevDeps,
    peerDependencies: allPeerDeps,
  };

  // Detect lockfile
  const candidates: Array<[DepsTruth["lockfile"]["type"], string]> = [
    ["pnpm", "pnpm-lock.yaml"],
    ["npm", "package-lock.json"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lockb"]
  ];

  for (const [type, file] of candidates) {
    const p = path.join(repoRoot, file);
    if (fs.existsSync(p)) {
      out.lockfile = { type, path: file };
      break;
    }
  }

  return out;
}

export function isVersionAllowed(deps: DepsTruth, pkg: string, requested?: string): { allowed: boolean; declared?: string } {
  const all = {
    ...(deps.packageJson?.dependencies ?? {}),
    ...(deps.packageJson?.devDependencies ?? {}),
    ...(deps.packageJson?.peerDependencies ?? {})
  };
  
  const declared = all[pkg];
  if (!declared) {
    return { allowed: false };
  }
  
  // If no specific version requested, just check if package exists
  if (!requested) {
    return { allowed: true, declared };
  }
  
  // v1: check if requested version is compatible with declared
  // For now, we just check if it's declared at all
  return { allowed: true, declared };
}

export function getInstalledPackages(deps: DepsTruth): string[] {
  const all = {
    ...(deps.packageJson?.dependencies ?? {}),
    ...(deps.packageJson?.devDependencies ?? {}),
    ...(deps.packageJson?.peerDependencies ?? {})
  };
  return Object.keys(all);
}
