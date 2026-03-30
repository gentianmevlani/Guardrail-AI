/**
 * Environment Validation
 * 
 * Validates that all required environment variables are present in production.
 * Fails fast if critical configuration is missing.
 */

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
}

const REQUIRED_ENV: EnvConfig[] = [
  // Database
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  
  // Authentication
  { name: 'JWT_SECRET', required: true, description: 'JWT signing secret (min 32 chars)' },
  { name: 'GITHUB_CLIENT_ID', required: false, description: 'GitHub OAuth client ID' },
  { name: 'GITHUB_CLIENT_SECRET', required: false, description: 'GitHub OAuth client secret' },
  
  // API Configuration
  { name: 'API_BASE_URL', required: true, description: 'API base URL for external access' },
  { name: 'NEXT_PUBLIC_API_URL', required: true, description: 'Public API URL for frontend' },
  
  // Redis (if used)
  { name: 'REDIS_URL', required: false, description: 'Redis connection string' },
  
  // Stripe (if payments enabled)
  { name: 'STRIPE_SECRET_KEY', required: false, description: 'Stripe API secret key' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: false, description: 'Stripe webhook secret' },
  
  // WebSocket
  { name: 'WS_URL', required: true, description: 'WebSocket server URL' },
  
  // CORS
  { name: 'ALLOWED_ORIGINS', required: true, description: 'Comma-separated list of allowed origins' },
];

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const invalid: string[] = [];

  console.log(`🔍 Validating environment configuration (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);

  for (const env of REQUIRED_ENV) {
    const value = process.env[env.name];
    
    if (env.required && !value) {
      missing.push(env.name);
      continue;
    }

    // Special validations
    if (env.name === 'JWT_SECRET' && value && value.length < 32) {
      invalid.push(`${env.name} (must be at least 32 characters)`);
    }

    if (env.name === 'ALLOWED_ORIGINS' && value && !value.includes('localhost')) {
      // In production, we shouldn't have localhost in allowed origins
      if (isProduction) {
        invalid.push(`${env.name} (should not include localhost in production)`);
      }
    }

    if (env.name === 'DATABASE_URL' && value && value.includes('localhost')) {
      // In production, database should not be localhost
      if (isProduction) {
        invalid.push(`${env.name} (should not use localhost in production)`);
      }
    }
  }

  // Report errors
  if (missing.length > 0 || invalid.length > 0) {
    console.error('\n❌ Environment validation failed!\n');
    
    if (missing.length > 0) {
      console.error('Missing required environment variables:');
      missing.forEach(name => {
        const config = REQUIRED_ENV.find(e => e.name === name);
        console.error(`  - ${name}: ${config?.description}`);
      });
      console.error('');
    }

    if (invalid.length > 0) {
      console.error('Invalid environment variables:');
      invalid.forEach(name => console.error(`  - ${name}`));
      console.error('');
    }

    if (isProduction) {
      console.error('🚨 In production mode, application will exit due to invalid configuration.\n');
      process.exit(1);
    } else {
      console.warn('⚠️  In development mode, continuing with invalid configuration.\n');
    }
  } else {
    console.log('✅ Environment validation passed!\n');
  }
}

/**
 * Get a list of all environment variables that should be set in production
 */
export function getProductionEnvList(): EnvConfig[] {
  return REQUIRED_ENV.filter(env => env.required);
}

/**
 * Check if we're running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
