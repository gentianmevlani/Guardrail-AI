# guardrail AI - Full-Codebase Context Manager

## 🧠 What It Does

guardrail AI now acts as a **full-codebase context manager** for AI coding assistants. Instead of AI tools seeing only one file or snippet at a time (which causes hallucinations), guardrail AI:

1. **Reads your entire codebase** - Scans all files, not just snippets
2. **Builds a project map** - Architecture, endpoints, data structures, dependencies, connections
3. **Generates context files** - Rules and summaries that feed to AI assistants
4. **Integrates with IDEs** - Works with Cursor, VSCode, Copilot, Claude, etc.
5. **Reduces hallucinations** - AI assistants work with the "big picture" in mind

## 🎯 Key Features

### Full-Codebase Scanning
- Scans entire project (not just open files)
- Detects architecture type
- Maps all API endpoints
- Identifies data structures
- Tracks dependencies and connections
- Discovers code patterns

### Context Generation
- Generates rules files for AI assistants
- Creates IDE-specific context files
- Builds project map (JSON)
- Maintains conventions documentation

### IDE Integration
- **Cursor** - Auto-loads `.cursorrules`
- **VSCode** - Settings and context files
- **Copilot** - Context markdown files
- **Claude** - JSON context files

### Fast Setup
- Minutes, not hours
- One command: `guardrail context`
- Automatic detection
- No manual configuration

## 🚀 Usage

### Build Context
```bash
guardrail context
# or
npm run build-context
```

This will:
1. Scan your entire codebase
2. Build project map
3. Generate context files
4. Set up IDE integration

### Generated Files

All files are created in `.guardrail/`:

- **context.json** - Universal context (all AI assistants)
- **.cursorrules** - Cursor-specific context
- **copilot-context.md** - GitHub Copilot context
- **claude-context.json** - Claude AI context
- **rules.md** - Project rules and conventions
- **project-map.json** - Complete project map

### Auto-Update

Run `guardrail context` whenever your codebase changes significantly. The context files will be regenerated with the latest information.

## 📊 What Gets Scanned

### Architecture
- Project type (monolith, microservices, SPA, fullstack, serverless)
- Framework detection
- Build system
- Deployment targets
- Entry points
- Layer structure

### API Endpoints
- All routes (Express, Next.js, etc.)
- HTTP methods
- Parameters
- Authentication requirements
- Rate limiting

### Data Structures
- TypeScript interfaces
- Type definitions
- Classes
- Models
- Schemas
- Relationships

### Dependencies
- Runtime dependencies
- Dev dependencies
- Peer dependencies
- Internal modules

### Connections
- Import/export relationships
- File dependencies
- API calls
- Database connections

### Patterns
- Component patterns
- Hook patterns
- Service patterns
- Utility patterns
- Middleware patterns

### Conventions
- Naming conventions (files, components, functions)
- File structure
- Import/export patterns
- Code style

## 💡 How It Works

### 1. Scanning Phase
```
guardrail context
  ↓
Scans entire codebase
  ↓
Detects architecture, endpoints, data structures
  ↓
Maps dependencies and connections
  ↓
Identifies patterns and conventions
```

### 2. Generation Phase
```
Project Map
  ↓
Generates context files
  ↓
Creates IDE-specific files
  ↓
Sets up integration
```

### 3. Usage Phase
```
AI Assistant (Cursor/Copilot/Claude)
  ↓
Reads context files
  ↓
Has full project awareness
  ↓
Generates code with context
```

## 🎯 Benefits

### Reduces Hallucinations
- AI sees the full picture, not just snippets
- Understands project structure
- Knows existing patterns
- Follows conventions

### Prevents Errors
- Uses correct naming conventions
- Matches architecture type
- References real endpoints
- Follows file structure

### Saves Time
- Faster code generation
- Less rework
- Better suggestions
- Faster onboarding

### Improves Quality
- Consistent code
- Follows patterns
- Matches conventions
- Better architecture

## 🔌 IDE Integration

### Cursor
The `.cursorrules` file is automatically loaded by Cursor. Your AI assistant will have full context awareness.

### VSCode
Settings are configured to recognize context files. You can manually reference them in prompts.

### GitHub Copilot
Use the `copilot-context.md` file in your prompts or as reference.

### Claude
Load the `claude-context.json` file when starting a conversation.

## 📋 Example Context File

```markdown
# Project Architecture
Type: fullstack
Framework: Next.js
Build System: Next.js
Layers: components, pages, api, services, utils

# API Endpoints
- GET /api/users → app/api/users/route.ts
- POST /api/users → app/api/users/route.ts
  Auth: Required

# Data Structures
- User (interface)
  Fields: id: string, name: string, email: string

# Naming Conventions
Files: kebab-case
Components: PascalCase
Functions: camelCase
```

## 🚀 Quick Start

```bash
# 1. Build context
guardrail context

# 2. Use with AI assistant
# Cursor: Automatically loaded
# Copilot: Reference copilot-context.md
# Claude: Load claude-context.json

# 3. Regenerate when codebase changes
guardrail context
```

## 💡 Tips

1. **Run regularly** - Rebuild context when architecture changes
2. **Check context files** - Review generated files for accuracy
3. **Customize rules** - Edit `.cursorrules` for project-specific rules
4. **Share with team** - Commit context files to version control
5. **Use in prompts** - Reference context files in AI prompts

---

**Give your AI assistant the full picture - not just snippets!** 🧠

