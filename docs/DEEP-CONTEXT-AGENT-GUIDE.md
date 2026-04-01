# Deep Context Agent - Complete Guide

## 🎯 What is the Deep Context Agent?

The **Deep Context Agent** is a project-specific AI assistant with **deeper understanding** of your codebase than general AI agents like ChatGPT.

**Key Difference:**
- **General AI (ChatGPT)**: Knows programming in general, but not YOUR codebase
- **Deep Context Agent**: Knows YOUR codebase specifically - architecture, patterns, conventions, decisions

## 🧠 How It Works

### 1. Knowledge Base Building
The agent builds a deep knowledge base of your project:

- **Architecture**: Structure, tech stack, layers, entry points
- **Patterns**: Common patterns used in your codebase
- **Conventions**: Naming, file organization, import patterns
- **Relationships**: File dependencies, imports, exports
- **Decisions**: Past architectural decisions and rationale
- **Context**: Recent changes, active features, current focus

### 2. Context-Aware Responses
When you ask a question, the agent:
- Searches the knowledge base
- Finds relevant patterns and decisions
- Understands your architecture
- Provides project-specific answers

### 3. Continuous Learning
The knowledge base grows over time:
- Tracks decisions as you make them
- Updates with recent changes
- Learns from patterns you use
- Remembers context across sessions

## 🚀 Usage

### Build Knowledge Base
```bash
npm run build-knowledge
```

This analyzes your codebase and creates `.codebase-knowledge.json`

### Get Deep Context
```bash
npm run deep-context "How do I add a new API endpoint?"
```

### In Your IDE (MCP)
Available as MCP tools:
- `build_knowledge_base` - Build/rebuild knowledge
- `get_deep_context` - Get context for a query

## 📊 What It Knows

### Architecture
- Project type (monolith, microservices, modular)
- Tech stack (React, Express, PostgreSQL, etc.)
- Layer structure (components, services, hooks, etc.)
- Entry points and main modules

### Patterns
- Component patterns
- Hook patterns
- API patterns
- State management patterns
- Routing patterns

### Conventions
- File naming (kebab-case, PascalCase, etc.)
- Import patterns (path aliases, relative, etc.)
- File organization
- Code style

### Relationships
- File dependencies
- Import/export relationships
- Module connections

### Decisions
- Past architectural decisions
- Rationale for decisions
- Files affected by decisions
- Context of decisions

## 💡 Example

### Without Deep Context (General AI)
**You:** "How do I add a new API endpoint?"

**General AI:** "Create a route file, add handler, export it..."

*Generic answer, doesn't know your project structure*

### With Deep Context
**You:** "How do I add a new API endpoint?"

**Deep Context Agent:**
```
🧠 Deep Context for: "How do I add a new API endpoint?"

## Understanding
This is a modular project using:
- Frontend: react, next
- Backend: express
- Structure: components → pages → services → api

## Recommendations
- Found 5 relevant API patterns in codebase
- Follow kebab-case naming convention
- Previous decision: Use Express routers in src/api/routes/

## Full Context
Your API routes are organized in src/api/routes/
Existing patterns show:
- Routes use Express Router
- Handlers are in src/api/handlers/
- Validation uses Zod schemas
- Error handling uses centralized middleware

Consider using existing patterns for consistency.
```

*Project-specific answer based on YOUR codebase!*

## 🎯 Benefits

### For You
- ✅ **Project-specific answers** - Not generic advice
- ✅ **Pattern recognition** - Uses YOUR patterns
- ✅ **Convention awareness** - Follows YOUR conventions
- ✅ **Decision memory** - Remembers past decisions
- ✅ **Context continuity** - Understands project evolution

### For Your Project
- ✅ **Consistency** - Enforces existing patterns
- ✅ **Knowledge preservation** - Decisions aren't lost
- ✅ **Onboarding** - New team members understand codebase
- ✅ **Maintainability** - Patterns are documented and enforced

## 🔧 Integration

### With Architect Agent
The Deep Context Agent works with the Architect Agent:
1. Architect Agent analyzes what's needed
2. Deep Context Agent provides project-specific context
3. Templates are applied following YOUR conventions

### With IDE (MCP)
Your AI assistant can:
- Build knowledge base automatically
- Use knowledge for context-aware suggestions
- Remember decisions across sessions
- Provide project-specific help

## 📋 Knowledge Base Structure

The `.codebase-knowledge.json` file contains:

```json
{
  "architecture": {
    "structure": { "type": "modular", "layers": [...] },
    "techStack": { "frontend": ["react"], "backend": ["express"] },
    "conventions": { "naming": { "files": "kebab-case" } }
  },
  "patterns": [
    { "name": "Component Pattern", "examples": [...], "frequency": 25 }
  ],
  "decisions": [
    { "question": "How to organize API routes?", "decision": "Use Express routers", ... }
  ],
  "relationships": {
    "imports": { "file.ts": ["dependency1", "dependency2"] }
  },
  "context": {
    "recentChanges": [...],
    "activeFeatures": ["auth", "payments"]
  }
}
```

## 🔄 Workflow

### Initial Setup
1. Run `npm run build-knowledge`
2. Knowledge base is created
3. Agent is ready to use

### Daily Use
1. Ask questions using `get_deep_context`
2. Agent searches knowledge base
3. Provides project-specific answers

### Maintenance
1. Rebuild knowledge after major changes
2. Add decisions as you make them
3. Update context as project evolves

## 💡 Pro Tips

1. **Build early** - Create knowledge base from the start
2. **Rebuild regularly** - Update after major changes
3. **Add decisions** - Document architectural decisions
4. **Use in IDE** - Integrate with MCP for seamless use
5. **Share knowledge** - Knowledge base helps team onboarding

## 🎯 Comparison

| Feature | General AI | Deep Context Agent |
|---------|-----------|-------------------|
| Codebase knowledge | ❌ None | ✅ Deep understanding |
| Pattern recognition | ❌ Generic | ✅ Your patterns |
| Convention awareness | ❌ None | ✅ Your conventions |
| Decision memory | ❌ None | ✅ Past decisions |
| Project context | ❌ None | ✅ Full context |
| Consistency | ❌ Varies | ✅ Enforced |

---

**Get deeper, project-specific AI assistance!** 🧠

