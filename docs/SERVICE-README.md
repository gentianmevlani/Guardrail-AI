# AI Agent Guardrails - NPM Package

## Installation

### As an NPM Package

```bash
# Install globally
npm install -g ai-agent-guardrails

# Or install locally in your project
npm install --save-dev ai-agent-guardrails
```

### Using the CLI

```bash
# Install guardrails to current directory
npx ai-agent-guardrails install

# Or install to a specific directory
npx ai-agent-guardrails install ./my-project
```

### Manual Installation

1. Clone or download this repository
2. Copy all files to your project
3. Run `npm install` in your project
4. Run `npm run setup`

## Quick Start

```bash
# 1. Install the package
npm install --save-dev ai-agent-guardrails

# 2. Run the installer
npx ai-agent-guardrails install

# 3. Register your API endpoints
# Edit src/config/api-endpoints.ts

# 4. Start using validatedFetch
import { validatedFetch } from '@/lib/api-validator';
```

## What Gets Installed

- ✅ ESLint configuration with strict rules
- ✅ TypeScript configuration with strict checking
- ✅ Prettier configuration
- ✅ Pre-commit hooks (Husky)
- ✅ API endpoint validator
- ✅ Validation scripts
- ✅ .cursorrules for AI agents
- ✅ Project structure validation

## Usage

### In Your Code

```typescript
import { validatedFetch, apiValidator } from '@/lib/api-validator';

// Register endpoints when creating API routes
apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
});

// Use validatedFetch instead of fetch
const response = await validatedFetch('/api/users');
const data = await response.json();
```

### Validation Scripts

```bash
# Check for mock data and fake endpoints
npm run validate

# Check project structure drift
npm run check-drift

# Type check
npm run type-check

# Lint
npm run lint
npm run lint:fix
```

## Features

- 🛡️ **Prevents Agent Drift** - Keeps AI agents following your project structure
- ✅ **Catches Errors Early** - ESLint and TypeScript strict mode
- 🚫 **No Mock Data** - Detects and prevents mock data usage
- 🔗 **Real Endpoints Only** - Validates API endpoints before use
- 🔄 **Auto-validation** - Pre-commit hooks catch issues automatically

## Configuration

### Customize ESLint Rules

Edit `eslint.config.js` in your project after installation.

### Customize TypeScript

Edit `tsconfig.json` in your project after installation.

### Register API Endpoints

Edit `src/config/api-endpoints.ts`:

```typescript
import { apiValidator } from '@/lib/api-validator';

apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
  description: 'Get all users',
});
```

## For AI Agents

Add this to the start of every AI prompt:

```
IMPORTANT: Follow guardrails: 
1) Files in /src/ subdirectories only (never root)
2) No mock data - only real registered API endpoints
3) All code must pass ESLint/TypeScript
4) Register endpoints in src/config/api-endpoints.ts
```

## Publishing

To publish this package to npm:

```bash
# 1. Update version in package.json
npm version patch|minor|major

# 2. Publish
npm publish

# 3. Tag release
git tag v1.0.0
git push --tags
```

## License

MIT

## Support

- Documentation: See `AI-AGENT-GUARDRAILS-KIT.md`
- Integration Guide: See `INTEGRATION-GUIDE.md`
- Issues: GitHub Issues

