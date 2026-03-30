#!/usr/bin/env node

/**
 * API Endpoint Validation Script
 * 
 * Scans the codebase for API calls and validates they reference real endpoints.
 * Prevents mock data and fake API usage.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MOCK_DATA_PATTERNS = [
  /lorem\s+ipsum/gi,
  /mock\s+data/gi,
  /fake\s+data/gi,
  /dummy\s+data/gi,
  /test\s+data/gi,
  /example\.com/gi,
  /placeholder/gi,
  /sample\s+data/gi,
  /const\s+\w+\s*=\s*\[.*\{.*id:\s*\d+.*\}/s, // Array of objects with numeric IDs
];

const FAKE_ENDPOINT_PATTERNS = [
  /fetch\(['"]https?:\/\/jsonplaceholder\.typicode\.com/gi,
  /fetch\(['"]https?:\/\/reqres\.in/gi,
  /fetch\(['"]https?:\/\/api\.example\.com/gi,
  /fetch\(['"]https?:\/\/fakeapi\./gi,
  /fetch\(['"]https?:\/\/mockapi\./gi,
  /\/api\/mock\//gi,
  /\/api\/fake\//gi,
  /\/api\/test\//gi,
];

const ALLOWED_EXTERNAL_APIS = [
  // Add your actual external API domains here
  // 'api.github.com',
  // 'api.stripe.com',
];

function findFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    // Skip node_modules, .next, dist, etc.
    if (
      item.name.startsWith('.') ||
      item.name === 'node_modules' ||
      item.name === '.next' ||
      item.name === 'dist' ||
      item.name === 'build'
    ) {
      continue;
    }

    if (item.isDirectory()) {
      files.push(...findFiles(fullPath, extensions));
    } else if (extensions.some((ext) => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check for mock data patterns
  MOCK_DATA_PATTERNS.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        type: 'mock-data',
        pattern: pattern.toString(),
        matches: matches.length,
        file: filePath,
      });
    }
  });

  // Check for fake endpoints
  FAKE_ENDPOINT_PATTERNS.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        type: 'fake-endpoint',
        pattern: pattern.toString(),
        matches: matches.length,
        file: filePath,
      });
    }
  });

  // Check for external API calls (warn if not in allowed list)
  const externalApiRegex = /fetch\(['"](https?:\/\/[^'"]+)['"]/gi;
  let match;
  while ((match = externalApiRegex.exec(content)) !== null) {
    const url = match[1];
    const domain = new URL(url).hostname;

    if (
      !ALLOWED_EXTERNAL_APIS.some((allowed) => domain.includes(allowed)) &&
      !url.includes('localhost') &&
      !url.includes('127.0.0.1')
    ) {
      issues.push({
        type: 'external-api',
        url: url,
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
      });
    }
  }

  return issues;
}

function main() {
  console.log('🔍 Validating API endpoints and checking for mock data...\n');

  const srcDir = path.join(process.cwd(), 'src');
  if (!fs.existsSync(srcDir)) {
    console.log('⚠️  No src directory found. Skipping validation.');
    return;
  }

  const files = findFiles(srcDir);
  const allIssues = [];

  files.forEach((file) => {
    const issues = checkFile(file);
    allIssues.push(...issues);
  });

  if (allIssues.length === 0) {
    console.log('✅ No issues found! All API calls appear to use real endpoints.\n');
    process.exit(0);
  }

  console.log(`❌ Found ${allIssues.length} issue(s):\n`);

  const groupedIssues = {
    'mock-data': [],
    'fake-endpoint': [],
    'external-api': [],
  };

  allIssues.forEach((issue) => {
    groupedIssues[issue.type].push(issue);
  });

  if (groupedIssues['mock-data'].length > 0) {
    console.log('📝 MOCK DATA DETECTED:');
    groupedIssues['mock-data'].forEach((issue) => {
      console.log(`   ${issue.file}`);
      console.log(`   Pattern: ${issue.pattern}`);
      console.log(`   Matches: ${issue.matches}\n`);
    });
  }

  if (groupedIssues['fake-endpoint'].length > 0) {
    console.log('🌐 FAKE ENDPOINTS DETECTED:');
    groupedIssues['fake-endpoint'].forEach((issue) => {
      console.log(`   ${issue.file}`);
      console.log(`   Pattern: ${issue.pattern}`);
      console.log(`   Matches: ${issue.matches}\n`);
    });
  }

  if (groupedIssues['external-api'].length > 0) {
    console.log('⚠️  EXTERNAL API CALLS (not in allowed list):');
    groupedIssues['external-api'].forEach((issue) => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`   URL: ${issue.url}\n`);
    });
  }

  console.log(
    '\n💡 Fix these issues by:\n' +
      '   1. Removing all mock/fake data\n' +
      '   2. Using only real, registered API endpoints\n' +
      '   3. Adding external APIs to ALLOWED_EXTERNAL_APIS if legitimate\n'
  );

  process.exit(1);
}

main();

