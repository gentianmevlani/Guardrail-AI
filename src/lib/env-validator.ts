/**
 * Environment Configuration Validator
 *
 * Validates environment variables at startup and generates
 * .env.example files with documentation.
 */

import * as fs from "fs";
import * as path from "path";

export interface EnvVariable {
  name: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "url" | "email" | "json";
  description: string;
  example?: string;
  default?: string;
  sensitive?: boolean;
  category?: string;
}

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  invalid: Array<{ name: string; error: string }>;
  warnings: string[];
}

export interface EnvConfig {
  variables: EnvVariable[];
  categories?: string[];
}

// Common environment variables for different project types
const COMMON_ENV_VARS: EnvVariable[] = [
  {
    name: "NODE_ENV",
    required: true,
    type: "string",
    description: "Application environment",
    example: "development",
    default: "development",
    category: "App",
  },
  {
    name: "PORT",
    required: false,
    type: "number",
    description: "Server port number",
    example: "3000",
    default: "3000",
    category: "App",
  },
  {
    name: "LOG_LEVEL",
    required: false,
    type: "string",
    description: "Logging level (debug, info, warn, error)",
    example: "info",
    default: "info",
    category: "App",
  },
];

const DATABASE_ENV_VARS: EnvVariable[] = [
  {
    name: "DATABASE_URL",
    required: true,
    type: "url",
    description: "Database connection string",
    example: "postgresql://user:password@localhost:5432/mydb",
    sensitive: true,
    category: "Database",
  },
  {
    name: "DATABASE_POOL_SIZE",
    required: false,
    type: "number",
    description: "Database connection pool size",
    example: "10",
    default: "10",
    category: "Database",
  },
];

const AUTH_ENV_VARS: EnvVariable[] = [
  {
    name: "JWT_SECRET",
    required: true,
    type: "string",
    description: "Secret key for JWT token signing",
    example: "your-super-secret-jwt-key-min-32-chars",
    sensitive: true,
    category: "Auth",
  },
  {
    name: "JWT_EXPIRES_IN",
    required: false,
    type: "string",
    description: "JWT token expiration time",
    example: "7d",
    default: "7d",
    category: "Auth",
  },
  {
    name: "REFRESH_TOKEN_EXPIRES_IN",
    required: false,
    type: "string",
    description: "Refresh token expiration time",
    example: "30d",
    default: "30d",
    category: "Auth",
  },
];

const EMAIL_ENV_VARS: EnvVariable[] = [
  {
    name: "SMTP_HOST",
    required: false,
    type: "string",
    description: "SMTP server hostname",
    example: "smtp.sendgrid.net",
    category: "Email",
  },
  {
    name: "SMTP_PORT",
    required: false,
    type: "number",
    description: "SMTP server port",
    example: "587",
    default: "587",
    category: "Email",
  },
  {
    name: "SMTP_USER",
    required: false,
    type: "string",
    description: "SMTP authentication username",
    example: "apikey",
    sensitive: true,
    category: "Email",
  },
  {
    name: "SMTP_PASSWORD",
    required: false,
    type: "string",
    description: "SMTP authentication password",
    example: "your-smtp-password",
    sensitive: true,
    category: "Email",
  },
  {
    name: "EMAIL_FROM",
    required: false,
    type: "email",
    description: "Default sender email address",
    example: "noreply@yourapp.com",
    category: "Email",
  },
];

const API_ENV_VARS: EnvVariable[] = [
  {
    name: "API_URL",
    required: false,
    type: "url",
    description: "Base URL for API",
    example: "http://localhost:3000/api",
    category: "API",
  },
  {
    name: "CORS_ORIGIN",
    required: false,
    type: "string",
    description: "Allowed CORS origins (comma-separated)",
    example: "http://localhost:3000,https://yourapp.com",
    category: "API",
  },
  {
    name: "RATE_LIMIT_MAX",
    required: false,
    type: "number",
    description: "Maximum requests per rate limit window",
    example: "100",
    default: "100",
    category: "API",
  },
  {
    name: "RATE_LIMIT_WINDOW_MS",
    required: false,
    type: "number",
    description: "Rate limit window in milliseconds",
    example: "60000",
    default: "60000",
    category: "API",
  },
];

