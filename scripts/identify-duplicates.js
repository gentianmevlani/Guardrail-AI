#!/usr/bin/env node

/**
 * Identify duplicate .js files that have .ts equivalents
 * This helps identify files that can be safely removed
 */

const fs = require('fs');
const path = require('path');

function findDuplicates(dir) {
  const duplicates = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      duplicates.push(...findDuplicates(fullPath));
    } else if (file.name.endsWith('.js') && !file.name.endsWith('.config.js')) {
      const tsPath = fullPath.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsPath)) {
        duplicates.push({
          js: fullPath,
          ts: tsPath,
          relative: path.relative(process.cwd(), fullPath),
        });
      }
    }
  }

  return duplicates;
}

const duplicates = findDuplicates(path.join(process.cwd(), 'src'));

if (duplicates.length === 0) {
  console.log('✅ No duplicate .js files found!');
  process.exit(0);
}

console.log(`\n📋 Found ${duplicates.length} duplicate .js files:\n`);

duplicates.forEach((dup, index) => {
  console.log(`${index + 1}. ${dup.relative}`);
  console.log(`   TypeScript: ${path.relative(process.cwd(), dup.ts)}`);
  console.log('');
});

console.log('\n💡 These .js files can be safely removed as they have .ts equivalents.');
console.log('   The TypeScript files will be compiled to JavaScript during build.\n');

// Write to file for review
const reportPath = path.join(process.cwd(), 'duplicate-files-report.json');
fs.writeFileSync(reportPath, JSON.stringify(duplicates, null, 2));
console.log(`📄 Report saved to: ${reportPath}\n`);


