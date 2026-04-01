/**
 * Comprehensive Security Middleware
 * Provides all essential security protections for production APIs
 */

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import * as crypto from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger";
import { ApiErrorCode, ResponseBuilder } from "../types/api-responses";

// Security configuration
export interface SecurityConfig {
  rateLimiting: {
    global: {
      max: number;
      timeWindow: string;
    };
    auth: {
      max: number;
      timeWindow: string;
    };
    api: {
      max: number;
      timeWindow: string;
    };
  };
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
    headers: string[];
  };
  helmet: {
    contentSecurityPolicy: any;
    hsts: any;
  };
  requestSize: {
    maxBodySize: number;
    maxFileSize: number;
    maxFileCount: number;
  };
  encryption: {
    algorithm: string;
    keySize: number;
    ivSize: number;
  };
}

// Default security configuration
const defaultConfig: SecurityConfig = {
  rateLimiting: {
    global: {
      max: 1000,
      timeWindow: "15m",
    },
    auth: {
      max: 5,
      timeWindow: "15m",
    },
    api: {
      max: 100,
      timeWindow: "1m",
    },
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  requestSize: {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxFileCount: 10,
  },
  encryption: {
    algorithm: "aes-256-gcm",
    keySize: 32,
    ivSize: 16,
  },
};

// Security utilities
export class SecurityUtils {
  // Generate secure random token
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  // Hash password with bcrypt
  static async hashPassword(password: string): Promise<string> {
    const bcrypt = await import("bcryptjs");
    return bcrypt.hash(password, 12);
  }

  // Verify password
  static async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    const bcrypt = await import("bcryptjs");
    return bcrypt.compare(password, hash);
  }

  // Encrypt sensitive data using AES-256-GCM (authenticated encryption)
  static encrypt(text: string, key: string): string {
    const { encrypt: secureEncrypt } = require("../utils/encryption");
    return secureEncrypt(text, key);
  }

  // Decrypt sensitive data using AES-256-GCM
  static decrypt(encrypted: string, key: string): string {
    const { decrypt: secureDecrypt } = require("../utils/encryption");
    return secureDecrypt(encrypted, key);
  }

  // Re-encrypt data with a new key (for key rotation)
  static rotateEncryptionKey(
    encrypted: string,
    oldKey: string,
    newKey: string,
  ): string {
    const { rotateKey } = require("../utils/encryption");
    return rotateKey(encrypted, oldKey, newKey);
  }

  // Migrate legacy encrypted data to new format
  static migrateLegacyEncryption(
    legacyEncrypted: string,
    legacyKey: string,
    newKey: string,
  ): string {
    const { migrateLegacy } = require("../utils/encryption");
    return migrateLegacy(legacyEncrypted, legacyKey, newKey);
  }

  // Validate and sanitize URL
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // Check for SQL injection patterns
  static containsSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(--|\/\*|\*\/|;|'|")/,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"])/i,
    ];

    return sqlPatterns.some((pattern) => pattern.test(input));
  }

  // Check for XSS patterns
  static containsXss(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
  }

  // Check for SSRF patterns
  static containsSsrf(url: string): boolean {
    const dangerousHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "169.254.169.254", // AWS metadata
      "metadata.google.internal", // GCP metadata
    ];

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      return dangerousHosts.some(
        (dangerous) => hostname === dangerous || hostname.endsWith(dangerous),
      );
    } catch {
      return true; // Invalid URLs are potentially dangerous
    }
  }

  // Generate CSRF token
  static generateCsrfToken(): string {
    return this.generateSecureToken(32);
  }

  // Validate CSRF token
  static validateCsrfToken(token: string, sessionToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(sessionToken, "hex"),
    );
  }

  // Rate limit key generator
  static generateRateLimitKey(request: FastifyRequest, type: string): string {
    const ip = request.ip;
    const userId = (request as any).user?.id || "anonymous";
    const endpoint = request.url;

    return `${type}:${ip}:${userId}:${endpoint}`;
  }
}

