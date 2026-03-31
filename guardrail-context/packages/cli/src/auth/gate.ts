/**
 * Payment Gate - API key verification for paid features
 * Free tier: on, checkpoint (limited), stats
 * Paid tier: ship (full), checkpoint (unlimited)
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type Tier = "free" | "pro" | "enterprise";

export interface AuthState {
  authenticated: boolean;
  tier: Tier;
  apiKey?: string;
  email?: string;
  expiresAt?: string;
  checkpointsToday?: number;
  checkpointLimit?: number;
}

const CONFIG_DIR = path.join(os.homedir(), ".guardrail");
const AUTH_FILE = path.join(CONFIG_DIR, "auth.json");

const FREE_CHECKPOINT_LIMIT = 5;

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

export function getAuthState(): AuthState {
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      authenticated: false,
      tier: "free",
      checkpointsToday: 0,
      checkpointLimit: FREE_CHECKPOINT_LIMIT,
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    return {
      authenticated: !!data.apiKey,
      tier: data.tier || "free",
      apiKey: data.apiKey,
      email: data.email,
      expiresAt: data.expiresAt,
      checkpointsToday: data.checkpointsToday || 0,
      checkpointLimit: data.tier === "free" ? FREE_CHECKPOINT_LIMIT : Infinity,
    };
  } catch {
    return {
      authenticated: false,
      tier: "free",
      checkpointsToday: 0,
      checkpointLimit: FREE_CHECKPOINT_LIMIT,
    };
  }
}

export function saveAuthState(state: Partial<AuthState>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const existing = getAuthState();
  const updated = { ...existing, ...state };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(updated, null, 2), "utf-8");
}

export function incrementCheckpoints(): boolean {
  const state = getAuthState();
  
  if (state.tier !== "free") {
    return true; // Paid users have unlimited
  }

  const today = new Date().toDateString();
  const savedDate = state.expiresAt; // Reusing for daily reset tracking
  
  if (savedDate !== today) {
    // New day, reset counter
    saveAuthState({ checkpointsToday: 1, expiresAt: today });
    return true;
  }

  if ((state.checkpointsToday || 0) >= FREE_CHECKPOINT_LIMIT) {
    return false; // Limit reached
  }

  saveAuthState({ checkpointsToday: (state.checkpointsToday || 0) + 1 });
  return true;
}

export function requirePaidTier(feature: string): boolean {
  const state = getAuthState();

  if (state.tier === "free") {
    printUpgradePrompt(feature);
    return false;
  }

  return true;
}

export function checkShipAccess(): { allowed: boolean; reason?: string } {
  const state = getAuthState();

  if (state.tier === "free") {
    return {
      allowed: false,
      reason: "Ship verdicts require a Pro subscription",
    };
  }

  // Check if subscription is expired
  if (state.expiresAt && new Date(state.expiresAt) < new Date()) {
    return {
      allowed: false,
      reason: "Your subscription has expired",
    };
  }

  return { allowed: true };
}

function printUpgradePrompt(feature: string): void {
  console.log(`
${ANSI.yellow}╔═══════════════════════════════════════════════════════════╗
║                    UPGRADE REQUIRED                        ║
╚═══════════════════════════════════════════════════════════╝${ANSI.reset}

${ANSI.bold}${feature}${ANSI.reset} requires a Pro subscription.

${ANSI.bold}What you get with Pro ($29/mo):${ANSI.reset}
  ${ANSI.green}✓${ANSI.reset} Unlimited checkpoints (free: ${FREE_CHECKPOINT_LIMIT}/day)
  ${ANSI.green}✓${ANSI.reset} Ship verdicts with GO/WARN/NO-GO
  ${ANSI.green}✓${ANSI.reset} Auto-fix for common issues
  ${ANSI.green}✓${ANSI.reset} HTML/PDF shareable reports
  ${ANSI.green}✓${ANSI.reset} CI/CD integration

${ANSI.cyan}Upgrade: https://guardrailai.dev/upgrade${ANSI.reset}

${ANSI.dim}Or run: guardrail login${ANSI.reset}
`);
}

export function printFreeStats(state: AuthState): void {
  if (state.tier === "free") {
    const remaining = FREE_CHECKPOINT_LIMIT - (state.checkpointsToday || 0);
    console.log(`${ANSI.dim}Free tier: ${remaining}/${FREE_CHECKPOINT_LIMIT} checkpoints remaining today${ANSI.reset}`);
  }
}

export async function login(apiKey: string): Promise<boolean> {
  // In production, this would validate against the API
  // For now, we accept keys that start with "gr_"
  if (!apiKey.startsWith("gr_")) {
    console.log(`${ANSI.red}Invalid API key format${ANSI.reset}`);
    return false;
  }

  const tier: Tier = apiKey.startsWith("gr_pro_") ? "pro" : 
                     apiKey.startsWith("gr_ent_") ? "enterprise" : "free";

  saveAuthState({
    authenticated: true,
    apiKey,
    tier,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  });

  console.log(`${ANSI.green}✓ Logged in as ${tier} tier${ANSI.reset}`);
  return true;
}

export function logout(): void {
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
  console.log(`${ANSI.green}✓ Logged out${ANSI.reset}`);
}
