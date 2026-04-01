#!/usr/bin/env node
/**
 * CI guard: fail if new TypeScript files are added under repository-root src/.
 *
 * Environment:
 *   ROOT_SRC_BASE_REF - merge base (default: origin/main, or origin/$GITHUB_BASE_REF)
 *   SKIP_ROOT_SRC_TS_CHECK - set to "1" to skip (local sandboxes without git)
 *
 * Exits 0 when not a git repo or when skip is set (so local clones without .git still work).
 */
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

if (process.env.SKIP_ROOT_SRC_TS_CHECK === "1") {
  console.log("check-no-new-root-src-ts: skipped (SKIP_ROOT_SRC_TS_CHECK=1)");
  process.exit(0);
}

const gitOk = run("git rev-parse --is-inside-work-tree 2>/dev/null");
if (gitOk !== "true") {
  console.warn("check-no-new-root-src-ts: not a git repository, skipping");
  process.exit(0);
}

let base =
  process.env.ROOT_SRC_BASE_REF ||
  (process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "origin/main");

const refExists = run(`git rev-parse --verify ${base} 2>/dev/null`);
if (!refExists) {
  const head = run("git rev-parse HEAD 2>/dev/null");
  if (head) {
    console.warn(
      `check-no-new-root-src-ts: base ref ${base} missing; comparing against HEAD~1 only (shallow clone?)`,
    );
    base = "HEAD~1";
  } else {
    console.warn("check-no-new-root-src-ts: no usable git refs, skipping");
    process.exit(0);
  }
}

const mergeBase = run(`git merge-base ${base} HEAD 2>/dev/null`) || base;
const diff = run(
  `git diff --name-only --diff-filter=A ${mergeBase}...HEAD -- "src/**/*.ts" "src/**/*.tsx" "src/**/*.mts" "src/**/*.cts"`,
);

const added = diff
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

if (added.length > 0) {
  console.error(
    "ERROR: New TypeScript files under deprecated repository-root src/ are not allowed:",
  );
  for (const f of added) {
    console.error(`  - ${f}`);
  }
  console.error(
    "Add code under apps/web-ui/src, apps/api/src, or packages/* instead. See SOURCE_MAP.md.",
  );
  process.exit(1);
}

console.log("check-no-new-root-src-ts: OK (no new TS under root src/)");
