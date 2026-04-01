# CLI Publish Checklist

Quick checklist for testing and publishing the CLI to npm.

## Pre-Publish Steps

### 1. Build All Dependencies
```bash
# From project root
npm run build
```

This builds all workspace packages that the CLI depends on:
- `@guardrail/core`
- `@guardrail/security`
- `@guardrail/ship`

### 2. Build CLI Package
```bash
cd packages/cli
npm run build
```

Verify build:
```bash
# Check dist exists
ls dist/index.js
```

### 3. Test CLI Commands

**Quick test (from root):**
```bash
node scripts/test-cli-commands.js
```

**Manual test:**
```bash
cd packages/cli
node dist/index.js --help
node dist/index.js --version
node dist/index.js auth --status
```

### 4. Verify Package.json

Check `packages/cli/package.json`:
- ✅ Version number correct
- ✅ All workspace dependencies resolved (not `workspace:*`)
- ✅ `files` includes only: `dist/**/*`, `README.md`, `LICENSE`
- ✅ `prepublishOnly` script runs build

**Important**: For npm publish, workspace dependencies (`workspace:*`) must be:
1. Either bundled in the CLI package
2. Or published separately and referenced by published package name

### 5. Dry Run Publish

```bash
cd packages/cli
npm publish --dry-run
```

Verify:
- ✅ Only expected files included
- ✅ No workspace dependencies in package.json (they'll be resolved to published packages)
- ✅ Package size reasonable

### 6. Check npm Login

```bash
npm whoami
```

If not logged in:
```bash
npm login
```

## Publish

```bash
cd packages/cli
npm publish --access public
```

Or use root script:
```bash
npm run deploy:production
```

## Post-Publish

1. ✅ Verify package on npm: https://www.npmjs.com/package/guardrail-cli-tool
2. ✅ Test install: `npm install -g guardrail-cli-tool@latest`
3. ✅ Test command: `guardrail --version`
4. ✅ Update changelog if needed

## Common Issues

### Workspace Dependencies

The CLI uses workspace dependencies (`@guardrail/core`, `@guardrail/security`, `@guardrail/ship`). 

**Before publish**: These must either:
1. Be bundled into the CLI package, OR
2. Be published as separate packages with actual versions (not `workspace:*`)

**Check current setup**: See `packages/cli/package.json` dependencies.

### Build Errors

If build fails:
```bash
cd packages/cli
rm -rf dist node_modules
npm install
npm run build
```

### Module Not Found After Publish

If published CLI can't find dependencies:
- Dependencies must be published separately first
- Or dependencies must be bundled
