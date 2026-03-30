# Quick Install Guide

## Option 1: NPM Package (Easiest)

```bash
# Install and setup in one command
npx ai-agent-guardrails install
```

This will:
- ✅ Copy all configuration files
- ✅ Install required dependencies
- ✅ Set up pre-commit hooks
- ✅ Create API validator files
- ✅ Update your package.json

## Option 2: Manual Installation

### Step 1: Install Package

```bash
npm install --save-dev ai-agent-guardrails
```

### Step 2: Run Installer

```bash
npx ai-agent-guardrails install
```

### Step 3: Register API Endpoints

Edit `src/config/api-endpoints.ts`:

```typescript
import { apiValidator } from '@/lib/api-validator';

apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
});
```

### Step 4: Use validatedFetch

```typescript
import { validatedFetch } from '@/lib/api-validator';

const response = await validatedFetch('/api/users');
```

## Option 3: Copy Files Manually

1. Copy these files to your project:
   - `eslint.config.js`
   - `tsconfig.json`
   - `.prettierrc`
   - `.cursorrules`
   - `.husky/pre-commit`
   - `scripts/` directory
   - `src/lib/api-validator.ts`
   - `src/config/api-endpoints.ts`

2. Install dependencies:
   ```bash
   npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-prettier eslint-plugin-import eslint-plugin-react eslint-plugin-react-hooks husky lint-staged prettier typescript
   ```

3. Set up Husky:
   ```bash
   npx husky install
   ```

## Verify Installation

```bash
# Check validation works
npm run validate

# Check type checking
npm run type-check

# Check linting
npm run lint
```

## Next Steps

1. ✅ Customize `eslint.config.js` for your project
2. ✅ Update `tsconfig.json` paths
3. ✅ Register your API endpoints
4. ✅ Add project-specific rules to `.cursorrules`
5. ✅ Start using `validatedFetch()` in your code

## Troubleshooting

### "Command not found"
Make sure you have Node.js 16+ installed:
```bash
node --version
```

### "Permission denied"
On Unix systems, you may need:
```bash
chmod +x cli.js
```

### "Package not found"
If publishing to npm, make sure the package name is available:
```bash
npm search ai-agent-guardrails
```

## Support

- See `SERVICE-README.md` for package usage
- See `INTEGRATION-GUIDE.md` for detailed setup
- See `AI-AGENT-GUARDRAILS-KIT.md` for full documentation

