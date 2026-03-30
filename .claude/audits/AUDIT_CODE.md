```yaml
---
agent: code-auditor
status: warn
findings: 22
---
```

# Code Quality & Maintainability Audit — Guardrail-Ofiicial-main

## Summary

The monorepo shows **strong discipline in library packages** (`packages/core`, `packages/database`, `tsconfig.base.json`) with full `strict` TypeScript and additional safety flags (`noUncheckedIndexedAccess`, unused symbol checks). **The API surface is the weakest link for maintainability**: `apps/api/tsconfig.json` disables strict mode entirely (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, …), which **undermines the stated project rule** of avoiding `any` and makes refactors and null-safety work much harder than in packages.

**Architectural strain** comes from **three parallel application trees**: `apps/web-ui`, `apps/api`, and a large root-level `src/` (~368 `.ts` files, ~4.6 MB), plus nested `guardrail-context/`. Jest is configured with `@/` mapping to **root `src/`**, while the primary product UI lives under `apps/web-ui` with its own `@/*` alias—easy for contributors to implement or test the “wrong” layer.

**Complexity hotspots** include `packages/cli/src/index.ts` (~5.1k lines), `apps/api/src/worker.ts` (~1.0k lines), and `apps/api/src/routes/projects.ts` (~478 lines). The CLI entrypoint mixes command registration, UI framing, and utilities in one file—high cost for reviews and merges.

**Typing volume**: approximate grep counts for `: any` / `as any` (word-boundary pattern) in first-party source: **~1,447 in `apps/api/src`**, **~68 in `apps/web-ui/src`**, **~592 across `packages/`** (CLI dominates within packages). These counts include tests and declarations; they are **indicative**, not a formal type-error tally, but they correlate with relaxed API compiler settings.

**Test tooling split**: root **Jest** (`config/jest.config.js`, global **80%** coverage thresholds) vs **`apps/web-ui`** **Vitest** increases cognitive load. Many paths are excluded from Jest via `testPathIgnorePatterns`, which is pragmatic but **reduces confidence** that the configured thresholds apply uniformly.

**Overall**: **warn** — shippable with active tech debt concentrated in API typing posture, CLI structure, and multi-root source layout.

---

## Findings

### High

| # | Location | Description | Remediation |
|---|----------|-------------|-------------|
| H1 | `apps/api/tsconfig.json` | `strict`, `noImplicitAny`, `strictNullChecks`, and related checks are **all off**. Compiler does not enforce the same bar as `packages/core` / `packages/database`. | Enable `strict` incrementally: turn on `strictNullChecks` + `noImplicitAny` first, fix errors, then align with `tsconfig.base.json` / package strict flags. Use `// @ts-expect-error` with tickets only as a temporary bridge. |
| H2 | `packages/cli/src/index.ts` (~5k+ lines) | Single file acts as **god module** for CLI: commands, UI, config, and helpers. Extremely high **merge conflict** and review cost. | Split by domain: `commands/*` already exists—move registration into `commands/index.ts` or per-command modules; extract UI (`ui/`), runtime (`runtime/`), and shared helpers; keep `index.ts` as a thin bootstrap. |
| H3 | Root `src/` vs `apps/*` | **Dual (triple with `guardrail-context/`) source roots** (~368 `.ts` under `src/`). Jest `moduleNameMapper` points `@/` → `src/`, not `apps/web-ui/src`. New code can land in the wrong tree. | Document a single **source-of-truth** map in CONTRIBUTING; deprecate or fence root `src/`; align Jest aliases with app boundaries or add CI checks that forbid new files in deprecated paths. |
| H4 | `apps/api/src/index.ts` vs `apps/api/src/server.ts` | Two Fastify construction patterns (`buildServer` vs `createServer`); `package.json` entry is `start.ts` → `dist/start.js`, while `main` is `./dist/index.js`. Risk of **drift** between code paths. | Consolidate one bootstrap path; delete or clearly mark experimental `server.ts`; ensure `main`, `dev`, and `start` scripts reference the same composition root. |

### Medium

| # | Location | Description | Remediation |
|---|----------|-------------|-------------|
| M1 | `apps/web-ui/tsconfig.json` | `strict: true` but **recommended stricter options are commented out** (`noUnusedLocals`, `noUncheckedIndexedAccess`, …). Drifts from `tsconfig.base.json` intent. | Enable `noUncheckedIndexedAccess` first (matches base); then unused locals/params after lint cleanup. |
| M2 | `tsconfig.test.json` | **`strict: false`** for Jest; tests do not prove the same contracts as production types. | Tighten test tsconfig toward `strict: true` for new tests; migrate critical suites first. |
| M3 | `apps/api/src` — pervasive `any` | ~1,447 matches for `: any` / `as any` pattern (includes tests). Example pattern in `apps/api/src/index.ts`: hooks use `(request: any, reply: any)` and `(request.log as any)`. | Replace with Fastify generics (`FastifyRequest`, `FastifyReply`) and typed `request.log`; narrow Stripe/webhook payloads with Zod + inferred types. |
| M4 | `packages/cli/src` — `any` density | ~186 matches in CLI alone; `index.ts` concentration drives total. | Same as H2: smaller modules + stricter exported types from command handlers. |
| M5 | `config/jest.config.js` | **Global 80%** branches/functions/lines/statements while large areas are **excluded** via `testPathIgnorePatterns`. Threshold may be **misleading** or routinely failing. | Re-scope thresholds per project (`apps/api`, `packages/*`) or lower global until exclusions removed; track coverage in CI per package. |
| M6 | Stripe SDK versions | Root `package.json` has `"stripe": "^20.1.0"` (devDependency); `apps/api` and `apps/web-ui` use **`^17.0.0`**. Version skew across workspace. | Align on one major line via `pnpm` workspace protocol or root catalog; document upgrade path. |
| M7 | `apps/api/src/worker.ts` (~1k lines) | Large worker file likely mixes queue setup, job handlers, and side effects—**high cyclomatic complexity** risk. | Split by job type or domain services; shared initialization in `worker/bootstrap.ts`. |
| M8 | `apps/api/src/routes/projects.ts`, `runs.ts`, `organizations.ts`, etc. | Route files with **many** `any` usages and large line counts—**boundary validation** and handler logic may be intertwined. | Extract service layer (already partially in `services/`), keep routes as thin adapters; Zod schemas colocated with routes. |
| M9 | Error handling style | Mix of `catch (error: any)`, `err: any`, and typed paths (`apps/api/src/middleware/error-handler.ts` exists). Inconsistent patterns **complicate** centralized logging and Sentry. | Standardize on `unknown` + narrowers (`instanceof Error`) or a small `toErrorMessage()` helper used everywhere. |
| M10 | Dual test runners | Jest (repo root) + Vitest (`apps/web-ui`). Different configs, different DX. | Document when to use which; consider consolidating on Vitest for TS-first monorepos long-term, or keep Jest only for Node packages. |

