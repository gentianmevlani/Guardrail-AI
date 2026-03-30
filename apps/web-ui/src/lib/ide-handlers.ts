/**
 * IDE-specific handlers for MCP installation
 */

import { logger } from "./logger";
import { createSafeModal } from "./security/safe-dom";

export interface IDEInfo {
  id: string;
  name: string;
  protocol: string;
  extensionId: string;
  configPath: string;
  instructions: {
    vscode: string[];
    cursor: string[];
    windsurf: string[];
  };
}

export const IDE_HANDLERS: Record<string, IDEInfo> = {
  vscode: {
    id: "vscode",
    name: "VS Code",
    protocol: "vscode",
    extensionId: "guardrail.mcp-security",
    configPath: "~/.vscode/mcp-servers.json",
    instructions: {
      vscode: [
        "1. Open VS Code",
        "2. Press Ctrl+Shift+X to open Extensions",
        '3. Search for "guardrail MCP Security"',
        "4. Click Install on the extension",
        "5. Open Command Palette (Ctrl+Shift+P)",
        '6. Type "MCP: Configure Servers"',
        "7. Add your API key to the configuration",
      ],
      cursor: [
        "1. Open Cursor",
        "2. Click the Extensions icon in the sidebar",
        '3. Search for "guardrail MCP"',
        "4. Click Install",
        "5. Go to Settings → MCP Servers",
        "6. Configure with your API key",
      ],
      windsurf: [
        "1. Open Windsurf",
        "2. Go to Settings → Extensions",
        '3. Search for "guardrail MCP"',
        "4. Click Install",
        "5. Configure MCP server with your API key",
      ],
    },
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    protocol: "cursor",
    extensionId: "guardrail",
    configPath: "~/.cursor/mcp.json",
    instructions: {
      vscode: [],
      cursor: [
        "1. Open Cursor",
        "2. Click the Extensions icon in the sidebar",
        '3. Search for "guardrail MCP"',
        "4. Click Install",
        "5. Go to Settings → MCP Servers",
        "6. Add your API key to the configuration",
      ],
      windsurf: [],
    },
  },
  windsurf: {
    id: "windsurf",
    name: "Windsurf",
    protocol: "windsurf",
    extensionId: "guardrail",
    configPath: "~/.windsurf/mcp_config.json",
    instructions: {
      vscode: [],
      cursor: [],
      windsurf: [
        "1. Open Windsurf",
        "2. Go to Settings → Extensions",
        '3. Search for "guardrail MCP"',
        "4. Click Install",
        "5. Configure MCP server with your API key",
      ],
    },
  },
};

export function installMCPExtension(ideId: string, apiKey?: string): boolean {
  const ide = IDE_HANDLERS[ideId];
  if (!ide) {
    logger.error(`Unknown IDE: ${ideId}`);
    return false;
  }

  try {
    // Try to open the IDE's protocol handler
    const protocolUrl = `${ide.protocol}://install-extension/${ide.extensionId}`;

    // Create a temporary link to trigger the protocol
    const link = document.createElement("a");
    link.href = protocolUrl;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show fallback instructions after a delay
    setTimeout(() => {
      showFallbackInstructions(ideId, apiKey);
    }, 2000);

    return true;
  } catch (error) {
    logger.error(`Failed to install ${ide.name} extension:`, error);
    showFallbackInstructions(ideId, apiKey);
    return false;
  }
}

function showFallbackInstructions(ideId: string, apiKey?: string) {
  const ide = IDE_HANDLERS[ideId];
  if (!ide) return;

  const instructions =
    ide.instructions[ideId as keyof typeof ide.instructions] || [];

  let message = `If ${ide.name} didn't open automatically, please follow these steps:\n\n`;
  message += instructions.join("\n");

  if (apiKey && ideId === "vscode") {
    message += `\n\nYour API Key: ${apiKey}`;
    message += `\n\nConfiguration file location: ${ide.configPath}`;
  }

  // Create a modal using safe DOM manipulation to prevent XSS
  const modal = createSafeModal({
    title: "Installation Instructions",
    content: message,
    buttonText: "Got it",
  });
  document.body.appendChild(modal);
}

export function detectInstalledIDEs(): string[] {
  const detected: string[] = [];

  // Check for VS Code
  if (
    navigator.userAgent.includes("VSCode") ||
    window.location.protocol === "vscode:"
  ) {
    detected.push("vscode");
  }

  // Check for Cursor (custom protocol detection)
  setTimeout(() => {
    const link = document.createElement("a");
    link.href = "cursor://";
    link.onclick = () => {
      detected.push("cursor");
      return false;
    };
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, 100);

  // Check for Windsurf (custom protocol detection)
  setTimeout(() => {
    const link = document.createElement("a");
    link.href = "windsurf://";
    link.onclick = () => {
      detected.push("windsurf");
      return false;
    };
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, 200);

  return detected;
}

export function generateMCPConfig(apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        guardrail: {
          command: "npx",
          args: ["-y", "@guardrail/mcp-server"],
          env: {
            Guardrail_API_KEY: apiKey,
          },
        },
      },
    },
    null,
    2,
  );
}
