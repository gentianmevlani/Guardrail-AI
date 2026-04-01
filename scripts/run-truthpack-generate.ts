/**
 * Invoked by sync-vibecheck-truthpack.mjs — keeps path handling out of shell -e strings.
 */
import { resolve } from "node:path";
import { TruthPackGenerator } from "../packages/cli/src/truth-pack/index.ts";

async function main(): Promise<void> {
  const root = resolve(process.argv[2] ?? process.cwd());
  const g = new TruthPackGenerator(root);
  await g.generate();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
