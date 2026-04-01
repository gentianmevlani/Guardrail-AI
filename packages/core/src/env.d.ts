import { z } from "zod";
declare const envSchema: z.ZodObject<
  {
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    HOST: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodString;
    JWT_SECRET: z.ZodString;
    OPENAI_API_KEY: z.ZodOptional<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    CORS_ORIGIN: z.ZodDefault<z.ZodString>;
    RATE_LIMIT_WINDOW_MS: z.ZodDefault<
      z.ZodEffects<z.ZodString, number, string>
    >;
    RATE_LIMIT_MAX_REQUESTS: z.ZodDefault<
      z.ZodEffects<z.ZodString, number, string>
    >;
    GITHUB_WEBHOOK_SECRET: z.ZodOptional<z.ZodString>;
    SENTRY_DSN: z.ZodOptional<z.ZodString>;
    ENABLE_METRICS: z.ZodDefault<z.ZodEffects<z.ZodString, boolean, string>>;
    ENABLE_AI_FEATURES: z.ZodDefault<
      z.ZodEffects<z.ZodString, boolean, string>
    >;
  },
  "strip",
  z.ZodTypeAny,
  {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    HOST: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    CORS_ORIGIN: string;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    ENABLE_METRICS: boolean;
    ENABLE_AI_FEATURES: boolean;
    OPENAI_API_KEY?: string | undefined;
    REDIS_URL?: string | undefined;
    GITHUB_WEBHOOK_SECRET?: string | undefined;
    SENTRY_DSN?: string | undefined;
  },
  {
    DATABASE_URL: string;
    JWT_SECRET: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: string | undefined;
    HOST?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
    REDIS_URL?: string | undefined;
    CORS_ORIGIN?: string | undefined;
    RATE_LIMIT_WINDOW_MS?: string | undefined;
    RATE_LIMIT_MAX_REQUESTS?: string | undefined;
    GITHUB_WEBHOOK_SECRET?: string | undefined;
    SENTRY_DSN?: string | undefined;
    ENABLE_METRICS?: string | undefined;
    ENABLE_AI_FEATURES?: string | undefined;
  }
>;
export type Env = z.infer<typeof envSchema>;
export declare function validateEnv(): Env;
export declare function getEnv(): Env;
export declare function checkRequiredEnv(): void;
export declare function isDevelopment(): boolean;
export declare function isProduction(): boolean;
export declare function isTest(): boolean;
export {};
//# sourceMappingURL=env.d.ts.map
