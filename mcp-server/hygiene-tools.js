/**
 * MCP Tool Interface for Repo Hygiene + Debt Radar
 *
 * Provides composable MCP methods for:
 * - repo.hygiene.scan - Full hygiene scan
 * - repo.hygiene.duplicates - Duplicate detection
 * - repo.hygiene.unused - Unused file analysis
 * - repo.hygiene.errors - Error collection
 * - repo.hygiene.rootCleanup - Root directory cleanup
 */

const fs = require("fs");
const path = require("path");
const {
  findDuplicates,
  findUnusedFiles,
  collectAllErrors,
  analyzeRootDirectory,
  generateHygieneReport,
  calculateHygieneScore,
  generateRootCleanupPlan,
} = require("../scripts/hygiene");

/**
 * Full hygiene scan
 */
async function hygieneFullScan({
  projectPath = ".",
  mode = "report",
  saveArtifacts = true,
}) {
  const resolvedPath = path.resolve(projectPath);

  const results = {
    projectPath: resolvedPath,
    mode,
    timestamp: new Date().toISOString(),
    duplicates: findDuplicates(resolvedPath),
    unused: findUnusedFiles(resolvedPath),
    errors: collectAllErrors(resolvedPath),
    rootCleanup: analyzeRootDirectory(resolvedPath),
  };

  results.score = calculateHygieneScore(results);

  if (saveArtifacts) {
    const reportDir = path.join(resolvedPath, ".guardrail");
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    fs.writeFileSync(
      path.join(reportDir, "hygiene-report.md"),
      generateHygieneReport(results),
    );
    fs.writeFileSync(
      path.join(reportDir, "duplicates.json"),
      JSON.stringify(results.duplicates, null, 2),
    );
    fs.writeFileSync(
      path.join(reportDir, "unused-files.json"),
      JSON.stringify(results.unused, null, 2),
    );
    fs.writeFileSync(
      path.join(reportDir, "errors.json"),
      JSON.stringify(results.errors, null, 2),
    );
    fs.writeFileSync(
      path.join(reportDir, "root-cleanup-plan.md"),
      generateRootCleanupPlan(results.rootCleanup),
    );
    fs.writeFileSync(
      path.join(reportDir, "hygiene-score.json"),
      JSON.stringify(results.score, null, 2),
    );
  }

  return {
    success: true,
    score: results.score,
    summary: {
      duplicates: {
        exact: results.duplicates.exact.length,
        near: results.duplicates.near.length,
        copyPaste: results.duplicates.copyPaste.length,
      },
      unused: {
        definitelyUnused: results.unused.unused.definitelyUnused.length,
        probablyUnused: results.unused.unused.probablyUnused.length,
        special: results.unused.unused.special.length,
      },
      errors: results.errors.summary,
      rootCleanup: {
        junkFiles: results.rootCleanup.junkFiles.length,
        missingStandards: results.rootCleanup.missingStandards.length,
      },
    },
    artifacts: saveArtifacts
      ? [
          ".guardrail/hygiene-report.md",
          ".guardrail/duplicates.json",
          ".guardrail/unused-files.json",
          ".guardrail/errors.json",
          ".guardrail/root-cleanup-plan.md",
          ".guardrail/hygiene-score.json",
        ]
      : [],
  };
}

/**
 * Duplicate detection only
 */
async function hygieneDuplicates({ projectPath = ".", threshold = 0.85 }) {
  const resolvedPath = path.resolve(projectPath);
  const duplicates = findDuplicates(resolvedPath);

  return {
    success: true,
    exact: duplicates.exact,
    near: duplicates.near,
    copyPaste: duplicates.copyPaste,
    summary: {
      exactCount: duplicates.exact.length,
      nearCount: duplicates.near.length,
      copyPasteCount: duplicates.copyPaste.length,
      totalWastedBytes: duplicates.exact.reduce(
        (sum, g) => sum + g.totalWastedBytes,
        0,
      ),
    },
  };
}

/**
 * Unused file analysis only
 */
async function hygieneUnused({ projectPath = ".", scope = "all" }) {
  const resolvedPath = path.resolve(projectPath);
  const result = findUnusedFiles(resolvedPath);

  let filtered = result.unused;
  if (scope === "prod") {
    filtered = {
      definitelyUnused: result.unused.definitelyUnused,
      probablyUnused: result.unused.probablyUnused,
      special: [],
      testOnly: [],
    };
  } else if (scope === "test") {
    filtered = {
      definitelyUnused: [],
      probablyUnused: [],
      special: [],
      testOnly: result.unused.testOnly,
    };
  }

  return {
    success: true,
    unused: filtered,
    stats: result.stats,
    safeToDelete: filtered.definitelyUnused.map((f) => f.file),
    reviewFirst: filtered.probablyUnused.map((f) => f.file),
  };
}

/**
 * Error collection only
 */
