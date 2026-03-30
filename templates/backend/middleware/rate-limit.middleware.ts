/**
 * Rate Limiting Middleware
 * 
 * Essential rate limiting that AI agents often miss
 * Prevents API abuse and DDoS attacks
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  private getKey(req: Request): string {
    // Use IP address or user ID
    return req.user?.id || req.ip || 'unknown';
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  check(req: Request): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(req);
    const now = Date.now();
    const entry = this.store[key];

    if (!entry || entry.resetTime < now) {
      // New window
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }
}

/**
 * Create rate limiter middleware
 */
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100
) => {
  const limiter = new RateLimiter(windowMs, maxRequests);

  return (req: Request, res: Response, next: NextFunction) => {
    const result = limiter.check(req);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
    }

    next();
  };
};

/**
 * Strict rate limiter (for auth endpoints)
 */
export const strictRateLimit = createRateLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes

/**
 * Standard rate limiter (for general endpoints)
 */
export const standardRateLimit = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes

/**
 * Loose rate limiter (for public endpoints)
 */
export const looseRateLimit = createRateLimiter(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes

