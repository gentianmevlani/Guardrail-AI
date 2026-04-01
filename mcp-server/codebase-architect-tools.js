/**
 * Codebase-Aware Architect MCP Tools
 *
 * These tools give AI agents access to deep codebase knowledge:
 * 1. guardrail_architect_context - Get full codebase context
 * 2. guardrail_architect_guide - Get guidance for creating/modifying code
 * 3. guardrail_architect_validate - Validate code against codebase patterns
 * 4. guardrail_architect_patterns - Get specific patterns from codebase
 * 5. guardrail_architect_dependencies - Understand file relationships
 */

import fs from "fs";
import path from "path";

// Cache for loaded context
let contextCache = null;
let contextLoadedAt = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load context from .guardrail/ directory
 */
async function loadCodebaseContext(projectPath) {
  const guardrailDir = path.join(projectPath, ".guardrail");

  // Check cache
  if (
    contextCache &&
    contextLoadedAt &&
    Date.now() - contextLoadedAt < CACHE_TTL_MS
  ) {
    return contextCache;
  }

  const context = {
    projectSummary: await loadJsonFile(guardrailDir, "project-summary.json"),
    dependencyGraph: await loadJsonFile(guardrailDir, "dependency-graph.json"),
    apiContracts: await loadJsonFile(guardrailDir, "api-contracts.json"),
    teamConventions: await loadJsonFile(guardrailDir, "team-conventions.json"),
    gitContext: await loadJsonFile(guardrailDir, "git-context.json"),
    patterns: await loadJsonFile(guardrailDir, "patterns.json"),
    // Also load generated rules files
    cursorRules: await loadTextFile(projectPath, ".cursorrules"),
    windsurfRules: await loadTextFile(
      path.join(projectPath, ".windsurf", "rules"),
      "rules.md",
    ),
  };

  // If no context files exist, analyze the codebase
  if (!context.projectSummary) {
    context.projectSummary = await analyzeProject(projectPath);
    context.teamConventions = await analyzeConventions(projectPath);
    context.patterns = await analyzePatterns(projectPath);
  }

  contextCache = context;
  contextLoadedAt = Date.now();

  return context;
}

/**
 * Load a JSON file safely
 */
async function loadJsonFile(dir, filename) {
  const filePath = path.join(dir, filename);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
    }
  } catch (e) {
    console.warn(`Could not load ${filename}:`, e.message);
  }
  return null;
}

/**
 * Load a text file safely
 */
