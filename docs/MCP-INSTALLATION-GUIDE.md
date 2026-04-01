# guardrail AI - MCP Plugin Installation Guide

## 🎯 What is MCP?

Model Context Protocol (MCP) allows AI assistants to interact with external tools and services. guardrail AI's MCP plugin brings professional development guardrails directly to your AI assistant!

## ✅ Supported Editors

- ✅ **Cursor** - Full support with enhanced logging
- ✅ **Claude Desktop** - Full support with professional configuration
- ✅ **VS Code** (with MCP extension) - Full support
- ✅ **Windsurf** - Full support
- ✅ **Any MCP-compatible editor**

## 🚀 Quick Installation

### For Cursor

1. **Install the package:**
   ```bash
   npm install -g @guardrail/mcp-server
   ```

2. **Configure Cursor:**
   
   Create or edit `.cursor/mcp.json` in your project root:
   ```json
   {
     "mcpServers": {
       "guardrail": {
         "command": "npx",
         "args": [
           "-y",
           "@guardrail/mcp-server"
         ],
         "env": {
           "Guardrail_DEBUG": "false"
         }
       }
     }
   }
   ```

3. **Restart Cursor**

4. **Done!** The AI assistant now has access to professional guardrails tools.

### For Claude Desktop

1. **Install the package:**
   ```bash
   npm install -g @guardrail/mcp-server
   ```

