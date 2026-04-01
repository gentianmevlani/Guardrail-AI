/**
 * Architect Agent MCP Tools
 *
 * Tools that let AI agents consult the Architect before writing code:
 *
 * 1. guardrail_architect_review - Review code against architecture patterns
 * 2. guardrail_architect_suggest - Get suggestions before writing code
 * 3. guardrail_architect_learn - Learn patterns from existing code
 * 4. guardrail_architect_patterns - List active patterns
 */

import fs from "fs";
import path from "path";

// Pattern types and their validation rules
const ARCHITECTURE_PATTERNS = {
  // React patterns
  react_import_order: {
    name: "React Import Order",
    description: "React imports first, then external, then internal",
    check: (code) => {
      const imports = code.match(/^import .+ from ['"][^'"]+['"];?$/gm) || [];
      if (imports.length < 2) return { pass: true };

      const reactIndex = imports.findIndex(
        (i) => i.includes("'react'") || i.includes('"react"'),
      );
      if (reactIndex > 0) {
        return {
          pass: false,
          message: "React imports should be at the top",
          fix: "Move React imports to the beginning of the import block",
        };
      }
      return { pass: true };
    },
  },

  component_pascal_case: {
    name: "PascalCase Components",
    description: "React components must use PascalCase naming",
    check: (code, filePath) => {
      if (!filePath.match(/\.(jsx|tsx)$/)) return { pass: true };

      const match = code.match(
        /(?:function|const)\s+([a-z][a-zA-Z]*)\s*(?:=\s*\(|:\s*(?:React\.)?FC|\()/,
      );
      if (match && /^[a-z]/.test(match[1])) {
        if (code.includes("return") && code.includes("<")) {
          return {
            pass: false,
            message: `Component "${match[1]}" should use PascalCase`,
            fix: `Rename to "${match[1].charAt(0).toUpperCase() + match[1].slice(1)}"`,
          };
        }
      }
      return { pass: true };
    },
  },

  hook_use_prefix: {
    name: "Hook Naming",
    description: 'Custom hooks must start with "use"',
    check: (code, filePath) => {
      if (!filePath.includes("hook") && !filePath.includes("use"))
        return { pass: true };

      const funcMatch = code.match(
        /(?:function|const)\s+([a-zA-Z]+)\s*(?:=\s*\(|\()/,
      );
      if (funcMatch && !funcMatch[1].startsWith("use")) {
        if (code.includes("useState") || code.includes("useEffect")) {
          return {
            pass: false,
            message: `Custom hook "${funcMatch[1]}" must start with "use"`,
            fix: `Rename to "use${funcMatch[1].charAt(0).toUpperCase() + funcMatch[1].slice(1)}"`,
          };
        }
      }
      return { pass: true };
    },
  },

  // TypeScript patterns
  no_any_type: {
    name: "No Any Type",
    description: 'Avoid using "any" type',
    check: (code) => {
      if (code.match(/:\s*any\b/) && !code.includes("@ts-")) {
        return {
          pass: false,
          message: 'Avoid using "any" type - use specific types',
          fix: 'Replace "any" with a specific type or "unknown" for truly unknown types',
        };
      }
      return { pass: true };
    },
  },

  explicit_return_types: {
    name: "Explicit Return Types",
    description: "Functions should have explicit return types",
    check: (code) => {
      const asyncFuncs =
        code.match(/(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/g) || [];
      for (const func of asyncFuncs) {
        if (!func.includes(":") && !func.includes("constructor")) {
          return {
            pass: false,
            message: "Function missing return type annotation",
            fix: "Add return type: function name(): ReturnType { ... }",
          };
        }
      }
      return { pass: true };
    },
  },

  // API patterns
  api_error_handling: {
    name: "API Error Handling",
    description: "API routes must have try/catch",
    check: (code, filePath) => {
      if (!filePath.includes("api") && !filePath.includes("route"))
        return { pass: true };

      if (
        code.includes("async") &&
        (code.includes("req") || code.includes("request"))
      ) {
        if (!code.includes("try") || !code.includes("catch")) {
          return {
            pass: false,
            message: "API handler missing error handling",
            fix: "Wrap handler logic in try/catch block",
          };
        }
      }
      return { pass: true };
    },
  },

  // General patterns
  no_console_in_production: {
    name: "No Console Logs",
    description: "Remove console.log from production code",
    check: (code, filePath) => {
      if (filePath.includes("test") || filePath.includes("spec"))
        return { pass: true };

      if (code.includes("console.log")) {
        return {
          pass: false,
          message: "console.log found in production code",
          fix: "Remove console.log or use a proper logging service",
        };
      }
      return { pass: true };
    },
  },

  no_hardcoded_secrets: {
    name: "No Hardcoded Secrets",
    description: "API keys and secrets should use env vars",
    check: (code) => {
      const patterns = [
        /['"]sk-[a-zA-Z0-9]{20,}['"]/, // OpenAI
        /['"]ghp_[a-zA-Z0-9]{20,}['"]/, // GitHub
        /['"]AKIA[A-Z0-9]{16}['"]/, // AWS
      ];

      for (const pattern of patterns) {
        if (pattern.test(code)) {
          return {
            pass: false,
            message: "Hardcoded secret/API key detected",
            fix: "Move secret to environment variable: process.env.SECRET_NAME",
          };
        }
      }
      return { pass: true };
    },
  },

  service_singleton: {
    name: "Service Singleton",
    description: "Services should export singleton instances",
    check: (code, filePath) => {
      if (!filePath.includes("service")) return { pass: true };

      if (code.includes("class") && code.includes("Service")) {
        if (!code.match(/export\s+(?:const|let)\s+\w+\s*=\s*new/)) {
          return {
            pass: false,
            message: "Service should export a singleton instance",
            fix: "Add: export const serviceName = new ServiceClass();",
          };
        }
      }
      return { pass: true };
    },
  },
};

// File type detection
function detectFileType(filePath, content) {
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);

  if (fileName.includes(".test.") || fileName.includes(".spec.")) return "test";
  if (fileName.includes("hook") || fileName.startsWith("use")) return "hook";
  if (
    dirName.includes("components") ||
    (content.includes("return") && content.includes("<"))
  )
    return "component";
  if (dirName.includes("api") || dirName.includes("routes")) return "api";
  if (dirName.includes("services") || fileName.includes("service"))
    return "service";
  if (dirName.includes("utils") || dirName.includes("lib")) return "util";
  if (fileName.includes(".d.ts") || dirName.includes("types")) return "type";

  return "unknown";
}

// Framework detection
function detectFramework(content) {
  if (content.includes("from 'react'") || content.includes('from "react"'))
    return "react";
  if (content.includes("from 'vue'")) return "vue";
  if (content.includes("from 'svelte'")) return "svelte";
  if (content.includes("from 'express'")) return "express";
  if (content.includes("from 'next'")) return "next";
  return null;
}

// Current project state
let projectPatterns = {};
let learnedPatterns = [];
let strictnessLevel = "standard"; // relaxed, standard, strict

/**
 * Review code against architecture patterns
 */
function reviewCode(filePath, content) {
  const fileType = detectFileType(filePath, content);
  const framework = detectFramework(content);
  const violations = [];
  const suggestions = [];

  // Check all patterns
  for (const [id, pattern] of Object.entries(ARCHITECTURE_PATTERNS)) {
    const result = pattern.check(content, filePath);
    if (!result.pass) {
      violations.push({
        pattern: id,
        name: pattern.name,
        message: result.message,
        fix: result.fix,
        severity:
          id.includes("secret") || id.includes("error") ? "error" : "warning",
      });
    }
  }

  // Generate suggestions based on file type
  if (fileType === "component" && framework === "react") {
    if (
      !content.includes("memo") &&
      content.includes(".map(") &&
      content.includes(".filter(")
    ) {
      suggestions.push({
        type: "performance",
        title: "Consider useMemo",
        description: "Complex computations could benefit from memoization",
        code: "const processed = useMemo(() => data.filter(...).map(...), [data]);",
      });
    }

    if (
      content.includes("await") &&
      !content.includes("loading") &&
      !content.includes("isLoading")
    ) {
      suggestions.push({
        type: "ux",
        title: "Add Loading State",
        description: "Async operations should show loading state",
        code: "const [isLoading, setIsLoading] = useState(false);",
      });
    }
  }

  if (fileType === "api") {
    if (
      !content.includes("validate") &&
      !content.includes("zod") &&
      !content.includes("yup")
    ) {
      suggestions.push({
        type: "security",
        title: "Add Input Validation",
        description: "API routes should validate input data",
        code: "import { z } from 'zod';\nconst schema = z.object({ ... });",
      });
    }
  }

  // Calculate score
  let score = 100;
  for (const v of violations) {
    score -= v.severity === "error" ? 20 : 10;
  }
  score -= suggestions.length * 2;
  score = Math.max(0, Math.min(100, score));

  const approved =
    strictnessLevel === "strict"
      ? violations.length === 0
      : violations.filter((v) => v.severity === "error").length === 0;

  return {
    approved,
    fileType,
    framework,
    score,
    violations,
    suggestions,
    summary: approved
      ? `✅ Approved (${score}/100) - ${violations.length} warnings, ${suggestions.length} suggestions`
      : `🛑 BLOCKED (${score}/100) - ${violations.filter((v) => v.severity === "error").length} errors must be fixed`,
  };
}

/**
 * Get suggestions before writing code
 */
function getSuggestions(intent, context) {
  const suggestions = [];

  // Based on intent (what they want to create)
  if (intent.includes("component") || intent.includes("ui")) {
    suggestions.push({
      pattern: "React Component",
      template: `interface Props {
  // Define props here
}

export function ComponentName({ prop }: Props) {
  // 1. Hooks first
  const [state, setState] = useState();
  
  // 2. Event handlers
  const handleClick = () => {};
  
  // 3. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}`,
      rules: [
        "Use PascalCase for component name",
        "Define Props interface",
        "Hooks before handlers before return",
        "Use named export for components",
      ],
    });
  }

  if (intent.includes("hook") || intent.includes("use")) {
    suggestions.push({
      pattern: "Custom Hook",
      template: `export function useHookName(param: Type) {
  // 1. Internal state
  const [state, setState] = useState();
  
  // 2. Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // 3. Return value
  return { state, actions };
}`,
      rules: [
        'Name must start with "use"',
        "Return object or tuple",
        "Document dependencies clearly",
      ],
    });
  }

  if (
    intent.includes("api") ||
    intent.includes("endpoint") ||
    intent.includes("route")
  ) {
    suggestions.push({
      pattern: "API Route",
      template: `export async function handler(req: Request, res: Response) {
  try {
    // 1. Validate input
    const data = schema.parse(req.body);
    
    // 2. Business logic
    const result = await service.process(data);
    
    // 3. Return response
    return res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}`,
      rules: [
        "Always wrap in try/catch",
        "Validate input data",
        "Return consistent response shape",
        "Log errors properly",
      ],
    });
  }

  if (intent.includes("service") || intent.includes("class")) {
    suggestions.push({
      pattern: "Service Class",
      template: `class ServiceName {
  private dependency: Dependency;
  
  constructor(dependency: Dependency) {
    this.dependency = dependency;
  }
  
  async method(param: Type): Promise<Result> {
    // Implementation
  }
}

// Export singleton
export const serviceName = new ServiceName(dependency);`,
      rules: [
        "Use dependency injection",
        "Export singleton instance",
        "Add explicit return types",
        "Keep methods focused",
      ],
    });
  }

  return suggestions;
}

/**
 * MCP Tool Definitions
 */
const ARCHITECT_TOOLS = [
  {
    name: "guardrail_architect_review",
    description: `🏛️ ARCHITECT REVIEW - Review code against architecture patterns BEFORE committing.

Call this tool to check if code follows project architecture:
- Import ordering and structure
- Naming conventions (PascalCase, camelCase, use*)
- Error handling patterns
- TypeScript best practices
- Security patterns (no secrets, validation)

Returns: approval status, score, violations, and suggestions.
If blocked, you MUST fix the violations before proceeding.`,
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file being reviewed",
        },
        content: {
          type: "string",
          description: "The code content to review",
        },
      },
      required: ["file_path", "content"],
    },
  },

  {
    name: "guardrail_architect_suggest",
    description: `💡 ARCHITECT SUGGEST - Get architectural guidance BEFORE writing code.

Call this FIRST when you're about to create:
- A new component
- A new hook
- An API route
- A service class
- Any significant new code

Returns: recommended patterns, templates, and rules to follow.`,
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description:
            'What you want to create (e.g., "user profile component", "authentication hook", "payment API endpoint")',
        },
        context: {
          type: "string",
          description: "Additional context about the feature",
        },
      },
      required: ["intent"],
    },
  },

  {
    name: "guardrail_architect_patterns",
    description: `📋 List all active architecture patterns and their rules.`,
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["all", "react", "typescript", "api", "security"],
          description: "Filter patterns by category",
        },
      },
    },
  },

  {
    name: "guardrail_architect_set_strictness",
    description: `⚙️ Set architect strictness level:
- relaxed: Only block on critical issues
- standard: Block on errors, warn on issues
- strict: Block on any violation`,
    inputSchema: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["relaxed", "standard", "strict"],
        },
      },
      required: ["level"],
    },
  },
];

