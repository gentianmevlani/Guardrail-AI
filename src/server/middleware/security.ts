/**
 * Security Middleware for Express
 *
 * Provides various security enhancements including headers, CSRF protection, and more
 */

import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";

/**
 * Security headers middleware
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  if (process.env["NODE_ENV"] === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'",
    );
  }

  // Strict Transport Security (HTTPS only)
  if (req.secure) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Remove server signature
  res.removeHeader("X-Powered-By");

  next();
}

/**
 * CSRF protection middleware
 */
export class CSRFProtection {
  private tokens = new Map<string, { token: string; expires: number }>();

  constructor() {
    // STRICT: No fallbacks for CSRF secret
    const secret = process.env["CSRF_SECRET"];
    if (!secret) {
      throw new Error(
        "FATAL: CSRF_SECRET environment variable is required. " +
          "Generate with: openssl rand -base64 32",
      );
    }
    (this as any)._secret = secret;
  }

  /**
   * Generate CSRF token
   */
  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    this.tokens.set(sessionId, { token, expires });

    return token;
  }

  /**
   * Verify CSRF token
   */
  verifyToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);

    if (!stored || stored.token !== token || Date.now() > stored.expires) {
      return false;
    }

    return true;
  }

  /**
   * Middleware to add CSRF token to response
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const sessionId = (req as any).sessionID || req.ip || "anonymous";
      const token = this.generateToken(sessionId);

      // Add token to response headers
      res.setHeader("X-CSRF-Token", token);

      // Add token to cookies
      res.cookie("csrf-token", token, {
        httpOnly: false, // Needed for JavaScript access
        secure: req.secure,
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
      });

      next();
    };
  }

  /**
   * Middleware to verify CSRF token on state-changing requests
   */
  verify() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip verification for GET, HEAD, OPTIONS
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        next();
        return;
      }

      const sessionId = (req as any).sessionID || req.ip || "anonymous";
      const token =
        (req.headers["x-csrf-token"] as string) || req.body?.csrfToken;

      if (!token || !this.verifyToken(sessionId, token)) {
        res.status(403).json({
          success: false,
          error: "Invalid CSRF token",
          code: "INVALID_CSRF_TOKEN",
        });
        return;
      }

      next();
    };
  }

  /**
   * Clean up expired tokens
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.tokens.forEach((value, key) => {
      if (now > value.expires) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach((key) => this.tokens.delete(key));
  }
}

/**
 * Request ID middleware
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);
  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const requestId = req.headers["x-request-id"];

  // Log request
  console.log(`[${requestId}] ${req.method} ${req.url} - ${req.ip}`);

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${requestId}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
}

/**
 * IP whitelist middleware
 */
export function ipWhitelist(allowedIPs: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress;

    if (!allowedIPs.includes(ip!)) {
      res.status(403).json({
        success: false,
        error: "Access denied from this IP",
        code: "IP_NOT_ALLOWED",
      });
      return;
    }

    next();
  };
}

/**
 * User agent validation middleware
 */
export function validateUserAgent(blacklistedPatterns: RegExp[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userAgent = req.get("User-Agent") || "";

    for (const pattern of blacklistedPatterns) {
      if (pattern.test(userAgent)) {
        res.status(403).json({
          success: false,
          error: "Access denied",
          code: "INVALID_USER_AGENT",
        });
        return;
      }
    }

    next();
  };
}

/**
 * Request size limit middleware
 */
export function requestSizeLimit(maxSize: string = "10mb") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    const maxSizeBytes = parseSize(maxSize);

    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        success: false,
        error: "Request entity too large",
        code: "REQUEST_TOO_LARGE",
        maxSize,
      });
      return;
    }

    next();
  };
}

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const _units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const _match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
  if (!_match) {
    throw new Error("Invalid size format");
  }

  const [, value, unit] = _match;
  if (!value || !unit) {
    throw new Error("Invalid size format");
  }
  return parseInt(value, 10) * _units[unit]!;
}

/**
 * API version middleware
 */
export function apiVersion(
  supportedVersions: string[],
  defaultVersion: string = "v1",
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const version =
      (req.headers["api-version"] as string) ||
      (req.query["version"] as string) ||
      defaultVersion;

    if (!supportedVersions.includes(version!)) {
      res.status(400).json({
        success: false,
        error: `Unsupported API version. Supported versions: ${supportedVersions.join(", ")}`,
        code: "UNSUPPORTED_API_VERSION",
      });
      return;
    }

    req.headers["api-version"] = version!;
    res.setHeader("API-Version", version!);

    next();
  };
}

/**
 * CORS middleware with dynamic origins
 */
export function dynamicCORS(allowedOrigins: string[] | string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (typeof allowedOrigins === "string" && allowedOrigins === "*") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (Array.isArray(allowedOrigins)) {
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
    } else if (typeof allowedOrigins === "string") {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Request-ID, API-Version",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    next();
  };
}

/**
 * Health check endpoint with security info
 */
export function healthCheck(_securityInfo: { [key: string]: any } = {}) {
  return (_req: Request, res: Response): void => {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env["npm_package_version"] || "1.0.0",
      environment: process.env["NODE_ENV"] || "development",
      security: {
        csrfProtection: !!process.env["CSRF_SECRET"],
        rateLimitEnabled: true,
        httpsEnabled: _req.secure,
        ..._securityInfo,
      },
    };

    res.json(health);
  };
}

/**
 * Timeout middleware
 */
export function timeout(ms: number = 30000) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: "Request timeout",
          code: "REQUEST_TIMEOUT",
        });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    next();
  };
}
