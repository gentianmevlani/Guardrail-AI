import { buildTruthPack } from "@guardrail-context/engine";

export async function cmdIndex(repoRoot: string) {
  console.log("📦 Building Truth Pack...\n");

  const startTime = Date.now();
  const result = await buildTruthPack(repoRoot);
  const duration = Date.now() - startTime;

  console.log(`
✅ Truth Pack built in ${duration}ms

Output: ${result.outDir}
  - truthpack.json (project metadata)
  - symbols.json (${result.symbols.length} symbols)
  - deps.json (dependencies)
  - graph.json (import graph)
  - risk.json (risk tags)
  - importance.json (file importance scores)
  - patterns.json (${Object.keys(result.patterns).length} golden patterns)

Next: Run 'guardrail-context serve' to start the MCP server
`);
}
