#!/usr/bin/env node

/**
 * Generate CI/CD Configuration
 * 
 * Creates GitHub Actions, GitLab CI, or pre-commit hooks
 */

const fs = require('fs');
const path = require('path');

const CI_TEMPLATES = {
  github: `name: guardrail Validation

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main, develop ]

jobs:
  validate:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run type check
      run: npm run type-check
    
    - name: Run linting
      run: npm run lint
    
    - name: Validate API endpoints
      run: npm run validate
    
    - name: Check for mock data
      run: npm run validate
      continue-on-error: true
    
    - name: Check project structure
      run: npm run check-drift
      continue-on-error: true
`,

  gitlab: `validate:
  image: node:18
  stage: test
  cache:
    paths:
      - node_modules/
  before_script:
    - npm ci
  script:
    - npm run type-check
    - npm run lint
    - npm run validate
    - npm run check-drift
  only:
    - merge_requests
    - main
    - develop
`,

  precommit: `#!/bin/sh
# Pre-commit hook for guardrail validation

echo "🔍 Running guardrail validation..."

# Run type check
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ Type check failed"
  exit 1
fi

# Run linting
npm run lint:fix
if [ $? -ne 0 ]; then
  echo "❌ Linting failed"
  exit 1
fi

# Validate API endpoints
npm run validate
if [ $? -ne 0 ]; then
  echo "❌ Validation failed"
  exit 1
fi

echo "✅ All checks passed!"
exit 0
`,
};

function main() {
  const args = process.argv.slice(2);
  const ciType = args[0] || 'github';
  const outputDir = args[1] || process.cwd();

  if (!CI_TEMPLATES[ciType]) {
    console.error(`❌ Unknown CI type: ${ciType}`);
    console.error(`Available types: ${Object.keys(CI_TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  const template = CI_TEMPLATES[ciType];
  let outputPath;
  let content = template;

  switch (ciType) {
    case 'github':
      outputPath = path.join(outputDir, '.github', 'workflows', 'guardrail.yml');
      break;
    case 'gitlab':
      outputPath = path.join(outputDir, '.gitlab-ci.yml');
      break;
    case 'precommit':
      outputPath = path.join(outputDir, '.git', 'hooks', 'pre-commit');
      content = template;
      break;
  }

  // Create directory if needed
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, content);
  
  // Make executable for pre-commit
  if (ciType === 'precommit') {
    fs.chmodSync(outputPath, '755');
  }

  console.log(`✅ Generated ${ciType} configuration at: ${outputPath}`);
}

main();

