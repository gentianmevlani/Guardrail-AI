# FIXES — Prioritized remediation

## Executive summary

Consolidates **`.claude/audits/AUDIT_CODE.md`** (maintainability) and the **March 2026 comprehensive code-auditor** pass (security + architecture + deps). **CLI structure has improved**: `packages/cli/src/index.ts` is a thin entry; legacy bulk is `index.legacy.backup.ts`—do **not** re-apply obsolete “duplicate banner” fixes to current `index.ts`.

**New since AUDIT_CODE-only planning:** **P0** items for **web-ui mock auth** when `NEXT_PUBLIC_API_URL` is unset, **dual HTTP stacks** (Express under root `src/server` vs Fastify `apps/api`), **`crypto` npm** in `packages/ai-guardrails`, and **Prisma / Next** version skew.

**Source audits consolidated:** `AUDIT_CODE.md`, comprehensive code-auditor (full monorepo sampling). Truthpack: consult `.vibecheck/truthpack/` or `.guardrail/truthpack/` when changing routes, contracts, copy, or env docs (`routes.json`, `contracts.json`, `env.json`, `copy.json`).

```yaml
---
agent: fix-planner
status: warn
findings: 31
sources:
  - AUDIT_CODE.md
  - code-auditor-comprehensive-2026-03
---
```

---

## Dependencies (read first)

| ID | Detail |
|----|--------|
| **D1** | Enable **`strictNullChecks`** and **`noImplicitAny`** (or full `strict`) in `apps/api/tsconfig.json` **before** large-scale removal of `: any` / `as any` in `apps/api/src`. |
| **D2** | **CLI modularization** (split registration, UI, runtime) reduces duplicate effort for CLI `any` cleanup. |
| **D3** | **Route thinness / Zod** pairs with API typing; do not change public HTTP contracts without checking truthpack (`contracts.json` / `routes.json`). |
| **D4** | **Ship P0 mock-auth fixes** before any production or staging deploy that relies on web-ui auth routes; verify `NEXT_PUBLIC_API_URL` is required in `env.json` / deploy docs. |

---

## P0 — Blockers / security-critical

| ID | File / path | Problem | Recommended fix | Effort | Owner hint |
|----|-------------|---------|-----------------|--------|------------|
| **FIX-P0-01** | `apps/web-ui/src/app/api/auth/login/route.ts`, `.../register/route.ts` | `IS_DEV = NODE_ENV === "development" \|\| !API_URL` treats **missing public API URL** like dev → **mock sessions** possible in non-dev deploys. | Mock auth only when `NODE_ENV === "development"` **and** explicit opt-in e.g. `ALLOW_MOCK_AUTH=true`, **or** require `NEXT_PUBLIC_API_URL` always and return 503/config error if unset in non-dev. | S | web-ui / security |
| **FIX-P0-02** | Same mock paths | Mock login accepts any email + password ≥ 6 chars. | Even for dev, tie to fixed test users or document; ensure P0-01 guarantees this path **never** runs outside intended local dev. | S | web-ui |

---

## P1 — High

