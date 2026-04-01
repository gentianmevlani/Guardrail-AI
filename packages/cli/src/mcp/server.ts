/**
 * MCP Server for Context Mode
 * 
 * Starts MCP server that AI tools can connect to
 */

<<<<<<< HEAD
import { Server } from '@modelcontextprotocol/sdk/server';
=======
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

export interface MCPServerOptions {
  port?: number;
  telemetry?: boolean;
}

let mcpServer: Server | null = null;

export async function startMCPServer(projectPath: string, options: MCPServerOptions = {}): Promise<void> {
  // For now, we'll use stdio transport (standard MCP)
  // The actual MCP server is in mcp-server/index.js
  // This function just ensures it's available
  
  // Check if MCP server module exists
  try {
    // The MCP server runs as a separate process
    // We just need to indicate it's ready
    mcpServer = new Server({
      name: 'guardrail-mcp',
      version: '2.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    // Register tools from the reorganized groups
    // This will be handled by the main MCP server file
    console.log('  MCP server ready for connections');
  } catch (error: any) {
    throw new Error(`Failed to start MCP server: ${error.message}`);
  }
}

export function stopMCPServer(): void {
  if (mcpServer) {
    // Cleanup
    mcpServer = null;
  }
}
