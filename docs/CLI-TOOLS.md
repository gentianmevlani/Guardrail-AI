# CLI Tools Documentation

guardrail provides multiple CLI tools for different use cases. Each tool serves a specific purpose in the ecosystem.

## Available CLI Tools

### 1. `cli.js` - Basic Installation CLI
**Purpose**: Simple, scriptable installation of guardrail guardrails

**Usage**:
```bash
node cli.js [options]
```

**Features**:
- Installs core guardrails files (eslint, prettier, tsconfig)
- Copies necessary scripts and configurations
- Suitable for CI/CD and automation
- No interactive prompts

**When to use**:
- Automated setups
- Docker containers
- CI/CD pipelines
- When you need minimal configuration

### 2. `cli-wizard.js` - Interactive Setup Wizard
**Purpose**: Guided project setup with interactive questions

**Usage**:
```bash
node cli-wizard.js
```

**Features**:
- Interactive Q&A setup
- Generates project-specific templates
- Supports multiple project types (full-stack, api-only, frontend)
- Customizes configurations based on answers
- Creates proper project structure

**When to use**:
- New project setup
- When you want customized configuration
- Learning about available options
- Complex project requirements

### 3. `cli-natural.js` - Natural Language Interface
**Purpose**: Conversational interface for guardrail AI features

**Usage**:
```bash
node cli-natural.js [command]
```

**Features**:
- Natural language commands
- Interactive chat mode
- Access to AI features like:
  - Code search
  - Time-travel debugging
  - Production prediction
  - Code explanation
- Requires setup completion

**When to use**:
- Exploring codebase with natural language
- Using advanced AI features
- When you prefer conversational interface
- Complex queries requiring AI assistance

## Choosing the Right CLI

| Scenario | Recommended CLI |
|----------|-----------------|
| Quick guardrails installation | `cli.js` |
| New project with custom setup | `cli-wizard.js` |
| Using AI features | `cli-natural.js` |
| CI/CD automation | `cli.js` |
| Learning the system | `cli-wizard.js` |
| Complex code analysis | `cli-natural.js` |

## Installation

Make the CLI files executable:
```bash
chmod +x cli*.js
```

Or run with Node:
```bash
node cli.js
node cli-wizard.js
node cli-natural.js
```

## Examples

### Basic Installation
```bash
# Install guardrails with defaults
node cli.js

# Output: ✅ ESLint configured
#        ✅ TypeScript configured
#        ✅ Prettier configured
#        ✅ Pre-commit hooks installed
```

### Interactive Setup
```bash
# Start wizard
node cli-wizard.js

# ? Project type? full-stack
# ? Frontend framework? nextjs
# ? Database? postgresql
# ? Authentication? jwt
# ✅ Project configured successfully
```

### Natural Language
```bash
# Interactive mode
node cli-natural.js

# Or direct command
node cli-natural.js "show me all authentication code"
```

## Development

To add new CLI commands:
1. Create new file: `cli-[name].js`
2. Add shebang: `#!/usr/bin/env node`
3. Update this documentation
4. Add to package.json scripts if needed

## Related Files

- `src/lib/natural-language-cli.js` - Core natural language processing
- `src/lib/auto-setup.js` - Auto-setup logic
- `scripts/` - Various utility scripts
