# CLI Testing and Publishing Guide

Complete guide for testing all CLI commands and publishing to npm.

## Overview

This guide covers:
1. Building the CLI package
2. Testing all CLI commands
3. Preparing for npm publish
4. Publishing to npm

## CLI Commands Available

The guardrail CLI supports the following commands:

### Authentication
- `auth` - Authenticate with API key
- `auth --status` - Check authentication status
- `auth --refresh` - Refresh cached entitlements
- `auth --logout` - Logout

### Scanning
- `scan` - Run security scans
- `scan:secrets` - Scan for hardcoded secrets
- `scan:vulnerabilities` - Scan dependencies for CVEs (OSV integration)
- `scan:compliance` - Compliance assessment (Pro tier)

### SBOM
- `sbom:generate` - Generate Software Bill of Materials (Pro tier)

### Code Quality
- `smells` - Code smell analysis
- `fix` - Manual fix suggestions (Starter+)
- `fix-rollback` - Rollback applied fixes

### Deployment
- `ship` - Ship readiness checks (Starter+)
- `ship:pro` - Advanced ship checks (Pro tier)

### Testing
- `reality` - Browser testing for fake data (Starter+)
- `reality:graph` - Reality graph visualization

### AI Features
- `autopilot` - AI-powered batch remediation (Pro tier)
- `autopatch:verify` - Verify autopatch
- `autopatch:merge` - Merge autopatch
- `receipt:verify` - Verify execution receipts

### Setup
- `init` - Initialize guardrail in a project
- `menu` - Interactive menu

### Cache
- `cache:clear` - Clear OSV vulnerability cache
- `cache:status` - Show cache statistics

## Step 1: Build the CLI Package

From the project root:

```bash
# Build the CLI package
cd packages/cli
npm run build
```

The build script:
1. Compiles TypeScript to JavaScript (`dist/`)
2. Fixes runtime imports

Verify build succeeded:
```bash
# Check dist folder exists
ls dist/index.js
```

## Step 2: Test All CLI Commands

### Quick Test Script

Run the automated test script:

```bash
# From project root
node scripts/test-cli-commands.js
```

This script tests all commands with `--help` flag to verify they exist and don't crash.

### Manual Testing

Test key commands manually:

```bash
# From project root
cd packages/cli

# Test help
node dist/index.js --help

# Test version
node dist/index.js --version

# Test auth status
node dist/index.js auth --status

# Test scan help
node dist/index.js scan --help

# Test init help
node dist/index.js init --help
```

### Integration Tests

Run the existing integration tests:

```bash
# From project root
cd packages/cli
npm test
```

Or run specific test suites:

```bash
# Run integration tests
cd packages/cli
npx jest tests/integration
```

## Step 3: Verify Package.json

Before publishing, verify `packages/cli/package.json`:

- ✅ `name`: `guardrail-cli-tool`
- ✅ `version`: Current version (e.g., `2.5.0`)
- ✅ `bin`: `guardrail` and `vc` point to `dist/index.js`
- ✅ `files`: Includes `dist/**/*`, `README.md`, `LICENSE`
- ✅ `prepublishOnly`: Runs build script
- ✅ `publishConfig.access`: `public`

## Step 4: Prepare for Publish

### 1. Update Version (if needed)

```bash
cd packages/cli

# Check current version
npm version

# Bump version (patch, minor, or major)
npm version patch   # 2.5.0 -> 2.5.1
npm version minor   # 2.5.0 -> 2.6.0
npm version major   # 2.5.0 -> 3.0.0
```

### 2. Build for Production

```bash
cd packages/cli
npm run build
```

### 3. Dry Run (Test Publish)

Test what will be published without actually publishing:

```bash
cd packages/cli
npm publish --dry-run
```

This shows:
- Files that will be included
- Package size
- Dependencies

Verify:
- ✅ Only necessary files included (no source files, only `dist/`)
- ✅ `README.md` and `LICENSE` included
- ✅ Package size reasonable
- ✅ No secrets or credentials

### 4. Check Package Contents

```bash
cd packages/cli
npm pack --dry-run
```

This creates a `.tgz` file you can inspect (or just shows what would be included).

## Step 5: Publish to npm

### Prerequisites

1. **npm Account**: Logged in to npm
   ```bash
   npm login
   ```

2. **2FA Enabled**: Recommended for security
   ```bash
   npm profile enable-2fa auth-and-writes
   ```

3. **Verify Login**:
   ```bash
   npm whoami
   ```

### Publish

```bash
cd packages/cli

# Final build
npm run build

# Publish (will run prepublishOnly script automatically)
npm publish --access public
```

Or use the root script:

```bash
# From project root
npm run deploy:production
```

This script:
1. Builds all packages with Turbo
2. Changes to `packages/cli`
3. Publishes to npm

### Verify Publish

After publishing, verify the package:

```bash
# View package on npm
npm view guardrail-cli-tool

# Test install (in a new directory)
mkdir test-install
cd test-install
npm install -g guardrail-cli-tool@latest
guardrail --version
guardrail --help
```

## Troubleshooting

### Build Errors

If build fails:
```bash
cd packages/cli
rm -rf dist node_modules
npm install
npm run build
```

### Publish Errors

**Error: "You must verify your email"**
```bash
# Check your email and verify
npm whoami
```

**Error: "Package already exists"**
- Version already published - bump version first
```bash
npm version patch
npm publish
```

**Error: "Insufficient permissions"**
- Not logged in or wrong account
```bash
npm login
npm whoami
```

### Command Not Found After Install

If `guardrail` command not found after global install:
- Check npm global bin path: `npm config get prefix`
- Add to PATH if needed
- Try: `npx guardrail --version`

## Versioning Strategy

Follow semantic versioning:

- **Patch** (2.5.0 -> 2.5.1): Bug fixes, small improvements
- **Minor** (2.5.0 -> 2.6.0): New features, backward compatible
- **Major** (2.5.0 -> 3.0.0): Breaking changes

Update version before each publish.

## Post-Publish Checklist

After successful publish:

- [ ] Package visible on npm: https://www.npmjs.com/package/guardrail-cli-tool
- [ ] Version number correct
- [ ] README.md displays correctly
- [ ] Can install globally: `npm install -g guardrail-cli-tool@latest`
- [ ] Commands work: `guardrail --help`
- [ ] Update changelog/docs if needed

## Quick Reference

```bash
# Full workflow
cd packages/cli
npm run build                    # Build
node ../../scripts/test-cli-commands.js  # Test
npm version patch                # Bump version
npm publish --dry-run           # Test publish
npm publish --access public     # Publish
```

## Support

For issues:
- Check npm logs: `npm config get logs`
- Check package.json configuration
- Verify build output in `dist/`
- Test commands locally before publishing
