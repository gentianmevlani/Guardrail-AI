# MCP Plugin Installation Guide

This guide helps you install and configure the guardrail MCP plugin for your favorite IDE.

## Quick Install

1. **Generate an API Key** from the [Integrations page](/integrations)
2. **Click Install** on your IDE below
3. **Configure** the plugin with your API key

## IDE-Specific Instructions

### VS Code

1. Click the "Install Plugin" button or visit the [Marketplace](vscode:extension/guardrail.mcp-security)
2. Install the "guardrail MCP Security" extension
3. Open Command Palette (Ctrl+Shift+P)
4. Type "MCP: Configure Servers"
5. Add your API key to the configuration:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["-y", "@guardrail/mcp-server"],
      "env": {
        "Guardrail_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor

1. Click the "Install Plugin" button or use: `cursor://install-extension/guardrail`
2. Go to Settings → MCP Servers
3. Add guardrail with your API key:

```json
{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["-y", "@guardrail/mcp-server"],
      "env": {
        "Guardrail_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Windsurf

1. Click the "Install Plugin" button or use: `windsurf://install-mcp/guardrail`
2. Go to Settings → Extensions
3. Configure MCP server with your API key

## Configuration File Locations

- **VS Code**: `~/.vscode/mcp-servers.json`
- **Cursor**: `~/.cursor/mcp.json`
- **Windsurf**: `~/.windsurf/mcp_config.json`

## Testing the Installation

1. Open your IDE with the plugin installed
2. Open a code file
3. Ask the AI: "Scan this file for security issues"
4. The plugin should analyze and report findings

## Troubleshooting

### Plugin Not Working

1. Verify your API key is valid
2. Check the configuration file syntax
3. Restart your IDE
4. Check the IDE's developer console for errors

### API Key Issues

1. Generate a new API key from the Integrations page
2. Ensure you're on a Pro or Enterprise plan
3. Check that the key has no extra spaces

### Connection Issues

1. Ensure you have an internet connection
2. Check if the API server is running (for self-hosted)
3. Verify your firewall settings

## CLI Integration

The MCP plugin works seamlessly with the guardrail CLI:

```bash
# Install CLI
npm install -g guardrail-cli-tool

# Authenticate
guardrail auth login YOUR_API_KEY

# Scan your project
guardrail scan

# Run AI guardrails
guardrail guard
```

## Support

- Documentation: [guardrailai.dev/docs](https://guardrailai.dev/docs)
- Issues: [GitHub Issues](https://github.com/guardrail/issues)
- Discord: [discord.gg/guardrail](https://discord.gg/guardrail)

## Security Notice

- Never share your API key publicly
- Store it securely in your configuration
- Rotate keys regularly for security
- Use environment variables in CI/CD

## Next Steps

1. ✅ Install the MCP plugin
2. ✅ Configure with your API key
3. ✅ Test with a sample file
4. 📚 Explore [CLI commands](./CLI-COMMANDS.md)
5. 🔧 Set up [CI/CD integration](./CI-CD-INTEGRATION.md)
