#!/usr/bin/env node

/**
 * Find all 'any' types in TypeScript files
 * Helps identify files that need type fixes
 */

const fs = require('fs');
const path = require('path');

function findAnyTypes(dir, results = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory() && !file.name.includes('node_modules') && !file.name.includes('__tests__')) {
      findAnyTypes(fullPath, results);
    } else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Match various any patterns
        const anyPatterns = [
          /:\s*any\b/g,
          /any\[/g,
          /any\s*\|/g,
          /any\s*&/g,
          /<any>/g,
          /catch\s*\([^)]*:\s*any\)/g,
        ];

        anyPatterns.forEach(pattern => {
          if (pattern.test(line)) {
            results.push({
              file: path.relative(process.cwd(), fullPath),
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      });
    }
  }

  return results;
}

const results = findAnyTypes(path.join(process.cwd(), 'src'));

if (results.length === 0) {
  console.log('✅ No `any` types found!');
  process.exit(0);
}

console.log(`\n📋 Found ${results.length} instances of 'any' types:\n`);

// Group by file
const byFile = {};
results.forEach(result => {
  if (!byFile[result.file]) {
    byFile[result.file] = [];
  }
  byFile[result.file].push(result);
});

Object.entries(byFile).forEach(([file, instances]) => {
  console.log(`${file}:`);
  instances.forEach(inst => {
    console.log(`  Line ${inst.line}: ${inst.content.substring(0, 80)}`);
  });
  console.log('');
});

// Write to file
const reportPath = path.join(process.cwd(), 'any-types-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`📄 Report saved to: ${reportPath}\n`);


