/**
 * Strict Environment Variable Validation
 *
 * FAILS HARD if any required secret is missing - NO FALLBACKS.
 * Call validateRequiredSecrets() at application startup.
 */

export interface RequiredSecrets {
  // Core secrets - REQUIRED in all environments
  JWT_SECRET: string;
  DATABASE_URL: string;

  // Production-only secrets
  JWT_REFRESH_SECRET?: string;
  COOKIE_SECRET?: string;
  SESSION_SECRET?: string;

  // OAuth (required if OAuth is enabled)
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;

  // Payments (required if billing is enabled)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // AI (required if AI features are enabled)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

// Secrets that are ALWAYS required
const ALWAYS_REQUIRED = ["JWT_SECRET", "DATABASE_URL"] as const;

// Secrets required in production
const PRODUCTION_REQUIRED = [
  ...ALWAYS_REQUIRED,
  "JWT_REFRESH_SECRET",
  "COOKIE_SECRET",
  "SESSION_SECRET",
] as const;

// Minimum lengths for secrets (security requirement)
const SECRET_MIN_LENGTHS: Record<string, number> = {
  JWT_SECRET: 32,
  JWT_REFRESH_SECRET: 32,
  COOKIE_SECRET: 32,
  SESSION_SECRET: 32,
  GITHUB_CLIENT_SECRET: 20,
  GOOGLE_CLIENT_SECRET: 20,
  STRIPE_SECRET_KEY: 20,
  STRIPE_WEBHOOK_SECRET: 20,
};

// Patterns that indicate placeholder/unsafe values
const UNSAFE_PATTERNS = [
  /^dev-/i,
  /^test-/i,
  /^your-/i,
  /change-in-production/i,
  /example/i,
  /placeholder/i,
  /^xxx+$/i,
  /^12345/,
  /^password$/i,
  /^secret$/i,
];

export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly missing: string[],
    public readonly invalid: Array<{ key: string; reason: string }>,
  ) {
    super(message);
    this.name = "EnvValidationError";
  }
}

/**
 * Validates that all required secrets are present and secure.
 * Throws EnvValidationError if validation fails.
 *
 * @throws {EnvValidationError} If any required secret is missing or invalid
 */
export function validateRequiredSecrets(): RequiredSecrets {
  const isProduction = process.env.NODE_ENV === "production";
  const requiredVars = isProduction ? PRODUCTION_REQUIRED : ALWAYS_REQUIRED;

  const missing: string[] = [];
  const invalid: Array<{ key: string; reason: string }> = [];

  // Check for missing secrets
  for (const key of requiredVars) {
    const value = process.env[key];

    if (!value || value.trim() === "") {
      missing.push(key);
      continue;
    }

    // Check minimum length
    const minLength = SECRET_MIN_LENGTHS[key];
    if (minLength && value.length < minLength) {
      invalid.push({
        key,
        reason: `Must be at least ${minLength} characters (got ${value.length})`,
      });
    }

    // Check for unsafe patterns (only in production)
    if (isProduction) {
      for (const pattern of UNSAFE_PATTERNS) {
        if (pattern.test(value)) {
          invalid.push({
            key,
            reason: `Contains unsafe pattern: ${pattern.toString()}`,
          });
          break;
        }
      }
    }
  }

  // Fail hard if any issues
  if (missing.length > 0 || invalid.length > 0) {
    const errorParts: string[] = [];

    if (missing.length > 0) {
      errorParts.push(`Missing required secrets: ${missing.join(", ")}`);
    }

    if (invalid.length > 0) {
      const invalidDetails = invalid
        .map((i) => `${i.key}: ${i.reason}`)
        .join("; ");
      errorParts.push(`Invalid secrets: ${invalidDetails}`);
    }

    const error = new EnvValidationError(
      `Environment validation failed:\n${errorParts.join("\n")}`,
      missing,
      invalid,
    );

    // Log detailed error
    console.error("\n" + "=".repeat(60));
    console.error("🚨 FATAL: Environment Validation Failed");
    console.error("=".repeat(60));

    if (missing.length > 0) {
      console.error("\n❌ Missing Required Secrets:");
      missing.forEach((key) => console.error(`   - ${key}`));
    }

    if (invalid.length > 0) {
      console.error("\n⚠️  Invalid Secrets:");
      invalid.forEach(({ key, reason }) =>
        console.error(`   - ${key}: ${reason}`),
      );
    }

    console.error("\n📋 To fix:");
    console.error("   1. Set missing environment variables");
    console.error("   2. Ensure secrets meet minimum length requirements");
    console.error("   3. Do not use placeholder values in production");
    console.error("\n" + "=".repeat(60) + "\n");

    throw error;
  }

  // Return validated secrets
  return {
    JWT_SECRET: process.env.JWT_SECRET!,
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    COOKIE_SECRET: process.env.COOKIE_SECRET,
    SESSION_SECRET: process.env.SESSION_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };
}

/**
 * Get a required secret, throwing if not present.
 * Use this instead of direct process.env access for secrets.
 */
export function getRequiredSecret(key: keyof RequiredSecrets): string {
  const value = process.env[key];

  if (!value || value.trim() === "") {
    throw new Error(
      `Required secret '${key}' is not set. Application cannot start without this value.`,
    );
  }

  return value;
}

/**
 * Check if a feature's required secrets are available.
 * Returns false if secrets are missing (feature should be disabled).
 */
export function isFeatureConfigured(
  feature: "github" | "google" | "stripe" | "openai" | "anthropic",
): boolean {
  switch (feature) {
    case "github":
      return Boolean(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
      );
    case "google":
      return Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      );
    case "stripe":
      return Boolean(process.env.STRIPE_SECRET_KEY);
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    default:
      return false;
  }
}
