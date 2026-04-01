# Example MCP Configurations

Copy-paste these configs for your AI editor.

---

## Cursor

**File:** `~/.cursor/mcp.json` (or in Cursor Settings → MCP)

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["C:/Users/YOUR_USERNAME/path/to/project/mcp-server/index.js"],
      "cwd": "C:/Users/YOUR_USERNAME/path/to/project"
    }
  }
}
```

---

## Windsurf

**File:** Open via Command Palette → "Windsurf: Open MCP Config"

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

## Claude Desktop (Windows)

**File:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["C:/Users/YOUR_USERNAME/path/to/project/mcp-server/index.js"]
    }
  }
}
```

---

## Claude Desktop (Mac)

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/path/to/project/mcp-server/index.js"]
    }
  }
}
```

---

## VS Code with Continue Extension

**File:** `~/.continue/config.json`

```json
{
  "mcpServers": [
    {
      "name": "guardrail",
      "command": "node",
      "args": ["./mcp-server/index.js"]
    }
  ]
}
```

---

## Tips

1. **Use absolute paths** - Relative paths can fail depending on where your editor starts
2. **Restart your editor** after changing the config
3. **Check the terminal** - If the server fails, you'll see errors there
4. **Test manually first** - Run `node mcp-server/index.js` to verify it works

---

## Verifying It Works

After setting up, ask your AI:

> "What guardrail tools are available?"

If connected properly, it should list tools like:
- `guardrail.ship`
- `guardrail.scan`
- `guardrail_checkpoint`
- `guardrail_architect_review`
- etc.

---

## Multiple Projects

If you work on multiple projects, you can set up project-specific servers:

```json
{
  "mcpServers": {
    "guardrail-project-a": {
      "command": "node",
      "args": ["C:/projects/project-a/mcp-server/index.js"],
      "cwd": "C:/projects/project-a"
    },
    "guardrail-project-b": {
      "command": "node", 
      "args": ["C:/projects/project-b/mcp-server/index.js"],
      "cwd": "C:/projects/project-b"
    }
  }
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Server not found" | Check the path is correct and absolute |
| "Cannot find module" | Run `npm install` in the mcp-server folder |
| "Permission denied" | On Mac/Linux, you may need `chmod +x` on the script |
| Tools not showing | Restart your editor completely |
| "Already running" | Kill any existing node processes and restart |