| ID | File / path | Problem | Recommended fix | Effort | Owner hint |
|----|-------------|---------|-----------------|--------|------------|
| **FIX-P1-01** | `apps/api/tsconfig.json` | `strict` and related checks disabled vs `tsconfig.base.json` / packages. | Incremental strictness: `strictNullChecks` + `noImplicitAny`, fix errors; align with base. `// @ts-expect-error` only with ticket refs as bridge. | L | api |
| **FIX-P1-02** | `packages/cli/src/` (`bootstrap.ts`, `commands/`, `index.legacy.backup.ts`) | Legacy bulk in backup; modular split in progress. | Keep `index.ts` as entry only; route new code through `commands/*`, `ui/*`, `runtime/*`; archive backup if redundant. | M | cli |
| **FIX-P1-03** | Root `src/` vs `apps/web-ui` vs `apps/api` | Parallel source trees; Jest `@/` → root `src/`, not `apps/web-ui`. | Document canonical layout; fence deprecated roots; CI guardrails for new files in ambiguous paths. | L | monorepo / dx |
| **FIX-P1-04** | `apps/api/src/index.ts`, `server.ts`, `start` / `main` | Two Fastify construction patterns; entry drift risk. | Single bootstrap path; align `main`, `dev`, `start` to same composition root. | M | api |
| **FIX-P1-05** | Root `src/server/**` (Express) vs `apps/api/**` (Fastify) | **Dual HTTP application stacks**; duplicate auth/middleware surface; unclear canonical backend. | Deprecate or fence Express tree; document “legacy only” or remove; single owner for HTTP security review. | L | monorepo / architect |
| **FIX-P1-06** | `packages/ai-guardrails/package.json` | Dependency **`crypto` (^1.0.1)** npm package shadows Node built-in; unnecessary supply-chain risk. | Remove after verifying no `require('crypto')` resolves to npm package; use Node `node:crypto`. | S | packages |
| **FIX-P1-07** | Multiple `package.json` (e.g. `packages/database`, root, `apps/web-ui`) | **Prisma** and **Next / @next/*** version skew across workspaces. | Align versions via pnpm catalog or workspace overrides; one codegen line per DB package. | M | monorepo / deps |

---

## P2 — Medium

| ID | File / path | Problem | Recommended fix | Effort | Owner hint |
|----|-------------|---------|-----------------|--------|------------|
| **FIX-P2-01** | `apps/web-ui/tsconfig.json` | Stricter options commented out vs base. | Enable `noUncheckedIndexedAccess` first; then unused locals/params after lint cleanup. | M | web-ui |
| **FIX-P2-02** | `tsconfig.test.json` | `strict: false` for Jest. | Tighten toward `strict: true` for new tests; migrate critical suites first. | M | monorepo / test |
| **FIX-P2-03** | `apps/api/src` (e.g. `plugins/websocket.ts`, `services/file-storage-service.ts`, `middleware/impersonation.ts`) | Pervasive `any`; hot paths for WS, uploads, tokens. | Fastify types + Zod-inferred types; **after D1.** | L | api |
| **FIX-P2-04** | `packages/cli/src` | High `any` density. | Stricter handler types; **pairs with FIX-P1-02.** | M | cli |
| **FIX-P2-05** | `config/jest.config.js` | Global coverage with large `testPathIgnorePatterns`; many suites excluded from default `pnpm test`. | Per-package thresholds; document test matrix (`test:unit` vs integration vs package `vitest`). | M | monorepo / test |
| **FIX-P2-06** | Root `package.json` vs `apps/api` / `apps/web-ui` | Stripe major version skew (root vs apps). | Align on one major line; document upgrade steps. | S | monorepo / deps |
| **FIX-P2-07** | `apps/api/src/worker.ts` | Large worker file. | Split by job/domain; shared init e.g. `worker/bootstrap.ts`. | M | api |
| **FIX-P2-08** | `apps/api/src/routes/projects.ts`, `runs.ts`, `organizations.ts`, … | Large routes with `any`; validation intertwined. | Thin routes; services in `services/`; Zod next to routes. **After D1/D3.** | M | api |
| **FIX-P2-09** | `apps/api/src` (catch blocks) | Mix of `catch (error: any)` and typed paths. | Standardize on `unknown` + narrowing or `toErrorMessage()`. | M | api |
| **FIX-P2-10** | Repo-wide | Jest + Vitest split. | Document when to use which; optional long-term Vitest consolidation. | S | monorepo / dx |

---

## P3 — Low / quick wins

| ID | File / path | Problem | Recommended fix | Effort | Owner hint |
|----|-------------|---------|-----------------|--------|------------|
| **FIX-P3-01** | `apps/api/src`, `apps/web-ui/src` | Many `console.*` usages; noisy vs structured logging guidance. | Prefer shared loggers (`logger.ts` / `lib/logger.ts`) or build-time stripping. | M | api, web-ui |
| **FIX-P3-02** | `apps/*`, `packages/*` | Many TODO/FIXME markers. | Triage to issues or remove stale markers. | S | mixed |
| **FIX-P3-03** | `packages/*/dist` | Committed `dist/` noise. | Build at publish; `.gitignore` unless documented exception. | S | monorepo |
| **FIX-P3-04** | `apps/web-ui` | `allowJs: true` hides TS migration debt. | New code TS-only; optional `checkJs`. | S | web-ui |
| **FIX-P3-05** | Workspace naming | `guardrail-core` vs `@guardrail/*`. | Document; optional scoped rename in major bump. | L | monorepo |
| **FIX-P3-06** | `apps/api/src/services/run-execution.service.ts.tmp` | Stray `.tmp` next to real service. | Delete or move to archive; exclude from builds. | S | api |
| **FIX-P3-07** | `apps/api/src/middleware/error-handler.ts` | `(request as any).requestId` vs typed extensions elsewhere. | Align with Fastify declaration merging / typed request. | S | api |
| **FIX-P3-08** | Root `package.json` | Both `bcrypt` and `bcryptjs`. | Standardize on one implementation. | S | monorepo |
| **FIX-P3-09** | `apps/web-ui/src/lib/blog.ts` | TODO: real API. | Implement or remove from prod paths. | S | web-ui |
| **FIX-P3-10** | `packages/cli`, `packages/ship` vs root | `engines.node` >=18 vs root >=20.11. | Align `engines` with CI and root. | S | monorepo |
| **FIX-P3-11** | `packages/compliance` | Duplicate test roots (`src/**/__tests__` vs `tests/`). | Consolidate or document intentional split. | S | compliance |
| **FIX-P3-12** | `.cursorrules`, `.cursor/rules/architecture.mdc` | Describe Pages Router + Zustand; repo is **App Router–heavy**; Zustand not observed under `apps/web-ui/src`. | Update agent/onboarding docs to match reality. | S | dx |

---

## Resolved / outdated audit lines

| Audit ref | Original note | Current status |
|-----------|---------------|----------------|
| **L1** (`AUDIT_CODE.md`) | Duplicate comments in `packages/cli/src/index.ts`. | **Resolved / outdated:** live `index.ts` is thin bootstrap; legacy is `index.legacy.backup.ts`. |
| **H2 / Metrics** | `index.ts` ~5k lines. | **Outdated for live entry:** measure `index.legacy.backup.ts` / modular dirs. |
| **M4** | CLI `any` tied to monolithic `index.ts`. | **Partially addressed**; finish via **FIX-P1-02** + **FIX-P2-04**. |

---

## Metrics (for code-fixer scope)

| Bucket | Count |
|--------|-------|
| **P0** | 2 |
| **P1** | 7 |
| **P2** | 10 |
| **P3** | 12 |
| **Total actionable items** | **31** |
| **Resolved / outdated** | 3 audit lines above |

---

## Positive signals (keep)

- `tsconfig.base.json` and packages like `packages/core`, `packages/database` use strong strict settings—**mirror in `apps/api` over time**.
- Zod and validation middleware exist—**extend** rather than reinventing contracts.

---

*Last updated: consolidated fix-planner + comprehensive code-auditor. Implement in priority order; verify P0 before deploy.*
