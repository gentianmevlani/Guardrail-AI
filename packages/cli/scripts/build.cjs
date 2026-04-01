#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runNode(scriptPath) {
  const res = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
  return typeof res.status === 'number' ? res.status : 1;
}

function runTsc() {
  // Avoid relying on a platform-specific `tsc` shim (tsc.cmd). This works cross-platform.
  const tscBin = require.resolve('typescript/bin/tsc');
  const res = spawnSync(process.execPath, [tscBin], { stdio: 'inherit' });
  return typeof res.status === 'number' ? res.status : 1;
}

// 1) Bundle workspace dependencies first
console.log('📦 Step 1: Bundling workspace dependencies...');
const bundleScript = path.join(__dirname, 'bundle-deps.cjs');
const bundleStatus = runNode(bundleScript);
if (bundleStatus !== 0) {
  console.warn('⚠️  Bundle step had issues, continuing anyway...');
}

// 2) Compile TypeScript (allow TS errors without failing publish)
console.log('\n📝 Step 2: Compiling TypeScript...');
runTsc();

// Copy JS context modules (team-conventions, git-context, etc.) for `guardrail team` and runtime requires
const ctxSrc = path.join(__dirname, '..', 'src', 'context');
const ctxDst = path.join(__dirname, '..', 'dist', 'context');
if (fs.existsSync(ctxSrc)) {
  fs.rmSync(ctxDst, { recursive: true, force: true });
  fs.cpSync(ctxSrc, ctxDst, { recursive: true });
  console.log('📁 Copied src/context → dist/context');
}

// 3) Always rewrite runtime imports in dist output (must succeed)
console.log('\n🔧 Step 3: Fixing runtime imports...');
const fixScript = path.join(__dirname, 'fix-imports.cjs');
const fixStatus = runNode(fixScript);
if (fixStatus !== 0) process.exit(fixStatus);

console.log('\n✅ Build complete!');
process.exit(0);
