# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install
```bash
npm install -g ai-agent-guardrails
# Or use npx (no installation)
npx ai-agent-guardrails install
```

### Step 2: Initialize
```bash
cd your-project
npm run setup
```

### Step 3: Build Knowledge Base
```bash
npm run build-knowledge
```

### Step 4: Let Architect Agent Set Everything Up
```bash
npm run architect
# Answer "yes" to apply templates
```

### Step 5: Start Building!
You're ready! The agent will guide you from here.

## 🎯 What You Get

✅ **Universal Guardrails** - Works in VS Code, Cursor, Windsurf, Claude  
✅ **Architect Agent** - Intelligent template orchestration  
✅ **Deep Context Agent** - Project-specific AI understanding  
✅ **Full Stack Templates** - All backend essentials  
✅ **Auto-Growth System** - Adds features as you grow  
✅ **Polish Service** - Finds missing details  
✅ **Infrastructure Essentials** - Production-ready from day one  

## 💡 Common Workflows

### New Project
```bash
# 1. Create project
mkdir my-project && cd my-project
npm init -y

# 2. Install guardrails
npx ai-agent-guardrails install

# 3. Build knowledge
npm run build-knowledge

# 4. Let architect set everything up
npm run architect

# 5. Start coding!
```

### Existing Project
```bash
# 1. Install guardrails
npx ai-agent-guardrails install

# 2. Build knowledge
npm run build-knowledge

# 3. Check what's missing
npm run polish

# 4. Apply what you need
npm run architect
```

### Daily Use
```bash
# Before making changes
npm run analyze-impact src/components/Button.tsx

# Find code
npm run semantic-search "authentication"

# Generate code
npm run generate-code "Create user profile component"

# Check polish
npm run polish
```

## 🔧 IDE Setup

### Cursor / VS Code / Windsurf
The MCP server is automatically available. Just use the tools:
- `architect_analyze` - Analyze project
- `get_deep_context` - Get context
- `semantic_search` - Find code
- `analyze_change_impact` - Check impact

### Claude Desktop
Add to MCP config:
```json
{
  "mcpServers": {
    "ai-agent-guardrails": {
      "command": "npx",
      "args": ["ai-agent-guardrails", "mcp"]
    }
  }
}
```

## 📚 Next Steps

1. **Read the guides:**
   - [ARCHITECT-AGENT-GUIDE.md](./ARCHITECT-AGENT-GUIDE.md)
   - [DEEP-CONTEXT-AGENT-GUIDE.md](./DEEP-CONTEXT-AGENT-GUIDE.md)
   - [INFRASTRUCTURE-ESSENTIALS.md](./INFRASTRUCTURE-ESSENTIALS.md)

2. **Explore features:**
   - Run `npm run architect` to see what it recommends
   - Run `npm run polish` to find missing details
   - Run `npm run build-knowledge` to build understanding

3. **Integrate with your workflow:**
   - Add to pre-commit hooks
   - Use in CI/CD
   - Share with team

---

**You're all set! Start building with confidence!** 🚀

