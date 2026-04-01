# guardrail AI - Usage Examples

Complete examples for all new features and enhancements.

## 🚀 Quick Start Examples

### Auto-Fix Issues

```bash
# Interactive mode - shows issues and asks for confirmation
npm run fix

# Fix all issues without confirmation
npm run fix:all
```

**Example Output:**
```
🔧 Auto-fixing issues...

✅ Fixed 5 issue(s)
⚠️  1 issue(s) failed to fix

✅ src/components/ErrorBoundary.tsx
   • Created ErrorBoundary component

✅ src/components/LoadingState.tsx
   • Created LoadingState component

✅ src/pages/NotFound.tsx
   • Created NotFound page
```

### Watch Mode

```bash
# Start watching for file changes
npm run watch
```

**Example Output:**
```
👀 Watching /path/to/project for changes...

📋 src/components/Button.tsx
   ❌ 1 error(s)
      • no-any-type: Prevent using "any" type in TypeScript
   ⚠️  2 warning(s)
      • no-console-log: Warn about console.log statements

✅ src/lib/utils.ts - No issues
```

### Batch Validation

```bash
# Validate multiple projects
npm run batch-validate projects ./project1 ./project2 ./project3

# Validate multiple files
npm run batch-validate files src/components/Button.tsx src/lib/utils.ts
```

**Example Output:**
```
📊 VALIDATION REPORT

Total: 3
✅ Valid: 2
❌ Invalid: 1

Summary:
  Total Errors: 5
  Total Warnings: 12
  Avg Duration: 234.56ms
```

### Generate CI/CD Config

```bash
# GitHub Actions
npm run generate-ci github

# GitLab CI
npm run generate-ci gitlab

# Pre-commit hooks
npm run generate-ci precommit
```

## 📝 Configuration Examples

### Basic Configuration (.guardrailrc.json)

```json
{
  "validation": {
    "strict": true,
    "autoFix": true,
    "watch": false
  },
  "paths": {
    "components": "src/components",
    "features": "src/features"
  }
}
```

### Advanced Configuration

```json
{
  "rules": {
    "enabled": [
      "no-mock-data",
      "api-endpoint-validation",
      "no-hardcoded-secrets"
    ],
    "disabled": [
      "no-console-log"
    ],
    "custom": [
      {
        "id": "custom-rule",
        "name": "Custom Rule",
        "description": "Your custom validation",
        "severity": "warning",
        "pattern": "TODO",
        "check": "./scripts/custom-check.js"
      }
    ]
  },
  "validation": {
    "strict": true,
    "autoFix": true,
    "watch": true
  },
  "api": {
    "autoRegister": true,
    "endpointFile": "src/config/api-endpoints.ts"
  },
  "team": {
    "workspaceId": "team-123",
    "syncEnabled": true
  }
}
```

### Config Inheritance

```json
{
  "extends": "./shared/.guardrailrc.json",
  "rules": {
    "disabled": ["no-console-log"]
  }
}
```

## 💻 Code Examples

### Using Auto-Fixer Programmatically

```typescript
import { autoFixer } from '@/lib/auto-fixer';
import { polishService } from '@/lib/polish-service';

// Analyze and fix issues
const report = await polishService.analyzeProject('./my-project');
const autoFixable = report.issues.filter(i => i.autoFixable);

const fixReport = await autoFixer.fixAll(autoFixable, './my-project');
console.log(`Fixed ${fixReport.totalFixed} issues`);
```

### Using Watch Mode Programmatically

```typescript
import { watchValidator } from '@/lib/watch-validator';

await watchValidator.watch({
  projectPath: './my-project',
  onFileChange: (file, result) => {
    if (!result.valid) {
      console.log(`❌ ${file} has ${result.errors.length} errors`);
    }
  },
  onError: (error) => {
    console.error('Watch error:', error);
  },
});
```

### Using Enhanced Error Context

```typescript
import { errorEnhancer } from '@/lib/error-enhancer';

const error = {
  rule: 'no-mock-data',
  message: 'Mock data detected',
  severity: 'error',
  file: 'src/api/users.ts',
  line: 15,
};

const enhanced = await errorEnhancer.enhanceError(error, './my-project');

console.log(enhanced.explanation);
console.log('Suggested fixes:');
enhanced.suggestedFixes.forEach(fix => {
  console.log(`- ${fix.description}`);
  if (fix.codeExample) {
    console.log(fix.codeExample);
  }
});
```

### Using Embedding Service

```typescript
import { embeddingService } from '@/lib/embedding-service';

// With OpenAI (requires OPENAI_API_KEY env var)
const embedding = await embeddingService.generateEmbedding(
  'function getUser(id: string) { return fetch(`/api/users/${id}`); }',
  { provider: 'openai', model: 'text-embedding-3-small' }
);

// With Cohere (requires COHERE_API_KEY env var)
const embedding = await embeddingService.generateEmbedding(
  'function getUser(id: string) { return fetch(`/api/users/${id}`); }',
  { provider: 'cohere' }
);

// Local fallback (no API key needed)
const embedding = await embeddingService.generateEmbedding(
  'function getUser(id: string) { return fetch(`/api/users/${id}`); }',
  { provider: 'local' }
);

// Batch embeddings
const texts = ['code snippet 1', 'code snippet 2'];
const embeddings = await embeddingService.batchEmbed(texts);
```

