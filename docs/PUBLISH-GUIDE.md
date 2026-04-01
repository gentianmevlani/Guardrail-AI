# Publishing Guide

## Prerequisites

1. NPM account (create at https://www.npmjs.com/signup)
2. Login to npm: `npm login`
3. Verify: `npm whoami`

## Publishing Steps

### 1. Prepare Package

```bash
# Make sure cli.js is executable
chmod +x cli.js

# Test locally
npm link
npm link ai-agent-guardrails

# Test in a project
cd /path/to/test-project
npx ai-agent-guardrails install
```

### 2. Update Version

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major
```

### 3. Build/Verify

```bash
# Run validation
npm run validate

# Check what will be published
npm pack --dry-run

# Test package locally
npm pack
tar -xzf ai-agent-guardrails-*.tgz
```

### 4. Publish

```bash
# Publish to npm
npm publish

# Or publish as public (if scoped)
npm publish --access public
```

### 5. Tag Release

```bash
# Create git tag
git tag v1.0.0
git push origin v1.0.0
```

## Post-Publishing

### Update Documentation

- Update version numbers in README
- Add changelog entry
- Update examples if needed

### Announce

- Update GitHub releases
- Share on social media
- Update project documentation

## Unpublishing (Emergency Only)

```bash
# Unpublish (within 72 hours)
npm unpublish ai-agent-guardrails@1.0.0

# Or unpublish entire package (not recommended)
npm unpublish ai-agent-guardrails --force
```

**Note:** Unpublishing should be avoided. Use deprecation instead:

```bash
npm deprecate ai-agent-guardrails@1.0.0 "Use version 1.0.1 instead"
```

## Scoped Packages (Optional)

If you want a scoped package:

```json
{
  "name": "@your-org/ai-agent-guardrails"
}
```

Then publish with:
```bash
npm publish --access public
```

## Automated Publishing (CI/CD)

Add to `.github/workflows/publish.yml`:

```yaml
name: Publish
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

## Version Strategy

- **Patch** (1.0.0 -> 1.0.1): Bug fixes, small improvements
- **Minor** (1.0.0 -> 1.1.0): New features, backward compatible
- **Major** (1.0.0 -> 2.0.0): Breaking changes

## Checklist Before Publishing

- [ ] Version updated in package.json
- [ ] All tests passing
- [ ] Validation scripts working
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] No sensitive data in package
- [ ] .npmignore configured correctly
- [ ] CLI tested locally
- [ ] Package tested in real project