async function loadTextFile(dir, filename) {
  const filePath = path.join(dir, filename);
  try {
    if (fs.existsSync(filePath)) {
      return await fs.promises.readFile(filePath, "utf-8");
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

/**
 * Analyze project basics
 */
async function analyzeProject(projectPath) {
  const pkgPath = path.join(projectPath, "package.json");
  let pkg = {};

  try {
    if (fs.existsSync(pkgPath)) {
      pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"));
    }
  } catch {}

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Detect tech stack
  const techStack = {
    languages: ["javascript"],
    frameworks: [],
    databases: [],
    tools: [],
  };

  if (deps.typescript) techStack.languages.push("typescript");
  if (deps.react) techStack.frameworks.push("react");
  if (deps.next) techStack.frameworks.push("next.js");
  if (deps.vue) techStack.frameworks.push("vue");
  if (deps.express) techStack.frameworks.push("express");
  if (deps.fastify) techStack.frameworks.push("fastify");
  if (deps.prisma) techStack.databases.push("prisma");
  if (deps.jest) techStack.tools.push("jest");
  if (deps.vitest) techStack.tools.push("vitest");

  // Detect project type
  let type = "unknown";
  if (fs.existsSync(path.join(projectPath, "pnpm-workspace.yaml")))
    type = "monorepo";
  else if (pkg.bin) type = "cli";
  else if (techStack.frameworks.includes("next.js")) type = "next-app";
  else if (techStack.frameworks.includes("react")) type = "react-app";

  return {
    name: pkg.name || path.basename(projectPath),
    description: pkg.description || "",
    type,
    techStack,
    structure: {
      srcDir: fs.existsSync(path.join(projectPath, "src")) ? "src" : ".",
      hasTests:
        fs.existsSync(path.join(projectPath, "tests")) ||
        fs.existsSync(path.join(projectPath, "__tests__")),
    },
  };
}

/**
 * Analyze coding conventions
 */
async function analyzeConventions(projectPath) {
  // Check prettier config
  let codeStyle = {
    quotes: "single",
    semicolons: true,
    indentSize: 2,
  };

  const prettierRc = path.join(projectPath, ".prettierrc");
  if (fs.existsSync(prettierRc)) {
    try {
      const config = JSON.parse(
        await fs.promises.readFile(prettierRc, "utf-8"),
      );
      if (config.singleQuote === false) codeStyle.quotes = "double";
      if (config.semi === false) codeStyle.semicolons = false;
      if (config.tabWidth) codeStyle.indentSize = config.tabWidth;
    } catch {}
  }

  // Detect file naming convention
  const files = await findSourceFiles(projectPath, 30);
  let kebab = 0,
    camel = 0,
    pascal = 0;

  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    if (name.includes("-")) kebab++;
    else if (name[0] === name[0]?.toUpperCase()) pascal++;
    else camel++;
  }

  const fileNaming =
    kebab > camel && kebab > pascal
      ? "kebab-case"
      : pascal > camel
        ? "PascalCase"
        : "camelCase";

  return {
    namingConventions: {
      files: fileNaming,
      components: "PascalCase",
      functions: "camelCase",
      types: "PascalCase",
    },
    codeStyle,
  };
}

/**
 * Analyze code patterns
 */
async function analyzePatterns(projectPath) {
  const files = await findSourceFiles(projectPath, 100);
  const patterns = {
    components: [],
    hooks: [],
    services: [],
    api: [],
    utilities: [],
  };

  // Find component patterns
  const componentFiles = files.filter(
    (f) =>
      (f.includes("components") || f.includes("ui")) &&
      (f.endsWith(".tsx") || f.endsWith(".jsx")),
  );

  if (componentFiles.length > 0) {
    let template = "";
    try {
      const content = await fs.promises.readFile(componentFiles[0], "utf-8");
      const match = content.match(/(export\s+)?(function|const)\s+\w+[^{]+\{/);
      if (match) template = match[0] + "/* ... */ }";
    } catch {}

    patterns.components.push({
      name: "React Component",
      template:
        template ||
        "export function Component(props: Props) { return <div />; }",
      examples: componentFiles
        .slice(0, 3)
        .map((f) => path.relative(projectPath, f)),
      count: componentFiles.length,
    });
  }

  // Find hook patterns
  const hookFiles = files.filter((f) => f.includes("use") && f.endsWith(".ts"));
  if (hookFiles.length > 0) {
    patterns.hooks.push({
      name: "Custom Hook",
      template:
        "export function useHook() { const [state, setState] = useState(); return { state }; }",
      examples: hookFiles.slice(0, 3).map((f) => path.relative(projectPath, f)),
      count: hookFiles.length,
    });
  }

  // Find API patterns
  const apiFiles = files.filter(
    (f) => f.includes("api") || f.includes("route"),
  );
  if (apiFiles.length > 0) {
    patterns.api.push({
      name: "API Route",
      template:
        "export async function handler(req, res) { try { /* logic */ } catch (e) { res.status(500).json({ error }); } }",
      examples: apiFiles.slice(0, 3).map((f) => path.relative(projectPath, f)),
      count: apiFiles.length,
    });
  }

  return patterns;
}

/**
 * Find source files
 */
async function findSourceFiles(projectPath, limit = 50) {
  const files = [];
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  const ignoreDirs = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
  ];

  async function walk(dir, depth = 0) {
    if (depth > 5 || files.length >= limit) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= limit) break;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            await walk(fullPath, depth + 1);
          }
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {}
  }

  await walk(projectPath);
  return files;
}

/**
 * Get guidance for creating new code
 */
function getGuidance(context, intent, targetPath) {
  const fileType = detectFileType(targetPath, intent);
  const patterns = context.patterns?.[fileType] || [];
  const conventions = context.teamConventions || {};

  let guidance = `\n🏛️ ARCHITECT GUIDANCE\n`;
  guidance += `${"═".repeat(50)}\n`;
  guidance += `Intent: "${intent}"\n`;
  guidance += `Target: ${targetPath}\n`;
  guidance += `File Type: ${fileType}\n\n`;

  // Project context
  if (context.projectSummary) {
    guidance += `📋 PROJECT CONTEXT\n`;
    guidance += `Name: ${context.projectSummary.name}\n`;
    guidance += `Type: ${context.projectSummary.type}\n`;
    if (context.projectSummary.techStack?.frameworks?.length > 0) {
      guidance += `Frameworks: ${context.projectSummary.techStack.frameworks.join(", ")}\n`;
    }
    guidance += `\n`;
  }

  // Conventions
  if (conventions.namingConventions) {
    guidance += `📝 CONVENTIONS TO FOLLOW\n`;
    guidance += `- File naming: ${conventions.namingConventions.files}\n`;
    guidance += `- Components: ${conventions.namingConventions.components}\n`;
    guidance += `- Functions: ${conventions.namingConventions.functions}\n`;
    if (conventions.codeStyle) {
      guidance += `- Quotes: ${conventions.codeStyle.quotes}\n`;
      guidance += `- Semicolons: ${conventions.codeStyle.semicolons ? "yes" : "no"}\n`;
    }
    guidance += `\n`;
  }

  // Patterns
  if (patterns.length > 0) {
    guidance += `📐 PATTERN TO FOLLOW\n`;
    for (const pattern of patterns.slice(0, 1)) {
      guidance += `${pattern.name}:\n`;
      guidance += `\`\`\`typescript\n${pattern.template}\n\`\`\`\n`;
      if (pattern.examples?.length > 0) {
        guidance += `\nReference files:\n`;
        for (const ex of pattern.examples.slice(0, 3)) {
          guidance += `  - ${ex}\n`;
        }
      }
    }
    guidance += `\n`;
  }

  // Cursor/Windsurf rules
  if (context.cursorRules) {
    guidance += `📜 PROJECT RULES (from .cursorrules)\n`;
    const rules = context.cursorRules.split("\n").slice(0, 10).join("\n");
    guidance += `${rules}\n...\n\n`;
  }

  guidance += `${"═".repeat(50)}\n`;

  return guidance;
}

/**
 * Detect file type from path and intent
 */
function detectFileType(filePath, intent) {
  const lower = (filePath + " " + intent).toLowerCase();

  if (lower.includes("component") || lower.includes("ui")) return "components";
  if (lower.includes("hook") || lower.includes("use")) return "hooks";
  if (lower.includes("service")) return "services";
  if (lower.includes("api") || lower.includes("route")) return "api";
  return "utilities";
}

/**
 * Validate code against patterns
 */
function validateCode(context, filePath, content) {
  const issues = [];
  const suggestions = [];
  const conventions = context.teamConventions || {};

  // Check naming convention
  const basename = path.basename(filePath, path.extname(filePath));
  if (conventions.namingConventions?.files === "kebab-case") {
    if (
      !basename.includes("-") &&
      basename.length > 10 &&
      /[A-Z]/.test(basename)
    ) {
      issues.push({
        rule: "naming-convention",
        message: `File should use kebab-case (e.g., ${toKebabCase(basename)})`,
        severity: "warning",
      });
    }
  }

  // Check for console.log
  if (content.includes("console.log") && !filePath.includes("test")) {
    issues.push({
      rule: "no-console",
      message: "Remove console.log from production code",
      severity: "warning",
    });
  }

  // Check for any type
  if (content.includes(": any") && !content.includes("@ts-")) {
    issues.push({
      rule: "no-any",
      message: 'Avoid using "any" type',
      severity: "warning",
    });
  }

  // Check for TODO/FIXME
  if (content.match(/\/\/\s*(TODO|FIXME)/i)) {
    issues.push({
      rule: "no-todo",
      message: "Complete TODO/FIXME before committing",
      severity: "warning",
    });
  }

  // Check imports
  const imports = content.match(/import .+ from ['"]([^'"]+)['"]/g) || [];
  if (imports.some((i) => i.includes("../../../"))) {
    suggestions.push("Consider using path aliases (@/) for deep imports");
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    score: Math.max(0, 100 - issues.length * 10),
    issues,
    suggestions,
  };
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

// ============================================================================
// MCP TOOL DEFINITIONS
// ============================================================================

const CODEBASE_ARCHITECT_TOOLS = [
  {
    name: "guardrail_architect_context",
    description: `🧠 GET CODEBASE CONTEXT - Load deep knowledge about this project.

Returns:
- Project summary (name, type, tech stack)
- Team coding conventions
- Code patterns and templates
- Dependency relationships
- Git context and recent changes

Call this FIRST before writing any code to understand the codebase.`,
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the project root (default: current directory)",
        },
      },
    },
  },

  {
    name: "guardrail_architect_guide",
    description: `🏛️ GET ARCHITECT GUIDANCE - Get specific guidance for creating or modifying code.

Before creating a new file, call this to get:
- The pattern to follow
- Naming conventions
- Reference files to look at
- Project rules to follow

This ensures your code fits the existing codebase style.`,
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description:
            'What you want to create (e.g., "user profile component", "auth hook", "API endpoint")',
        },
        target_path: {
          type: "string",
          description: "Path where the file will be created",
        },
        project_path: {
          type: "string",
          description: "Path to the project root (default: current directory)",
        },
      },
      required: ["intent", "target_path"],
    },
  },

  {
    name: "guardrail_architect_validate",
    description: `✅ VALIDATE CODE - Check if code follows codebase patterns and conventions.

Returns:
- Validation score (0-100)
- Issues found (naming, console.log, any types, etc.)
- Suggestions for improvement

Call this AFTER writing code to ensure it fits the codebase.`,
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file being validated",
        },
        content: {
          type: "string",
          description: "The code content to validate",
        },
        project_path: {
          type: "string",
          description: "Path to the project root (default: current directory)",
        },
      },
      required: ["file_path", "content"],
    },
  },

  {
    name: "guardrail_architect_patterns",
    description: `📐 GET PATTERNS - Get specific code patterns from the codebase.

Returns templates and examples for:
- components
- hooks
- services
- api routes
- utilities

Use this to see exactly how similar code is structured in this project.`,
    inputSchema: {
      type: "object",
      properties: {
        pattern_type: {
          type: "string",
          enum: ["components", "hooks", "services", "api", "utilities", "all"],
          description: "Type of pattern to retrieve",
        },
        project_path: {
          type: "string",
          description: "Path to the project root (default: current directory)",
        },
      },
      required: ["pattern_type"],
    },
  },

  {
    name: "guardrail_architect_dependencies",
    description: `🔗 GET DEPENDENCIES - Understand file relationships and impact.

Returns:
- Files that import this file
- Files this file imports
- Potential impact of changes
- Circular dependency warnings

Call this before modifying existing code to understand the ripple effects.`,
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to analyze",
        },
        project_path: {
          type: "string",
          description: "Path to the project root (default: current directory)",
        },
      },
      required: ["file_path"],
    },
  },
];

