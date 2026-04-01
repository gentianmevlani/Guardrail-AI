# Using AI Agent Guardrails as a Service

## What is This?

This kit is now packaged as an **installable NPM service** that you can:
- Install in any project with one command
- Use via CLI tool
- Publish to npm for others to use
- Integrate into CI/CD pipelines

## Installation Methods

### 1. Global Installation

```bash
npm install -g ai-agent-guardrails

# Then use anywhere:
guardrails install
# or
ai-guardrails install
```

### 2. Local Installation (Recommended)

```bash
# In your project
npm install --save-dev ai-agent-guardrails

# Run installer
npx ai-agent-guardrails install
```

### 3. One-Line Install (No Installation)

```bash
# Just run directly
npx ai-agent-guardrails install
```

## How It Works

### Installation Process

When you run `npx ai-agent-guardrails install`, it:

1. **Copies Configuration Files**
   - ESLint config
   - TypeScript config
   - Prettier config
   - .cursorrules
   - Pre-commit hooks

2. **Creates Required Files**
   - API validator utility
   - API endpoints registry
   - Validation scripts

3. **Installs Dependencies**
   - ESLint and plugins
   - TypeScript
   - Husky
   - Lint-staged
   - Prettier

4. **Sets Up Git Hooks**
   - Pre-commit validation
   - Auto-fix on commit

5. **Updates package.json**
   - Adds validation scripts
   - Adds lint-staged config

## Using the Service

### In Your Code

```typescript
// Import the validator
import { validatedFetch, apiValidator } from '@/lib/api-validator';

// Register endpoints when creating API routes
apiValidator.registerEndpoint({
  path: '/api/users',
  method: 'GET',
  description: 'Get all users',
});

// Use validatedFetch instead of fetch
const response = await validatedFetch('/api/users');
const data = await response.json();
```

### Validation Commands

```bash
# Check for mock data and fake endpoints
npm run validate

# Check project structure
npm run check-drift

# Type check
npm run type-check

# Lint
npm run lint
npm run lint:fix
```

### Pre-commit Hooks

Automatically runs on every commit:
- ESLint checks
- TypeScript validation
- API endpoint validation
- Mock data detection

## Publishing as a Service

### For Your Organization

1. **Publish to npm:**
   ```bash
   npm publish
   ```

2. **Use in projects:**
   ```bash
   npm install --save-dev @your-org/ai-agent-guardrails
   npx @your-org/ai-agent-guardrails install
   ```

### For Public Use

1. **Publish to npm:**
   ```bash
   npm publish --access public
   ```

2. **Share with community:**
   - Add to npm registry
   - Share on GitHub
   - Document usage

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm install -g ai-agent-guardrails
      - run: guardrails install
      - run: npm run validate
      - run: npm run type-check
      - run: npm run lint
```

### GitLab CI

```yaml
validate:
  image: node:20
  script:
    - npm install
    - npm install -g ai-agent-guardrails
    - guardrails install
    - npm run validate
    - npm run type-check
```

## Customization

### Custom Rules

After installation, customize:
- `eslint.config.js` - Add/remove rules
- `tsconfig.json` - Adjust TypeScript settings
- `.cursorrules` - Add project-specific rules

### Custom Validation

Edit validation scripts:
- `scripts/validate-api-endpoints.js`
- `scripts/validate-no-mock-data.js`
- `scripts/check-project-drift.js`

## Service Architecture

```
ai-agent-guardrails/
├── cli.js                    # CLI entry point
├── package.json              # Package metadata
├── eslint.config.js          # ESLint config template
├── tsconfig.json             # TypeScript config template
├── scripts/                  # Validation scripts
│   ├── validate-api-endpoints.js
│   ├── validate-no-mock-data.js
│   └── check-project-drift.js
└── src/                      # Source files
    ├── lib/
    │   └── api-validator.ts
    └── config/
        └── api-endpoints.ts
```

## Benefits of Service Approach

1. **Easy Installation** - One command setup
2. **Consistent** - Same guardrails across projects
3. **Maintainable** - Update once, use everywhere
4. **Shareable** - Publish to npm for team/community
5. **Automated** - CLI handles all setup

## Version Management

```bash
# Check installed version
npm list ai-agent-guardrails

# Update to latest
npm update ai-agent-guardrails

# Install specific version
npm install ai-agent-guardrails@1.0.0
```

## Uninstalling

```bash
# Remove package
npm uninstall ai-agent-guardrails

# Remove files (manual)
# Delete: eslint.config.js, tsconfig.json, .prettierrc, .cursorrules, .husky/, scripts/, src/lib/, src/config/
```

## Support

- **Documentation**: See `SERVICE-README.md`
- **Integration**: See `INTEGRATION-GUIDE.md`
- **Publishing**: See `PUBLISH-GUIDE.md`
- **Full Docs**: See `AI-AGENT-GUARDRAILS-KIT.md`

---

**Ready to use as a service!** 🚀

