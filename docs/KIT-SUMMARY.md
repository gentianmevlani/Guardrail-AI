# AI Agent Guardrails Kit - Summary

## What This Kit Does

This kit provides **comprehensive guardrails** to keep AI agents perfectly on track for your project. It prevents:

1. **Agent Drift** - Keeps agents following your project structure
2. **ESLint/Syntax Errors** - Catches errors before they cause problems
3. **Mock Data Usage** - Prevents fake data and placeholder content
4. **Fake API Endpoints** - Ensures only real, registered endpoints are used
5. **Code Quality Issues** - Enforces best practices automatically

## Files Included

### Configuration Files
- ✅ `eslint.config.js` - Strict ESLint rules
- ✅ `tsconfig.json` - TypeScript strict configuration
- ✅ `.prettierrc` - Code formatting
- ✅ `.cursorrules` - AI agent rules for Cursor
- ✅ `.husky/pre-commit` - Git pre-commit hooks
- ✅ `package.json` - Dependencies and scripts

### Core Utilities
- ✅ `src/lib/api-validator.ts` - API endpoint validation
- ✅ `src/config/api-endpoints.ts` - Endpoint registry

### Validation Scripts
- ✅ `scripts/validate-api-endpoints.js` - Scans for fake endpoints
- ✅ `scripts/validate-no-mock-data.js` - Detects mock data patterns
- ✅ `scripts/check-project-drift.js` - Validates project structure
- ✅ `scripts/setup-kit.js` - Automated setup

### Documentation
- ✅ `AI-AGENT-GUARDRAILS-KIT.md` - Full documentation
- ✅ `INTEGRATION-GUIDE.md` - Step-by-step setup
- ✅ `AI-AGENT-PROMPT-TEMPLATE.md` - Prompt templates

## Quick Start

1. **Copy files to your project**
2. **Run setup:**
   ```bash
   npm install
   npm run setup
   ```
3. **Register your API endpoints** in `src/config/api-endpoints.ts`
4. **Start using validatedFetch()** instead of fetch()

## Key Features

### 1. Pre-commit Hooks
Automatically runs on every commit:
- ESLint checks
- TypeScript type checking
- API endpoint validation
- Mock data detection

### 2. API Endpoint Validation
```typescript
import { validatedFetch } from '@/lib/api-validator';

// This will validate the endpoint exists before calling
const response = await validatedFetch('/api/users');
```

### 3. Project Drift Detection
```bash
npm run check-drift
```
Checks for files in wrong locations, missing directories, etc.

### 4. Mock Data Detection
```bash
npm run validate
```
Scans codebase for mock data patterns and fake endpoints.

## Usage in AI Prompts

Always start prompts with:

```
IMPORTANT: Follow guardrails: 
1) Files in /src/ subdirectories only (never root)
2) No mock data - only real registered API endpoints
3) All code must pass ESLint/TypeScript
4) Register endpoints in src/config/api-endpoints.ts
```

See `AI-AGENT-PROMPT-TEMPLATE.md` for full prompt templates.

## Scripts Available

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run type-check` - TypeScript type checking
- `npm run validate` - Validate API endpoints and check for mock data
- `npm run check-drift` - Check project structure drift
- `npm run setup` - Initial setup

## Integration

See `INTEGRATION-GUIDE.md` for detailed integration steps.

## Support

- Check validation script output for issues
- Review ESLint/TypeScript errors
- Ensure all endpoints are registered
- Verify project structure matches architecture

---

**Ready to keep your AI agents perfectly on track!** 🎯

