# AI Agent Guardrails Kit

## Overview

A comprehensive kit to keep AI agents perfectly on track for your project. Prevents:
- ❌ Agent drift (going off track)
- ❌ ESLint and syntax errors
- ❌ Mock data usage
- ❌ Fake API endpoints
- ❌ Code quality issues

## Quick Start

### 1. Install the Kit

```bash
# Copy all kit files to your project root
# Then run:
npm install
npm run setup
```

### 2. Configure for Your Project

1. **Review ESLint config** (`eslint.config.js`)
   - Adjust rules based on your project needs
   - Add project-specific plugins if needed

2. **Update TypeScript config** (`tsconfig.json`)
   - Adjust path aliases to match your project structure
   - Update include/exclude patterns

3. **Register API Endpoints** (`src/config/api-endpoints.ts`)
   - Register all your actual API endpoints
   - This prevents using mock/fake endpoints

4. **Customize .cursorrules**
   - Add project-specific rules
   - Include your architecture patterns

### 3. Use in Your Workflow

**Before every AI agent session, include this prompt:**

```
IMPORTANT: Follow these guardrails:
1. Create all files in appropriate /src/ subdirectories. Never create files in root.
2. Only use real, registered API endpoints. No mock data or fake endpoints.
3. All code must pass ESLint and TypeScript checks.
4. Follow the project architecture in .cursorrules
```

## What's Included

### 1. ESLint Configuration (`eslint.config.js`)

Strict rules that catch:
- Unused imports/variables
- Type safety issues
- Code quality problems
- Common AI agent mistakes

**Key Rules:**
- No `any` types
- No unused variables
- Proper import ordering
- React hooks rules
- TypeScript strict mode

### 2. TypeScript Configuration (`tsconfig.json`)

Strict type checking:
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noImplicitReturns`: true
- `noUncheckedIndexedAccess`: true

### 3. Pre-commit Hooks (Husky)

Automatically runs on every commit:
- ESLint checks
- Type checking
- API endpoint validation
- Mock data detection

### 4. API Endpoint Validator (`src/lib/api-validator.ts`)

Prevents mock data and fake endpoints:

```typescript
import { validatedFetch, apiValidator } from '@/lib/api-validator';

// Register endpoints when creating API routes
apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
});

// Use validatedFetch instead of fetch
const response = await validatedFetch('/api/users');
```

### 5. Validation Scripts

**Check API Endpoints:**
```bash
npm run validate
```

**Check Project Drift:**
```bash
npm run check-drift
```

**Type Check:**
```bash
npm run type-check
```

**Lint:**
```bash
npm run lint
npm run lint:fix
```

## How It Prevents Issues

### 1. Prevents Agent Drift

- **File Location Validation**: Scripts check that files are in correct locations
- **Structure Validation**: Ensures project follows intended architecture
- **Pre-commit Hooks**: Catches issues before they're committed

### 2. Prevents ESLint/Syntax Errors

- **Strict ESLint Rules**: Catches errors before they cause problems
- **TypeScript Strict Mode**: Catches type errors early
- **Auto-fix on Commit**: Automatically fixes fixable issues

### 3. Prevents Mock Data

- **Pattern Detection**: Scans for common mock data patterns
- **API Validator**: Ensures only real endpoints are used
- **Validation Scripts**: Run checks before commits

### 4. Enforces Real API Endpoints

- **Endpoint Registry**: All endpoints must be registered
- **Validation Wrapper**: `validatedFetch()` checks endpoints before calling
- **Pre-commit Checks**: Validates all API calls in staged files

## Integration with AI Agents

### For Cursor/Claude/ChatGPT

Add this to the start of every prompt:

```
## CRITICAL: AI AGENT GUARDRAILS

Before doing anything:
1. Read .cursorrules file
2. Check existing project structure
3. Only use registered API endpoints (check src/config/api-endpoints.ts)
4. Never create mock data or fake endpoints
5. All files must go in /src/ subdirectories, never root
6. Run validation: npm run validate && npm run type-check

When creating files:
- Always specify full path: /src/features/[name]/components/Component.tsx
- Check if similar file exists first
- Follow feature-based architecture
```

### For Automated Workflows

Add to your CI/CD:

```yaml
# .github/workflows/validate.yml
name: Validate
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run type-check
      - run: npm run lint
      - run: npm run validate
      - run: npm run check-drift
```

## Customization

### Adding Custom Validation Rules

Edit `scripts/validate-api-endpoints.js`:

```javascript
const CUSTOM_PATTERNS = [
  // Add your patterns
  /your-pattern/gi,
];
```

### Adding Allowed External APIs

Edit `scripts/validate-api-endpoints.js`:

```javascript
const ALLOWED_EXTERNAL_APIS = [
  'api.github.com',
  'api.stripe.com',
  // Add your APIs
];
```

### Adjusting ESLint Rules

Edit `eslint.config.js`:

```javascript
rules: {
  // Make rules less strict if needed
  '@typescript-eslint/no-explicit-any': 'warn', // instead of 'error'
}
```

## Troubleshooting

### "Too many false positives"

- Adjust pattern matching in validation scripts
- Add exceptions for legitimate cases
- Use `// eslint-disable` comments sparingly

### "Pre-commit hooks failing"

- Run `npm run lint:fix` to auto-fix issues
- Check `npm run type-check` for type errors
- Review validation script output

### "API validator too strict"

- Register endpoints in `src/config/api-endpoints.ts`
- Use `validatedFetch` wrapper for all API calls
- Check that endpoints match registered patterns

## Best Practices

1. **Register endpoints immediately** when creating API routes
2. **Run validation frequently** during development
3. **Fix issues early** before they accumulate
4. **Keep .cursorrules updated** with project changes
5. **Review pre-commit output** to catch issues early

## File Structure

```
your-project/
├── .cursorrules              # AI agent rules
├── .husky/                   # Git hooks
│   └── pre-commit
├── eslint.config.js          # ESLint configuration
├── tsconfig.json              # TypeScript configuration
├── .prettierrc                # Prettier configuration
├── package.json               # Dependencies
├── scripts/
│   ├── setup-kit.js           # Setup script
│   ├── validate-api-endpoints.js
│   ├── validate-no-mock-data.js
│   └── check-project-drift.js
└── src/
    ├── config/
    │   └── api-endpoints.ts   # Endpoint registry
    └── lib/
        └── api-validator.ts   # API validation utilities
```

## Support

If you encounter issues:
1. Check the validation script output
2. Review ESLint/TypeScript errors
3. Ensure all endpoints are registered
4. Verify project structure matches architecture

---

**Version:** 1.0.0  
**Last Updated:** December 2024

