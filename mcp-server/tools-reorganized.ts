/**
 * MCP Tools Reorganized into 5 Groups
 * 
 * Truth, Impact, Standards, Security, Workflow
 * ~20 tools total, grouped for sanity
 */

export const TRUTH_TOOLS = [
  {
    name: 'repo_map',
    description: 'Get complete repository map (structure, files, relationships)',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'symbols_exists',
    description: 'Check if symbol exists in codebase',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name to check' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'symbols_find',
    description: 'Find symbol definition location',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol name' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'symbols_fuzzy',
    description: 'Fuzzy search for symbols',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'versions_allowed',
    description: 'Check if dependency version is allowed',
    inputSchema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package name' },
        version: { type: 'string', description: 'Version to check' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
];

export const IMPACT_TOOLS = [
  {
    name: 'graph_related',
    description: 'Get blast radius - files affected by changes',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
];

export const STANDARDS_TOOLS = [
  {
    name: 'patterns_pick',
    description: 'Pick appropriate pattern from codebase',
    inputSchema: {
      type: 'object',
      properties: {
        patternType: { type: 'string', description: 'Type of pattern needed' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'architecture_check',
    description: 'Check code against architecture patterns',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to check' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'boundary_check',
    description: 'Check if code respects architectural boundaries',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
];

export const SECURITY_TOOLS = [
  {
    name: 'antipatterns_scan',
    description: 'Scan for code smells and security footguns',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File path' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'antipatterns_check',
    description: 'Check specific code against antipatterns',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to check' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'vulnerabilities_scan',
    description: 'Scan dependencies for vulnerabilities',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'vulnerability_check',
    description: 'Check specific package/version for vulnerabilities',
    inputSchema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package name' },
        version: { type: 'string', description: 'Version' },
      },
    },
  },
];

export const WORKFLOW_TOOLS = [
  {
    name: 'scope_declare',
    description: 'Declare intent/scope before writing code',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'What you intend to do' },
        scope: { type: 'string', description: 'Scope of changes' },
      },
    },
  },
  {
    name: 'scope_check',
    description: 'Check if code changes align with declared scope',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to check' },
        declaredScope: { type: 'string', description: 'Originally declared scope' },
      },
    },
  },
  {
    name: 'autopilot',
    description: 'Intent classification and autopilot suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'User intent' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'verify_fast',
    description: 'Fast pre-write verification',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to verify' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
  {
    name: 'verify_deep',
    description: 'Deep verification with runtime checks',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to verify' },
        projectPath: { type: 'string', description: 'Project path' },
      },
    },
  },
];

export const PROMPT_TOOLS = [
  {
    name: 'prompt_firewall_analyze',
    description: 'Run prompt through the Advanced Prompt Firewall for verification, task breakdown, and fix generation',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt text to analyze' },
        projectPath: { type: 'string', description: 'Project path' },
        options: {
          type: 'object',
          description: 'Firewall options (autoBreakdown, autoVerify, autoFix, includeVersionControl, generatePlan)',
        },
      },
    },
  },
  {
    name: 'prompt_injection_detect',
    description: 'Check text for prompt injection and jailbreak patterns',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to scan for injection patterns' },
      },
    },
  },
  {
    name: 'prompt_safety_check',
    description: 'Combined safety check: injection detection + PII scanning + unicode anomaly detection',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to check for all safety concerns' },
      },
    },
  },
];

/**
 * All tools grouped
 */
export const ALL_MCP_TOOLS = [
  ...TRUTH_TOOLS,
  ...IMPACT_TOOLS,
  ...STANDARDS_TOOLS,
  ...SECURITY_TOOLS,
  ...PROMPT_TOOLS,
  ...WORKFLOW_TOOLS,
];

/**
 * Tool response format (world-class rules)
 */
export interface ToolResponse {
  verdict: 'PASS' | 'FAIL' | 'WARN' | 'INDEX_REQUIRED';
  proof: any; // Evidence/proof data
  nextAction: string; // What to do next
  latency?: number; // Tool execution time in ms
  blockedHallucination?: boolean; // Did this prevent a hallucination?
  prevented?: {
    type: 'symbol' | 'route' | 'version' | 'boundary';
    value: string;
  };
}
