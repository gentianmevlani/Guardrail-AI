/**
 * Auth Rate Limiter
 *
 * Dual-track rate limiting for authentication endpoints:
 * - Account-based: Escalating cooldown with exponential backoff per account
 * - IP-based: Stricter limits to prevent spray attacks
 *
 * Features:
 * - No account enumeration (safe error messages)
 * - Enterprise IP allowlist (optional feature flag)
 * - Exponential backoff for repeated failures
 */

import { NextFunction, Request, Response } from "express";

// ============================================================================
// Types
// ============================================================================

interface AccountAttempt {
  count: number;
  windowStart: number;
  lockoutUntil: number | null;
  lockoutCount: number; // Number of times account has been locked out
}

interface IpAttempt {
  count: number;
  windowStart: number;
  uniqueAccounts: Set<string>; // Track unique accounts attempted from this IP
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds
  reason?: "account_locked" | "ip_limited" | "account_limited";
}

export interface AuthRateLimiterConfig {
  // Account-based limits
  accountMaxAttempts: number; // Max attempts per account per window (default: 10)
  accountWindowMs: number; // Window duration in ms (default: 15 min)
  accountBaseLockoutMs: number; // Base lockout duration (default: 1 min)
  accountMaxLockoutMs: number; // Max lockout duration (default: 1 hour)

  // IP-based limits
  ipMaxAttempts: number; // Max attempts per IP per window (default: 50)
  ipWindowMs: number; // Window duration in ms (default: 15 min)

  // Enterprise allowlist
  enableAllowlist: boolean; // Feature flag for enterprise IP allowlist
  allowlistedIpRanges: string[]; // CIDR ranges or exact IPs
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AuthRateLimiterConfig = {
  // Account: 10 attempts per 15 min, then escalating lockout
  accountMaxAttempts: 10,
  accountWindowMs: 15 * 60 * 1000,
  accountBaseLockoutMs: 60 * 1000, // 1 minute
  accountMaxLockoutMs: 60 * 60 * 1000, // 1 hour

  // IP: 50 attempts per 15 min (stricter for spray attacks)
  ipMaxAttempts: 50,
  ipWindowMs: 15 * 60 * 1000,

  // Enterprise allowlist disabled by default
  enableAllowlist: false,
  allowlistedIpRanges: [],
};

// ============================================================================
// Auth Rate Limiter Class
// ============================================================================

export class AuthRateLimiter {
  private config: AuthRateLimiterConfig;
  private accountAttempts: Map<string, AccountAttempt> = new Map();
  private ipAttempts: Map<string, IpAttempt> = new Map();

