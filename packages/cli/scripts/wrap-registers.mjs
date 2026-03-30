#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcCommands = join(__dirname, '../src/commands');
const preamble = readFileSync(join(srcCommands, 'register-preamble.txt'), 'utf8');

function fixRelativeRequires(body) {
  return body
    .replaceAll("require('./reality/", "require('../reality/")
    .replaceAll("require('./autopatch/", "require('../autopatch/")
    .replaceAll("require('./fix')", "require('../fix')")
    .replaceAll('require("./fix")', 'require("../fix")')
    .replaceAll("await import('./fix')", "await import('../fix')")
    .replaceAll('await import("./fix")', 'await import("../fix")');
}

const parts = [
  ['registerScansCoreCommands', 'register-scans-core.ts', '_reg-scans-core.txt'],
  ['registerSmellsFixCommands', 'register-smells-fix.ts', '_reg-smells-fix.txt'],
  ['registerFixRollbackCommands', 'register-fix-rollback.ts', '_reg-fix-rollback.txt'],
  ['registerShipCommands', 'register-ship.ts', '_reg-ship.txt'],
  ['registerRealityCommandsPartA', 'register-reality-a.ts', '_reg-reality-a.txt'],
  ['registerRealityCommandsPartB', 'register-reality-b.ts', '_reg-reality-b.txt'],
  ['registerAdvancedCommandsPartA', 'register-advanced-a.ts', '_reg-advanced-a.txt', { trimLeadingLines: 48 }],
  ['registerAdvancedCommandsPartB', 'register-advanced-b.ts', '_reg-advanced-b.txt'],
];

for (const entry of parts) {
  const [fnName, outName, bodyName, opts] = entry;
  let body = readFileSync(join(srcCommands, bodyName), 'utf8');
  if (opts?.trimLeadingLines) {
    const lines = body.split(/\r?\n/);
    body = lines.slice(opts.trimLeadingLines).join('\n');
  }
  body = fixRelativeRequires(body);
  const out = `${preamble}\n\nexport function ${fnName}(program: Command): void {\n${body}\n}\n`;
  writeFileSync(join(srcCommands, outName), out);
}

console.log('Wrote register-*.ts files');
