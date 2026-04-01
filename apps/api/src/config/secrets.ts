/**
 * Security Configuration
 *
 * Centralized management of secrets and security-sensitive configuration.
 * Validates that required secrets are set in production.
 */

import { logger } from "../logger";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEV_FLAG = process.env.DEV_FLAG === "true";

/**
 * Get JWT secret with validation
 * Throws error in production if not configured
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (IS_PRODUCTION) {
      logger.error("CRITICAL: JWT_SECRET is not set in production!");
      throw new Error(
        "JWT_SECRET environment variable is required in production",
      );
    }
    
    // In development, only allow fallback if DEV_FLAG is explicitly set
    if (!DEV_FLAG) {
      logger.error(
        "JWT_SECRET is not set and DEV_FLAG is not enabled. " +
        "Set JWT_SECRET or run with DEV_FLAG=true for development defaults"
      );
      throw new Error(
        "JWT_SECRET environment variable is required (set DEV_FLAG=true for development defaults)"
      );
    }
    
    logger.warn("Using development JWT secret - DEV_FLAG enabled, NOT SAFE FOR PRODUCTION");
    return "dev-only-secret-do-not-use-in-production";
  }

  // Validate secret strength
  if (secret.length < 32) {
    const message = "JWT_SECRET is less than 32 characters - consider using a longer secret";
    if (IS_PRODUCTION) {
      logger.error(message);
      throw new Error(message);
    }
    logger.warn(message);
  }

  // Check for weak/common secrets in production
  if (IS_PRODUCTION && (
    secret.includes("dev-only") || 
    secret.includes("test") || 
    secret.includes("example") ||
    secret === "dev-only-secret-do-not-use-in-production"
  )) {
    logger.error("CRITICAL: JWT_SECRET appears to be a development secret in production!");
    throw new Error("JWT_SECRET appears to be a development/weak secret - not allowed in production");
  }

  return secret;
}

/**
 * Get Stripe secret key with validation
 */
export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    if (IS_PRODUCTION) {
      logger.warn("STRIPE_SECRET_KEY is not set - billing features disabled");
    }
    return null;
  }

  return key;
}

/**
 * Get Stripe webhook secret with validation
 */
export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

/**
 * Get GitHub OAuth credentials
 */
export function getGitHubOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri =
    process.env.GITHUB_REDIRECT_URI || process.env.GITHUB_CALLBACK_URL;

  if (!clientId || !clientSecret) {
    if (IS_PRODUCTION) {
      logger.warn("GitHub OAuth credentials not configured");
    }
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri:
      redirectUri || `${process.env.FRONTEND_URL}/api/auth/github/callback`,
  };
}

/**
 * Get Google OAuth credentials
 */
export function getGoogleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL;

  if (!clientId || !clientSecret) {
    if (IS_PRODUCTION) {
      logger.warn("Google OAuth credentials not configured");
    }
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri:
      redirectUri || `${process.env.FRONTEND_URL}/api/auth/google/callback`,
  };
}

/**
 * Get database URL with validation
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    if (IS_PRODUCTION) {
      logger.error("CRITICAL: DATABASE_URL is not set in production!");
      throw new Error("DATABASE_URL environment variable is required in production");
    }
    
    // In development, only allow fallback if DEV_FLAG is explicitly set
    if (!DEV_FLAG) {
      logger.error(
        "DATABASE_URL is not set and DEV_FLAG is not enabled. " +
        "Set DATABASE_URL or run with DEV_FLAG=true for development defaults"
      );
      throw new Error(
        "DATABASE_URL environment variable is required (set DEV_FLAG=true for development defaults)"
      );
    }
    
    logger.warn("Using development database URL - DEV_FLAG enabled, NOT SAFE FOR PRODUCTION");
    return "postgresql://localhost:5432/guardrail_dev";
  }

  // Validate database URL format in production
  if (IS_PRODUCTION && !url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    logger.error("CRITICAL: DATABASE_URL must be a PostgreSQL connection string in production!");
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string in production");
  }

  return url;
}

/**
 * Get frontend URL
 */
export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL;
  
  if (!url) {
    if (IS_PRODUCTION) {
      logger.error("CRITICAL: FRONTEND_URL is not set in production!");
      throw new Error("FRONTEND_URL environment variable is required in production");
    }
    
    // In development, only allow fallback if DEV_FLAG is explicitly set
    if (!DEV_FLAG) {
      logger.error(
        "FRONTEND_URL is not set and DEV_FLAG is not enabled. " +
        "Set FRONTEND_URL or run with DEV_FLAG=true for development defaults"
      );
      throw new Error(
        "FRONTEND_URL environment variable is required (set DEV_FLAG=true for development defaults)"
      );
    }
    
    logger.warn("Using development frontend URL - DEV_FLAG enabled, NOT SAFE FOR PRODUCTION");
    return "http://localhost:3001";
  }
  
  return url;
}

/**
 * Check if maintenance mode is enabled
 */
export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}

/**
 * Validate all required secrets on startup
 * In production, this will fail fast if any critical secrets are missing
 */
export function validateSecrets(): { valid: boolean; missing: string[]; weak: string[] } {
  const missing: string[] = [];
  const weak: string[] = [];

  // Always validate JWT secret
  if (!process.env.JWT_SECRET) {
    missing.push("JWT_SECRET");
  } else {
    // Check for weak secrets
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret.length < 32) {
      weak.push("JWT_SECRET (too short - must be at least 32 characters)");
    }
    if (IS_PRODUCTION && (
      jwtSecret.includes("dev-only") || 
      jwtSecret.includes("test") || 
      jwtSecret.includes("example") ||
      jwtSecret === "dev-only-secret-do-not-use-in-production"
    )) {
      weak.push("JWT_SECRET (appears to be a development secret)");
    }
  }

  // Production-specific validations
  if (IS_PRODUCTION) {
    if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
    if (!process.env.FRONTEND_URL) missing.push("FRONTEND_URL");
    
    // Validate database URL format
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      weak.push("DATABASE_URL (must be a PostgreSQL connection string)");
    }
  }

  // Log validation results
  if (missing.length > 0) {
    logger.error({ missing }, "Missing required environment variables");
  }
  
  if (weak.length > 0) {
    if (IS_PRODUCTION) {
      logger.error({ weak }, "Weak or invalid environment variables detected in production");
    } else {
      logger.warn({ weak }, "Weak or invalid environment variables detected (development mode)");
    }
  }

  const isValid = missing.length === 0 && (IS_PRODUCTION ? weak.length === 0 : true);
  
  // In production, fail hard on any issues
  if (IS_PRODUCTION && !isValid) {
    const allIssues = [...missing, ...weak];
    throw new Error(
      `Production security validation failed: ${allIssues.join(', ')}`
    );
  }

  return { valid: isValid, missing, weak };
}

// Export validated JWT secret for backwards compatibility
export const JWT_SECRET = getJwtSecret();
export const JWT_EXPIRES_IN = parseInt(
  process.env.JWT_EXPIRES_IN_SECONDS || "604800",
  10,
);
