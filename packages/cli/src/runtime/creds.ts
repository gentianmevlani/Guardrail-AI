/**
 * Enterprise Credential Store
 * - OS keychain first (Keychain/Windows Credential Manager/libsecret)
 * - Secure fallback with 0600 perms + atomic writes
 * - Token-first model (short-lived tokens preferred over static API keys)
 */

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';

export type Tier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface AuthState {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tier?: Tier;
  email?: string;
  entitlements?: string[];
  authenticatedAt?: string;
  cacheUntil?: string; // ISO timestamp - short cache for entitlements
  expiresAt?: string; // ISO timestamp - when entitlements expire (from server)
  issuedAt?: string; // ISO timestamp - when credentials were issued
}

const SERVICE = 'guardrail-cli-tool';
const ACCOUNT = 'default';

function getConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'guardrail'
    );
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'guardrail');
  }
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'guardrail'
  );
}

const CONFIG_DIR = getConfigDir();
const CONFIG_FILE = path.join(CONFIG_DIR, 'state.json');

/**
 * Try to load keytar for OS keychain access
 * Returns null if keytar is not available
 */
async function tryKeytar(): Promise<any | null> {
  try {
    return require('keytar');
  } catch {
    return null;
  }
}

/**
 * Atomic write with restrictive permissions
 * Prevents partial writes and race conditions
 * Security: 0600 on Unix, NTFS ACL restriction on Windows (best effort)
 */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  
  // Write with restrictive mode on Unix
  await fs.writeFile(tmp, data, { encoding: 'utf8', mode: 0o600 });

  // Lock down permissions
  if (process.platform !== 'win32') {
    // Unix: 0600 = owner read/write only
    await fs.chmod(tmp, 0o600);
  } else {
    // Windows: Best effort - use icacls to restrict access
    // This is a no-op if it fails, as Windows file permissions are complex
    try {
      const { exec } = await import('child_process');
      const username = process.env.USERNAME || process.env.USER;
      if (username) {
        await new Promise<void>((resolve) => {
          exec(
            `icacls "${tmp}" /inheritance:r /grant:r "${username}:F"`,
            { windowsHide: true },
            () => resolve() // Ignore errors
          );
        });
      }
    } catch {
      // Windows permission setting failed - continue anyway
    }
  }
  
  await fs.rename(tmp, filePath);
  
  // Also secure the directory on Unix
  if (process.platform !== 'win32') {
    await fs.chmod(path.dirname(filePath), 0o700).catch(() => {});
  }
}

/**
 * Load authentication state
 * Prefers keychain for sensitive tokens, falls back to disk
 */
export async function loadAuthState(): Promise<AuthState> {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    const state = JSON.parse(raw) as AuthState;

    // If keychain is available, prefer tokens from there
    const keytar = await tryKeytar();
    if (keytar) {
      try {
        const secret = await keytar.getPassword(SERVICE, ACCOUNT);
        if (secret) {
          const fromKeychain = JSON.parse(secret) as Partial<AuthState>;
          return { ...state, ...fromKeychain };
        }
      } catch {
        // Keychain access failed, use disk state
      }
    }

    return state;
  } catch {
    return {};
  }
}

/**
 * Save authentication state
 * Stores sensitive tokens in keychain when available, non-sensitive data on disk
 */
export async function saveAuthState(next: AuthState): Promise<void> {
  // Separate sensitive from non-sensitive data
  const { accessToken, refreshToken, apiKey, ...diskSafe } = next;

  const keytar = await tryKeytar();
  if (keytar) {
    try {
      const secretPayload: Partial<AuthState> = { accessToken, refreshToken, apiKey };
      await keytar.setPassword(SERVICE, ACCOUNT, JSON.stringify(secretPayload));
    } catch {
      // Keychain save failed, store everything on disk
      (diskSafe as AuthState).apiKey = apiKey;
      (diskSafe as AuthState).accessToken = accessToken;
      (diskSafe as AuthState).refreshToken = refreshToken;
    }
  } else {
    // No keychain available: fall back to disk with tight perms
    (diskSafe as AuthState).apiKey = apiKey;
    (diskSafe as AuthState).accessToken = accessToken;
    (diskSafe as AuthState).refreshToken = refreshToken;
  }

  await atomicWrite(CONFIG_FILE, JSON.stringify(diskSafe, null, 2));
}

/**
 * Clear all authentication state (logout)
 */
export async function clearAuthState(): Promise<void> {
  const keytar = await tryKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE, ACCOUNT);
    } catch {
      // Keychain delete failed, continue anyway
    }
  }
  await atomicWrite(CONFIG_FILE, JSON.stringify({}, null, 2));
}

/**
 * Check if cached entitlements are still valid
 * Uses the shorter of cacheUntil (local) or expiresAt (server)
 */
export function isCacheValid(state: AuthState): boolean {
  if (!state.tier) return false;
  
  const now = new Date();
  
  // Check local cache expiry
  if (state.cacheUntil) {
    const cacheExpiry = new Date(state.cacheUntil);
    if (cacheExpiry <= now) return false;
  }
  
  // Check server-issued expiry
  if (state.expiresAt) {
    const serverExpiry = new Date(state.expiresAt);
    if (serverExpiry <= now) return false;
  }
  
  // At least one expiry must be set
  return Boolean(state.cacheUntil || state.expiresAt);
}

/**
 * Check if entitlements should be reused from cache
 * Returns true only if cache is valid AND has > 5 minutes remaining
 */
export function shouldUseCachedEntitlements(state: AuthState): boolean {
  if (!state.tier) return false;
  
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  
  // Check if local cache has > 5 min remaining
  if (state.cacheUntil) {
    const cacheExpiry = new Date(state.cacheUntil);
    if (cacheExpiry <= fiveMinutesFromNow) return false;
  }
  
  // Check if server expiry has > 5 min remaining
  if (state.expiresAt) {
    const serverExpiry = new Date(state.expiresAt);
    if (serverExpiry <= fiveMinutesFromNow) return false;
  }
  
  // At least one expiry must be set and valid
  return Boolean(state.cacheUntil || state.expiresAt);
}

/**
 * Get config directory path (for display purposes)
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}