/**
 * Handle MCP tool calls
 */
async function handleArchitectTool(name, args) {
  switch (name) {
    case "guardrail_architect_review": {
      const { file_path, content } = args;
      const result = reviewCode(file_path, content);

      let output = "\n🏛️ ARCHITECT REVIEW\n";
      output += "═".repeat(50) + "\n";
      output += `File: ${file_path}\n`;
      output += `Type: ${result.fileType} | Framework: ${result.framework || "none"}\n`;
      output += `Score: ${result.score}/100\n\n`;

      if (result.violations.length > 0) {
        output += "❌ VIOLATIONS:\n";
        for (const v of result.violations) {
          const icon = v.severity === "error" ? "🚫" : "⚠️";
          output += `${icon} [${v.name}] ${v.message}\n`;
          output += `   Fix: ${v.fix}\n\n`;
        }
      }

      if (result.suggestions.length > 0) {
        output += "💡 SUGGESTIONS:\n";
        for (const s of result.suggestions) {
          output += `• [${s.type}] ${s.title}\n`;
          output += `  ${s.description}\n`;
          if (s.code) {
            output += `  Example: ${s.code}\n`;
          }
          output += "\n";
        }
      }

      output += "═".repeat(50) + "\n";
      output += result.summary + "\n";

      return {
        content: [{ type: "text", text: output }],
        isError: !result.approved,
      };
    }

    case "guardrail_architect_suggest": {
      const { intent, context } = args;
      const suggestions = getSuggestions(intent, context || "");

      let output = "\n💡 ARCHITECT SUGGESTIONS\n";
      output += "═".repeat(50) + "\n";
      output += `For: "${intent}"\n\n`;

      for (const s of suggestions) {
        output += `📋 ${s.pattern}\n\n`;
        output += `Template:\n\`\`\`typescript\n${s.template}\n\`\`\`\n\n`;
        output += `Rules to follow:\n`;
        for (const rule of s.rules) {
          output += `  ✓ ${rule}\n`;
        }
        output += "\n";
      }

      if (suggestions.length === 0) {
        output += "No specific pattern suggestions for this intent.\n";
        output += "General rules:\n";
        output += "  ✓ Use TypeScript with explicit types\n";
        output += "  ✓ Handle errors properly\n";
        output += "  ✓ Follow project naming conventions\n";
      }

      output += "═".repeat(50) + "\n";

      return {
        content: [{ type: "text", text: output }],
      };
    }

    case "guardrail_architect_patterns": {
      const { category } = args;

      let output = "\n📋 ARCHITECTURE PATTERNS\n";
      output += "═".repeat(50) + "\n";
      output += `Strictness: ${strictnessLevel.toUpperCase()}\n\n`;

      for (const [id, pattern] of Object.entries(ARCHITECTURE_PATTERNS)) {
        if (category && category !== "all") {
          if (
            category === "react" &&
            !id.includes("react") &&
            !id.includes("component") &&
            !id.includes("hook")
          )
            continue;
          if (
            category === "typescript" &&
            !id.includes("type") &&
            !id.includes("any")
          )
            continue;
          if (category === "api" && !id.includes("api")) continue;
          if (
            category === "security" &&
            !id.includes("secret") &&
            !id.includes("console")
          )
            continue;
        }

        output += `• ${pattern.name}\n`;
        output += `  ${pattern.description}\n\n`;
      }

      output += "═".repeat(50) + "\n";

      return {
        content: [{ type: "text", text: output }],
      };
    }

    case "guardrail_architect_set_strictness": {
      const { level } = args;
      strictnessLevel = level;

      return {
        content: [
          {
            type: "text",
            text:
              `🏛️ Architect strictness set to: ${level.toUpperCase()}\n\n` +
              (level === "relaxed"
                ? "Only critical issues will block."
                : level === "standard"
                  ? "Errors block, warnings are reported."
                  : "All violations will block."),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

export {
  ARCHITECT_TOOLS,
  handleArchitectTool,
  reviewCode,
  getSuggestions,
  ARCHITECTURE_PATTERNS,
};
