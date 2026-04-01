#!/usr/bin/env node
/**
 * Generates Truth Pack under `.guardrail-context/` (CLI canonical location),
 * then mirrors JSON artifacts into `.vibecheck/truthpack/` for tools that read that path.
 *
 * Usage: node scripts/sync-vibecheck-truthpack.mjs [projectRoot]
 */

import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(__dirname, "..");

function main() {
  console.log(`Truth Pack project root: ${root}`);

  execSync(`pnpm exec tsx scripts/run-truthpack-generate.ts ${JSON.stringify(root)}`, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  const srcDir = join(root, ".guardrail-context");
  const destDir = join(root, ".vibecheck", "truthpack");

  if (!existsSync(srcDir)) {
    console.error("Expected .guardrail-context after generation");
    process.exit(1);
  }

  mkdirSync(destDir, { recursive: true });

  const files = readdirSync(srcDir).filter((f) => {
    const p = join(srcDir, f);
    return statSync(p).isFile() && f.endsWith(".json");
  });

  for (const f of files) {
    copyFileSync(join(srcDir, f), join(destDir, f));
  }

  console.log(`Copied ${files.length} file(s) to ${destDir}`);
}

main();
