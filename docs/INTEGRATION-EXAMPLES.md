# Integration Examples

## 🔧 Real-World Integration Patterns

### 1. Pre-Commit Hook Integration

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run guardrails validation
npm run validate

# Check polish before committing
npm run polish -- --check-only

# Analyze impact of changed files
git diff --cached --name-only | while read file; do
  if [[ "$file" == *.ts ]] || [[ "$file" == *.tsx ]]; then
    npm run analyze-impact "$file" || exit 1
  fi
done
```

### 2. CI/CD Pipeline Integration

**GitHub Actions:**
```yaml
name: Guardrails Check

on: [push, pull_request]

jobs:
  guardrails:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build knowledge base
        run: npm run build-knowledge
      
      - name: Run validation
        run: npm run validate
      
      - name: Check polish
        run: npm run polish -- --check-only
      
      - name: Check subscription limits
        run: npm run check-subscription pro
```

### 3. VS Code Tasks

Add to `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Guardrails: Validate",
      "type": "shell",
      "command": "npm run validate",
      "problemMatcher": []
    },
    {
      "label": "Guardrails: Polish Check",
      "type": "shell",
      "command": "npm run polish",
      "problemMatcher": []
    },
    {
      "label": "Guardrails: Build Knowledge",
      "type": "shell",
      "command": "npm run build-knowledge",
      "problemMatcher": []
    },
    {
      "label": "Guardrails: Architect",
      "type": "shell",
      "command": "npm run architect",
      "problemMatcher": []
    }
  ]
}
```

### 4. Package.json Scripts Integration

Add to your `package.json`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "npm run validate && next build",
    "precommit": "npm run validate && npm run polish -- --check-only",
    "prebuild": "npm run build-knowledge",
    "postinstall": "npm run architect -- --auto-apply-critical"
  }
}
```

### 5. Git Hooks with Husky

`.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run guardrails
npm run validate
npm run polish -- --check-only
```

`.husky/post-merge`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Rebuild knowledge after merge
npm run build-knowledge
```

### 6. Docker Integration

`Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install guardrails
RUN npm install -g ai-agent-guardrails

# Copy project
COPY . .

# Build knowledge base
RUN npm run build-knowledge

# Validate
RUN npm run validate

# Build
RUN npm run build
```

### 7. Monorepo Integration

For monorepos (Turborepo, Nx, etc.):

**Root `package.json`:**
```json
{
  "scripts": {
    "guardrails:validate": "turbo run validate",
    "guardrails:polish": "turbo run polish",
    "guardrails:knowledge": "turbo run build-knowledge"
  }
}
```

**Workspace `package.json`:**
```json
{
  "scripts": {
    "validate": "node ../../scripts/validate.js",
    "polish": "node ../../scripts/polish-project.js",
    "build-knowledge": "node ../../scripts/build-knowledge.js"
  }
}
```

### 8. Team Workflow Integration

**Onboarding Checklist:**
1. Install: `npm install -g ai-agent-guardrails`
2. Setup: `npm run setup`
3. Build knowledge: `npm run build-knowledge`
4. Review: `npm run architect`
5. Apply: `npm run architect` (yes)

**Daily Workflow:**
1. Before coding: `npm run deep-context "my question"`
2. Before changing: `npm run analyze-impact file.ts`
3. Finding code: `npm run semantic-search "what I need"`
4. Before commit: `npm run polish`
5. After merge: `npm run build-knowledge`

### 9. VS Code Extension Integration

Create `.vscode/settings.json`:
```json
{
  "tasks.runTask": {
    "guardrails.validate": {
      "command": "npm run validate"
    }
  },
  "mcp.servers": {
    "ai-agent-guardrails": {
      "command": "npx",
      "args": ["ai-agent-guardrails", "mcp"]
    }
  }
}
```

### 10. Slack/Teams Integration

**Slack Webhook:**
```javascript
// scripts/slack-notify.js
const https = require('https');

function notifySlack(message) {
  const data = JSON.stringify({ text: message });
  const options = {
    hostname: 'hooks.slack.com',
    path: process.env.SLACK_WEBHOOK_PATH,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };
  
  const req = https.request(options);
  req.write(data);
  req.end();
}

// Use in CI/CD
notifySlack('Guardrails check passed! ✅');
```

## 🎯 Best Practices

### 1. Knowledge Base Updates
- Rebuild after major changes
- Sync decisions regularly
- Update on feature completion

### 2. Impact Analysis
- Run before refactoring
- Check before deleting files
- Review before major changes

### 3. Polish Checks
- Run before releases
- Check in PR reviews
- Monitor continuously

### 4. Architect Agent
- Run on new projects
- Run when adding features
- Review recommendations

---

**Integrate seamlessly into your workflow!** 🔧

