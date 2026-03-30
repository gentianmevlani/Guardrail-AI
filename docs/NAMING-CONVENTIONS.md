# File Naming Conventions

This document outlines the naming conventions used in the guardrail project to maintain consistency.

## Current Conventions

### Configuration Files
- **kebab-case**: `eslint.config.js`, `jest.config.js`, `playwright.config.ts`
- **camelCase**: `package.json`, `tsconfig.json`, `turbo.json`
- **Special cases**: `.env.example`, `.gitignore`, `.prettierrc`

### CLI Files
- **kebab-case with prefix**: `cli.js`, `cli-wizard.js`, `cli-natural.js`

### Documentation
- **UPPERCASE-KEBAB-CASE**: `01-UI-UX-SYSTEM-TEMPLATE.md`
- **Title-Case**: `GETTING-STARTED.md`, `README.md`
- **kebab-case**: `cli-tools.md`, `documentation-index.md`

## Recommended Standardization

To improve consistency, we recommend the following standards:

### 1. Configuration Files
Use **kebab-case** for all configuration files:
```
✅ Recommended:
- eslint.config.js
- jest.config.js
- playwright.config.ts
- package-lock.json (keep as is - npm standard)
- tsconfig.json (keep as is - TypeScript standard)
- turbo.json (keep as is - Turbo standard)

❌ Avoid:
- Mixed camelCase and kebab-case
```

### 2. CLI Tools
Use **kebab-case with cli- prefix**:
```
✅ Current (good):
- cli.js
- cli-wizard.js
- cli-natural.js
```

### 3. Documentation Files
Use **kebab-case** for new documentation:
```
✅ Recommended for new docs:
- getting-started.md
- api-reference.md
- contributing-guide.md

✅ Keep existing numbered docs:
- 01-quick-start.md
- 02-architecture.md
```

### 4. Example Files
Use **kebab-case with .example suffix**:
```
✅ Current (good):
- .env.example
- claude-desktop-config.example.json
- cursor-mcp-config.example.json
```

### 5. Test Files
Use **kebab-case with .test suffix**:
```
✅ Recommended:
- auth-service.test.ts
- user-model.test.ts
- integration.test.ts
```

## Files That Need Updates

The following files should be renamed for consistency (optional):

### High Priority
None - Current naming is acceptable

### Medium Priority (Optional)
- `any-types-report.json` → `any-types-report.json` (already follows convention)
- `sync-figma-tokens.ts` → `sync-figma-tokens.ts` (already follows convention)

### Low Priority (Consider for future)
- Documentation files could gradually move to kebab-case
  - `GETTING-STARTED.md` → `getting-started.md`
  - `README.md` → `readme.md` (but keep README.md as convention)

## Implementation Notes

1. **Breaking changes**: Renaming files that are imported requires updating all imports
2. **Git history**: Use `git mv` to preserve history when renaming
3. **Documentation**: Some naming follows ecosystem conventions (package.json, tsconfig.json)
4. **Priority**: Focus on new files following conventions rather than renaming existing ones

## Decision Matrix

| File Type | Convention | Example | Status |
|-----------|------------|---------|---------|
| Config | kebab-case | `eslint.config.js` | ✅ Already followed |
| Package manifest | ecosystem standard | `package.json` | ✅ Keep as is |
| CLI | cli-kebab-case | `cli-wizard.js` | ✅ Already followed |
| Documentation | kebab-case or numbered | `getting-started.md` | ⚠️ Mixed |
| Examples | kebab-case.example | `.env.example` | ✅ Already followed |
| Tests | kebab-case.test | `auth.test.ts` | ✅ Follow this |

## Recommendations

1. Keep current naming for already-established files
2. Follow kebab-case for all new configuration files
3. Use numbered prefixes for ordered documentation (01-, 02-, etc.)
4. Document these conventions in contributor guidelines
