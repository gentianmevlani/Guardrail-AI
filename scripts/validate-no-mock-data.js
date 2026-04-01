#!/usr/bin/env node

/**
 * Mock Data Detection Script
 * 
 * Scans for common patterns that indicate mock/fake data usage.
 */

const fs = require('fs');
const path = require('path');

const MOCK_INDICATORS = [
  {
    pattern: /const\s+\w+\s*=\s*\[[\s\S]*?\{[\s\S]*?id:\s*\d+[\s\S]*?\}[\s\S]*?\]/g,
    description: 'Hardcoded array of objects with numeric IDs',
  },
  {
    pattern: /const\s+\w+\s*=\s*\{[\s\S]*?data:\s*\[[\s\S]*?\{[\s\S]*?id:[\s\S]*?\}[\s\S]*?\]/g,
    description: 'Hardcoded data object with array',
  },
  {
    pattern: /\/\/\s*(mock|fake|dummy|test|sample|placeholder)\s+data/gi,
    description: 'Comments mentioning mock data',
  },
  {
    pattern: /return\s+\[[\s\S]{0,500}?\{[\s\S]{0,200}?name:\s*['"][A-Z][a-z]+['"]/g,
    description: 'Return statement with hardcoded object arrays',
  },
];

function findFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (
      item.name.startsWith('.') ||
      item.name === 'node_modules' ||
      item.name === '.next' ||
      item.name === 'dist' ||
      item.name === 'build' ||
      item.name === '__tests__' ||
      item.name === '__mocks__'
    ) {
      continue;
    }

    if (item.isDirectory()) {
      files.push(...findFiles(fullPath));
    } else if (
      ['.ts', '.tsx', '.js', '.jsx'].some((ext) => item.name.endsWith(ext))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Skip test files and mocks (they're allowed to have mock data)
  if (
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('__mocks__') ||
    filePath.includes('__tests__')
  ) {
    return issues;
  }

  MOCK_INDICATORS.forEach((indicator) => {
    const matches = [...content.matchAll(indicator.pattern)];
    if (matches.length > 0) {
      matches.forEach((match) => {
        const lines = content.substring(0, match.index).split('\n');
        const lineNumber = lines.length;
        const lineContent = lines[lines.length - 1].trim();

        // Check if it's in a comment or string (might be documentation)
        const beforeMatch = content.substring(
          Math.max(0, match.index - 100),
          match.index
        );
        const isInComment =
          beforeMatch.includes('//') || beforeMatch.includes('/*');

        if (!isInComment) {
          issues.push({
            line: lineNumber,
            content: lineContent.substring(0, 100),
            description: indicator.description,
            match: match[0].substring(0, 150),
          });
        }
      });
    }
  });

  return issues;
}

function main() {
  console.log('🔍 Scanning for mock data patterns...\n');

  const srcDir = path.join(process.cwd(), 'src');
  if (!fs.existsSync(srcDir)) {
    console.log('⚠️  No src directory found. Skipping validation.');
    return;
  }

  const files = findFiles(srcDir);
  const allIssues = [];

  files.forEach((file) => {
    const issues = checkFile(file);
    allIssues.push(...issues.map((issue) => ({ ...issue, file })));
  });

  if (allIssues.length === 0) {
    console.log('✅ No mock data patterns detected!\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${allIssues.length} potential mock data pattern(s):\n`);

  allIssues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}:${issue.line}`);
    console.log(`   ${issue.description}`);
    console.log(`   Content: ${issue.content}...`);
    console.log(`   Match: ${issue.match}...\n`);
  });

  console.log(
    '💡 If these are legitimate (e.g., constants, seed data), you can:\n' +
      '   1. Move them to a separate constants file\n' +
      '   2. Add a comment: // eslint-disable-next-line no-mock-data\n' +
      '   3. Use real API endpoints instead\n'
  );

  // Don't fail the build, just warn
  process.exit(0);
}

main();

