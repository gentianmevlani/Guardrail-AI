# guardrail: The Beginner's Guide

> **Stop shipping broken code. Start shipping with confidence.**

This guide explains everything in plain English so you can get guardrail working in your project in minutes.

---

## What is guardrail?

**guardrail is like a safety net for your code.** 

When you're coding with AI assistants (Cursor, Windsurf, Copilot, Claude), they sometimes:
- Leave TODOs and FIXMEs that never get done
- Add `console.log` statements you forget to remove
- Use placeholder/mock data that shouldn't go to production
- Create code that looks good but doesn't actually work

**guardrail catches all of this before you ship.**

---

## How Does It Work?

guardrail runs as an **MCP Server** (Model Context Protocol). Think of it as a background helper that your AI coding assistant can talk to.

```
Your AI Assistant (Cursor/Windsurf) 
        ↓
    MCP Protocol
        ↓
   guardrail Server (checks your code)
        ↓
   "GO" or "NO-GO" decision
```

---

## Quick Setup (5 Minutes)

### Step 1: Install Dependencies

Open your terminal in the project folder and run:

```bash
cd mcp-server
npm install
```

### Step 2: Configure Your AI Editor

Pick your editor below and follow the instructions:

---

### For Cursor Users

1. Open Cursor Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "MCP" 
3. Click "Edit in settings.json"
4. Add this configuration:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["C:/path/to/your/project/mcp-server/index.js"],
      "cwd": "C:/path/to/your/project"
    }
  }
}
```

**Replace `C:/path/to/your/project` with your actual project path!**

---

### For Windsurf Users

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Type "Windsurf: Open MCP Config"
3. Add this to your config:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node", 
      "args": ["./mcp-server/index.js"]
    }
  }
}
```

---

### For Claude Desktop Users

1. Find your Claude config file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add this:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["/full/path/to/mcp-server/index.js"]
    }
  }
}
```

---

## The Tools (In Plain English)

### 1. Ship Check - "Is my app ready?"

**What it does:** Runs a quick health check on your entire project.

**When to use it:** Before deploying, pushing to main, or sharing your code.

**What you get:**
- ✅ **GO** = Safe to ship!
- ⚠️ **WARN** = Has some issues, might be okay
- 🚫 **NO-GO** = Don't ship this, fix the problems first

**How to use it:** Just ask your AI:
> "Run guardrail ship check on my project"

---

### 2. Checkpoint - "Block bad code before it's written"

**What it does:** Checks code BEFORE your AI writes it. If there are problems, it blocks the write until you fix them.

**What it catches:**
| Level | What it blocks |
|-------|---------------|
| **Chill** | TODOs, FIXMEs, mock data, placeholders |
| **Standard** | + console.log, debugger, localhost URLs |
| **Strict** | + `any` types, @ts-ignore, eslint-disable |
| **Paranoid** | + nested ternaries, inline styles |

**How to use it:** Ask your AI:
> "Set guardrail checkpoint to standard mode"

Then every time your AI tries to write code with issues, it'll get blocked and told to fix them first.

---

### 3. Architect - "Get guidance before coding"

**What it does:** Your AI asks the Architect for advice BEFORE writing code. This ensures new code matches your project's style.

**Example:** Before creating a new React component, your AI can ask:
> "Use guardrail architect suggest for a user profile component"

And it'll get:
- The exact pattern to follow
- Naming conventions to use
- Example files to reference
- Rules to follow

---

### 4. Intent Drift Guard - "Stay on task"

**What it does:** Prevents your AI from going off-track. You tell it what you want to build, and it monitors if the code actually matches that.

**The Problem:** You ask your AI to "add a login form" but it also adds a registration form, password reset, and refactors your database.

**The Solution:** Intent Drift Guard catches scope creep and says "Hey, you're drifting from the original task!"

**How to use it:**

1. **Start with your intent:**
   > "Use guardrail intent start with prompt 'Add email login with validation'"

2. **After making changes, check for drift:**
   > "Use guardrail intent check"

3. **When done:**
   > "Use guardrail intent complete"

---

### 5. Reality Mode - "Test in a real browser"

**What it does:** Actually opens a browser and clicks buttons, fills forms, and finds broken UI.

**Why it matters:** Code can look correct but fail when users actually click things.

**How to use it:**
> "Run guardrail reality mode on http://localhost:3000"

---

### 6. MockProof - "Find fake data"

**What it does:** Scans your code for:
- Mock/fake/dummy data
- Placeholder text (Lorem ipsum)
- Hardcoded test credentials
- Demo API responses

**How to use it:**
> "Run guardrail proof mocks"

---

## Common Scenarios

### Scenario 1: "I just want to check if my code is ready to deploy"

Ask your AI:
> "Run guardrail ship check"

You'll get a score (0-100) and a clear GO/WARN/NO-GO verdict.

---

### Scenario 2: "I want stricter code quality"

Ask your AI:
> "Set guardrail checkpoint strictness to strict"

Now your AI will be blocked from writing code with:
- `any` types in TypeScript
- `@ts-ignore` comments
- `eslint-disable` directives

---

### Scenario 3: "My AI keeps going off-task"

Use Intent Lock:
> "Use guardrail intent start with prompt 'Fix the login bug' and lock it"

Now if anyone asks the AI to do something unrelated, it'll refuse until the current task is done.

---

### Scenario 4: "I want to understand my codebase before making changes"

Ask your AI:
> "Use guardrail architect context"

You'll get a summary of:
- Your tech stack
- Coding conventions
- File patterns
- Project structure

---

## Cheat Sheet

| I want to... | Ask your AI... |
|--------------|---------------|
| Check if ready to ship | "Run guardrail ship check" |
| Set strictness level | "Set guardrail checkpoint to strict" |
| Get coding guidance | "Use guardrail architect suggest for [what you're building]" |
| Start a focused task | "Use guardrail intent start with prompt '[your task]'" |
| Check for scope creep | "Use guardrail intent check" |
| Find mock/fake data | "Run guardrail proof mocks" |
| Test in real browser | "Run guardrail reality on [url]" |
| See project health | "Use guardrail status" |
| Get codebase context | "Use guardrail architect context" |

---

## Troubleshooting

### "The MCP server isn't connecting"

1. Make sure you ran `npm install` in the `mcp-server` folder
2. Check that the path in your config is correct (use full absolute paths)
3. Restart your AI editor after changing the config

### "I'm getting blocked on every write"

Your strictness level might be too high. Try:
> "Set guardrail checkpoint to chill"

### "Intent drift keeps triggering"

The intent might be too narrow. Use broader descriptions:
- Bad: "Add a button"
- Good: "Add user authentication with login form and validation"

---

## What's Next?

Once you're comfortable with the basics:

1. **Set up CI/CD integration** - Block deploys automatically
2. **Generate context files** - Help your AI understand your codebase
3. **Customize rules** - Create project-specific checks

See the full docs in the `/docs` folder for advanced features.

---

## Need Help?

- Check the `/docs` folder for detailed documentation
- Look at `/examples` for sample configurations
- Open an issue on GitHub if you're stuck

---

**Happy shipping!** 🚀
