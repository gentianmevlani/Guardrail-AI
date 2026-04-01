#!/usr/bin/env node

/**
 * Setup Script for AI Agent Guardrails Kit
 * 
 * Installs and configures all guardrails for a project.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up AI Agent Guardrails Kit...\n');

// Check if package.json exists
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found. Please run this in a project directory.');
  process.exit(1);
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier eslint-plugin-import eslint-plugin-react eslint-plugin-react-hooks husky lint-staged prettier typescript', {
    stdio: 'inherit',
  });
  console.log('✅ Dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

// Setup Husky
console.log('🐕 Setting up Husky...');
try {
  if (!fs.existsSync('.husky')) {
    execSync('npx husky install', { stdio: 'inherit' });
  }
  execSync('npx husky add .husky/pre-commit "npm run pre-commit"', {
    stdio: 'inherit',
  });
  console.log('✅ Husky configured\n');
} catch (error) {
  console.warn('⚠️  Husky setup had issues. You may need to configure it manually.');
}

// Create .cursorrules file
console.log('📝 Creating .cursorrules file...');
const cursorRules = `# AI Agent Guardrails

## CRITICAL RULES

### 1. FILE ORGANIZATION
- NEVER create files in root directory (except allowed config files)
- ALWAYS specify full file paths when creating files
- Use feature-based organization: /src/features/[name]/
- Shared code goes in /src/components, /src/lib, /src/hooks, etc.

### 2. NO MOCK DATA
- NEVER use mock data, fake endpoints, or placeholder data
- ALWAYS use real API endpoints that are registered
- If an endpoint doesn't exist, create it first, then use it
- No hardcoded arrays of objects with fake data

### 3. API ENDPOINTS
- Only use registered API endpoints
- Register new endpoints using apiValidator.registerEndpoint()
- Use validatedFetch() wrapper for all API calls
- Never use external mock APIs (jsonplaceholder, reqres, etc.)

### 4. CODE QUALITY
- All code must pass ESLint and TypeScript checks
- Fix all linting errors before committing
- Use proper TypeScript types (no 'any')
- Follow the project's architecture patterns

### 5. VALIDATION
- Run 'npm run validate' before committing
- Run 'npm run type-check' to ensure type safety
- Run 'npm run check-drift' to verify project structure

## ALLOWED ROOT FILES
Only these files are allowed in root:
- package.json, tsconfig.json, *.config.js/ts
- .env files, .gitignore, README.md
- LICENSE, Dockerfile, docker-compose.yml

## FILE LOCATIONS
- Components: /src/components/ or /src/features/[name]/components/
- Hooks: /src/hooks/ or /src/features/[name]/hooks/
- Services: /src/services/ or /src/features/[name]/services/
- Types: /src/types/ or /src/features/[name]/types/
- API Routes: /src/app/api/[resource]/route.ts
- Utils: /src/lib/ or /src/utils/

## BEFORE CREATING ANY FILE
1. Check if it belongs in a feature directory
2. Verify the full path is correct
3. Ensure no similar file exists
4. Use proper naming conventions
`;

fs.writeFileSync('.cursorrules', cursorRules);
console.log('✅ .cursorrules created\n');

// Create API endpoints registry template
console.log('📋 Creating API endpoints registry...');
const apiRegistryPath = path.join(process.cwd(), 'src', 'config', 'api-endpoints.ts');
const apiRegistryDir = path.dirname(apiRegistryPath);

if (!fs.existsSync(apiRegistryDir)) {
  fs.mkdirSync(apiRegistryDir, { recursive: true });
}

const apiRegistryContent = `/**
 * API Endpoints Registry
 * 
 * Register all API endpoints here. This prevents using mock data or fake endpoints.
 * Import and use apiValidator.registerEndpoint() when creating new API routes.
 */

import { apiValidator } from '@/lib/api-validator';

// Register your API endpoints here
// Example:
// apiValidator.registerEndpoint({
//   path: '/api/users',
//   method: 'GET',
//   description: 'Get all users',
// });

// Auto-register from Next.js API routes (if using Next.js)
// You can also manually register endpoints as you create them

export function registerAllEndpoints() {
  // Add endpoint registrations here
  // This function can be called during app initialization
}
`;

fs.writeFileSync(apiRegistryPath, apiRegistryContent);
console.log('✅ API endpoints registry created\n');

console.log('✅ Setup complete!\n');
console.log('Next steps:');
console.log('1. Review and customize eslint.config.js and tsconfig.json');
console.log('2. Register your API endpoints in src/config/api-endpoints.ts');
console.log('3. Add your project-specific rules to .cursorrules');
console.log('4. Run "npm run validate" to test the setup\n');

