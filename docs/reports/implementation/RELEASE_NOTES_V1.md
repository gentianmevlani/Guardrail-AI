# guardrail v1.0.0 Release Notes

**Release Date:** January 2026  
**Codename:** "Ship with Confidence"

---

## 🎯 What's New

### Verdict Trustworthiness

We've completely overhauled how guardrail makes ship/no-ship decisions:

- **Confidence Scoring**: Every finding now includes a confidence score (0-100%) so you know how certain we are
- **Smarter Deduplication**: No more seeing the same issue 50 times — duplicate findings are consolidated
- **Priority Sorting**: Blockers appear first, sorted by severity and confidence
- **Clear Verdicts**: `pass`, `fail`, or `warn` with explicit reasoning

```json
{
  "verdict": "fail",
  "score": 72,
  "findings": [
    {
      "type": "secret",
      "severity": "critical",
      "confidence": 95,
      "blocksShip": true,
      "message": "AWS access key detected",
      "suggestedFix": "Use environment variables or AWS Secrets Manager"
    }
  ]
}
```

### CLI Improvements

- **JSON Schema Contract**: All `--json` output now follows a documented schema with version tracking
- **Consistent Exit Codes**: Predictable exit codes for CI/CD integration
  - `0` = Pass
  - `1` = Fail (findings block shipping)
  - `2` = Auth required
  - `3+` = Specific error codes
- **Better Error Messages**: Every error now includes suggested next steps

```
✗ Authentication required
  No API key found

Next steps:
  • Run "guardrail login" to authenticate
  • Get your API key at https://guardrail.dev/settings/keys
```

### Performance

- **Incremental Scanning**: File-level caching means unchanged files aren't re-scanned
- **Cache Statistics**: See your cache hit rate with `guardrail doctor`
- **Faster CI Runs**: Up to 80% faster on subsequent scans of large codebases

### Gate Command

The `guardrail gate` command is now production-ready:

- **Real SARIF Upload**: Results upload to guardrail Dashboard (not just mocked)
- **JSON Output**: Full support for `--json` flag
- **CI Integration**: Works seamlessly with GitHub Actions, GitLab CI, etc.

```bash
# CI/CD usage
guardrail gate --json --sarif-upload
```

---

## 🔐 Security Fixes

- Removed `GUARDRAIL_OWNER_MODE` environment variable bypass
- Removed `GUARDRAIL_SKIP_ENTITLEMENTS` bypass
- CLI now requires real API connection for paid features (no mock fallback)
- All API routes verified for auth middleware coverage

---

## 🔧 Breaking Changes

### Exit Codes

Exit codes have been standardized. If you're parsing exit codes in scripts:

| Old Behavior | New Behavior |
|--------------|--------------|
| Various codes | `0` = pass, `1` = fail, `2` = auth required |

### JSON Output

The `--json` output format has changed:

```javascript
// Old format
{ "success": true, "issues": [...] }

// New format (v1)
{ 
  "schemaVersion": "1.0.0",
  "success": true,
  "verdict": "pass",
  "score": 100,
  "summary": { "total": 0, "critical": 0, ... },
  "findings": [...],
  "metadata": { "scanId": "...", "timestamp": "..." }
}
```

### Environment Variables

These environment variables no longer work:
- `GUARDRAIL_OWNER_MODE` - Removed for security
- `GUARDRAIL_SKIP_ENTITLEMENTS` - Removed for security

---

## 📦 Installation

```bash
# npm
npm install -g @guardrail/cli

# pnpm
pnpm add -g @guardrail/cli

# yarn
yarn global add @guardrail/cli
```

---

## 🚀 Migration Guide

### From v0.x

1. **Update your scripts**: Check for exit code changes
2. **Update JSON parsing**: New schema format
3. **Remove bypasses**: `GUARDRAIL_OWNER_MODE` and `GUARDRAIL_SKIP_ENTITLEMENTS` no longer work
4. **Test in CI**: Run `guardrail gate --json` to verify

### For CI/CD

```yaml
# GitHub Actions example
- name: Security Gate
  run: |
    npx guardrail gate --json
  env:
    GUARDRAIL_API_KEY: ${{ secrets.GUARDRAIL_API_KEY }}
```

---

## 📊 Metrics

This release includes:
- 4 P0 fixes (critical reliability)
- 4 P1 fixes (high-impact improvements)
- 2 new test suites
- 3 new library modules

---

## 🙏 Acknowledgments

Thanks to everyone who reported issues and contributed to this release.

---

## 📋 Full Changelog

See [GUARDRAIL_V1_DOD.md](./GUARDRAIL_V1_DOD.md) for the complete list of changes.

---

## 🐛 Known Issues

- PDF export not yet implemented (JSON/CSV available)
- Cache may need manual clear after guardrail upgrade: `guardrail cache clear`

---

## 📞 Support

- Documentation: https://docs.guardrail.dev
- Issues: https://github.com/guardrail/guardrail/issues
- Email: support@guardrail.dev