async function hygieneErrors({
  projectPath = ".",
  eslint = true,
  tsc = true,
  imports = true,
  syntax = true,
}) {
  const resolvedPath = path.resolve(projectPath);
  const result = collectAllErrors(resolvedPath);

  // Filter based on options
  const filtered = {
    typescript: tsc ? result.typescript : [],
    eslint: eslint ? result.eslint : [],
    syntax: syntax ? result.syntax : [],
    imports: imports ? result.imports : [],
  };

  const allFiltered = [
    ...filtered.typescript,
    ...filtered.eslint,
    ...filtered.syntax,
    ...filtered.imports,
  ];

  return {
    success: true,
    errors: filtered,
    summary: {
      total: allFiltered.length,
      byCategory: {
        typescript: filtered.typescript.length,
        eslint: filtered.eslint.length,
        syntax: filtered.syntax.length,
        imports: filtered.imports.length,
      },
      bySeverity: {
        error: allFiltered.filter((e) => e.severity === "error").length,
        warning: allFiltered.filter((e) => e.severity === "warning").length,
      },
      autoFixable: allFiltered.filter((e) => e.fixable).length,
    },
    topOffenders: result.topOffenders,
  };
}

/**
 * Root cleanup analysis only
 */
async function hygieneRootCleanup({ projectPath = ".", ruleset = "default" }) {
  const resolvedPath = path.resolve(projectPath);
  const result = analyzeRootDirectory(resolvedPath);

  return {
    success: true,
    junkFiles: result.junkFiles,
    missingStandards: result.missingStandards,
    duplicateConfigs: result.duplicateConfigs,
    misplacedFiles: result.misplacedFiles,
    suggestions: result.suggestions,
    cleanupPlan: generateRootCleanupPlan(result),
  };
}

/**
 * Get deletion plan (safe files to delete)
 */
async function hygieneDeletionPlan({
  projectPath = ".",
  includeReview = false,
}) {
  const resolvedPath = path.resolve(projectPath);

  const duplicates = findDuplicates(resolvedPath);
  const unused = findUnusedFiles(resolvedPath);

  const safeToDelete = [];
  const reviewFirst = [];

  // Add duplicate files (keep first, delete rest)
  for (const group of duplicates.exact) {
    const [keep, ...remove] = group.files;
    safeToDelete.push(
      ...remove.map((f) => ({
        file: f.path,
        reason: `Exact duplicate of ${keep.path}`,
        category: "duplicate",
      })),
    );
  }

  // Add definitely unused
  safeToDelete.push(
    ...unused.unused.definitelyUnused.map((f) => ({
      file: f.file,
      reason: f.reason,
      category: "unused",
    })),
  );

  // Add probably unused to review
  reviewFirst.push(
    ...unused.unused.probablyUnused.map((f) => ({
      file: f.file,
      reason: f.reason,
      category: "unused",
    })),
  );

  return {
    success: true,
    safeToDelete,
    reviewFirst: includeReview ? reviewFirst : [],
    summary: {
      safeCount: safeToDelete.length,
      reviewCount: reviewFirst.length,
    },
  };
}

// MCP Tool Definitions
const hygieneTools = [
  {
    name: "repo_hygiene_scan",
    description:
      "Run a full repository hygiene scan including duplicates, unused files, errors, and root cleanup. Generates comprehensive reports.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        mode: {
          type: "string",
          enum: ["report", "safe-fix", "hard-fix"],
          default: "report",
        },
        saveArtifacts: {
          type: "boolean",
          description: "Save reports to .guardrail/",
          default: true,
        },
      },
    },
    handler: hygieneFullScan,
  },
  {
    name: "repo_hygiene_duplicates",
    description:
      "Find duplicate files: exact duplicates (same hash), near-duplicates (85%+ similar), and copy-pasted code blocks.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        threshold: {
          type: "number",
          description: "Similarity threshold for near-duplicates",
          default: 0.85,
        },
      },
    },
    handler: hygieneDuplicates,
  },
  {
    name: "repo_hygiene_unused",
    description:
      "Find unused files by building an import graph from entrypoints. Classifies files by deletion safety.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        scope: {
          type: "string",
          enum: ["all", "prod", "test"],
          description: "Filter scope",
          default: "all",
        },
      },
    },
    handler: hygieneUnused,
  },
  {
    name: "repo_hygiene_errors",
    description:
      "Collect all lint, type, import, and syntax errors in a unified format. CI-friendly with counts and top offenders.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        eslint: {
          type: "boolean",
          description: "Include ESLint errors",
          default: true,
        },
        tsc: {
          type: "boolean",
          description: "Include TypeScript errors",
          default: true,
        },
        imports: {
          type: "boolean",
          description: "Include import resolution errors",
          default: true,
        },
        syntax: {
          type: "boolean",
          description: "Include syntax errors",
          default: true,
        },
      },
    },
    handler: hygieneErrors,
  },
  {
    name: "repo_hygiene_root_cleanup",
    description:
      "Analyze root directory for junk files, missing standards, duplicate configs, and misplaced files.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        ruleset: {
          type: "string",
          description: "Cleanup ruleset to use",
          default: "default",
        },
      },
    },
    handler: hygieneRootCleanup,
  },
  {
    name: "repo_hygiene_deletion_plan",
    description:
      "Generate a safe deletion plan for duplicate and unused files. Never deletes automatically.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", default: "." },
        includeReview: {
          type: "boolean",
          description: "Include files that need review",
          default: false,
        },
      },
    },
    handler: hygieneDeletionPlan,
  },
];

module.exports = {
  hygieneTools,
  hygieneFullScan,
  hygieneDuplicates,
  hygieneUnused,
  hygieneErrors,
  hygieneRootCleanup,
  hygieneDeletionPlan,
};
