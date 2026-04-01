/**
 * Status model - reads current guardrail state
 * Used by menu and status commands
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export type GuardrailStatus = {
  repoPath: string;
  truthPack: { exists: boolean; ageSec?: number; symbolCount?: number };
  telemetry: { exists: boolean; events24h?: number; hallucinationsBlocked?: number };
  auth: { tier: "free" | "pro" | "enterprise" | "unknown"; keyPresent: boolean };
  contextMode: { running: boolean; pid?: number };
};

function fileAgeSec(p: string): number | undefined {
  try {
    const st = fs.statSync(p);
    return Math.floor((Date.now() - st.mtimeMs) / 1000);
  } catch {
    return undefined;
  }
}

export function readStatus(repoPath: string): GuardrailStatus {
  const truthpackPath = path.join(repoPath, ".guardrail-context", "truthpack.json");
  const symbolsPath = path.join(repoPath, ".guardrail-context", "symbols.json");
  const ledgerPath = path.join(repoPath, ".guardrail", "telemetry", "context-events.ndjson");
  const pidPath = path.join(repoPath, ".guardrail", "runtime", "context.pid");
  
  // Global auth file (in user home)
  const authFile = path.join(os.homedir(), ".guardrail", "auth.json");

  // Truth Pack status
  const truthExists = fs.existsSync(truthpackPath);
  const truthAge = truthExists ? fileAgeSec(truthpackPath) : undefined;
  let symbolCount: number | undefined;
  if (fs.existsSync(symbolsPath)) {
    try {
      const symbols = JSON.parse(fs.readFileSync(symbolsPath, "utf8"));
      symbolCount = Array.isArray(symbols) ? symbols.length : undefined;
    } catch {}
  }

  // Telemetry status
  const ledgerExists = fs.existsSync(ledgerPath);
  let events24h = 0;
  let hallucinationsBlocked = 0;
  if (ledgerExists) {
    const stats = countEventsSince(ledgerPath, 24 * 3600);
    events24h = stats.total;
    hallucinationsBlocked = stats.hallucinations;
  }

  // Auth status
  let tier: GuardrailStatus["auth"]["tier"] = "free";
  let keyPresent = false;
  if (fs.existsSync(authFile)) {
    try {
      const a = JSON.parse(fs.readFileSync(authFile, "utf8"));
      tier = a?.tier ?? "free";
      keyPresent = Boolean(a?.apiKey);
    } catch {}
  }

  // Context Mode running status
  let running = false;
  let pid: number | undefined;
  if (fs.existsSync(pidPath)) {
    try {
      const pidStr = fs.readFileSync(pidPath, "utf8").trim();
      pid = parseInt(pidStr, 10);
      if (pid && isProcessRunning(pid)) {
        running = true;
      }
    } catch {}
  }

  return {
    repoPath,
    truthPack: { exists: truthExists, ageSec: truthAge, symbolCount },
    telemetry: { exists: ledgerExists, events24h, hallucinationsBlocked },
    auth: { tier, keyPresent },
    contextMode: { running, pid },
  };
}

function countEventsSince(file: string, seconds: number): { total: number; hallucinations: number } {
  const cutoff = Date.now() - seconds * 1000;
  let total = 0;
  let hallucinations = 0;
  
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        const ts = new Date(j.ts ?? j.timestamp ?? 0).getTime();
        if (Number.isFinite(ts) && ts >= cutoff) {
          total++;
          if (j.blocked || j.resultType === "blocked") {
            hallucinations++;
          }
        }
      } catch {}
    }
  } catch {}
  
  return { total, hallucinations };
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function formatAge(ageSec?: number): string {
  if (ageSec == null) return "?";
  if (ageSec < 60) return `${ageSec}s ago`;
  const m = Math.floor(ageSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
