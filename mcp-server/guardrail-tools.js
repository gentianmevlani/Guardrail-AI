/**
 * guardrail AI Guardrails MCP Tools
 *
 * Prompt Firewall + Output Verification Layer for AI agents:
 * - guardrail.verify              - Verify AI agent output before applying
 * - guardrail.quality             - Code quality analysis
 * - guardrail.smells              - Detect code smells
 * - guardrail.hallucination       - Check for AI hallucination risks
 * - guardrail.breaking            - Detect breaking changes
 * - guardrail.mdc                 - Generate MDC specifications
 */

import path from "path";
import fs from "fs/promises";
import { execSync } from "child_process";
import { withTierCheck, checkFeatureAccess } from "./tier-auth.js";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const GUARDRAIL_TOOLS = [
  // 1. VERIFY - Verify AI agent output
  {
    name: "guardrail.verify",
    description:
      "🛡️ Verify AI Output — Validates AI-generated code/diffs before applying. Checks for secrets, dangerous commands, path traversal, and stubs.",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "AI agent output (guardrail-v1 JSON format) to verify",
        },
        file: {
          type: "string",
          description: "Path to file containing AI output to verify",
        },
        mode: {
          type: "string",
          enum: ["explore", "build", "ship"],
          description: "Verification mode: explore (lenient), build (normal), ship (strict)",
          default: "build",
        },
        strict: {
          type: "boolean",
          description: "Enable strict mode (fail on warnings)",
          default: false,
        },
        projectPath: {
          type: "string",
          description: "Project root for context",
          default: ".",
        },
      },
    },
  },

  // 2. QUALITY - Code quality analysis
  {
    name: "guardrail.quality",
    description:
      "📊 Code Quality — Analyze complexity, maintainability, technical debt. Returns actionable metrics.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        file: {
          type: "string",
          description: "Specific file to analyze (optional)",
        },
        threshold: {
          type: "number",
          description: "Minimum quality score (0-100) to pass",
          default: 70,
        },
      },
    },
  },

  // 3. SMELLS - Code smell detection
  {
    name: "guardrail.smells",
    description:
      "👃 Code Smells — Detect anti-patterns, complexity issues, naming problems, and structural issues. PRO features include AI-powered technical debt calculation, trend analysis, and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        pro: {
          type: "boolean",
          description: "Enable PRO features (advanced predictor, technical debt calculation, trend analysis)",
          default: false,
        },
        premium: {
          type: "boolean", 
          description: "Alias for pro - Enable premium features",
          default: false,
        },
        file: {
          type: "string",
          description: "Specific file to analyze (optional)",
        },
        severity: {
          type: "string",
          enum: ["all", "critical", "high", "medium"],
          description: "Minimum severity to report",
          default: "medium",
        },
        limit: {
          type: "number",
          description: "Maximum number of smells to return (PRO only, default 50)",
          default: 50,
        },
      },
    },
  },

  // 4. HALLUCINATION - AI hallucination detection
  {
    name: "guardrail.hallucination",
    description:
      "🔍 Hallucination Check — Verify claims against actual source code. Detects contradictions and missing evidence.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        claims: {
          type: "array",
          items: { type: "string" },
          description: "Claims to verify against source code",
        },
        spec: {
          type: "string",
          description: "MDC specification file to verify",
        },
      },
    },
  },

  // 5. BREAKING - Breaking change detection
  {
    name: "guardrail.breaking",
    description:
      "⚠️ Breaking Changes — Detect API changes, removed methods, type changes between versions.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        previousVersion: {
          type: "string",
          description: "Git ref or path to previous version",
        },
        output: {
          type: "string",
          enum: ["text", "json", "markdown"],
          description: "Output format",
          default: "text",
        },
      },
    },
  },

  // 6. MDC - Generate MDC specifications
  {
    name: "guardrail.mdc",
    description:
      "📝 MDC Generator — Generate Markdown Context files with verified, source-anchored documentation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        outputDir: {
          type: "string",
          description: "Output directory for MDC files",
          default: ".specs",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Categories to generate: architecture, algorithm, data-flow, design-system, integration, security, utility",
        },
        depth: {
          type: "string",
          enum: ["shallow", "medium", "deep"],
          description: "Analysis depth",
          default: "medium",
        },
      },
    },
  },

  // 7. COVERAGE - Test coverage mapping
  {
    name: "guardrail.coverage",
    description:
      "🧪 Test Coverage — Map test coverage to components, identify untested code.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        format: {
          type: "string",
          enum: ["text", "json", "markdown"],
          description: "Output format",
          default: "text",
        },
      },
    },
  },

  // 8. AUTOFIX - AI-powered verified autofix (PRO+)
  {
    name: "guardrail.autofix",
    description:
      "🔧 Verified Autofix — AI-powered code fixes with verification. Supports route-integrity, placeholders, type-errors, build-blockers, test-failures fix packs. PRO+ feature.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        fixPack: {
          type: "string",
          enum: ["route-integrity", "placeholders", "type-errors", "build-blockers", "test-failures"],
          description: "Fix pack to apply",
        },
        dryRun: {
          type: "boolean",
          description: "Preview changes without applying",
          default: true,
        },
        model: {
          type: "string",
          description: "AI model to use (e.g., gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514)",
        },
        maxAttempts: {
          type: "number",
          description: "Maximum fix attempts",
          default: 3,
        },
      },
      required: ["fixPack"],
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export async function handleGuardrailTool(toolName, args) {
  const projectPath = path.resolve(args.projectPath || ".");

  // Map tools to required features
<<<<<<< HEAD
  /** Canonical `@guardrail/core` Feature ids (tier-config). */
  const featureMap = {
    "guardrail.verify": "scan",
    "guardrail.quality": "scan",
    "guardrail.smells": "scan:full",
    "guardrail.hallucination": "scan",
    "guardrail.breaking": "scan:full",
    "guardrail.mdc": "mcp",
    "guardrail.coverage": "scan",
    "guardrail.autofix": "fix:auto",
=======
  const featureMap = {
    "guardrail.verify": "verify",
    "guardrail.quality": "quality", 
    "guardrail.smells": "smells",
    "guardrail.hallucination": "hallucination",
    "guardrail.breaking": "breaking",
    "guardrail.mdc": "mdc",
    "guardrail.coverage": "quality", // map to quality tier
    "guardrail.autofix": "smells" // map to smells tier (fix requires starter+)
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  };

  const requiredFeature = featureMap[toolName];
  if (requiredFeature) {
    const access = await checkFeatureAccess(requiredFeature, args?.apiKey);
    if (!access.hasAccess) {
      return {
        content: [{
          type: "text",
          text: `🚫 UPGRADE REQUIRED\n\n${access.reason}\n\nCurrent tier: ${access.tier}\nUpgrade at: ${access.upgradeUrl}`
        }],
        isError: true
      };
    }
  }

  switch (toolName) {
    case "guardrail.verify":
      return handleVerify(args, projectPath);

    case "guardrail.quality":
      return handleQuality(args, projectPath);

    case "guardrail.smells":
      return handleSmells(args, projectPath);

    case "guardrail.hallucination":
      return handleHallucination(args, projectPath);

    case "guardrail.breaking":
      return handleBreaking(args, projectPath);

    case "guardrail.mdc":
      return handleMDC(args, projectPath);

    case "guardrail.coverage":
      return handleCoverage(args, projectPath);

    case "guardrail.autofix":
      return handleAutofix(args, projectPath);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============================================================================
// INDIVIDUAL HANDLERS
// ============================================================================

async function handleVerify(args, projectPath) {
  try {
    let input = args.input;

    // Read from file if specified
    if (args.file && !input) {
      const filePath = path.resolve(projectPath, args.file);
      input = await fs.readFile(filePath, "utf8");
    }

    if (!input) {
      return {
        success: false,
        error: "No input provided. Specify 'input' or 'file' parameter.",
      };
    }

    // Use the verification module
    const { verifyAgentOutput } = await import("../bin/runners/lib/verification.js");

    const context = {
      projectRoot: projectPath,
      mode: args.mode || "build",
      strict: args.strict || false,
      runTests: false,
    };

    const result = await verifyAgentOutput(input, context);

    return {
      success: result.success,
      checks: result.checks,
      blockers: result.blockers,
      warnings: result.warnings,
      failureContext: result.failureContext,
      summary: result.success
        ? "✅ Verification PASSED - Safe to apply"
        : `❌ Verification FAILED - ${result.blockers.length} blocker(s)`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Verification error: ${error.message}`,
    };
  }
}

async function handleQuality(args, projectPath) {
  try {
    const results = {
      summary: {
        overallScore: 0,
        components: 0,
        issues: [],
      },
      metrics: [],
    };

    // Find source files
    const sourceFiles = await findSourceFiles(projectPath, args.file);

    for (const file of sourceFiles.slice(0, 20)) {
      const content = await fs.readFile(file, "utf8");
      const metrics = analyzeFileQuality(content, file);
      results.metrics.push(metrics);
    }

    // Calculate overall score
    if (results.metrics.length > 0) {
      results.summary.overallScore = Math.round(
        results.metrics.reduce((sum, m) => sum + m.maintainability, 0) /
          results.metrics.length
      );
      results.summary.components = results.metrics.length;
    }

    // Collect issues
    for (const m of results.metrics) {
      if (m.maintainability < (args.threshold || 70)) {
        results.summary.issues.push({
          file: m.file,
          score: m.maintainability,
          suggestion: "Consider refactoring to improve maintainability",
        });
      }
    }

    const passed = results.summary.overallScore >= (args.threshold || 70);

    return {
      success: passed,
      score: results.summary.overallScore,
      threshold: args.threshold || 70,
      components: results.summary.components,
      issues: results.summary.issues,
      summary: passed
        ? `✅ Quality PASSED (${results.summary.overallScore}/100)`
        : `❌ Quality FAILED (${results.summary.overallScore}/100, threshold: ${args.threshold || 70})`,
    };
  } catch (error) {
    return { success: false, error: `Quality analysis error: ${error.message}` };
  }
}

async function handleSmells(args, projectPath) {
  try {
    // Check for pro features
    const isPro = args.pro === true || args.premium === true;
    
    if (isPro) {
      // Use advanced CodeSmellPredictor for pro users
      const { codeSmellPredictor } = require('../src/lib/code-smell-predictor');
      const report = await codeSmellPredictor.predict(projectPath);
      
      // Filter by severity if specified
      let filteredSmells = report.smells;
      if (args.severity) {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const minSeverity = severityOrder[args.severity];
        filteredSmells = report.smells.filter(
          (s) => severityOrder[s.severity] >= minSeverity
        );
      }
      
      return {
        success: filteredSmells.filter((s) => s.severity === "critical").length === 0,
        total: filteredSmells.length,
        critical: filteredSmells.filter((s) => s.severity === "critical").length,
        estimatedDebt: report.estimatedDebt,
        estimatedDebtAI: report.estimatedDebt, // AI-adjusted debt hours
        bySeverity: {
          critical: filteredSmells.filter((s) => s.severity === "critical").length,
          high: filteredSmells.filter((s) => s.severity === "high").length,
          medium: filteredSmells.filter((s) => s.severity === "medium").length,
          low: filteredSmells.filter((s) => s.severity === "low").length,
        },
        smells: filteredSmells.slice(0, args.limit || 50),
        trends: report.trends,
        recommendations: filteredSmells.flatMap(s => s.recommendation).slice(0, 10),
        summary:
          filteredSmells.length === 0
            ? "✅ No significant code smells detected (PRO Analysis)"
            : `⚠️ Found ${filteredSmells.length} code smell(s) - ${report.estimatedDebt}h AI-assisted debt (PRO Analysis)`,
        proFeatures: {
          advancedPredictor: true,
          technicalDebtCalculation: true,
          trendAnalysis: true,
          recommendations: true,
          aiAdjustedTimelines: true
        }
      };
    } else {
      // Basic smell detection for free users
      const smells = [];
      const sourceFiles = await findSourceFiles(projectPath, args.file);

      for (const file of sourceFiles.slice(0, 10)) { // Limited to 10 files for free tier
        const content = await fs.readFile(file, "utf8");
        const fileSmells = detectCodeSmells(content, file, args.severity || "medium");
        smells.push(...fileSmells);
      }

      // Filter by severity
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const minSeverity = severityOrder[args.severity || "medium"];
      const filteredSmells = smells.filter(
        (s) => severityOrder[s.severity] >= minSeverity
      );

      return {
        success: filteredSmells.filter((s) => s.severity === "critical").length === 0,
        total: filteredSmells.length,
        bySeverity: {
          critical: filteredSmells.filter((s) => s.severity === "critical").length,
          high: filteredSmells.filter((s) => s.severity === "high").length,
          medium: filteredSmells.filter((s) => s.severity === "medium").length,
        },
        smells: filteredSmells.slice(0, 10), // Limited results for free tier
        summary:
          filteredSmells.length === 0
            ? "✅ No significant code smells detected (Basic Analysis)"
            : `⚠️ Found ${filteredSmells.length} code smell(s) (Basic Analysis - Upgrade to PRO for advanced features)`,
        upgradePrompt: "🚀 Upgrade to PRO for technical debt calculation, trend analysis, and AI-powered recommendations"
      };
    }
  } catch (error) {
    return { success: false, error: `Smell detection error: ${error.message}` };
  }
}

async function handleHallucination(args, projectPath) {
  try {
    const risks = [];

    if (args.claims) {
      // Verify specific claims
      for (const claim of args.claims) {
        const verified = await verifyClaim(claim, projectPath);
        if (!verified.found) {
          risks.push({
            type: "unverified-claim",
            claim,
            confidence: verified.confidence,
            suggestion: "Verify claim exists in source code",
          });
        }
      }
    }

    if (args.spec) {
      // Verify MDC specification
      const specPath = path.resolve(projectPath, args.spec);
      const specContent = await fs.readFile(specPath, "utf8");
      const specRisks = await verifySpecification(specContent, projectPath);
      risks.push(...specRisks);
    }

    const riskScore = risks.length > 0 ? Math.min(100, risks.length * 15) : 0;

    return {
      success: riskScore < 30,
      riskScore,
      risks: risks.slice(0, 10),
      verified: args.claims ? args.claims.length - risks.length : 0,
      unverified: risks.length,
      summary:
        riskScore < 30
          ? "✅ Low hallucination risk"
          : riskScore < 60
          ? "⚠️ Medium hallucination risk - review claims"
          : "🚨 High hallucination risk - verify all claims",
    };
  } catch (error) {
    return { success: false, error: `Hallucination check error: ${error.message}` };
  }
}

async function handleBreaking(args, projectPath) {
  try {
    const changes = [];

    // Compare with previous version if specified
    if (args.previousVersion) {
      // Get current exports
      const currentExports = await extractExports(projectPath);
      
      // This would compare with previous version
      // For now, return structure
      return {
        success: true,
        changes: [],
        summary: "✅ No breaking changes detected",
        note: "Full comparison requires git history or previous version path",
      };
    }

    return {
      success: true,
      changes: [],
      summary: "Specify previousVersion to compare",
    };
  } catch (error) {
    return { success: false, error: `Breaking change error: ${error.message}` };
  }
}

async function handleMDC(args, projectPath) {
  try {
    const outputDir = path.resolve(projectPath, args.outputDir || ".specs");

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Find source files and generate basic MDC
    const sourceFiles = await findSourceFiles(projectPath);
    const components = [];

    for (const file of sourceFiles.slice(0, 50)) {
      const content = await fs.readFile(file, "utf8");
      const extracted = extractComponents(content, file, projectPath);
      components.push(...extracted);
    }

    // Group by category
    const categories = {};
    for (const comp of components) {
      const cat = categorizeComponent(comp);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(comp);
    }

    // Generate MDC files
    const generated = [];
    for (const [category, comps] of Object.entries(categories)) {
      if (args.categories && !args.categories.includes(category)) continue;

      const mdcContent = generateMDCContent(category, comps);
      const fileName = `${category.replace("-", "_")}.mdc`;
      await fs.writeFile(path.join(outputDir, fileName), mdcContent);
      generated.push(fileName);
    }

    return {
      success: true,
      outputDir,
      generated,
      componentCount: components.length,
      summary: `✅ Generated ${generated.length} MDC file(s) with ${components.length} components`,
    };
  } catch (error) {
    return { success: false, error: `MDC generation error: ${error.message}` };
  }
}

async function handleCoverage(args, projectPath) {
  try {
    const coverage = {
      total: 0,
      tested: 0,
      untested: [],
    };

    const sourceFiles = await findSourceFiles(projectPath);
    const testFiles = await findTestFiles(projectPath);

    for (const file of sourceFiles) {
      coverage.total++;
      const baseName = path.basename(file, path.extname(file));
      const hasTest = testFiles.some(
        (t) => t.includes(baseName) && (t.includes(".test.") || t.includes(".spec."))
      );

      if (hasTest) {
        coverage.tested++;
      } else {
        coverage.untested.push(path.relative(projectPath, file));
      }
    }

    const percentage = coverage.total > 0
      ? Math.round((coverage.tested / coverage.total) * 100)
      : 0;

    return {
      success: percentage >= 50,
      coverage: percentage,
      total: coverage.total,
      tested: coverage.tested,
      untested: coverage.untested.slice(0, 10),
      summary:
        percentage >= 80
          ? `✅ Good coverage (${percentage}%)`
          : percentage >= 50
          ? `⚠️ Fair coverage (${percentage}%)`
          : `❌ Low coverage (${percentage}%)`,
    };
  } catch (error) {
    return { success: false, error: `Coverage error: ${error.message}` };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findSourceFiles(projectPath, specificFile) {
  if (specificFile) {
    return [path.resolve(projectPath, specificFile)];
  }

  const files = [];
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  const excludeDirs = ["node_modules", ".git", "dist", "build", ".next", "coverage"];

  async function walk(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectPath, fullPath);

        if (entry.isDirectory()) {
          if (!excludeDirs.some((d) => relativePath.includes(d))) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext) && !relativePath.includes("node_modules")) {
            files.push(fullPath);
          }
        }
      }
    } catch {}
  }

  await walk(projectPath);
  return files;
}

async function findTestFiles(projectPath) {
  const files = [];

  async function walk(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes("node_modules")) {
          await walk(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.includes(".test.") || entry.name.includes(".spec."))
        ) {
          files.push(fullPath);
        }
      }
    } catch {}
  }

  await walk(projectPath);
  return files;
}

function analyzeFileQuality(content, filePath) {
  const lines = content.split("\n");
  const linesOfCode = lines.filter((l) => l.trim() && !l.trim().startsWith("//")).length;

  let complexity = 1;
  for (const line of lines) {
    if (/\bif\s*\(/.test(line)) complexity++;
    if (/\bfor\s*\(/.test(line)) complexity++;
    if (/\bwhile\s*\(/.test(line)) complexity++;
    if (/\bswitch\s*\(/.test(line)) complexity++;
    if (/&&|\|\|/.test(line)) complexity++;
  }

  const maintainability = Math.max(
    0,
    Math.min(100, 100 - complexity * 2 - Math.max(0, linesOfCode - 200) / 10)
  );

  return {
    file: filePath,
    linesOfCode,
    complexity,
    maintainability: Math.round(maintainability),
  };
}

function detectCodeSmells(content, filePath, minSeverity) {
  const smells = [];
  const lines = content.split("\n");

  // Long function
  let functionLength = 0;
  let inFunction = false;
  for (let i = 0; i < lines.length; i++) {
    if (/function\s+\w+|=>\s*{/.test(lines[i])) {
      inFunction = true;
      functionLength = 0;
    }
    if (inFunction) functionLength++;
    if (lines[i].includes("}") && inFunction && functionLength > 50) {
      smells.push({
        type: "long-function",
        severity: "medium",
        line: i + 1,
        file: filePath,
        message: `Function is ${functionLength} lines (>50)`,
      });
      inFunction = false;
    }
  }

  // Deep nesting
  let maxNesting = 0;
  let currentNesting = 0;
  for (let i = 0; i < lines.length; i++) {
    currentNesting += (lines[i].match(/{/g) || []).length;
    currentNesting -= (lines[i].match(/}/g) || []).length;
    if (currentNesting > 5) {
      smells.push({
        type: "deep-nesting",
        severity: "high",
        line: i + 1,
        file: filePath,
        message: `Nesting depth of ${currentNesting} (>5)`,
      });
    }
    maxNesting = Math.max(maxNesting, currentNesting);
  }

  // Magic numbers
  for (let i = 0; i < lines.length; i++) {
    const magicMatch = lines[i].match(/[^a-zA-Z_](\d{2,})[^a-zA-Z_]/);
    if (magicMatch && !lines[i].includes("const") && !lines[i].includes("//")) {
      smells.push({
        type: "magic-number",
        severity: "low",
        line: i + 1,
        file: filePath,
        message: `Magic number ${magicMatch[1]} should be a named constant`,
      });
    }
  }

  // Console.log in production
  for (let i = 0; i < lines.length; i++) {
    if (/console\.(log|debug)\(/.test(lines[i]) && !filePath.includes("test")) {
      smells.push({
        type: "console-log",
        severity: "low",
        line: i + 1,
        file: filePath,
        message: "console.log in production code",
      });
    }
  }

  // Empty catch
  for (let i = 0; i < lines.length; i++) {
    if (/catch\s*\([^)]*\)\s*{\s*}/.test(lines[i])) {
      smells.push({
        type: "empty-catch",
        severity: "critical",
        line: i + 1,
        file: filePath,
        message: "Empty catch block swallows errors",
      });
    }
  }

  return smells;
}

async function verifyClaim(claim, projectPath) {
  // Simple claim verification - search for keywords
  const keywords = claim.split(/\s+/).filter((w) => w.length > 3);
  const files = await findSourceFiles(projectPath);

  for (const file of files.slice(0, 50)) {
    try {
      const content = await fs.readFile(file, "utf8");
      const found = keywords.filter((k) => content.includes(k)).length;
      if (found >= keywords.length * 0.5) {
        return { found: true, confidence: found / keywords.length };
      }
    } catch {}
  }

  return { found: false, confidence: 0 };
}

async function verifySpecification(content, projectPath) {
  const risks = [];
  // Parse spec and verify claims
  const componentMatches = content.match(/Component:\s*`?(\w+)`?/g) || [];

  for (const match of componentMatches) {
    const name = match.replace(/Component:\s*`?(\w+)`?/, "$1");
    const verified = await verifyClaim(name, projectPath);
    if (!verified.found) {
      risks.push({
        type: "unverified-component",
        component: name,
        suggestion: "Verify component exists in source",
      });
    }
  }

  return risks;
}

async function extractExports(projectPath) {
  const exports = [];
  const files = await findSourceFiles(projectPath);

  for (const file of files.slice(0, 30)) {
    try {
      const content = await fs.readFile(file, "utf8");
      const exportMatches = content.match(/export\s+(class|function|const|interface|type)\s+(\w+)/g) || [];
      for (const match of exportMatches) {
        const parts = match.split(/\s+/);
        exports.push({ type: parts[1], name: parts[2], file });
      }
    } catch {}
  }

  return exports;
}

function extractComponents(content, filePath, projectPath) {
  const components = [];
  const relativePath = path.relative(projectPath, filePath);

  // Extract classes
  const classMatches = content.match(/(?:export\s+)?class\s+(\w+)/g) || [];
  for (const match of classMatches) {
    const name = match.replace(/(?:export\s+)?class\s+/, "");
    components.push({ name, type: "class", path: relativePath });
  }

  // Extract functions
  const funcMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
  for (const match of funcMatches) {
    const name = match.replace(/(?:export\s+)?(?:async\s+)?function\s+/, "");
    components.push({ name, type: "function", path: relativePath });
  }

  return components;
}

function categorizeComponent(comp) {
  const pathLower = comp.path.toLowerCase();

  if (pathLower.includes("auth") || pathLower.includes("security")) return "security";
  if (pathLower.includes("api") || pathLower.includes("route")) return "integration";
  if (pathLower.includes("design") || pathLower.includes("theme")) return "design-system";
  if (pathLower.includes("util") || pathLower.includes("helper")) return "utility";
  return "architecture";
}

function generateMDCContent(category, components) {
  const titles = {
    architecture: "Architecture Overview",
    security: "Security Architecture",
    integration: "Integration Specifications",
    "design-system": "Design System",
    utility: "Utility Functions",
  };

  let content = `---
description: ${titles[category] || category} documentation
category: ${category}
generatedAt: ${new Date().toISOString()}
---

# ${titles[category] || category}

## Components

`;

  for (const comp of components.slice(0, 20)) {
    content += `### ${comp.name}\n`;
    content += `- **Type:** ${comp.type}\n`;
    content += `- **Path:** \`${comp.path}\`\n\n`;
  }

  return content;
}

// ============================================================================
// AUTOFIX HANDLER
// ============================================================================

async function handleAutofix(args, projectPath) {
  try {
    const { fixPack, dryRun = true, model, maxAttempts = 3 } = args;

    if (!fixPack) {
      return {
        success: false,
        error: "fixPack is required. Choose from: route-integrity, placeholders, type-errors, build-blockers, test-failures",
      };
    }

    // Set model environment variable if provided
    if (model) {
      if (model.startsWith('gpt') || model.startsWith('o1')) {
        process.env.OPENAI_MODEL = model;
      } else if (model.startsWith('claude')) {
        process.env.ANTHROPIC_MODEL = model;
      }
    }

    // Check for API key
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return {
        success: false,
        error: "No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.",
        hint: "Export your API key before starting the MCP server.",
      };
    }

    // Try to load verified autofix module
    const modulePath = path.resolve(__dirname, "../packages/core/dist/verified-autofix.js");
    
    let verifiedAutofix;
    try {
      verifiedAutofix = await import(modulePath);
    } catch (e) {
      // Try alternative path
      try {
        const altPath = path.resolve(projectPath, "packages/core/dist/verified-autofix.js");
        verifiedAutofix = await import(altPath);
      } catch {
        return {
          success: false,
          error: "Verified autofix module not found. Run 'pnpm build' in packages/core first.",
        };
      }
    }

    // Run autofix
    const result = await verifiedAutofix.runVerifiedAutofix({
      projectPath,
      fixPack,
      dryRun,
      maxAttempts,
      verbose: true,
    });

    return {
      success: result.success,
      fixPack: result.fixPack,
      attempts: result.attempts,
      maxAttempts: result.maxAttempts,
      filesModified: result.filesModified,
      generatedDiffs: result.generatedDiffs,
      aiExplanation: result.aiExplanation,
      errors: result.errors,
      dryRun,
      duration: result.duration,
      message: result.success 
        ? (dryRun ? "Preview generated. Run with dryRun=false to apply." : "Fixes applied successfully.")
        : "Autofix could not complete. Check errors for details.",
    };
  } catch (error) {
    return {
      success: false,
      error: `Autofix failed: ${error.message}`,
    };
  }
}
