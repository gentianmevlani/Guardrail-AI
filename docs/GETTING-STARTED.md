# Getting Started - Complete Guide

## 🎯 Choose Your Path

### Path 1: Complete Setup (Recommended)
**One command, everything set up:**
```bash
npm run complete-setup
```

### Path 2: Step by Step
**More control, understand each step:**
```bash
# 1. Basic setup
npm run setup

# 2. Build knowledge
npm run build-knowledge

# 3. Let architect set things up
npm run architect

# 4. Check polish
npm run polish
```

### Path 3: Just Templates
**Only need templates:**
```bash
npm run architect
# Select what you need
```

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git (optional, for decision tracking)

## 🚀 Installation

### Global Installation
```bash
npm install -g ai-agent-guardrails
```

### Local Installation
```bash
npm install --save-dev ai-agent-guardrails
```

### No Installation (npx)
```bash
npx ai-agent-guardrails install
```

## 🎯 First Steps

### 1. Navigate to Your Project
```bash
cd your-project
```

### 2. Run Complete Setup
```bash
npm run complete-setup
```

### 3. Follow the Prompts
The setup will guide you through:
- Building knowledge base
- Syncing decisions
- Applying templates
- Checking polish

### 4. Start Building!
You're ready! The system will guide you from here.

## 💡 What Happens During Setup

1. **Basic Setup** - Installs guardrails and configures project
2. **Knowledge Base** - Analyzes your codebase structure
3. **Decision Sync** - Extracts decisions from git/comments
4. **Architect Agent** - Analyzes and applies needed templates
5. **Polish Check** - Finds missing details

## 🔧 After Setup

### Daily Commands
```bash
# Get context for questions
npm run deep-context "How do I add authentication?"

# Find code semantically
npm run semantic-search "user validation"

# Check impact before changes
npm run analyze-impact src/components/Button.tsx

# Generate code with context
npm run generate-code "Create user profile component"

# Check polish
npm run polish
```

### IDE Integration
The MCP server is automatically available in:
- Cursor
- VS Code (with MCP extension)
- Windsurf
- Claude Desktop

Just use the tools in your AI assistant!

## 📚 Learn More

- **[QUICK-START.md](./QUICK-START.md)** - 5-minute quick start
- **[ARCHITECT-AGENT-GUIDE.md](./ARCHITECT-AGENT-GUIDE.md)** - Intelligent setup
- **[DEEP-CONTEXT-AGENT-GUIDE.md](./DEEP-CONTEXT-AGENT-GUIDE.md)** - Deep understanding
- **[INTEGRATION-EXAMPLES.md](./INTEGRATION-EXAMPLES.md)** - Real-world integration

## 🆘 Need Help?

1. **Check documentation** - Most questions answered in guides
2. **Run help commands** - `npm run` to see all commands
3. **Check knowledge base** - `npm run build-knowledge` if issues

---

**You're all set! Start building with confidence!** 🚀

