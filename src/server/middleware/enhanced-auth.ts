/**
 * Enhanced Authentication Middleware for Express
 *
 * Provides JWT authentication, role-based access control, and rate limiting
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { authService, UserResponse } from "../services/auth-service";

export interface AuthenticatedRequest extends Request {
  user?: UserResponse & { role?: string; subscriptionTier?: string };
  token?: string;
  headers: any;
  params: any;
  baseUrl: string;
}

// STRICT: No fallbacks for secrets - fail hard if missing
function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is required. " +
        "Application cannot start without this value.",
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "FATAL: JWT_SECRET must be at least 32 characters. " +
        "Generate with: openssl rand -base64 32",
    );
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();

/**
 * Generate JWT token
 */
export function generateToken(payload: {
  userId: string;
  email: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify JWT token
 */
export function verifyToken(
  token: string,
): Promise<{ userId: string; email: string }> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as { userId: string; email: string });
      }
    });
  });
}

/**
 * Authentication middleware
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Access token required",
        code: "NO_TOKEN",
      });
      return;
    }

    // Verify token
    const decoded = await verifyToken(token);

    // Get user details
    const user = await authService.getUserById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: "Invalid token - user not found",
        code: "INVALID_TOKEN",
      });
      return;
    }

    // Attach user info to request
    req.user = user;
    req.token = token;

    next();
  } catch (error: any) {
    console.error("Authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        error: "Invalid token",
        code: "INVALID_TOKEN",
      });
    } else if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        error: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    } else {
      res.status(401).json({
        success: false,
        error: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }
  }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer")
        ? authHeader.substring(7)
        : null;

    if (token) {
      const decoded = await verifyToken(token);
      const user = await authService.getUserById(decoded.userId);

      if (user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(allowedRoles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        message: `This feature requires one of these roles: ${allowedRoles.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Subscription tier authorization middleware factory
 */
export function requireSubscription(allowedTiers: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    if (
      !req.user.subscriptionTier ||
      !allowedTiers.includes(req.user.subscriptionTier)
    ) {
      res.status(403).json({
        success: false,
        error: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        message: `This feature requires one of these tiers: ${allowedTiers.join(", ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Resource owner verification middleware
 */
export function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
    return;
  }

  const resourceId = req.params.id;
  const _resourceType = req.baseUrl?.split("/")[2]; // Extract resource type from URL

  if (!resourceId) {
    res.status(400).json({
      success: false,
      error: "Resource ID required",
      code: "MISSING_RESOURCE_ID",
    });
    return;
  }

  // For admin users, skip ownership check
  if (req.user.role === "admin") {
    next();
    return;
  }

  // Check ownership based on resource type
  // This would typically involve a database query
  // For now, we'll add the check to the route handlers
  next();
}

/**
 * Rate limiting configurations
 */
export const rateLimiters = {
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: {
      success: false,
      error: "Too many authentication attempts",
      code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  standard: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      success: false,
      error: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  premium: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window
    skip: (req: AuthenticatedRequest) => {
      return (
        req.user?.subscriptionTier === "premium" ||
        req.user?.subscriptionTier === "enterprise"
      );
    },
    message: {
      success: false,
      error: "Rate limit exceeded",
      code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  ai: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 AI requests per minute
    message: {
      success: false,
      error: "AI service rate limit exceeded",
      code: "AI_RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: {
      success: false,
      error: "Upload rate limit exceeded",
      code: "UPLOAD_RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

/**
 * API key authentication middleware
 */
export async function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: "API key required",
        code: "NO_API_KEY",
      });
      return;
    }

    // Verify API key (implement your API key validation logic)
    // Note: validateApiKey method needs to be implemented in AuthService
    const user = (await (authService as any).validateApiKey?.(apiKey)) || null;

    if (!user) {
      res.status(401).json({
        success: false,
        error: "Invalid API key",
        code: "INVALID_API_KEY",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("API key authentication error:", error);
    res.status(401).json({
      success: false,
      error: "Authentication failed",
      code: "AUTH_FAILED",
    });
  }
}

/**
 * Permission-based authorization middleware
 */
export function requirePermission(resourceType: string, action: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    // Check user permissions (implement your permission checking logic)
    // Note: checkUserPermission method needs to be implemented in AuthService
    const permission = `${resourceType}:${action}`;
    const hasPermission =
      (await (authService as any).checkUserPermission?.(
        req.user.id,
        permission,
      )) || false;

    if (!hasPermission && req.user.role !== "admin") {
      res.status(403).json({
        success: false,
        error: "Permission denied",
        code: "PERMISSION_DENIED",
        message: `This feature requires '${permission}' permission`,
      });
      return;
    }

    next();
  };
}
