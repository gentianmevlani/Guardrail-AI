/**
 * Device Code Store
 *
 * In-memory store for device authorization codes.
 * Used by the device code flow to link CLI/VS Code to web accounts.
 *
 * In production, replace with Redis or database-backed store.
 */

import { randomBytes, randomUUID } from "crypto";

export type DeviceCodeStatus = "pending" | "authorized" | "expired" | "used";

export interface DeviceCodeEntry {
  deviceCode: string;
  userCode: string;
  clientType: "cli" | "vscode" | "unknown";
  status: DeviceCodeStatus;
  createdAt: Date;
  expiresAt: Date;
  /** Set when a logged-in user authorizes this code on the web */
  userId?: string;
  userEmail?: string;
  userName?: string;
  /** Tokens issued after authorization (set during poll pickup) */
  accessToken?: string;
  refreshToken?: string;
}

/** 10-minute expiry for device codes */
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;

/** Clean up expired entries every 60 seconds */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/** Store: deviceCode -> entry */
const store = new Map<string, DeviceCodeEntry>();

/** Index: userCode -> deviceCode (for fast lookup during verify) */
const userCodeIndex = new Map<string, string>();

/**
 * Generate a human-readable user code: XXXX-XXXX
 * Uses uppercase alphanumerics, excluding confusing chars (0/O, 1/I/L)
 */
function generateUserCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Create a new device code pair
 */
export function createDeviceCode(
  clientType: "cli" | "vscode" | "unknown" = "unknown",
): {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
} {
  // Ensure unique user code
  let userCode: string;
  do {
    userCode = generateUserCode();
  } while (userCodeIndex.has(userCode));

  const deviceCode = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEVICE_CODE_TTL_MS);

  const entry: DeviceCodeEntry = {
    deviceCode,
    userCode,
    clientType,
    status: "pending",
    createdAt: now,
    expiresAt,
  };

  store.set(deviceCode, entry);
  userCodeIndex.set(userCode, deviceCode);

  return {
    deviceCode,
    userCode,
    expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
    interval: 5,
  };
}

/**
 * Look up a device code entry by deviceCode (used during polling)
 */
export function getByDeviceCode(
  deviceCode: string,
): DeviceCodeEntry | undefined {
  const entry = store.get(deviceCode);
  if (!entry) return undefined;

  // Auto-expire
  if (entry.status === "pending" && new Date() > entry.expiresAt) {
    entry.status = "expired";
  }

  return entry;
}

/**
 * Look up a device code entry by userCode (used during web verification)
 */
export function getByUserCode(
  userCode: string,
): DeviceCodeEntry | undefined {
  const normalized = userCode.toUpperCase().replace(/\s/g, "");
  // Accept with or without hyphen
  const formatted =
    normalized.length === 8
      ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
      : normalized;

  const deviceCode = userCodeIndex.get(formatted);
  if (!deviceCode) return undefined;

  return getByDeviceCode(deviceCode);
}

/**
 * Authorize a device code (called when user confirms on web)
 */
export function authorizeDeviceCode(
  userCode: string,
  userId: string,
  userEmail?: string,
  userName?: string,
): { success: boolean; error?: string; clientType?: string } {
  const entry = getByUserCode(userCode);

  if (!entry) {
    return { success: false, error: "Invalid code" };
  }
  if (entry.status === "expired") {
    return { success: false, error: "Code has expired" };
  }
  if (entry.status === "authorized" || entry.status === "used") {
    return { success: false, error: "Code already used" };
  }

  entry.status = "authorized";
  entry.userId = userId;
  entry.userEmail = userEmail;
  entry.userName = userName;

  return { success: true, clientType: entry.clientType };
}

/**
 * Mark device code as used (after tokens are picked up by CLI/extension)
 */
export function markAsUsed(deviceCode: string): void {
  const entry = store.get(deviceCode);
  if (entry) {
    entry.status = "used";
  }
}

/**
 * Store tokens on the entry (set by the poll endpoint after issuing tokens)
 */
export function setTokens(
  deviceCode: string,
  accessToken: string,
  refreshToken: string,
): void {
  const entry = store.get(deviceCode);
  if (entry) {
    entry.accessToken = accessToken;
    entry.refreshToken = refreshToken;
  }
}

/**
 * Clean up expired and used entries
 */
function cleanup(): void {
  const now = new Date();
  for (const [deviceCode, entry] of store) {
    const isOld = now.getTime() - entry.createdAt.getTime() > DEVICE_CODE_TTL_MS * 2;
    if (entry.status === "expired" || entry.status === "used" || isOld) {
      userCodeIndex.delete(entry.userCode);
      store.delete(deviceCode);
    }
  }
}

// Start cleanup interval
if (typeof globalThis !== "undefined") {
  const key = "__guardrail_device_cleanup__";
  if (!(globalThis as any)[key]) {
    (globalThis as any)[key] = setInterval(cleanup, CLEANUP_INTERVAL_MS);
    // Don't prevent process exit
    if ((globalThis as any)[key]?.unref) {
      (globalThis as any)[key].unref();
    }
  }
}
