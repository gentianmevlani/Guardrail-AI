/**
 * Brute-Force Protection Service
 * 
 * Implements account lockout after repeated failed login attempts
 * Uses Redis if available, falls back to in-memory store
 */

import { logger } from '../logger';
import { prisma } from '@guardrail/database';

export interface LockoutConfig {
  maxAttempts: number;
  lockoutDurationMs: number;
  escalateLockout: boolean;
  escalationMultiplier: number;
}

const DEFAULT_CONFIG: LockoutConfig = {
  maxAttempts: 5, // Lock after 5 failed attempts
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  escalateLockout: true, // Increase lockout duration with each lockout
  escalationMultiplier: 2, // Double the duration each time
};

interface FailedAttempt {
  count: number;
  lastAttemptAt: number;
  lockoutUntil?: number;
  lockoutCount: number; // Number of times this account has been locked
}

// In-memory store (fallback when Redis unavailable)
const lockoutStore = new Map<string, FailedAttempt>();

// Redis client (optional)
let redisClient: any = null;

/**
 * Initialize Redis client if available
 */
export async function initLockoutStore(redisUrl?: string): Promise<void> {
  if (redisUrl) {
    try {
      const { createClient } = await import('redis');
      redisClient = createClient({ url: redisUrl });
      await redisClient.connect();
      logger.info('Brute-force protection using Redis');
    } catch (error) {
      logger.warn({ error }, 'Redis unavailable, using in-memory store for brute-force protection');
    }
  }
}

/**
 * Get the lockout key for an account identifier (email or userId)
 */
function getLockoutKey(identifier: string): string {
  return `lockout:${identifier.toLowerCase()}`;
}

/**
 * Record a failed login attempt
 * Returns lockout information if account should be locked
 */
export async function recordFailedAttempt(
  identifier: string,
  config: Partial<LockoutConfig> = {}
): Promise<{ locked: boolean; lockoutUntil?: number; attemptsRemaining: number }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const key = getLockoutKey(identifier);
  const now = Date.now();

  let attempt: FailedAttempt;

  if (redisClient) {
    // Use Redis
    try {
      const stored = await redisClient.get(key);
      if (stored) {
        attempt = JSON.parse(stored);
      } else {
        attempt = { count: 0, lastAttemptAt: now, lockoutCount: 0 };
      }
    } catch (error) {
      logger.warn({ error }, 'Redis get failed, falling back to in-memory');
      attempt = lockoutStore.get(key) || { count: 0, lastAttemptAt: now, lockoutCount: 0 };
    }
  } else {
    // Use in-memory store
    attempt = lockoutStore.get(key) || { count: 0, lastAttemptAt: now, lockoutCount: 0 };
  }

  // Check if currently locked
  if (attempt.lockoutUntil && now < attempt.lockoutUntil) {
    return {
      locked: true,
      lockoutUntil: attempt.lockoutUntil,
      attemptsRemaining: 0,
    };
  }

  // Reset if lockout expired
  if (attempt.lockoutUntil && now >= attempt.lockoutUntil) {
    attempt.count = 0;
    attempt.lockoutUntil = undefined;
  }

  // Increment failed attempt count
  attempt.count++;
  attempt.lastAttemptAt = now;

  // Check if should lock
  if (attempt.count >= finalConfig.maxAttempts) {
    // Calculate lockout duration (escalates if enabled)
    let lockoutDuration = finalConfig.lockoutDurationMs;
    if (finalConfig.escalateLockout) {
      lockoutDuration = lockoutDuration * Math.pow(finalConfig.escalationMultiplier, attempt.lockoutCount);
    }

    attempt.lockoutUntil = now + lockoutDuration;
    attempt.lockoutCount++;

    logger.warn(
      {
        identifier,
        attempts: attempt.count,
        lockoutUntil: attempt.lockoutUntil,
        lockoutCount: attempt.lockoutCount,
      },
      'Account locked due to brute-force attempts'
    );

    // Persist lockout state
    await persistAttempt(key, attempt);

    return {
      locked: true,
      lockoutUntil: attempt.lockoutUntil,
      attemptsRemaining: 0,
    };
  }

  // Persist attempt count
  await persistAttempt(key, attempt);

  return {
    locked: false,
    attemptsRemaining: finalConfig.maxAttempts - attempt.count,
  };
}