// Security middleware factory
export function createSecurityMiddleware(config: Partial<SecurityConfig> = {}) {
  const securityConfig = { ...defaultConfig, ...config };

  return {
    // Rate limiting middleware
    rateLimit: (type: "global" | "auth" | "api" = "global") => {
      const rateLimitConfig = securityConfig.rateLimiting[type];

      return (rateLimit as any)({
        max: rateLimitConfig.max,
        timeWindow: rateLimitConfig.timeWindow,
        keyGenerator: (request: FastifyRequest) =>
          SecurityUtils.generateRateLimitKey(request, type),
        errorResponseBuilder: (request: FastifyRequest, reply: FastifyReply) => {
          return ResponseBuilder.error(
            ApiErrorCode.RATE_LIMIT_EXCEEDED,
            `Rate limit exceeded for ${type} requests`,
            {
              limit: rateLimitConfig.max,
              window: rateLimitConfig.timeWindow,
              retryAfter: "60",
            },
          );
        },
        onExceeded: (request: FastifyRequest, key: string) => {
          logger.warn(
            {
              key,
              ip: request.ip,
              url: request.url,
              type: "rate_limit_exceeded",
            },
            "Rate limit exceeded",
          );
        },
        onExceeding: (request: FastifyRequest, key: string) => {
          logger.info(
            {
              key,
              ip: request.ip,
              url: request.url,
              type: "rate_limit_warning",
            },
            "Rate limit warning",
          );
        },
      });
    },

    // CORS middleware
    cors: () => {
      return (cors as any)({
        origin: securityConfig.cors.origin,
        credentials: securityConfig.cors.credentials,
        methods: securityConfig.cors.methods,
        allowedHeaders: securityConfig.cors.headers,
      });
    },

    // Helmet middleware
    helmet: () => {
      return (helmet as any)({
        contentSecurityPolicy: securityConfig.helmet.contentSecurityPolicy,
        hsts: securityConfig.helmet.hsts,
      });
    },
  };
}

// Helper function to sanitize objects recursively
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === "string") {
        // Remove potential XSS patterns
        obj[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "")
          .trim();
      } else if (typeof value === "object" && value !== null) {
        sanitizeObject(value);
      }
    }
  }
}

// CORS configuration
export function configureCors(config: Partial<SecurityConfig["cors"]> = {}) {
  const corsConfig = { ...defaultConfig.cors, ...config };

  return (cors as any)({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (corsConfig.origin.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(
          {
            origin,
            allowedOrigins: corsConfig.origin,
            type: "cors_blocked",
          },
          "CORS violation detected",
        );

        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: corsConfig.credentials,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.headers,
    exposedHeaders: [
      "X-Request-ID",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
    ],
  });
}

// Helmet configuration
export function configureHelmet(
  config: Partial<SecurityConfig["helmet"]> = {},
) {
  const helmetConfig = { ...defaultConfig.helmet, ...config };

  return (helmet as any)({
    contentSecurityPolicy: helmetConfig.contentSecurityPolicy,
    hsts: helmetConfig.hsts,
    crossOriginEmbedderPolicy: false,
  });
}

// File upload security
export class FileUploadSecurity {
  static validateFile(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): {
    valid: boolean;
    error?: string;
  } {
    // Check file signature (magic bytes)
    const signatures: Record<string, number[]> = {
      "image/jpeg": [0xff, 0xd8, 0xff],
      "image/png": [0x89, 0x50, 0x4e, 0x47],
      "image/gif": [0x47, 0x49, 0x46],
      "application/pdf": [0x25, 0x50, 0x44, 0x46],
      "text/plain": [], // Text files have no signature
    };

    const expectedSignature = signatures[mimetype];
    if (expectedSignature && expectedSignature.length > 0) {
      for (let i = 0; i < expectedSignature.length; i++) {
        if (buffer[i] !== expectedSignature[i]) {
          return {
            valid: false,
            error: "File signature does not match declared type",
          };
        }
      }
    }

    // Check for malicious file patterns
    const maliciousPatterns = [
      /<%.*%>/, // ASP tags
      /<\?php.*\?>/, // PHP tags
      /<script.*>/, // Script tags
      /eval\s*\(/, // eval function
      /exec\s*\(/, // exec function
    ];

    const content = buffer.toString("utf8", 0, Math.min(1024, buffer.length));
    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          error: "Potentially malicious file content detected",
        };
      }
    }

    return { valid: true };
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/_{2,}/g, "_")
      .toLowerCase();
  }
}

// Export default security middleware
export default createSecurityMiddleware;
