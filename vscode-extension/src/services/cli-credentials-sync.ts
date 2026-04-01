/**
 * Writes the same on-disk credential file the Guardrail CLI reads (see packages/cli creds.ts).
 * Lets one VS Code login populate `guardrail scan` without pasting an API key again.
 *
 * When the CLI has stored secrets in the OS keychain, `guardrail logout` clears them so
 * the new file-based key is picked up on the next run.
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { spawn } from "child_process";
<<<<<<< HEAD
import type { CliCredentialState, ProductTier } from "@guardrail/core/unified-auth";
import { normalizeTier } from "@guardrail/core/unified-auth";
=======

export type CliTier = "free" | "starter" | "pro" | "enterprise";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

function getCliConfigDir(): string {
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "guardrail",
    );
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "guardrail");
  }
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "guardrail",
  );
}

const CONFIG_FILE = path.join(getCliConfigDir(), "state.json");

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, data, { encoding: "utf8", mode: 0o600 });
  if (process.platform !== "win32") {
    await fs.chmod(tmp, 0o600).catch(() => {});
  }
  await fs.rename(tmp, filePath);
}

<<<<<<< HEAD
export type { CliCredentialState, ProductTier as CliTier };
=======
function planToTier(plan: string | undefined): CliTier {
  const p = (plan || "free").toLowerCase();
  if (p.includes("enterprise")) return "enterprise";
  if (p.includes("pro") || p.includes("team")) return "pro";
  if (p.includes("starter")) return "starter";
  return "free";
}
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

export interface SyncCliCredentialsInput {
  apiKey: string;
  email?: string;
  planLabel?: string;
}

/**
 * Persist API key for the CLI (same path as guardrail-cli-tool state.json).
 */
export async function syncCliCredentialsFromExtension(
  input: SyncCliCredentialsInput,
): Promise<void> {
  const cacheUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const authenticatedAt = new Date().toISOString();
<<<<<<< HEAD
  const state: CliCredentialState = {
    apiKey: input.apiKey,
    tier: normalizeTier(input.planLabel),
=======
  const state = {
    apiKey: input.apiKey,
    tier: planToTier(input.planLabel),
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    email: input.email ?? "",
    authenticatedAt,
    cacheUntil,
  };
  await atomicWrite(CONFIG_FILE, JSON.stringify(state, null, 2));
}

/** Clear on-disk CLI state (empty object). */
export async function clearCliCredentialsFile(): Promise<void> {
  await atomicWrite(CONFIG_FILE, JSON.stringify({}, null, 2));
}

export function getCliStateFilePathForDisplay(): string {
  return CONFIG_FILE;
}

<<<<<<< HEAD
/** Same `state.json` the CLI reads after extension sync (`tier`, `email`, `apiKey`). */
export async function readCliGuardrailState(): Promise<{
  tier?: string;
  email?: string;
} | null> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    const j = JSON.parse(raw) as { tier?: string; email?: string };
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
/**
 * Run `guardrail logout` if the CLI is on PATH — clears OS keychain entry so file-based
 * credentials from the extension take effect.
 */
export function trySpawnGuardrailLogout(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("guardrail", ["logout"], {
      shell: process.platform === "win32",
      stdio: "ignore",
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
