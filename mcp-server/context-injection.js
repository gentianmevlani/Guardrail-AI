/**
 * Guardrail Context Injection — MCP Resources & Tools
 *
 * Feeds truthpack data (routes, schema, env vars, patterns) directly into
 * AI coding sessions so the AI can't hallucinate. This is the core of the
 * AI Feedback Loop.
 *
 * MCP Resources:
 *   guardrail://truthpack/routes       — Verified API routes
 *   guardrail://truthpack/schema       — Database schema and types
 *   guardrail://truthpack/env          — Environment variables
 *   guardrail://truthpack/patterns     — Golden patterns to follow
 *   guardrail://truthpack/antipatterns — Patterns to avoid
 *   guardrail://truthpack/symbols      — Exported functions/classes
 *   guardrail://truthpack/violations   — Repeat violation warnings
 *   guardrail://truthpack/all          — Complete truthpack bundle
 *
 * MCP Tool:
 *   guardrail.inject — Returns structured context prompt for AI consumption
 */

import fs from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Canonical truthpack output directory (matches TruthPackGenerator)
const TRUTHPACK_DIR = ".guardrail-context";
const GUARDRAIL_DIR = ".guardrail";

// ============================================================================
// TRUTHPACK READER
// ============================================================================

async function readTruthpackFile(projectPath, filename) {
  const filePath = path.join(projectPath, TRUTHPACK_DIR, filename);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readGuardrailFile(projectPath, filename) {
  const filePath = path.join(projectPath, GUARDRAIL_DIR, filename);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function truthpackExists(projectPath) {
  return existsSync(path.join(projectPath, TRUTHPACK_DIR, "truthpack.json"));
}

// ============================================================================
// MCP RESOURCES
// ============================================================================

export const CONTEXT_INJECTION_RESOURCES = [
  {
    uri: "guardrail://truthpack/routes",
    name: "Verified API Routes",
    description:
      "All API routes extracted from the codebase — use these exact paths, do NOT invent routes",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/schema",
    name: "Database Schema & Types",
    description:
      "Database tables, columns, TypeScript interfaces, Zod schemas — use these exact types",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/env",
    name: "Environment Variables",
    description:
      "Verified environment variables — use these exact names, do NOT invent env vars",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/patterns",
    name: "Golden Patterns",
    description:
      "Verified good patterns from this codebase — follow these when writing new code",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/antipatterns",
    name: "Anti-Patterns to Avoid",
    description:
      "Known bad patterns in this codebase — do NOT replicate these",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/symbols",
    name: "Exported Symbols",
    description:
      "All exported functions, classes, types — import from these, do NOT create duplicates",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/violations",
    name: "Repeat Violation Warnings",
    description:
      "Violations that keep recurring — the AI must avoid generating code with these patterns",
    mimeType: "application/json",
  },
  {
    uri: "guardrail://truthpack/all",
    name: "Complete Truthpack Bundle",
    description:
      "Full project truth — routes, schema, env, patterns, symbols, violations in one payload",
    mimeType: "application/json",
  },
];

export async function handleContextInjectionResource(uri, projectPath) {
  if (!truthpackExists(projectPath)) {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "No truthpack found. Run `guardrail scan --with-context` or `guardrail context` first.",
            hint: "The truthpack provides verified project data that prevents AI hallucinations.",
          }),
        },
      ],
    };
  }

  const resourceMap = {
    "guardrail://truthpack/routes": async () =>
      (await readTruthpackFile(projectPath, "routes.json")) || [],
    "guardrail://truthpack/schema": async () => {
      const contextJson = await readGuardrailFile(projectPath, "context.json");
      return {
        types: contextJson?.types || {},
        models: contextJson?.structure?.models || [],
      };
    },
    "guardrail://truthpack/env": async () => {
      const contextJson = await readGuardrailFile(projectPath, "context.json");
      return contextJson?.environment || { variables: [] };
    },
    "guardrail://truthpack/patterns": async () =>
      (await readTruthpackFile(projectPath, "patterns.json")) || [],
    "guardrail://truthpack/antipatterns": async () =>
      (await readTruthpackFile(projectPath, "antipatterns.json")) || [],
    "guardrail://truthpack/symbols": async () =>
      (await readTruthpackFile(projectPath, "symbols.json")) || [],
    "guardrail://truthpack/violations": async () =>
      (await readGuardrailFile(projectPath, "violation-history.json")) || {
        patterns: [],
        message: "No violation history yet. Run guardrail scan to start tracking.",
      },
    "guardrail://truthpack/all": async () => {
      const [routes, symbols, patterns, antipatterns, deps, risk, contextJson, violations] =
        await Promise.all([
          readTruthpackFile(projectPath, "routes.json"),
          readTruthpackFile(projectPath, "symbols.json"),
          readTruthpackFile(projectPath, "patterns.json"),
          readTruthpackFile(projectPath, "antipatterns.json"),
          readTruthpackFile(projectPath, "deps.json"),
          readTruthpackFile(projectPath, "risk.json"),
          readGuardrailFile(projectPath, "context.json"),
          readGuardrailFile(projectPath, "violation-history.json"),
        ]);

      return {
        routes: routes || [],
        symbols: (symbols || []).slice(0, 200), // Cap for context window
        patterns: patterns || [],
        antipatterns: (antipatterns || []).slice(0, 50),
        dependencies: (deps || []).slice(0, 100),
        riskHotspots: (risk || []).filter((r) => r.severity === "critical" || r.severity === "high"),
        types: contextJson?.types || {},
        environment: contextJson?.environment || {},
        violations: violations?.patterns?.filter((p) => p.count >= 3) || [],
        project: contextJson?.project || {},
        techStack: contextJson?.techStack || {},
      };
    },
  };

  const handler = resourceMap[uri];
  if (!handler) {
    return { contents: [] };
  }

  const data = await handler();
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ============================================================================
// MCP TOOL: guardrail.inject
// ============================================================================