/**
 * Record a successful login and clear failed attempts
 */
export async function clearFailedAttempts(identifier: string): Promise<void> {
  const key = getLockoutKey(identifier);

  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.warn({ error }, 'Redis delete failed, falling back to in-memory');
      lockoutStore.delete(key);
    }
  } else {
    lockoutStore.delete(key);
  }
}

/**
 * Check if an account is currently locked
 */
export async function isLocked(identifier: string): Promise<{ locked: boolean; lockoutUntil?: number }> {
  const key = getLockoutKey(identifier);
  const now = Date.now();

  let attempt: FailedAttempt | null = null;

  if (redisClient) {
    try {
      const stored = await redisClient.get(key);
      if (stored) {
        attempt = JSON.parse(stored);
      }
    } catch (error) {
      logger.warn({ error }, 'Redis get failed, falling back to in-memory');
      attempt = lockoutStore.get(key) || null;
    }
  } else {
    attempt = lockoutStore.get(key) || null;
  }

  if (!attempt || !attempt.lockoutUntil) {
    return { locked: false };
  }

  if (now < attempt.lockoutUntil) {
    return {
      locked: true,
      lockoutUntil: attempt.lockoutUntil,
    };
  }

  // Lockout expired, clear it
  await clearFailedAttempts(identifier);
  return { locked: false };
}

/**
 * Manually unlock an account (admin function)
 */
export async function unlockAccount(identifier: string): Promise<void> {
  await clearFailedAttempts(identifier);
  logger.info({ identifier }, 'Account manually unlocked');
}

/**
 * Get lockout status for an account
 */
export async function getLockoutStatus(identifier: string): Promise<{
  locked: boolean;
  failedAttempts: number;
  lockoutUntil?: number;
  attemptsRemaining: number;
}> {
  const key = getLockoutKey(identifier);
  const now = Date.now();
  const config = DEFAULT_CONFIG;

  let attempt: FailedAttempt | null = null;

  if (redisClient) {
    try {
      const stored = await redisClient.get(key);
      if (stored) {
        attempt = JSON.parse(stored);
      }
    } catch (error) {
      attempt = lockoutStore.get(key) || null;
    }
  } else {
    attempt = lockoutStore.get(key) || null;
  }

  if (!attempt) {
    return {
      locked: false,
      failedAttempts: 0,
      attemptsRemaining: config.maxAttempts,
    };
  }

  const locked = attempt.lockoutUntil ? now < attempt.lockoutUntil : false;

  return {
    locked,
    failedAttempts: attempt.count,
    lockoutUntil: attempt.lockoutUntil,
    attemptsRemaining: locked ? 0 : Math.max(0, config.maxAttempts - attempt.count),
  };
}

/**
 * Persist attempt data to store
 */
async function persistAttempt(key: string, attempt: FailedAttempt): Promise<void> {
  // Set TTL to 24 hours (cleanup old entries)
  const ttl = 24 * 60 * 60; // 24 hours in seconds

  if (redisClient) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(attempt));
    } catch (error) {
      logger.warn({ error }, 'Redis setEx failed, falling back to in-memory');
      lockoutStore.set(key, attempt);
      // Cleanup old entries from memory store
      setTimeout(() => lockoutStore.delete(key), ttl * 1000);
    }
  } else {
    lockoutStore.set(key, attempt);
    // Cleanup old entries
    setTimeout(() => lockoutStore.delete(key), ttl * 1000);
  }
}

/**
 * Cleanup expired lockouts from in-memory store
 */
export function cleanupExpiredLockouts(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, attempt] of Array.from(lockoutStore.entries())) {
    if (attempt.lockoutUntil && now >= attempt.lockoutUntil) {
      lockoutStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug({ cleaned, remaining: lockoutStore.size }, 'Cleaned up expired lockouts');
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredLockouts, 5 * 60 * 1000);
