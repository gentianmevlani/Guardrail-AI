import fs from "node:fs";
import path from "node:path";

export async function readJson<T>(outDir: string, name: string): Promise<T> {
  const p = path.join(outDir, name);
  const raw = await fs.promises.readFile(p, "utf8");
  return JSON.parse(raw) as T;
}

export function readJsonSync<T>(outDir: string, name: string): T {
  const p = path.join(outDir, name);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as T;
}

export function truthPackExists(repoRoot: string): boolean {
  const outDir = path.join(repoRoot, ".guardrail-context");
  return fs.existsSync(path.join(outDir, "truthpack.json"));
}