/**
 * Handle MCP tool calls
 */
async function handleCodebaseArchitectTool(name, args) {
  const projectPath = args.project_path || process.cwd();

  switch (name) {
    case "guardrail_architect_context": {
      const context = await loadCodebaseContext(projectPath);

      let output = "\n🧠 CODEBASE CONTEXT\n";
      output += "═".repeat(50) + "\n\n";

      if (context.projectSummary) {
        output += "📋 PROJECT SUMMARY\n";
        output += `Name: ${context.projectSummary.name}\n`;
        output += `Type: ${context.projectSummary.type}\n`;
        output += `Description: ${context.projectSummary.description || "N/A"}\n`;
        if (context.projectSummary.techStack) {
          const ts = context.projectSummary.techStack;
          output += `Languages: ${ts.languages?.join(", ") || "N/A"}\n`;
          output += `Frameworks: ${ts.frameworks?.join(", ") || "N/A"}\n`;
          output += `Databases: ${ts.databases?.join(", ") || "N/A"}\n`;
          output += `Tools: ${ts.tools?.join(", ") || "N/A"}\n`;
        }
        output += "\n";
      }

      if (context.teamConventions) {
        output += "📝 TEAM CONVENTIONS\n";
        const tc = context.teamConventions;
        if (tc.namingConventions) {
          output += `File naming: ${tc.namingConventions.files}\n`;
          output += `Components: ${tc.namingConventions.components}\n`;
          output += `Functions: ${tc.namingConventions.functions}\n`;
        }
        if (tc.codeStyle) {
          output += `Quotes: ${tc.codeStyle.quotes}\n`;
          output += `Semicolons: ${tc.codeStyle.semicolons ? "yes" : "no"}\n`;
          output += `Indent: ${tc.codeStyle.indentSize} spaces\n`;
        }
        output += "\n";
      }

      if (context.patterns) {
        output += "📐 CODE PATTERNS FOUND\n";
        for (const [type, patterns] of Object.entries(context.patterns)) {
          if (Array.isArray(patterns) && patterns.length > 0) {
            output += `${type}: ${patterns.length} pattern(s)\n`;
          }
        }
        output += "\n";
      }

      if (context.cursorRules) {
        output += "📜 PROJECT RULES LOADED\n";
        output += `- .cursorrules: ${context.cursorRules.length} characters\n`;
      }
      if (context.windsurfRules) {
        output += `- .windsurf/rules: ${context.windsurfRules.length} characters\n`;
      }

      output += "\n" + "═".repeat(50) + "\n";
      output += "Use guardrail_architect_guide for specific guidance.\n";

      return { content: [{ type: "text", text: output }] };
    }

    case "guardrail_architect_guide": {
      const { intent, target_path } = args;
      const context = await loadCodebaseContext(projectPath);
      const guidance = getGuidance(context, intent, target_path);

      return { content: [{ type: "text", text: guidance }] };
    }

    case "guardrail_architect_validate": {
      const { file_path, content } = args;
      const context = await loadCodebaseContext(projectPath);
      const result = validateCode(context, file_path, content);

      let output = "\n✅ VALIDATION RESULT\n";
      output += "═".repeat(50) + "\n";
      output += `File: ${file_path}\n`;
      output += `Score: ${result.score}/100\n`;
      output += `Status: ${result.valid ? "✅ PASSED" : "❌ ISSUES FOUND"}\n\n`;

      if (result.issues.length > 0) {
        output += "❌ ISSUES:\n";
        for (const issue of result.issues) {
          const icon = issue.severity === "error" ? "🚫" : "⚠️";
          output += `${icon} [${issue.rule}] ${issue.message}\n`;
        }
        output += "\n";
      }

      if (result.suggestions.length > 0) {
        output += "💡 SUGGESTIONS:\n";
        for (const suggestion of result.suggestions) {
          output += `• ${suggestion}\n`;
        }
        output += "\n";
      }

      if (result.valid && result.issues.length === 0) {
        output += "✨ Code follows all codebase patterns!\n";
      }

      output += "═".repeat(50) + "\n";

      return {
        content: [{ type: "text", text: output }],
        isError: !result.valid,
      };
    }

    case "guardrail_architect_patterns": {
      const { pattern_type } = args;
      const context = await loadCodebaseContext(projectPath);

      let output = "\n📐 CODE PATTERNS\n";
      output += "═".repeat(50) + "\n\n";

      const patterns = context.patterns || {};
      const types =
        pattern_type === "all" ? Object.keys(patterns) : [pattern_type];

      for (const type of types) {
        const typePatterns = patterns[type] || [];
        if (typePatterns.length > 0) {
          output += `📁 ${type.toUpperCase()}\n\n`;
          for (const pattern of typePatterns) {
            output += `${pattern.name}:\n`;
            output += "```typescript\n" + pattern.template + "\n```\n\n";
            if (pattern.examples?.length > 0) {
              output += "Examples:\n";
              for (const ex of pattern.examples) {
                output += `  • ${ex}\n`;
              }
            }
            output += `Found: ${pattern.count || 0} instances\n\n`;
          }
        }
      }

      if (
        Object.keys(patterns).every((k) => (patterns[k]?.length || 0) === 0)
      ) {
        output +=
          "No patterns found. Run `guardrail context` to generate codebase analysis.\n";
      }

      output += "═".repeat(50) + "\n";

      return { content: [{ type: "text", text: output }] };
    }

    case "guardrail_architect_dependencies": {
      const { file_path } = args;
      const context = await loadCodebaseContext(projectPath);

      let output = "\n🔗 DEPENDENCY ANALYSIS\n";
      output += "═".repeat(50) + "\n";
      output += `File: ${file_path}\n\n`;

      const depGraph = context.dependencyGraph;

      if (depGraph?.edges) {
        const basename = path.basename(file_path);
        const importedBy = depGraph.edges
          .filter((e) => e.to.includes(basename))
          .map((e) => e.from);
        const imports = depGraph.edges
          .filter((e) => e.from.includes(basename))
          .map((e) => e.to);

        output += "📥 IMPORTED BY:\n";
        if (importedBy.length > 0) {
          for (const f of importedBy.slice(0, 10)) {
            output += `  • ${f}\n`;
          }
          if (importedBy.length > 10) {
            output += `  ... and ${importedBy.length - 10} more\n`;
          }
        } else {
          output += "  (no dependents found)\n";
        }

        output += "\n📤 IMPORTS:\n";
        if (imports.length > 0) {
          for (const f of imports.slice(0, 10)) {
            output += `  • ${f}\n`;
          }
        } else {
          output += "  (no imports found)\n";
        }

        output += `\n⚠️ IMPACT: Changes may affect ${importedBy.length} file(s)\n`;

        // Check for circular dependencies
        if (depGraph.circularDependencies?.length > 0) {
          const relevant = depGraph.circularDependencies.filter((c) =>
            c.includes(basename),
          );
          if (relevant.length > 0) {
            output += "\n🔄 CIRCULAR DEPENDENCIES:\n";
            for (const cycle of relevant) {
              output += `  ${cycle.join(" → ")}\n`;
            }
          }
        }
      } else {
        output += "No dependency data available.\n";
        output += "Run `guardrail context` to generate dependency graph.\n";
      }

      output += "\n" + "═".repeat(50) + "\n";

      return { content: [{ type: "text", text: output }] };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

export {
  CODEBASE_ARCHITECT_TOOLS,
  handleCodebaseArchitectTool,
  loadCodebaseContext,
};
