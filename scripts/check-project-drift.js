#!/usr/bin/env node

/**
 * Project Drift Detection Script
 * 
 * Checks if the project structure has drifted from the intended architecture.
 * Validates file locations, naming conventions, and structure.
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tailwind.config.ts',
  'tailwind.config.js',
  'next.config.js',
  'next.config.mjs',
  'postcss.config.js',
  '.env',
  '.env.local',
  '.env.example',
  '.gitignore',
  '.eslintrc.js',
  'eslint.config.js',
  '.prettierrc',
  'README.md',
  'LICENSE',
  'docker-compose.yml',
  'Dockerfile',
  '.husky',
];

const REQUIRED_DIRECTORIES = [
  'src',
  'src/components',
  'src/lib',
  'src/types',
];

const FORBIDDEN_ROOT_PATTERNS = [
  /\.tsx?$/,
  /\.jsx?$/,
  /Component\.tsx?$/,
  /Hook\.tsx?$/,
  /Service\.tsx?$/,
  /Api\.tsx?$/,
  /Types?\.tsx?$/,
  /Utils?\.tsx?$/,
  /README-.*\.md$/,
  /SETUP.*\.md$/,
];

function checkRootDirectory() {
  const rootFiles = fs.readdirSync(process.cwd(), { withFileTypes: true });
  const issues = [];

  rootFiles.forEach((item) => {
    if (item.isFile()) {
      // Check if it's an allowed root file
      if (!ALLOWED_ROOT_FILES.includes(item.name)) {
        // Check if it matches forbidden patterns
        const isForbidden = FORBIDDEN_ROOT_PATTERNS.some((pattern) =>
          pattern.test(item.name)
        );

        if (isForbidden) {
          issues.push({
            type: 'forbidden-root-file',
            file: item.name,
            message: `File "${item.name}" should not be in root directory. Move it to appropriate /src/ subdirectory.`,
          });
        }
      }
    }
  });

  return issues;
}

function checkDirectoryStructure() {
  const issues = [];
  const cwd = process.cwd();

  REQUIRED_DIRECTORIES.forEach((dir) => {
    const fullPath = path.join(cwd, dir);
    if (!fs.existsSync(fullPath)) {
      issues.push({
        type: 'missing-directory',
        directory: dir,
        message: `Required directory "${dir}" is missing.`,
      });
    }
  });

  return issues;
}

function checkFileLocations(srcDir) {
  const issues = [];
  const files = findFiles(srcDir);

  files.forEach((file) => {
    const relativePath = path.relative(srcDir, file);
    const parts = relativePath.split(path.sep);

    // Check for files that might be in wrong locations
    if (parts.length === 1 && !file.includes('page.tsx') && !file.includes('layout.tsx')) {
      // File directly in src/ (should be in subdirectory)
      issues.push({
        type: 'wrong-location',
        file: relativePath,
        message: `File "${relativePath}" is directly in src/. Move it to appropriate subdirectory.`,
      });
    }
  });

  return issues;
}

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
      item.name === 'build'
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

function main() {
  console.log('🔍 Checking for project drift...\n');

  const allIssues = [];

  // Check root directory
  const rootIssues = checkRootDirectory();
  allIssues.push(...rootIssues);

  // Check directory structure
  const dirIssues = checkDirectoryStructure();
  allIssues.push(...dirIssues);

  // Check file locations
  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) {
    const locationIssues = checkFileLocations(srcDir);
    allIssues.push(...locationIssues);
  }

  if (allIssues.length === 0) {
    console.log('✅ No drift detected! Project structure is correct.\n');
    process.exit(0);
  }

  console.log(`⚠️  Found ${allIssues.length} drift issue(s):\n`);

  const grouped = {
    'forbidden-root-file': [],
    'missing-directory': [],
    'wrong-location': [],
  };

  allIssues.forEach((issue) => {
    grouped[issue.type].push(issue);
  });

  if (grouped['forbidden-root-file'].length > 0) {
    console.log('📁 FORBIDDEN ROOT FILES:');
    grouped['forbidden-root-file'].forEach((issue) => {
      console.log(`   ${issue.file}`);
      console.log(`   ${issue.message}\n`);
    });
  }

  if (grouped['missing-directory'].length > 0) {
    console.log('📂 MISSING DIRECTORIES:');
    grouped['missing-directory'].forEach((issue) => {
      console.log(`   ${issue.message}\n`);
    });
  }

  if (grouped['wrong-location'].length > 0) {
    console.log('📍 FILES IN WRONG LOCATIONS:');
    grouped['wrong-location'].forEach((issue) => {
      console.log(`   ${issue.file}`);
      console.log(`   ${issue.message}\n`);
    });
  }

  console.log(
    '💡 Fix drift by:\n' +
      '   1. Moving files to appropriate /src/ subdirectories\n' +
      '   2. Creating missing required directories\n' +
      '   3. Following the project architecture template\n'
  );

  process.exit(1);
}

main();