2. **Configure Claude Desktop:**
   
   Edit `claude_desktop_config.json` (location varies by OS):
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`
   
   ```json
   {
     "mcpServers": {
       "guardrail": {
         "command": "npx",
         "args": [
           "-y",
           "@guardrail/mcp-server"
         ],
         "env": {
           "Guardrail_DEBUG": "false"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Success!** Professional guardrails are now available in your conversations.

### For VS Code

1. **Install MCP Extension:**
   - Install "MCP Client" extension from VS Code marketplace

2. **Install the package:**
   ```bash
   npm install -g @guardrail/mcp-server
   ```

3. **Configure VS Code:**
   
   Edit `.vscode/settings.json`:
   ```json
   {
     "mcp.servers": {
       "guardrail": {
         "command": "npx",
         "args": ["-y", "@guardrail/mcp-server"]
       }
     }
   }
   ```

4. **Restart VS Code**

### For Windsurf

1. **Install the package:**
   ```bash
   npm install -g @guardrail/mcp-server
   ```

2. **Configure Windsurf:**
   
   Edit Windsurf config (similar to Claude Desktop):
   ```json
   {
     "mcpServers": {
       "guardrail": {
         "command": "npx",
         "args": ["-y", "@guardrail/mcp-server"]
       }
     }
   }
   ```

## 🛠️ Available MCP Tools

Once installed, your AI assistant can use these professional tools:

### 🏗️ Project Analysis & Validation

#### 1. `validate_project`
🔍 Comprehensive project validation - checks structure, API endpoints, and identifies mock data usage

**Usage:**
```
AI: "Validate this project"
→ Calls validate_project tool
→ Returns detailed validation results
```

#### 2. `check_project_drift`
📊 Detect architectural drift - analyzes if project structure has deviated from intended patterns

**Usage:**
```
AI: "Check for project drift"
→ Calls check_project_drift tool
→ Returns drift analysis with recommendations
```

#### 3. `get_project_health`
💯 Generate project health score with actionable recommendations (Professional feature)

**Usage:**
```
AI: "What's the health score of this project?"
→ Calls get_project_health tool
→ Returns comprehensive health metrics
```

### 🎨 Design System Management

#### 4. `check_design_system`
🎨 Validate components against locked design system - ensures visual consistency

**Usage:**
```
AI: "Check if components follow the design system"
→ Calls check_design_system tool
→ Returns consistency report
```

#### 5. `setup_design_system`
🔧 Initialize and lock a professional design system for your project

**Usage:**
```
AI: "Set up a modern design system"
→ Calls setup_design_system tool with theme="modern"
→ Returns setup confirmation
```

### 🔌 API Management

#### 6. `register_api_endpoint`
📝 Register new API endpoints to prevent mock data usage and maintain API integrity

**Usage:**
```
AI: "Register endpoint POST /api/users for user creation"
→ Calls register_api_endpoint tool
→ Returns registration confirmation
```

#### 7. `get_guardrails_rules`
📋 Retrieve current guardrails rules and project constraints

**Usage:**
```
AI: "Show me the current guardrails rules"
→ Calls get_guardrails_rules tool
→ Returns project rules documentation
```

### 🧠 Intelligence & Knowledge

#### 8. `architect_analyze`
🏗️ Intelligent project analysis - understands context and recommends optimal implementation order

**Usage:**
```
AI: "Analyze this project and recommend what to implement first"
→ Calls architect_analyze tool
→ Returns analysis with prioritized recommendations
```

#### 9. `architect_apply`
⚡ Automatically apply recommended templates with dependency resolution

**Usage:**
```
AI: "Apply the recommended templates automatically"
→ Calls architect_apply tool
→ Returns application results
```

#### 10. `build_knowledge_base`
🧠 Build deep codebase knowledge - analyzes architecture, patterns, and relationships

**Usage:**
```
AI: "Build a knowledge base for this codebase"
→ Calls build_knowledge_base tool
→ Returns knowledge base summary
```

#### 11. `get_deep_context`
💬 Get project-specific answers using knowledge base with customizable response styles

**Usage:**
```
AI: "How is authentication implemented in this project? Use a technical tone."
→ Calls get_deep_context with style="technical"
→ Returns contextual, styled response
```

### 🔍 Code Analysis & Search

#### 12. `semantic_search`
🔍 Semantic code search - find code by meaning, not just text matching

**Usage:**
```
AI: "Find the authentication middleware code"
→ Calls semantic_search tool
→ Returns relevant code locations
```

#### 13. `analyze_change_impact`
💥 Analyze impact of changes - identifies dependencies and potential breaking changes

**Usage:**
```
AI: "What will break if I modify the user model?"
→ Calls analyze_change_impact tool
→ Returns impact analysis
```

#### 14. `generate_code_context`
⚙️ Generate code prompts that follow your project's patterns and conventions

**Usage:**
```
AI: "Generate a prompt for creating a new API endpoint following project patterns"
→ Calls generate_code_context tool
→ Returns context-aware prompt
```

## 🔧 Advanced Configuration

### Debug Mode

Enable detailed logging by setting `Guardrail_DEBUG` to `true`:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["-y", "@guardrail/mcp-server"],
      "env": {
        "Guardrail_DEBUG": "true"
      }
    }
  }
}
```

### Custom Project Path

All tools accept an optional `projectPath` parameter:

```javascript
{
  "projectPath": "/path/to/your/project"
}
```

## 🎯 Best Practices

1. **Always validate** your project after major changes
2. **Build knowledge base** before using contextual queries
3. **Register APIs** as you create them to avoid mock data
4. **Check design system** compliance regularly
5. **Use semantic search** to find code faster
6. **Analyze impact** before making breaking changes

## 🆘 Troubleshooting

### Common Issues

1. **"Tool not found" error**
   - Ensure the MCP server is properly configured
   - Restart your editor after configuration changes

2. **"Permission denied" error**
   - Check if npm global installation requires sudo
   - Try using `npx -y @guardrail/mcp-server` directly

3. **"Debug logging not showing"**
   - Ensure `Guardrail_DEBUG` is set to `"true"` (string, not boolean)
   - Check editor's developer console for logs

### Getting Help

- 📖 [Documentation](../../README.md)
- 🐛 [Report Issues](https://github.com/guardiavault-oss/guardrail/issues)
- 💬 [Discussions](https://github.com/guardiavault-oss/guardrail/discussions)

---

## 🎉 You're All Set!

With guardrail AI's MCP plugin installed, your AI assistant now has professional-grade development guardrails. Enjoy smarter, safer, and more efficient development!

*Context Enhanced by guardrail AI*
