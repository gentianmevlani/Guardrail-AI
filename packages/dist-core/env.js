"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
exports.getEnv = getEnv;
exports.checkRequiredEnv = checkRequiredEnv;
exports.isDevelopment = isDevelopment;
exports.isProduction = isProduction;
exports.isTest = isTest;
const zod_1 = require("zod");
// Build DATABASE_URL from individual PG* variables if DATABASE_URL is invalid
function getDatabaseUrl() {
    const dbUrl = process.env['DATABASE_URL'];
    // Check if DATABASE_URL is valid (starts with postgresql:// or postgres://)
    if (dbUrl && (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'))) {
        return dbUrl;
    }
    // Fallback: Build from individual PG* variables (Replit provides these)
    const pgHost = process.env['PGHOST'];
    const pgPort = process.env['PGPORT'] || '5432';
    const pgUser = process.env['PGUSER'] || 'postgres';
    const pgPassword = process.env['PGPASSWORD'] || 'password';
    const pgDatabase = process.env['PGDATABASE'];
    if (pgHost && pgDatabase) {
        const constructedUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
        // Update process.env so other parts of the app can use it
        process.env['DATABASE_URL'] = constructedUrl;
        return constructedUrl;
    }
    // Return original (will fail validation but with helpful error)
    return dbUrl || '';
}
// Environment variable schema
const envSchema = zod_1.z.object({
    // Node environment
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test', 'staging']).default('development'),
    // Server configuration
    PORT: zod_1.z.string().transform(Number).default('3000'),
    HOST: zod_1.z.string().default('localhost'),
    // Database - use custom getter that falls back to PG* variables
    DATABASE_URL: zod_1.z.string().url('Invalid database URL format'),
    // Authentication
    JWT_SECRET: zod_1.z.string().min(32, 'JWT secret must be at least 32 characters'),
    JWT_REFRESH_SECRET: zod_1.z.string().optional(),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    // GitHub OAuth (required in production)
    GITHUB_CLIENT_ID: zod_1.z.string().optional(),
    GITHUB_CLIENT_SECRET: zod_1.z.string().optional(),
    GITHUB_CALLBACK_URL: zod_1.z.string().url().optional(),
    GITHUB_WEBHOOK_SECRET: zod_1.z.string().optional(),
    // Stripe (required for billing)
    STRIPE_SECRET_KEY: zod_1.z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: zod_1.z.string().optional(),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().optional(),
    STRIPE_PRICE_ID_STARTER: zod_1.z.string().optional(),
    STRIPE_PRICE_ID_PRO: zod_1.z.string().optional(),
    STRIPE_PRICE_ID_ENTERPRISE: zod_1.z.string().optional(),
    // API URLs
    API_BASE_URL: zod_1.z.string().url().optional(),
    NEXT_PUBLIC_API_URL: zod_1.z.string().url().optional(),
    NEXT_PUBLIC_APP_URL: zod_1.z.string().url().optional(),
    // OpenAI (optional for development)
    OPENAI_API_KEY: zod_1.z.string().optional(),
    // Redis (optional)
    REDIS_URL: zod_1.z.string().optional(),
    // CORS
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:3000'),
    // API Rate Limiting
    RATE_LIMIT_WINDOW_MS: zod_1.z.string().transform(Number).default('900000'),
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.string().transform(Number).default('100'),
    // Monitoring
    SENTRY_DSN: zod_1.z.string().optional(),
    SENTRY_ORG: zod_1.z.string().optional(),
    SENTRY_PROJECT: zod_1.z.string().optional(),
    // Feature flags
    ENABLE_METRICS: zod_1.z.string().transform(val => val === 'true').default('false'),
    ENABLE_AI_FEATURES: zod_1.z.string().transform(val => val === 'true').default('true'),
    Guardrail_DEMO_MODE: zod_1.z.string().transform(val => val === 'true').default('false'),
    Guardrail_POLICY_STRICT: zod_1.z.string().transform(val => val === 'true').default('false'),
});
// Validate and parse environment variables
function validateEnv() {
    try {
        // Fix DATABASE_URL before validation if needed
        getDatabaseUrl();
        const env = envSchema.parse(process.env);
        // Additional production/staging checks
        const isProdLike = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
        if (isProdLike) {
            const productionErrors = [];
            const productionWarnings = [];
            // =======================================================================
            // CRITICAL: Required for production
            // =======================================================================
            // GitHub OAuth is optional for now
            // if (!process.env['GITHUB_CLIENT_ID']) {
            //   productionErrors.push('GITHUB_CLIENT_ID is required in production');
            // }
            // if (!process.env['GITHUB_CLIENT_SECRET']) {
            //   productionErrors.push('GITHUB_CLIENT_SECRET is required in production');
            // }
            // API URL must be configured
            if (!process.env['API_BASE_URL'] && !process.env['NEXT_PUBLIC_API_URL']) {
                productionErrors.push('API_BASE_URL or NEXT_PUBLIC_API_URL is required in production');
            }
            // =======================================================================
            // SECURITY: No localhost in production
            // =======================================================================
            if (env.CORS_ORIGIN.includes('localhost')) {
                productionErrors.push('CORS_ORIGIN should not include localhost in production');
            }
            if (env.DATABASE_URL.includes('localhost')) {
                productionErrors.push('DATABASE_URL should not use localhost in production');
            }
            if (env.HOST === 'localhost') {
                productionErrors.push('HOST should not be localhost in production (use 0.0.0.0)');
            }
            // Check callback URLs don't use localhost
            if (process.env['GITHUB_CALLBACK_URL']?.includes('localhost')) {
                productionErrors.push('GITHUB_CALLBACK_URL should not use localhost in production');
            }
            // =======================================================================
            // WARNINGS: Recommended but not blocking
            // =======================================================================
            // Stripe is needed for billing
            if (!process.env['STRIPE_SECRET_KEY']) {
                productionWarnings.push('STRIPE_SECRET_KEY not set - billing features will be disabled');
            }
            if (!process.env['STRIPE_WEBHOOK_SECRET']) {
                productionWarnings.push('STRIPE_WEBHOOK_SECRET not set - webhook verification disabled');
            }
            // Monitoring - disabled silently
            // if (!process.env['SENTRY_DSN']) {
            //   productionWarnings.push('SENTRY_DSN not set - error monitoring disabled');
            // }
            // Redis for caching/sessions - disabled silently  
            // if (!process.env['REDIS_URL']) {
            //   productionWarnings.push('REDIS_URL not set - using in-memory caching');
            // }
            // Output warnings
            if (productionWarnings.length > 0) {
                console.warn('\n⚠️  Production warnings:');
                productionWarnings.forEach(warning => console.warn(`  - ${warning}`));
                console.warn('');
            }
            // Exit on errors
            if (productionErrors.length > 0) {
                console.error('\n❌ Production environment validation failed:');
                productionErrors.forEach(error => console.error(`  - ${error}`));
                console.error('\n🚨 Application will exit due to invalid production configuration.\n');
                process.exit(1);
            }
        }
        return env;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('❌ Invalid environment variables:');
            error.errors.forEach(err => {
                console.error(`  - ${err.path.join('.')}: ${err.message}`);
            });
            // Always exit on validation errors
            console.error('\n🚨 Application will exit due to invalid configuration.\n');
            process.exit(1);
        }
        throw error;
    }
}
// Get validated environment (cached)
let cachedEnv = null;
function getEnv() {
    if (!cachedEnv) {
        cachedEnv = validateEnv();
    }
    return cachedEnv;
}
// Check if required environment variables are set
function checkRequiredEnv() {
    const isProd = process.env['NODE_ENV'] === 'production';
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    // Additional requirements in production
    if (isProd) {
        required.push('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET');
    }
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        if (isProd) {
            console.error('\n🚨 Production deployment requires all environment variables to be set.\n');
            process.exit(1);
        }
    }
}
// Development environment check
function isDevelopment() {
    return getEnv().NODE_ENV === 'development';
}
function isProduction() {
    return getEnv().NODE_ENV === 'production';
}
function isTest() {
    return getEnv().NODE_ENV === 'test';
}
