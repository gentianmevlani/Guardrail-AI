# 🧹 Repo Hygiene + Debt Radar

**guardrail Cleanup / Repo Doctor** - Find duplicate code, dead files, lint/import/syntax/type errors, and root directory mess. Produces a deletion-safe plan.

> **Key Rule:** This tool NEVER deletes automatically. It generates plans + optional codemods.

## Quick Start

```bash
# Full hygiene scan
node scripts/audit-repo-hygiene.js

# Or use the CLI
node bin/cli-hygiene.js scan

# Individual scans
node bin/cli-hygiene.js duplicates
node bin/cli-hygiene.js unused
node bin/cli-hygiene.js errors
node bin/cli-hygiene.js root
node bin/cli-hygiene.js delete-plan
```

## Features

### 1. Duplicate File Detection (3 Tiers)

#### Tier A: Exact Duplicates (High Confidence)

- Same bytes → same SHA256 hash
- Reports groups: `hash -> [paths...]`
- **Auto-fix suggestion:** Delete duplicates, keep one

#### Tier B: Near-Duplicate Files (85%+ Similar)

- Normalized content comparison (strips whitespace/comments)
- Fingerprinting with rolling hashes
- **Output:** "These files are 92% identical; consolidate into single module"

#### Tier C: Copy-Pasted Code Blocks

- Finds repeated blocks across different files (≥10 lines)
- Ranks by total duplicated LOC
- **Output:** "Top duplication clusters" + "extract function/module" suggestions

### 2. Unused File Detection (Import Graph Analysis)

**Correct "unused" detection requires entrypoints:**

- **Next.js:** `app/**/page.tsx`, `app/api/**/route.ts`, `middleware.ts`
- **CLI/Scripts:** `bin/**`, `scripts/**`, `src/cli.ts`
- **Config:** `*.config.*`, `tsconfig*.json`

**Classification Buckets:**

- ✅ **Definitely unused:** Not reachable from any entrypoint
- 🟡 **Probably unused:** Only referenced in comments/docs
- 🔵 **Special/keep:** Configs, types, assets, migrations
- ⚠️ **Generated/vendor:** Build output (ignored, not "unused")

**Output includes WHY it's unused:**

- "No inbound imports"
- "Only referenced by test files"
- "Reachable only from dev entrypoint"

### 3. Unified Error Collection

One report for all error types:

| Category          | Source                      |
| ----------------- | --------------------------- |
| TypeScript        | `tsc --noEmit`              |
| ESLint            | `eslint . --format json`    |
| Import Resolution | Broken paths, circular deps |
| Syntax            | Basic parse validation      |

**Output:**

- Total counts by category
- Top offending files
- `file:line` with excerpt + fix
- "autofixable" vs "manual"

**CI-Friendly:**

- Exit code nonzero if thresholds exceeded
- Optional "regressions only" mode

### 4. Root Directory Cleanup

**What it checks:**

- **Junk files:** `*.log`, `.DS_Store`, `*.bak`, `*.tmp`
- **Duplicate configs:** Multiple eslint/prettier configs
- **Missing standards:** `.editorconfig`, `.env.example`, `README.md`
- **Misplaced files:** Docs in root that should be in `docs/`
- **Build outputs:** Accidentally committed `dist/`, `.next/`

**Output:**

- "Move these files to /docs"
- "Consolidate configs into root"
- "Delete junk artifacts"
- "Add missing repo standards"

## MCP Tools

```javascript
// Full scan
repo_hygiene_scan({ projectPath: ".", mode: "report", saveArtifacts: true });

// Individual scans
repo_hygiene_duplicates({ projectPath: ".", threshold: 0.85 });
repo_hygiene_unused({ projectPath: ".", scope: "prod" | "test" | "all" });
repo_hygiene_errors({ projectPath: ".", eslint: true, tsc: true });
repo_hygiene_root_cleanup({ projectPath: "." });
repo_hygiene_deletion_plan({ projectPath: ".", includeReview: false });
```

## Generated Artifacts

All reports saved to `.guardrail/`:

| File                   | Contents                 |
| ---------------------- | ------------------------ |
| `hygiene-report.md`    | Full markdown report     |
| `duplicates.json`      | Duplicate file data      |
| `unused-files.json`    | Unused file analysis     |
| `errors.json`          | Error collection         |
| `root-cleanup-plan.md` | Root cleanup suggestions |
| `hygiene-score.json`   | Score and grade          |

## Hygiene Score

| Score  | Grade | Status                     |
| ------ | ----- | -------------------------- |
| 90-100 | A     | ✨ Excellent hygiene       |
| 80-89  | B     | 👍 Good, minor issues      |
| 70-79  | C     | ⚠️ Needs attention         |
| 60-69  | D     | 🔴 Significant debt        |
| 0-59   | F     | 🚨 Critical cleanup needed |

**Score Deductions:**

- Exact duplicates: -3 per group (max -10)
- Near-duplicates: -2 per group (max -10)
- Definitely unused files: -1 per file (max -20)
- Type/lint errors: -0.5 per error (max -30)
- Junk files: -1 per file (max -5)
- Missing required standards: -3 per item (max -10)

## CI/CD Integration

```yaml
# GitHub Actions
- name: Repo Hygiene Check
  run: |
    node scripts/audit-repo-hygiene.js
    if [ $? -ne 0 ]; then
      echo "Hygiene check failed (score < 60)"
      exit 1
    fi

# Or with JSON output
- name: Hygiene Check (JSON)
  run: node bin/cli-hygiene.js scan --json > hygiene-results.json
```

## Safe Deletion Plan

The deletion plan categorizes files:

### ✅ Safe to Delete Now

- Exact duplicates (keep canonical)
- Files with no inbound imports
- Orphaned test utilities

### 🟡 Review Before Deleting

- Files imported but not reachable from entrypoints
- Files only referenced by comments

### 🔵 Do Not Delete

- Config files (even if not imported)
- Type definitions
- Migrations and schemas
- CI/CD configs

## Avoiding False Positives

"Unused" false positives destroy trust. We mitigate this by:

1. **Explicit entrypoints** - Framework-magic files treated as entrypoints
2. **Special file detection** - Configs, types, migrations never marked unused
3. **Allowlist support** - `.guardrailignore` for exceptions
4. **Default to safe** - Plan only, no auto-deletion

## What Makes This Monetizable (Pro Features)

| Free               | Pro                         |
| ------------------ | --------------------------- |
| Full scan & report | Safe auto-fix PRs           |
| Deletion plan      | Baseline + regression-only  |
| JSON export        | Policy enforcement          |
|                    | Team dashboard trends       |
|                    | Block PRs adding dead files |

---

_Context Enhanced by guardrail AI_