const AI_ENV_VARS: EnvVariable[] = [
  {
    name: "OPENAI_API_KEY",
    required: false,
    type: "string",
    description: "OpenAI API key for AI features",
    example: "sk-...",
    sensitive: true,
    category: "AI",
  },
  {
    name: "ANTHROPIC_API_KEY",
    required: false,
    type: "string",
    description: "Anthropic API key for Claude",
    example: "sk-ant-...",
    sensitive: true,
    category: "AI",
  },
];

class EnvValidator {
  /**
   * Validate environment variables against schema
   */
  validate(config: EnvConfig): EnvValidationResult {
    const missing: string[] = [];
    const invalid: Array<{ name: string; error: string }> = [];
    const warnings: string[] = [];

    for (const variable of config.variables) {
      const value = process.env[variable.name];

      // Check required variables
      if (variable.required && !value) {
        missing.push(variable.name);
        continue;
      }

      // Skip validation if not set and not required
      if (!value) continue;

      // Type validation
      const typeError = this.validateType(variable.name, value, variable.type);
      if (typeError) {
        invalid.push({ name: variable.name, error: typeError });
      }

      // Sensitive variable warnings
      if (variable.sensitive && value.length < 16) {
        warnings.push(
          `${variable.name} appears to be too short for a secure value`,
        );
      }
    }

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
      warnings,
    };
  }

  /**
   * Validate value type
   */
  private validateType(
    name: string,
    value: string,
    type: EnvVariable["type"],
  ): string | null {
    switch (type) {
      case "number":
        if (isNaN(Number(value))) {
          return `${name} must be a valid number`;
        }
        break;
      case "boolean":
        if (
          !["true", "false", "1", "0", "yes", "no"].includes(
            value.toLowerCase(),
          )
        ) {
          return `${name} must be a boolean (true/false)`;
        }
        break;
      case "url":
        try {
          new URL(value);
        } catch {
          return `${name} must be a valid URL`;
        }
        break;
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return `${name} must be a valid email address`;
        }
        break;
      case "json":
        try {
          JSON.parse(value);
        } catch {
          return `${name} must be valid JSON`;
        }
        break;
    }
    return null;
  }

  /**
   * Generate .env.example file content
   */
  generateEnvExample(config: EnvConfig): string {
    const lines: string[] = [
      "# Environment Configuration",
      "# Copy this file to .env and fill in the values",
      "#",
      "# Legend:",
      "#   [REQUIRED] - Must be set for the application to start",
      "#   [OPTIONAL] - Has a default value or is not required",
      "#   [SENSITIVE] - Contains secrets, never commit to git",
      "",
    ];

    // Group by category
    const categories = new Map<string, EnvVariable[]>();

    for (const variable of config.variables) {
      const category = variable.category || "General";
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(variable);
    }

    // Generate content by category
    for (const [category, variables] of Array.from(categories.entries())) {
      lines.push(
        `# ═══════════════════════════════════════════════════════════════`,
      );
      lines.push(`# ${category.toUpperCase()}`);
      lines.push(
        `# ═══════════════════════════════════════════════════════════════`,
      );
      lines.push("");

      for (const variable of variables) {
        // Add description comment
        const tags: string[] = [];
        if (variable.required) tags.push("REQUIRED");
        else tags.push("OPTIONAL");
        if (variable.sensitive) tags.push("SENSITIVE");

        lines.push(`# ${variable.description}`);
        lines.push(`# [${tags.join("] [")}]`);

        // Add the variable
        const value = variable.sensitive
          ? ""
          : variable.example || variable.default || "";
        lines.push(`${variable.name}=${value}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate environment config based on project analysis
   */
  async detectProjectEnvNeeds(projectPath: string): Promise<EnvConfig> {
    const variables: EnvVariable[] = [...COMMON_ENV_VARS];
    const detectedCategories = new Set<string>(["App"]);

    // Check for database
    const hasDatabase = await this.hasPackage(projectPath, [
      "prisma",
      "@prisma/client",
      "mongoose",
      "pg",
      "mysql2",
      "sequelize",
    ]);
    if (hasDatabase) {
      variables.push(...DATABASE_ENV_VARS);
      detectedCategories.add("Database");
    }

    // Check for auth
    const hasAuth = await this.hasPackage(projectPath, [
      "jsonwebtoken",
      "passport",
      "next-auth",
      "@auth/core",
      "bcrypt",
    ]);
    if (hasAuth) {
      variables.push(...AUTH_ENV_VARS);
      detectedCategories.add("Auth");
    }

    // Check for email
    const hasEmail = await this.hasPackage(projectPath, [
      "nodemailer",
      "@sendgrid/mail",
      "resend",
      "postmark",
    ]);
    if (hasEmail) {
      variables.push(...EMAIL_ENV_VARS);
      detectedCategories.add("Email");
    }

    // Check for API/Express
    const hasApi = await this.hasPackage(projectPath, [
      "express",
      "fastify",
      "hono",
      "koa",
      "cors",
    ]);
    if (hasApi) {
      variables.push(...API_ENV_VARS);
      detectedCategories.add("API");
    }

    // Check for AI
    const hasAI = await this.hasPackage(projectPath, [
      "openai",
      "@anthropic-ai/sdk",
      "langchain",
    ]);
    if (hasAI) {
      variables.push(...AI_ENV_VARS);
      detectedCategories.add("AI");
    }

    return {
      variables,
      categories: Array.from(detectedCategories),
    };
  }

  /**
   * Check if project has certain packages
   */
  private async hasPackage(
    projectPath: string,
    packages: string[],
  ): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      const content = await fs.promises.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(content);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return packages.some((pkg) => pkg in allDeps);
    } catch {
      return false;
    }
  }

  /**
   * Create validation function code for runtime validation
   */
  generateValidationCode(config: EnvConfig): string {
    const lines: string[] = [
      "/**",
      " * Environment Validation",
      " * Auto-generated by guardrail",
      " * Run this at application startup to validate environment",
      " */",
      "",
      "export interface Env {",
    ];

    // Generate TypeScript interface
    for (const variable of config.variables) {
      const tsType =
        variable.type === "number"
          ? "number"
          : variable.type === "boolean"
            ? "boolean"
            : "string";
      const optional = variable.required ? "" : "?";
      lines.push(`  ${variable.name}${optional}: ${tsType};`);
    }

    lines.push("}");
    lines.push("");
    lines.push("export function validateEnv(): Env {");
    lines.push("  const errors: string[] = [];");
    lines.push("");

    // Generate validation code
    for (const variable of config.variables) {
      if (variable.required) {
        lines.push(`  if (!process.env.${variable.name}) {`);
        lines.push(
          `    errors.push('Missing required environment variable: ${variable.name}');`,
        );
        lines.push("  }");
      }
    }

    lines.push("");
    lines.push("  if (errors.length > 0) {");
    lines.push('    console.error("Environment validation failed:");');
    lines.push('    errors.forEach(e => console.error("  -", e));');
    lines.push("    process.exit(1);");
    lines.push("  }");
    lines.push("");
    lines.push("  return {");

    for (const variable of config.variables) {
      const parser =
        variable.type === "number"
          ? `Number(process.env.${variable.name})`
          : variable.type === "boolean"
            ? `process.env.${variable.name} === 'true'`
            : `process.env.${variable.name}`;
      const defaultValue = variable.default
        ? variable.type === "number"
          ? ` || ${variable.default}`
          : ` || '${variable.default}'`
        : variable.required
          ? ""
          : " || undefined";

      lines.push(`    ${variable.name}: ${parser}${defaultValue},`);
    }

    lines.push("  } as Env;");
    lines.push("}");

    return lines.join("\n");
  }
}

export const envValidator = new EnvValidator();
