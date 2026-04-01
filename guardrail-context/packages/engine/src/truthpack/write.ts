import fs from "node:fs";
import path from "node:path";

export async function writeJson(outDir: string, name: string, data: unknown) {
  await fs.promises.mkdir(outDir, { recursive: true });
  const p = path.join(outDir, name);
  await fs.promises.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

export function writeJsonSync(outDir: string, name: string, data: unknown) {
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}
