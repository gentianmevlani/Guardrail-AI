/**
 * MCP Client for Web Interface
 * Provides a web-friendly interface to guardrail MCP tools
 */

import { logger } from '@/lib/logger';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export class MCPWebClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api/mcp") {
    this.baseUrl = baseUrl;
  }

  /**
   * List all available MCP tools
   */
  async listTools(): Promise<MCPTool[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tools`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      logger.error('Failed to list MCP tools:', error);
      throw error;
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<MCPResult> {
    try {
      const response = await fetch(`${this.baseUrl}/${toolName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`Failed to call MCP tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * List available MCP resources
   */
  async listResources(): Promise<MCPResource[]> {
    try {
      const response = await fetch(`${this.baseUrl}/resources`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.resources || [];
    } catch (error) {
      logger.error('Failed to list MCP resources:', error);
      throw error;
    }
  }

  /**
   * Read an MCP resource
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    try {
      const response = await fetch(
        `${this.baseUrl}/resources/${encodeURIComponent(uri)}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`Failed to read MCP resource ${uri}:`, error);
      throw error;
    }
  }

  // Convenience methods for common tools

  /**
   * Validate project structure
   */
  async validateProject(projectPath: string = "."): Promise<MCPResult> {
    return this.callTool("validate_project", { projectPath });
  }

  /**
   * Run security scan
   */
  async securityScan(
    projectPath: string = ".",
    environment: string = "production",
  ): Promise<MCPResult> {
    return this.callTool("security_scan", { projectPath, environment });
  }

  /**
   * Check design system compliance
   */
  async checkDesignSystem(projectPath: string = "."): Promise<MCPResult> {
    return this.callTool("check_design_system", { projectPath });
  }

  /**
   * Get project health score
   */
  async getProjectHealth(projectPath: string = "."): Promise<MCPResult> {
    return this.callTool("get_project_health", { projectPath });
  }

  /**
   * Semantic code search
   */
  async semanticSearch(
    query: string,
    projectPath: string = ".",
  ): Promise<MCPResult> {
    return this.callTool("semantic_search", { query, projectPath });
  }

  /**
   * Analyze change impact
   */
  async analyzeChangeImpact(
    file: string,
    projectPath: string = ".",
  ): Promise<MCPResult> {
    return this.callTool("analyze_change_impact", { file, projectPath });
  }

  /**
   * Get deploy verdict
   */
  async getDeployVerdict(projectPath: string = "."): Promise<MCPResult> {
    return this.callTool("get_deploy_verdict", { projectPath });
  }
}

// Export singleton instance
export const mcpClient = new MCPWebClient();
