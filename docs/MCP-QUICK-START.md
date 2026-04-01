# MCP Plugin - Quick Start

## 🚀 30-Second Setup

### Step 1: Install
```bash
npm install -g ai-agent-guardrails
```

### Step 2: Configure Cursor

Create `.cursor/mcp.json` in your project:
```json
{
  "mcpServers": {
    "ai-agent-guardrails": {
      "command": "npx",
      "args": ["-y", "ai-agent-guardrails", "mcp"]
    }
  }
}
```

### Step 3: Restart Cursor

**Done!** Your AI assistant now has guardrails tools.

## 💡 What You Can Do Now

### Ask AI to Validate
```
You: "Validate this project"
AI: [Uses validate_project tool]
→ Shows validation results
```

### Ask AI to Check Design
```
You: "Check if components match the design system"
AI: [Uses check_design_system tool]
→ Shows consistency report
```

### Ask AI to Register Endpoints
```
You: "Create /api/users endpoint"
AI: [Creates endpoint]
AI: [Calls register_api_endpoint tool]
→ Endpoint registered, no mock data!
```

## 🎯 That's It!

Your AI assistant now:
- ✅ Validates as it works
- ✅ Uses locked design systems
- ✅ Registers API endpoints
- ✅ Checks for drift
- ✅ Ensures consistency

**No manual steps needed!** 🎉

