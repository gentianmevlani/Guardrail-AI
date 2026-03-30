import { verifyFast, verifyDeep, type VerifyOptions } from "@guardrail-context/engine";

export async function verifyFastTool(repoRoot: string, opts?: {
  changedFiles?: string[];
  referencedSymbols?: string[];
  referencedPackages?: string[];
}) {
  const result = await verifyFast(repoRoot, {
    changedFiles: opts?.changedFiles,
    referencedSymbols: opts?.referencedSymbols,
    referencedPackages: opts?.referencedPackages,
    skipCommands: true, // Fast mode skips commands
  });

  return {
    ok: result.ok,
    gates: result.gates,
    message: result.ok 
      ? "✅ All verification gates passed."
      : `❌ Verification failed. Fix the issues below:\n${result.gates.filter(g => !g.ok).map(g => `- ${g.name}: ${g.details}`).join("\n")}`
  };
}

export async function verifyDeepTool(repoRoot: string, opts?: {
  changedFiles?: string[];
}) {
  const result = await verifyDeep(repoRoot, {
    changedFiles: opts?.changedFiles,
  });

  return {
    ok: result.ok,
    gates: result.gates,
    message: result.ok 
      ? "✅ All verification gates passed (including tests)."
      : `❌ Deep verification failed:\n${result.gates.filter(g => !g.ok).map(g => `- ${g.name}: ${g.details?.slice(0, 500)}`).join("\n")}`
  };
}