  constructor(config: Partial<AuthRateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a login attempt should be allowed
   * @param accountIdentifier - Email or username (normalized to lowercase)
   * @param ip - Client IP address
   */
  check(accountIdentifier: string, ip: string): RateLimitResult {
    const normalizedAccount = accountIdentifier.toLowerCase().trim();
    const normalizedIp = this.normalizeIp(ip);
    const now = Date.now();

    // Check enterprise allowlist first
    if (this.isAllowlisted(normalizedIp)) {
      return { allowed: true };
    }

    // Check account lockout (exponential backoff)
    const accountResult = this.checkAccount(normalizedAccount, now);
    if (!accountResult.allowed) {
      return accountResult;
    }

    // Check IP limits
    const ipResult = this.checkIp(normalizedIp, normalizedAccount, now);
    if (!ipResult.allowed) {
      return ipResult;
    }

    return { allowed: true };
  }

  /**
   * Record a failed login attempt
   */
  recordFailure(accountIdentifier: string, ip: string): void {
    const normalizedAccount = accountIdentifier.toLowerCase().trim();
    const normalizedIp = this.normalizeIp(ip);
    const now = Date.now();

    // Skip recording for allowlisted IPs
    if (this.isAllowlisted(normalizedIp)) {
      return;
    }

    this.recordAccountFailure(normalizedAccount, now);
    this.recordIpFailure(normalizedIp, normalizedAccount, now);
  }

  /**
   * Record a successful login (resets account attempts)
   */
  recordSuccess(accountIdentifier: string, ip: string): void {
    const normalizedAccount = accountIdentifier.toLowerCase().trim();
    const normalizedIp = this.normalizeIp(ip);

    // Reset account attempts on successful login
    this.accountAttempts.delete(normalizedAccount);

    // Don't reset IP attempts - they track overall behavior
    // But we can remove this account from the IP's unique accounts set
    const ipData = this.ipAttempts.get(normalizedIp);
    if (ipData) {
      ipData.uniqueAccounts.delete(normalizedAccount);
    }
  }

  /**
   * Get current status for an account (for admin/debugging)
   */
  getAccountStatus(accountIdentifier: string): {
    attempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
    lockoutCount: number;
  } {
    const normalizedAccount = accountIdentifier.toLowerCase().trim();
    const now = Date.now();
    const data = this.accountAttempts.get(normalizedAccount);

    if (!data) {
      return { attempts: 0, isLocked: false, lockoutCount: 0 };
    }

    const isLocked = data.lockoutUntil !== null && data.lockoutUntil > now;
    return {
      attempts: data.count,
      isLocked,
      lockoutRemaining: isLocked
        ? Math.ceil((data.lockoutUntil! - now) / 1000)
        : undefined,
      lockoutCount: data.lockoutCount,
    };
  }

  /**
   * Get current status for an IP (for admin/debugging)
   */
  getIpStatus(ip: string): {
    attempts: number;
    uniqueAccounts: number;
    windowRemaining: number;
  } {
    const normalizedIp = this.normalizeIp(ip);
    const now = Date.now();
    const data = this.ipAttempts.get(normalizedIp);

    if (!data) {
      return { attempts: 0, uniqueAccounts: 0, windowRemaining: 0 };
    }

    const windowEnd = data.windowStart + this.config.ipWindowMs;
    return {
      attempts: data.count,
      uniqueAccounts: data.uniqueAccounts.size,
      windowRemaining: Math.max(0, Math.ceil((windowEnd - now) / 1000)),
    };
  }

  /**
   * Manually unlock an account (admin action)
   */
  unlockAccount(accountIdentifier: string): void {
    const normalizedAccount = accountIdentifier.toLowerCase().trim();
    this.accountAttempts.delete(normalizedAccount);
  }

  /**
   * Update allowlist (for runtime configuration)
   */
  updateAllowlist(ipRanges: string[], enable?: boolean): void {
    this.config.allowlistedIpRanges = ipRanges;
    if (enable !== undefined) {
      this.config.enableAllowlist = enable;
    }
  }

  /**
   * Clear all rate limit data (for testing)
   */
  reset(): void {
    this.accountAttempts.clear();
    this.ipAttempts.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private checkAccount(account: string, now: number): RateLimitResult {
    const data = this.accountAttempts.get(account);

    if (!data) {
      return { allowed: true };
    }

    // Check if currently locked out
    if (data.lockoutUntil !== null && data.lockoutUntil > now) {
      const retryAfter = Math.ceil((data.lockoutUntil - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: "account_locked",
      };
    }

    // Check if window has expired
    if (now > data.windowStart + this.config.accountWindowMs) {
      // Window expired, reset (but keep lockout count for escalation)
      data.count = 0;
      data.windowStart = now;
      data.lockoutUntil = null;
      return { allowed: true };
    }

    // Check if at limit
    if (data.count >= this.config.accountMaxAttempts) {
      // Apply lockout with exponential backoff
      const lockoutDuration = this.calculateLockoutDuration(data.lockoutCount);
      data.lockoutUntil = now + lockoutDuration;
      data.lockoutCount++;

      return {
        allowed: false,
        retryAfter: Math.ceil(lockoutDuration / 1000),
        reason: "account_locked",
      };
    }

    return { allowed: true };
  }

  private checkIp(ip: string, account: string, now: number): RateLimitResult {
    const data = this.ipAttempts.get(ip);

    if (!data) {
      return { allowed: true };
    }

    // Check if window has expired
    if (now > data.windowStart + this.config.ipWindowMs) {
      // Window expired, reset
      data.count = 0;
      data.windowStart = now;
      data.uniqueAccounts.clear();
      return { allowed: true };
    }

    // Check if at limit
    if (data.count >= this.config.ipMaxAttempts) {
      const windowEnd = data.windowStart + this.config.ipWindowMs;
      const retryAfter = Math.ceil((windowEnd - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: "ip_limited",
      };
    }

    return { allowed: true };
  }

  private recordAccountFailure(account: string, now: number): void {
    let data = this.accountAttempts.get(account);

    if (!data) {
      data = {
        count: 0,
        windowStart: now,
        lockoutUntil: null,
        lockoutCount: 0,
      };
      this.accountAttempts.set(account, data);
    }

    // Reset window if expired
    if (now > data.windowStart + this.config.accountWindowMs) {
      data.count = 0;
      data.windowStart = now;
      data.lockoutUntil = null;
    }

    data.count++;

    // Check if we need to apply lockout
    if (data.count >= this.config.accountMaxAttempts) {
      const lockoutDuration = this.calculateLockoutDuration(data.lockoutCount);
      data.lockoutUntil = now + lockoutDuration;
      data.lockoutCount++;
    }
  }

  private recordIpFailure(ip: string, account: string, now: number): void {
    let data = this.ipAttempts.get(ip);

    if (!data) {
      data = {
        count: 0,
        windowStart: now,
        uniqueAccounts: new Set(),
      };
      this.ipAttempts.set(ip, data);
    }

    // Reset window if expired
    if (now > data.windowStart + this.config.ipWindowMs) {
      data.count = 0;
      data.windowStart = now;
      data.uniqueAccounts.clear();
    }

    data.count++;
    data.uniqueAccounts.add(account);
  }

  private calculateLockoutDuration(lockoutCount: number): number {
    // Exponential backoff: base * 2^lockoutCount
    // e.g., 1min, 2min, 4min, 8min, 16min, 32min, 60min (capped)
    const duration =
      this.config.accountBaseLockoutMs * Math.pow(2, lockoutCount);
    return Math.min(duration, this.config.accountMaxLockoutMs);
  }

  private normalizeIp(ip: string): string {
    // Handle IPv6-mapped IPv4 addresses
    if (ip.startsWith("::ffff:")) {
      return ip.substring(7);
    }
    return ip;
  }

  private isAllowlisted(ip: string): boolean {
    if (!this.config.enableAllowlist) {
      return false;
    }

    for (const range of this.config.allowlistedIpRanges) {
      if (this.ipMatchesRange(ip, range)) {
        return true;
      }
    }

    return false;
  }

  private ipMatchesRange(ip: string, range: string): boolean {
    // Exact match
    if (ip === range) {
      return true;
    }

    // CIDR notation (simplified - supports /8, /16, /24, /32 for IPv4)
    if (range.includes("/")) {
      const [rangeIp, prefixStr] = range.split("/");
      const prefix = parseInt(prefixStr, 10);

      // Simple IPv4 CIDR check
      const ipParts = ip.split(".").map(Number);
      const rangeParts = rangeIp.split(".").map(Number);

      if (ipParts.length !== 4 || rangeParts.length !== 4) {
        return false;
      }

      const ipNum =
        (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
      const rangeNum =
        (rangeParts[0] << 24) |
        (rangeParts[1] << 16) |
        (rangeParts[2] << 8) |
        rangeParts[3];
      const mask = ~((1 << (32 - prefix)) - 1);

      return (ipNum & mask) === (rangeNum & mask);
    }

    return false;
  }

  /**
   * Cleanup expired entries (call periodically to prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now();

    // Cleanup account attempts
    for (const [account, data] of this.accountAttempts.entries()) {
      const windowExpired =
        now > data.windowStart + this.config.accountWindowMs;
      const lockoutExpired =
        data.lockoutUntil === null || data.lockoutUntil < now;

      // Only delete if both window and lockout have expired
      // and there have been no recent lockouts (to preserve escalation history)
      if (windowExpired && lockoutExpired && data.lockoutCount === 0) {
        this.accountAttempts.delete(account);
      }
    }

    // Cleanup IP attempts
    for (const [ip, data] of this.ipAttempts.entries()) {
      if (now > data.windowStart + this.config.ipWindowMs) {
        this.ipAttempts.delete(ip);
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const authRateLimiter = new AuthRateLimiter({
  // Load from environment if available
  accountMaxAttempts: parseInt(
    process.env.AUTH_RATE_LIMIT_ACCOUNT_MAX || "10",
    10
  ),
  ipMaxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_IP_MAX || "50", 10),
  enableAllowlist: process.env.AUTH_RATE_LIMIT_ALLOWLIST_ENABLED === "true",
  allowlistedIpRanges: process.env.AUTH_RATE_LIMIT_ALLOWLIST_IPS
    ? process.env.AUTH_RATE_LIMIT_ALLOWLIST_IPS.split(",")
    : [],
});

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Safe error message that doesn't reveal account existence
 */
const SAFE_ERROR_MESSAGE = "Too many login attempts. Please try again later.";

/**
 * Express middleware for auth rate limiting
 *
 * Usage:
 *   app.post('/api/auth/login', authRateLimitMiddleware(), async (req, res) => { ... })
 */
export function authRateLimitMiddleware(
  limiter: AuthRateLimiter = authRateLimiter
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const accountIdentifier = req.body?.email || req.body?.username || "";
    const ip = getClientIp(req);

    // If no account identifier provided, let the route handler deal with validation
    if (!accountIdentifier) {
      next();
      return;
    }

    const result = limiter.check(accountIdentifier, ip);

    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: SAFE_ERROR_MESSAGE,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: result.retryAfter,
      });
      return;
    }

    // Attach limiter info to request for use in route handler
    (req as any).authRateLimiter = {
      limiter,
      accountIdentifier,
      ip,
    };

    next();
  };
}

/**
 * Helper to record auth result from route handler
 *
 * Usage in route handler:
 *   if (loginSuccess) {
 *     recordAuthSuccess(req);
 *   } else {
 *     recordAuthFailure(req);
 *   }
 */
export function recordAuthFailure(req: Request): void {
  const info = (req as any).authRateLimiter;
  if (info) {
    info.limiter.recordFailure(info.accountIdentifier, info.ip);
  }
}

export function recordAuthSuccess(req: Request): void {
  const info = (req as any).authRateLimiter;
  if (info) {
    info.limiter.recordSuccess(info.accountIdentifier, info.ip);
  }
}

/**
 * Get client IP address, handling proxies
 */
function getClientIp(req: Request): string {
  // Trust X-Forwarded-For if behind a proxy (configure trust proxy in Express)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(
      ","
    );
    return ips[0].trim();
  }

  // Fall back to direct connection IP
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// ============================================================================
// Periodic Cleanup
// ============================================================================

// Run cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  authRateLimiter.cleanup();
}, 5 * 60 * 1000);
