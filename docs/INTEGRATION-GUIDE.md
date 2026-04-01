# Integration Guide: AI Agent Guardrails Kit

## Step-by-Step Integration

### Step 1: Copy Kit Files

Copy these files to your project root:

```
✅ eslint.config.js
✅ tsconfig.json
✅ .prettierrc
✅ .husky/pre-commit
✅ package.json (merge with existing)
✅ scripts/ (entire directory)
✅ src/lib/api-validator.ts
✅ src/config/api-endpoints.ts
✅ .cursorrules
✅ AI-AGENT-GUARDRAILS-KIT.md
```

### Step 2: Install Dependencies

```bash
npm install --save-dev \
  eslint \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-config-prettier \
  eslint-plugin-import \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  husky \
  lint-staged \
  prettier \
  typescript
```

Or merge into your existing `package.json`:

```json
{
  "devDependencies": {
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.29.1",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",
    "prettier": "^3.1.1",
    "typescript": "^5.3.3"
  },
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "type-check": "tsc --noEmit",
    "validate": "node scripts/validate-api-endpoints.js && node scripts/validate-no-mock-data.js",
    "pre-commit": "lint-staged",
    "check-drift": "node scripts/check-project-drift.js"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### Step 3: Run Setup Script

```bash
npm run setup
```

This will:
- Install dependencies
- Configure Husky
- Create `.cursorrules`
- Set up API endpoint registry

### Step 4: Configure for Your Project

#### A. Update TypeScript Paths

Edit `tsconfig.json` to match your project's path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      // Add your project-specific paths
    }
  }
}
```

#### B. Register Your API Endpoints

Edit `src/config/api-endpoints.ts`:

```typescript
import { apiValidator } from '@/lib/api-validator';

// Register all your actual API endpoints
apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
  description: 'Get all users',
});

apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'POST',
  description: 'Create a user',
});

apiValidator.registerEndpoint({
  path: '/api/users/[id]',
  method: 'GET',
  description: 'Get user by ID',
});

// ... register all endpoints
```

#### C. Update ESLint Config

If you're not using React, remove React-specific rules:

```javascript
// eslint.config.js
extends: [
  'eslint:recommended',
  'plugin:@typescript-eslint/recommended',
  // Remove 'plugin:react/recommended' if not using React
],
```

#### D. Customize .cursorrules

Add your project-specific architecture rules:

```
## PROJECT-SPECIFIC RULES

- Use Next.js App Router
- Feature-based architecture in /src/features/
- Shared components in /src/components/ui/
- API routes in /src/app/api/
```

### Step 5: Replace fetch() with validatedFetch()

Find all `fetch()` calls and replace with `validatedFetch()`:

```typescript
// Before
const response = await fetch('/api/users');

// After
import { validatedFetch } from '@/lib/api-validator';
const response = await validatedFetch('/api/users');
```

### Step 6: Test the Setup

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Validate API endpoints
npm run validate

# Check project drift
npm run check-drift
```

### Step 7: Configure Pre-commit Hooks

If Husky wasn't set up automatically:

```bash
npx husky install
npx husky add .husky/pre-commit "npm run pre-commit"
```

### Step 8: Add to CI/CD (Optional)

Add to `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run validate
      - run: npm run check-drift
```

## Migration Checklist

- [ ] All kit files copied to project
- [ ] Dependencies installed
- [ ] Setup script run successfully
- [ ] TypeScript paths configured
- [ ] API endpoints registered
- [ ] ESLint config customized
- [ ] .cursorrules updated with project rules
- [ ] All `fetch()` replaced with `validatedFetch()`
- [ ] Pre-commit hooks working
- [ ] All validation scripts passing
- [ ] CI/CD updated (if applicable)

## Common Issues & Solutions

### Issue: "Module not found: @/lib/api-validator"

**Solution:** Update `tsconfig.json` paths to match your project structure.

### Issue: "Too many ESLint errors"

**Solution:** 
1. Run `npm run lint:fix` to auto-fix
2. Gradually fix remaining errors
3. Temporarily disable strict rules if needed

### Issue: "Pre-commit hook fails"

**Solution:**
1. Fix linting errors: `npm run lint:fix`
2. Fix type errors: `npm run type-check`
3. Fix validation issues: `npm run validate`

### Issue: "API validator blocking legitimate calls"

**Solution:**
1. Register the endpoint in `src/config/api-endpoints.ts`
2. Check endpoint path matches registered pattern
3. Use `validatedFetch()` wrapper

## Next Steps

1. **Train your team** on the guardrails
2. **Update documentation** with project-specific rules
3. **Monitor validation output** to catch issues early
4. **Iterate on rules** based on common mistakes

## Support

For issues or questions:
1. Check validation script output
2. Review ESLint/TypeScript errors
3. Ensure all endpoints are registered
4. Verify project structure

---

**Ready to use!** Your AI agents will now stay perfectly on track. 🎯

