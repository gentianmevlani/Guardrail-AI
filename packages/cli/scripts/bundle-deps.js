#!/usr/bin/env node

/**
 * Bundle workspace dependencies into the CLI package
 * This allows the CLI to be published as a standalone package
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const distDir = path.join(__dirname, '../dist');
const bundlesDir = path.join(distDir, 'bundles');

// Ensure bundles directory exists
if (!fs.existsSync(bundlesDir)) {
  fs.mkdirSync(bundlesDir, { recursive: true });
}

// Workspace packages to bundle
const packagesToBundle = [
  {
    name: '@guardrail/security',
    entry: path.join(__dirname, '../../../packages/security/src/index.ts'),
    output: path.join(bundlesDir, 'guardrail-security.js'),
    packageName: 'guardrail-security',
  },
  {
    name: '@guardrail/core',
    entry: path.join(__dirname, '../../../packages/core/src/index.ts'),
    output: path.join(bundlesDir, 'guardrail-core.js'),
    packageName: '@guardrail/core',
  },
  {
    name: '@guardrail/ship',
    entry: path.join(__dirname, '../../../packages/ship/src/index.ts'),
    output: path.join(bundlesDir, 'guardrail-ship.js'),
    packageName: 'guardrail-ship',
  },
];

async function bundlePackage(pkg) {
  console.log(`📦 Bundling ${pkg.name}...`);
  
  try {
    // Check if entry file exists
    if (!fs.existsSync(pkg.entry)) {
      console.warn(`⚠️  Entry file not found: ${pkg.entry}`);
      console.warn(`   Skipping ${pkg.name}`);
      return false;
    }

    await esbuild.build({
      entryPoints: [pkg.entry],
      bundle: true,
      outfile: pkg.output,
      format: 'cjs',
      platform: 'node',
      target: 'node18',
      external: [
        // Keep these external (they'll be installed as npm dependencies)
        'commander',
        'chalk',
        'ora',
        'zod',
        'fs',
        'path',
        'os',
        'crypto',
        'util',
        'stream',
        'events',
        'http',
        'https',
        'url',
        'child_process',
      ],
      sourcemap: false,
      minify: false,
      treeShaking: true,
      keepNames: true,
      banner: {
        js: `// Bundled ${pkg.name} as ${pkg.packageName}\n`,
      },
    });

    console.log(`✅ Bundled ${pkg.name} → ${pkg.output}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to bundle ${pkg.name}:`, error.message);
    return false;
  }
}

async function createBundleIndex() {
  // Create index file that exports all bundled packages
  const indexContent = `// Auto-generated bundle index
// This file maps workspace packages to bundled versions

module.exports = {
  '@guardrail/security': require('./bundles/guardrail-security'),
  '@guardrail/core': require('./bundles/guardrail-core'),
  '@guardrail/ship': require('./bundles/guardrail-ship'),
};
`;

  const indexPath = path.join(distDir, 'bundles', 'index.js');
  fs.writeFileSync(indexPath, indexContent);
  console.log('✅ Created bundle index');
}

async function main() {
  console.log('🚀 Bundling workspace dependencies...\n');

  const results = await Promise.all(
    packagesToBundle.map(pkg => bundlePackage(pkg))
  );

  const successCount = results.filter(Boolean).length;
  const totalCount = packagesToBundle.length;

  if (successCount === totalCount) {
    await createBundleIndex();
    console.log(`\n✅ Successfully bundled ${successCount}/${totalCount} packages`);
    return 0;
  } else {
    console.error(`\n❌ Failed to bundle ${totalCount - successCount} packages`);
    return 1;
  }
}

main().then(code => process.exit(code));
