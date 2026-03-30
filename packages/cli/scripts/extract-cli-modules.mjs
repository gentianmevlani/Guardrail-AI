#!/usr/bin/env node
/**
 * One-off extraction helper: reads index.legacy.backup.ts slices and writes module stubs.
 * Run from packages/cli: node scripts/extract-cli-modules.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '../src/index.legacy.backup.ts');
const text = readFileSync(src, 'utf-8');
const lines = text.split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const outDir = join(__dirname, '../src/_extracted');
mkdirSync(outDir, { recursive: true });

// Scan helper block 3314-4498 (1-based)
writeFileSync(join(outDir, 'scan-helpers-raw.ts'), slice(3314, 4498), 'utf-8');
// Registration block 713-3280 (excludes trailing helpers) — split later
writeFileSync(join(outDir, 'registrations-713-2682.ts'), slice(713, 2682), 'utf-8');
writeFileSync(join(outDir, 'registrations-2684-3280.ts'), slice(2684, 3280), 'utf-8');
// Interactive menu
writeFileSync(join(outDir, 'interactive-menu-raw.ts'), slice(4488, 4999), 'utf-8');

console.log('Wrote extracted chunks to src/_extracted/');
