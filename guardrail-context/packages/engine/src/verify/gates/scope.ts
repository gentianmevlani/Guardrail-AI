import fs from "node:fs";
import path from "node:path";
import type { ScopeContract } from "@guardrail-context/shared";

export function readScope(repoRoot: string): ScopeContract | null {
  const p = path.join(repoRoot, ".guardrail-scope.json");
  if (!fs.existsSync(p)) return null;
  
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeScope(repoRoot: string, scope: ScopeContract): void {
  const p = path.join(repoRoot, ".guardrail-scope.json");
  fs.writeFileSync(p, JSON.stringify(scope, null, 2), "utf8");
}

export type GateResult = {
  ok: boolean;
  details: string;
};

export function scopeGate(changedFiles: string[], scope: ScopeContract | null): GateResult {
  if (!scope) {
    return { ok: true, details: "No scope contract present - all files allowed" };
  }

  const { allowedGlobs, forbiddenGlobs } = scope;
  const violations: string[] = [];

  for (const file of changedFiles) {
    // Check forbidden first
    if (forbiddenGlobs?.length) {
      for (const glob of forbiddenGlobs) {
        if (matchGlob(file, glob)) {
          violations.push(`FORBIDDEN: ${file} matches ${glob}`);
        }
      }
    }

    // Then check if allowed
    if (allowedGlobs.length) {
      const isAllowed = allowedGlobs.some(glob => matchGlob(file, glob));
      if (!isAllowed) {
        violations.push(`OUT OF SCOPE: ${file} not in allowed paths`);
      }
    }
  }

  if (violations.length) {
    return { 
      ok: false, 
      details: `Scope violations:\n${violations.slice(0, 20).join("\n")}` 
    };
  }

  return { ok: true, details: "All changes within scope" };
}

function matchGlob(str: string, glob: string): boolean {
  // Normalize paths
  const normalizedStr = str.replace(/\\/g, "/");
  const normalizedGlob = glob.replace(/\\/g, "/");
  
  // Convert glob to regex
  const re = new RegExp("^" + normalizedGlob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".") + "$");
  
  return re.test(normalizedStr);
}