### Low

| # | Location | Description | Remediation |
|---|----------|-------------|-------------|
| L1 | `packages/cli/src/index.ts` (lines ~66–72) | **Duplicate section comments** (“ENTERPRISE CLI STYLING”)—copy-paste artifact. | Remove duplicate block. |
| L2 | `console.*` in app source | ~94 matches for `console.log|debug|info|warn|error` in `apps/api/src` + `apps/web-ui/src` (grep count). Noisy in production; conflicts with `.cursorrules` guidance. | Route through shared `logger` (`apps/api/src/logger.ts`, `apps/web-ui/src/lib/logger.ts`) or strip in production builds. |
| L3 | TODO/FIXME | ~146 matches in `apps/*` + `packages` (`.ts`/`.tsx`). | Triage: convert to issues or remove stale markers. |
| L4 | `packages/*/dist` and committed build artifacts | If `dist/` is checked in (observed in grep paths), **diff noise** and drift from source. | Prefer build-on-publish; `.gitignore` dist for packages unless a deliberate exception. |
| L5 | `apps/web-ui` — `allowJs: true` | Allows JS files in Next app; can hide migration debt. | Keep TS-only for new files; enable `checkJs` selectively if JS remains. |
| L6 | Naming: `guardrail-core` vs `@guardrail/*` | Workspace packages use scoped names; `guardrail-core` is unscoped in `package.json` dependencies. Slight **inconsistency** for imports mental model. | Document naming; optional rename to `@guardrail/core` in a major bump (coordination-heavy). |

**Maintainability-adjacent notes (brief):** Relaxed API typing increases risk of **incorrect API contracts** (often security-auditor territory). Large route handlers may impact **cold paths and bundle size** (perf-auditor)—not expanded here.

---

## Metrics

| Metric | Approximate value | Notes |
|--------|-------------------|--------|
| TypeScript files (`apps/api/src`) | ~243 `.ts` files | `find` count |
| TS/TSX files (`apps/web-ui/src`) | ~428 | `find` count |
| TS files under `packages/` (`*/src`) | ~381 | Excludes nested `node_modules`/`dist` in find pipeline |
| TS files under root `src/` | ~368 | Parallel tree to `apps/` |
| `: any` / `as any` matches (`apps/api/src`) | ~1,447 | `grep -rE` word-boundary pattern |
| `: any` / `as any` matches (`apps/web-ui/src`) | ~68 | Same method |
| `: any` / `as any` matches (`packages/`, excl. `node_modules`/`dist`) | ~592 | CLI contributes heavily |
| `TODO`/`FIXME` in apps + packages | ~146 | `.ts`/`.tsx` |
| `console.*` in `apps/api/src` + `apps/web-ui/src` | ~94 | |
| Test files (`*.test.*`, `*.spec.*`) under `tests`, `apps`, `packages` | ~137 | Excl. `node_modules`/`dist` |
| Lines: `packages/cli/src/index.ts` | ~5,079 | `wc -l` |
| Lines: `apps/api/src/worker.ts` | ~1,047 | |
| Lines: `apps/api/src/index.ts` | ~521 | |
| Lines: `apps/api/src/routes/projects.ts` | ~478 | |
| Disk (rough): `src/` | ~4.6 MB | `du -sh` |
| Disk: `packages/` | ~20 MB | Source + metadata |

---

## Positive observations

- **`tsconfig.base.json`** sets `strict: true` and `noUncheckedIndexedAccess: true` as organizational defaults.
- **`packages/core/tsconfig.json`** and **`packages/database/tsconfig.json`** use a **strong strict stack** (unused symbols, fallthrough, index signature access, implicit override).
- **Zod** appears across stack (`package.json`, API routes); validation middleware exists (`apps/api/src/middleware/validation*.ts`).
- **Structured logging** (`pino`, custom logger) is preferred over raw console in API paths when used consistently.
- **Monorepo tooling**: `pnpm` workspaces + `turbo` pipelines for `build`, `lint`, `type-check` support incremental maintenance.

---

*Audit scope: code quality, complexity, maintainability; security/performance deep-dives intentionally limited.*