export const INJECT_TOOL = {
  name: "guardrail.inject",
  description:
    "🧬 Context Injection — Returns verified project truth (routes, schema, env vars, patterns) as a structured prompt. Call this BEFORE writing code to prevent hallucinations.",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "Path to project root",
        default: ".",
      },
      scope: {
        type: "string",
        enum: ["full", "routes", "schema", "env", "patterns", "compact"],
        description:
          "What to inject: full (everything), routes, schema, env, patterns, or compact (key facts only)",
        default: "compact",
      },
      file: {
        type: "string",
        description:
          "Current file being edited — returns only context relevant to this file",
      },
    },
  },
};

export async function handleInjectTool(args) {
  const projectPath = path.resolve(args?.projectPath || ".");
  const scope = args?.scope || "compact";
  const currentFile = args?.file;

  if (!truthpackExists(projectPath)) {
    return {
      content: [
        {
          type: "text",
          text: "⚠️ No truthpack found. Run `guardrail context` first to generate project truth.\n\nThe truthpack gives me verified data about your routes, schema, env vars, and patterns so I won't hallucinate.",
        },
      ],
    };
  }

  const [routes, symbols, patterns, antipatterns, contextJson, violations] =
    await Promise.all([
      readTruthpackFile(projectPath, "routes.json"),
      readTruthpackFile(projectPath, "symbols.json"),
      readTruthpackFile(projectPath, "patterns.json"),
      readTruthpackFile(projectPath, "antipatterns.json"),
      readGuardrailFile(projectPath, "context.json"),
      readGuardrailFile(projectPath, "violation-history.json"),
    ]);

  let prompt = "";

  // Header
  prompt += "# 🛡️ Guardrail Context Injection\n\n";
  prompt += "**The following is VERIFIED project truth. Use these exact values — do NOT invent alternatives.**\n\n";

  // Project identity
  if (contextJson?.project) {
    prompt += `## Project: ${contextJson.project.name}\n`;
    prompt += `- **Framework:** ${contextJson.project.framework || "unknown"}\n`;
    prompt += `- **Language:** ${contextJson.project.language || "unknown"}\n`;
    prompt += `- **Architecture:** ${contextJson.project.architecture || "unknown"}\n\n`;
  }

  // Scope-based injection
  if (scope === "full" || scope === "routes" || scope === "compact") {
    const routeList = routes || [];
    if (routeList.length > 0) {
      prompt += "## Verified API Routes\n\n";
      prompt += "| Method | Path | Auth | File |\n|--------|------|------|------|\n";
      const routesToShow = scope === "compact" ? routeList.slice(0, 20) : routeList;
      for (const r of routesToShow) {
        prompt += `| ${r.method} | ${r.path} | ${r.auth ? "✅" : "❌"} | ${r.file}:${r.line} |\n`;
      }
      if (scope === "compact" && routeList.length > 20) {
        prompt += `\n_...and ${routeList.length - 20} more routes. Use \`guardrail.inject --scope=routes\` for all._\n`;
      }
      prompt += "\n";
    }
  }

  if (scope === "full" || scope === "schema" || scope === "compact") {
    const types = contextJson?.types || {};
    if (types.interfaces?.length || types.types?.length) {
      prompt += "## Database Schema & Types\n\n";
      const allTypes = [...(types.interfaces || []), ...(types.types || [])];
      const typesToShow = scope === "compact" ? allTypes.slice(0, 15) : allTypes;
      for (const t of typesToShow) {
        prompt += `- **${t.name}** (${t.file}:${t.line})\n`;
      }
      prompt += "\n";
    }
  }

  if (scope === "full" || scope === "env" || scope === "compact") {
    const envVars = contextJson?.environment?.variables || [];
    if (envVars.length > 0) {
      prompt += "## Environment Variables\n\n";
      prompt += "Use ONLY these env var names:\n\n";
      for (const v of envVars) {
        prompt += `- \`${v.name || v}\`${v.required ? " (required)" : ""}\n`;
      }
      prompt += "\n";
    }
  }

  if (scope === "full" || scope === "patterns") {
    const patternList = patterns || [];
    if (patternList.length > 0) {
      prompt += "## Golden Patterns (Follow These)\n\n";
      for (const p of patternList.slice(0, 10)) {
        prompt += `- **${p.name}** — ${p.description} (${p.file}:${p.line})\n`;
      }
      prompt += "\n";
    }
  }

  // Always include antipatterns and violation warnings
  const antipatternList = antipatterns || [];
  if (antipatternList.length > 0 && (scope === "full" || scope === "compact")) {
    const unique = new Map();
    for (const a of antipatternList) {
      if (!unique.has(a.name)) unique.set(a.name, a);
    }
    prompt += "## ⚠️ Anti-Patterns to AVOID\n\n";
    for (const [, a] of [...unique].slice(0, 10)) {
      prompt += `- **${a.name}** — ${a.description}\n`;
    }
    prompt += "\n";
  }

  // Violation warnings (learning loop data)
  const violationPatterns = violations?.patterns?.filter((p) => p.count >= 3) || [];
  if (violationPatterns.length > 0) {
    prompt += "## 🔴 Repeat Violations (CRITICAL — Do NOT repeat these)\n\n";
    prompt += "These patterns have been flagged multiple times in this project:\n\n";
    for (const v of violationPatterns) {
      prompt += `- **${v.type}** in \`${v.file}\` — seen ${v.count}x (last: ${v.lastSeen})\n`;
      if (v.wasFixedThenReintroduced) {
        prompt += `  ⚡ This was FIXED then RE-INTRODUCED. Do not make this mistake again.\n`;
      }
    }
    prompt += "\n";
  }

  // File-specific context
  if (currentFile) {
    const symbolList = symbols || [];
    const relatedSymbols = symbolList.filter(
      (s) => s.file === currentFile || s.file.endsWith(currentFile),
    );
    if (relatedSymbols.length > 0) {
      prompt += `## Context for ${currentFile}\n\n`;
      prompt += "Symbols defined in this file:\n\n";
      for (const s of relatedSymbols) {
        prompt += `- \`${s.name}\` (${s.type}, line ${s.line})`;
        if (s.signature) prompt += ` — ${s.signature.slice(0, 80)}`;
        prompt += "\n";
      }
      prompt += "\n";
    }
  }

  prompt += "---\n_Context injected by Guardrail. This data is verified — treat it as ground truth._\n";

  return {
    content: [{ type: "text", text: prompt }],
  };
}
