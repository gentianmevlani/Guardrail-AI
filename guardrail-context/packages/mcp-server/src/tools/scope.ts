import fs from "node:fs";
import path from "node:path";
import { truthPackExists } from "@guardrail-context/engine";
import type { ScopeContract } from "@guardrail-context/shared";

export async function scopeDeclareTool(
  repoRoot: string, 
  allowedGlobs: string[], 
  forbiddenGlobs?: string[],
  requiredTests?: string[]
) {
  const scopePath = path.join(repoRoot, ".guardrail-scope.json");
  
  const contract: ScopeContract = {
    allowedGlobs,
    forbiddenGlobs: forbiddenGlobs || [],
    requiredTests: requiredTests || []
  };

  await fs.promises.writeFile(scopePath, JSON.stringify(contract, null, 2), "utf8");

  return {
    declared: true,
    scope: contract,
    message: `✅ Scope contract declared. Only files matching these patterns are allowed:\n${allowedGlobs.map(g => `  - ${g}`).join("\n")}`
  };
}

export async function scopeCheckTool(repoRoot: string, files: string[]) {
  const scopePath = path.join(repoRoot, ".guardrail-scope.json");
  
  if (!fs.existsSync(scopePath)) {
    return {
      hasScope: false,
      message: "No scope contract declared. Use scope_declare first to limit changes."
    };
  }

  const contract: ScopeContract = JSON.parse(await fs.promises.readFile(scopePath, "utf8"));
  const violations: string[] = [];
  const allowed: string[] = [];

  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, "/");
    
    // Check forbidden first
    for (const glob of contract.forbiddenGlobs || []) {
      if (matchGlob(normalizedFile, glob)) {
        violations.push(`FORBIDDEN: ${file} matches ${glob}`);
      }
    }

    // Check if allowed
    const isAllowed = contract.allowedGlobs.some(glob => matchGlob(normalizedFile, glob));
    if (isAllowed) {
      allowed.push(file);
    } else if (!violations.some(v => v.includes(file))) {
      violations.push(`OUT OF SCOPE: ${file} not in allowed patterns`);
    }
  }

  if (violations.length > 0) {
    return {
      hasScope: true,
      ok: false,
      violations,
      allowed,
      message: `❌ SCOPE VIOLATION:\n${violations.join("\n")}\n\nDo NOT modify these files.`
    };
  }

  return {
    hasScope: true,
    ok: true,
    allowed,
    message: `✅ All ${files.length} files are within scope.`
  };
}

export async function scopeClearTool(repoRoot: string) {
  const scopePath = path.join(repoRoot, ".guardrail-scope.json");
  
  if (fs.existsSync(scopePath)) {
    await fs.promises.unlink(scopePath);
    return { cleared: true, message: "Scope contract cleared." };
  }
  
  return { cleared: false, message: "No scope contract was set." };
}

function matchGlob(str: string, glob: string): boolean {
  const normalizedGlob = glob.replace(/\\/g, "/");
  const re = new RegExp("^" + normalizedGlob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".") + "$");
  return re.test(str);
}
