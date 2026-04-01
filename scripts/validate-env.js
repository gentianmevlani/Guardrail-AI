#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 * 
 * Validates all required environment variables before startup.
 * Fails fast with readable error messages if validation fails.
 */

const requiredEnvVars = {
  // Always required
  always: [
    { name: 'DATABASE_URL', description: 'PostgreSQL connection string' },
    { name: 'JWT_SECRET', description: 'JWT signing secret (min 32 chars)', minLength: 32 },
  ],
  
  // Required in production/staging
  production: [
    { name: 'NEXT_PUBLIC_API_URL', description: 'Public API URL for web-ui' },
  ],
};

function validateEnv() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  
  console.log(`🔍 Validating environment variables (NODE_ENV: ${process.env.NODE_ENV || 'development'})...\n`);
  
  // Validate always-required vars
  for (const envVar of requiredEnvVars.always) {
    const value = process.env[envVar.name];
    
    if (!value) {
      errors.push(`Missing required: ${envVar.name} - ${envVar.description}`);
      continue;
    }
    
    // Check minimum length if specified
    if (envVar.minLength && value.length < envVar.minLength) {
      errors.push(`${envVar.name} must be at least ${envVar.minLength} characters (got ${value.length})`);
    }
    
    // Security checks
    if (envVar.name === 'DATABASE_URL') {
      if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
        errors.push(`DATABASE_URL must be a PostgreSQL connection string (postgresql://...)`);
      }
      if (isProduction && value.includes('localhost')) {
        errors.push(`DATABASE_URL should not use localhost in production`);
      }
    }
    
    if (envVar.name === 'JWT_SECRET') {
      if (isProduction && (
        value.includes('dev') || 
        value.includes('test') || 
        value.includes('example') ||
        value === 'your-secret-key-here'
      )) {
        warnings.push(`JWT_SECRET appears to be a development secret - use a strong random secret in production`);
      }
    }
  }
  
  // Validate production-specific vars
  if (isProduction) {
    for (const envVar of requiredEnvVars.production) {
      const value = process.env[envVar.name];
      if (!value) {
        errors.push(`Missing required in production: ${envVar.name} - ${envVar.description}`);
      } else if (value.includes('localhost')) {
        errors.push(`${envVar.name} should not use localhost in production`);
      }
    }
  }
  
  // Output results
  if (warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
    console.warn('');
  }
  
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:\n');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\n🚨 Application will exit due to invalid configuration.\n');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed!\n');
}

// Run validation
validateEnv();
