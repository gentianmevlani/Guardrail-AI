import path from "node:path";
import type { VerifyResult, ScopeContract, SymbolRecord, DepsTruth } from "@guardrail-context/shared";
import { runCommand } from "./gates/commands.js";
import { scopeGate, readScope } from "./gates/scope.js";
import { symbolsGate } from "./gates/symbols.js";
import { versionsGate } from "./gates/versions.js";
import { readJsonSync } from "../truthpack/read.js";

export type VerifyOptions = {
  changedFiles?: string[];
  referencedSymbols?: string[];
  referencedPackages?: string[];
  commands?: string[];
  skipCommands?: boolean;
};

export async function verifyFast(repoRoot: string, opts?: VerifyOptions): Promise<VerifyResult> {
  const gates: VerifyResult["gates"] = [];
  const outDir = path.join(repoRoot, ".guardrail-context");

  // 1. Scope gate
  const changed = opts?.changedFiles ?? [];
  const scope = readScope(repoRoot);
  const sg = scopeGate(changed, scope);
  gates.push({ name: "scope", ok: sg.ok, details: sg.details });

  // 2. Symbol reality gate
  if (opts?.referencedSymbols?.length) {
    try {
      const symbols = readJsonSync<SymbolRecord[]>(outDir, "symbols.json");
      const symGate = symbolsGate(opts.referencedSymbols, symbols);
      gates.push({ name: "symbols", ok: symGate.ok, details: symGate.details });
    } catch {
      gates.push({ name: "symbols", ok: true, details: "No symbol index found, skipping" });
    }
  }

  // 3. Version constraint gate
  if (opts?.referencedPackages?.length) {
    try {
      const deps = readJsonSync<DepsTruth>(outDir, "deps.json");
      const verGate = versionsGate(opts.referencedPackages, deps);
      gates.push({ name: "versions", ok: verGate.ok, details: verGate.details });
    } catch {
      gates.push({ name: "versions", ok: true, details: "No deps index found, skipping" });
    }
  }

  // 4. Command gates (lint/typecheck/test)
  if (!opts?.skipCommands) {
    const cmds = opts?.commands ?? getDefaultCommands(repoRoot);
    for (const cmd of cmds) {
      const r = runCommand(cmd, repoRoot);
      gates.push({ name: `cmd:${cmd}`, ok: r.ok, details: r.ok ? undefined : r.out.slice(0, 2000) });
      if (!r.ok) break; // Stop on first failure
    }
  }

  return { ok: gates.every(g => g.ok), gates };
}

function getDefaultCommands(repoRoot: string): string[] {
  // v1: minimal set of commands
  return [
    "npm run typecheck --if-present",
    "npm run lint --if-present",
  ];
}

export async function verifyDeep(repoRoot: string, opts?: VerifyOptions): Promise<VerifyResult> {
  // Deep verify includes tests
  const result = await verifyFast(repoRoot, {
    ...opts,
    commands: [
      ...(opts?.commands ?? []),
      "npm run typecheck --if-present",
      "npm run lint --if-present",
      "npm test --if-present",
    ]
  });
  return result;
}
