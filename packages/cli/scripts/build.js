#!/usr/bin/env node

const { spawnSync } = require('child_process');
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
const bundleScript = path.join(__dirname, 'bundle-deps.js');
const bundleStatus = runNode(bundleScript);
if (bundleStatus !== 0) {
  console.warn('⚠️  Bundle step had issues, continuing anyway...');
}

// 2) Compile TypeScript (allow TS errors without failing publish)
console.log('\n📝 Step 2: Compiling TypeScript...');
runTsc();

// 3) Always rewrite runtime imports in dist output (must succeed)
console.log('\n🔧 Step 3: Fixing runtime imports...');
const fixScript = path.join(__dirname, 'fix-imports.js');
const fixStatus = runNode(fixScript);
if (fixStatus !== 0) process.exit(fixStatus);

console.log('\n✅ Build complete!');
process.exit(0);