### Using Cache Manager

```typescript
import { cacheManager } from '@/lib/cache-manager';
import { codebaseKnowledgeBase } from '@/lib/codebase-knowledge';

// Get cached knowledge
let knowledge = await cacheManager.getCachedKnowledge('./my-project');

if (!knowledge) {
  // Build if not cached
  knowledge = await codebaseKnowledgeBase.buildKnowledge('./my-project');
  await cacheManager.cacheKnowledge('./my-project', knowledge);
}

// Incremental update
knowledge = await cacheManager.updateKnowledgeIncremental(
  './my-project',
  ['src/components/Button.tsx'], // Changed files
  async (current) => {
    // Update logic here
    return current;
  }
);
```

### Using Team Collaboration

```typescript
import { teamCollaboration } from '@/lib/team-collaboration';

// Create workspace
const workspace = await teamCollaboration.createWorkspace(
  'team-123',
  'My Team',
  {
    sharedKnowledgeBase: true,
    ruleSharing: true,
    syncInterval: 3600000, // 1 hour
  }
);

// Sync knowledge base
await teamCollaboration.syncKnowledge('team-123', './my-project');

// Share rules
await teamCollaboration.shareRules('team-123', [
  {
    id: 'custom-rule',
    name: 'Custom Rule',
    description: 'Team-specific rule',
    severity: 'error',
    platforms: ['all'],
    check: async (file, content) => true,
  },
]);

// Get analytics
const analytics = await teamCollaboration.getTeamAnalytics('team-123');
console.log(`Active members: ${analytics.totalMembers}`);
```

### Using Batch Validator

```typescript
import { batchValidator } from '@/lib/batch-validator';

// Validate multiple projects
const report = await batchValidator.validateProjects(
  ['./project1', './project2', './project3'],
  {
    parallel: true,
    maxConcurrency: 5,
  }
);

console.log(`Valid: ${report.valid}/${report.total}`);
console.log(`Errors: ${report.summary.totalErrors}`);

// Validate multiple files
const fileReport = await batchValidator.validateFiles(
  ['src/components/Button.tsx', 'src/lib/utils.ts'],
  './my-project',
  {
    parallel: true,
    maxConcurrency: 10,
  }
);
```

### Using Language Detector

```typescript
import { languageDetector } from '@/lib/language-detector';

// Detect language from file
const lang = languageDetector.detectLanguage('src/components/Button.tsx');
console.log(lang); // 'typescript'

// Detect project languages
const languages = await languageDetector.detectProjectLanguage('./my-project');
console.log(languages); // ['typescript', 'javascript']

// Get language-specific rules
const rules = languageDetector.getLanguageRules('typescript');
console.log(`Found ${rules.length} TypeScript-specific rules`);

// Get language info
const info = languageDetector.getLanguageInfo('python');
console.log(`Linter: ${info?.linter}`); // 'pylint'
console.log(`Formatter: ${info?.formatter}`); // 'black'
```

### Using Change Tracker

```typescript
import { changeTracker } from '@/lib/change-tracker';

// Track changes
const report = await changeTracker.trackChanges('./my-project', '2024-01-01');

console.log(`Added: ${report.summary.added}`);
console.log(`Modified: ${report.summary.modified}`);
console.log(`Deleted: ${report.summary.deleted}`);

// Visual diff
const before = await codebaseKnowledgeBase.getKnowledge('./my-project');
// ... make changes ...
const after = await codebaseKnowledgeBase.getKnowledge('./my-project');

const diff = await changeTracker.visualizeDiff(before, after);
diff.differences.forEach(diff => {
  console.log(`${diff.type}: ${diff.path}`);
});
```

## 🔧 Integration Examples

### GitHub Actions

```yaml
name: guardrail Validation

on: [pull_request, push]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run validate
      - run: npm run type-check
      - run: npm run check-drift
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

npm run type-check && \
npm run lint:fix && \
npm run validate
```

### VS Code Settings

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.watcherExclude": {
    "**/.guardrail-cache/**": true
  }
}
```

## 📊 Metrics Dashboard

Access the metrics dashboard in the web UI:

```bash
cd web-ui
npm run dev
# Navigate to http://localhost:5173/metrics
```

The dashboard shows:
- guardrail effectiveness
- Code quality trends
- Performance metrics
- Team statistics
- Recent activity

## 🎯 Best Practices

1. **Enable Auto-Fix**: Set `"autoFix": true` in config for automatic fixes
2. **Use Watch Mode**: Enable watch mode during development for real-time feedback
3. **Cache Knowledge**: Use cache manager to speed up repeated operations
4. **Team Sync**: Enable team collaboration for shared rules and knowledge
5. **Batch Validation**: Use batch validator for CI/CD pipelines
6. **Language Detection**: Let the system auto-detect languages and apply rules

---

For more examples, see the main documentation files.

