#!/usr/bin/env node
/**
 * Regenerates SOURCE_MAP.md with a per-file classification of repo-root src/.
 * Run from repository root: node scripts/generate-source-map.mjs
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** @typedef {'a' | 'b' | 'c'} Category */

/** @param {string} relPath path relative to src/ */
function classify(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const base = norm.split("/")[0];

  /** @type {Category} */
  let cat = "b";
  /** @type {string} */
  let home = "packages/core";

  if (base === "components" || base === "pages") {
    cat = "a";
    home = "apps/web-ui/src";
    return { cat, home };
  }

  if (base === "bin") {
    cat = "b";
    home = "packages/cli";
    return { cat, home };
  }

  if (base === "server" || base === "services") {
    cat = "b";
    home = "apps/api/src";
    return { cat, home };
  }

  if (base === "config") {
    cat = "b";
    home = "apps/api/src/config (or shared config package)";
    return { cat, home };
  }

  if (base === "lib") {
    const second = norm.split("/")[1] ?? "";
    const map = {
      ai: "packages/ai-guardrails",
      security: "packages/security",
      orchestrator: "packages/core",
      ship: "packages/ship",
      "ship-badge": "packages/ship",
      cli: "packages/cli",
      mcp: "packages/cli",
      "mdc-generator": "packages/cli",
      mockproof: "packages/core",
      "route-integrity": "packages/core",
      polish: "packages/core",
      "reality-mode": "packages/ai-guardrails",
      "reality-sniff": "packages/core",
      analysis: "packages/core",
      certification: "packages/core",
      cdn: "packages/core",
      cache: "packages/core",
      context: "packages/core",
      errors: "packages/core",
      "framework-adapters": "packages/core",
      intelligence: "packages/core",
      monitoring: "packages/core",
      scaling: "packages/core",
      suites: "packages/core",
      types: "packages/core",
      verification: "packages/core",
    };
    if (second && map[second]) {
      home = map[second];
      return { cat: "b", home };
    }
    return { cat: "b", home: "packages/core" };
  }

  return { cat, home };
}

/** @param {string} dir */
async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

async function hasSiblingTs(jsPath) {
  const ts = jsPath.replace(/\.js$/, ".ts");
  try {
    await stat(ts);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const all = await walk(SRC);
  const rows = [];

  for (const abs of all.sort()) {
    const rel = relative(SRC, abs).replace(/\\/g, "/");
    let { cat, home } = classify(rel);

    if (abs.endsWith(".js") && (await hasSiblingTs(abs))) {
      cat = "c";
      home = "remove duplicate .js after migration (keep .ts only)";
    }

    rows.push({ rel, cat, home });
  }

  const byCat = { a: [], b: [], c: [] };
  for (const r of rows) {
    byCat[r.cat].push(r);
  }

  const lines = [];
  lines.push("# Root `src/` source map (deprecation)");
  lines.push("");
  lines.push("Repository-root `src/` is **deprecated**. New TypeScript must land under `apps/web-ui/src`, `apps/api/src`, or `packages/*`. CI blocks **new** `.ts`/`.tsx` files here (see `scripts/check-no-new-root-src-ts.mjs`).");
  lines.push("");
  lines.push("## Legend");
  lines.push("");
  lines.push("| Tag | Meaning |");
  lines.push("| --- | --- |");
  lines.push("| **(a)** | Belongs in `apps/web-ui/src` (UI, legacy pages mirror) |");
  lines.push("| **(b)** | Belongs in `packages/*` or `apps/api/src` (shared logic, API) |");
  lines.push("| **(c)** | Dead / remove: stale duplicate `.js` next to `.ts`, or obsolete artifacts |");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push(`| Category | Files |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| (a) | ${byCat.a.length} |`);
  lines.push(`| (b) | ${byCat.b.length} |`);
  lines.push(`| (c) | ${byCat.c.length} |`);
  lines.push("");
  lines.push("## Per-file manifest");
  lines.push("");
  lines.push("| Path (under `src/`) | Tag | Intended home |");
  lines.push("| --- | --- | --- |");

  for (const r of rows) {
    const tag =
      r.cat === "a" ? "(a)" : r.cat === "b" ? "(b)" : "(c)";
    const esc = r.rel.replace(/\|/g, "\\|");
    lines.push(`| \`${esc}\` | ${tag} | ${r.home} |`);
  }

  lines.push("");
  lines.push("---");
  lines.push("*Regenerate: `node scripts/generate-source-map.mjs`*");

  const out = join(ROOT, "SOURCE_MAP.md");
  await writeFile(out, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${out} (${rows.length} files)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
