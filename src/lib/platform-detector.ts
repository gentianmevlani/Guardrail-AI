/**
 * Platform Detector
 * 
 * Detects which AI coding platform is being used
 * and applies appropriate guardrails
 */

export type Platform = 'vscode' | 'cursor' | 'windsurf' | 'claude' | 'copilot' | 'unknown';

export interface PlatformInfo {
  platform: Platform;
  name: string;
  version?: string;
  mcpEnabled: boolean;
}

class PlatformDetector {
  /**
   * Detect current platform
   */
  detect(): PlatformInfo {
    // Check environment variables
    const cursorRules = process.env.CURSOR_RULES || process.env.CURSORRULES;
    const windsurf = process.env.WINDSURF;
    const claudeDesktop = process.env.CLAUDE_DESKTOP;
    const vscode = process.env.VSCODE;

    if (cursorRules) {
      return {
        platform: 'cursor',
        name: 'Cursor',
        mcpEnabled: true,
      };
    }

    if (windsurf) {
      return {
        platform: 'windsurf',
        name: 'Windsurf',
        mcpEnabled: true,
      };
    }

    if (claudeDesktop) {
      return {
        platform: 'claude',
        name: 'Claude Desktop',
        mcpEnabled: true,
      };
    }

    if (vscode) {
      return {
        platform: 'vscode',
        name: 'VS Code',
        mcpEnabled: false, // Depends on extensions
      };
    }

    // Check for MCP server
    if (process.env.MCP_SERVER) {
      return {
        platform: 'unknown',
        name: 'MCP Client',
        mcpEnabled: true,
      };
    }

    return {
      platform: 'unknown',
      name: 'Unknown',
      mcpEnabled: false,
    };
  }

  /**
   * Get platform-specific guardrails
   */
  getPlatformGuardrails(platform: Platform): string[] {
    const guardrails: Record<Platform, string[]> = {
      vscode: [
        'Use .vscode/settings.json for configuration',
        'Support VS Code extensions',
      ],
      cursor: [
        'Use .cursorrules for Cursor-specific rules',
        'Leverage Cursor AI features',
      ],
      windsurf: [
        'Use Windsurf-specific configurations',
        'Support Windsurf AI features',
      ],
      claude: [
        'Use Claude Desktop MCP configuration',
        'Support Claude-specific features',
      ],
      copilot: [
        'Support GitHub Copilot',
        'Use Copilot-specific features',
      ],
      unknown: [
        'Universal guardrails',
        'Platform-agnostic rules',
      ],
    };

    return guardrails[platform] || guardrails.unknown;
  }
}

export const platformDetector = new PlatformDetector();

