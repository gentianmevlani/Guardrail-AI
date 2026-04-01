/**
 * Unused File Detection Module
 *
 * Enhanced false-positive prevention for framework-managed files.
 * Builds import graph from entrypoints and finds truly unreachable files.
 */

const fs = require("fs");
const path = require("path");
const { getAllCodeFiles, CONFIG } = require("./duplicates");

// =============================================================================
// FRAMEWORK DETECTION - Prevent False Positives
// =============================================================================

/**
 * Framework-specific file patterns that are auto-discovered (no imports needed)
 */
const FRAMEWORK_PATTERNS = {
  // Next.js App Router (files auto-discovered by framework)
  nextjsAppRouter: [
    // Root app files (page.tsx, layout.tsx at app/ level)
    /app\/page\.(tsx?|jsx?)$/,
    /app\/layout\.(tsx?|jsx?)$/,
    /app\/loading\.(tsx?|jsx?)$/,
    /app\/error\.(tsx?|jsx?)$/,
    /app\/not-found\.(tsx?|jsx?)$/,
    // Nested app files (in subdirectories including route groups like (dashboard))
    /app\/.*\/page\.(tsx?|jsx?)$/,
    /app\/.*\/layout\.(tsx?|jsx?)$/,
    /app\/.*\/route\.(tsx?|jsx?)$/,
    /app\/.*\/loading\.(tsx?|jsx?)$/,
    /app\/.*\/error\.(tsx?|jsx?)$/,
    /app\/.*\/not-found\.(tsx?|jsx?)$/,
    /app\/.*\/template\.(tsx?|jsx?)$/,
    /app\/.*\/default\.(tsx?|jsx?)$/,
    /app\/globals\.css$/,
    /app\/.*\/opengraph-image\.(tsx?|jsx?|png|jpg)$/,
    /app\/.*\/icon\.(tsx?|jsx?|png|ico)$/,
  ],

  // Next.js Pages Router
  nextjsPagesRouter: [
    /pages\/.*\.(tsx?|jsx?)$/,
    /pages\/_app\.(tsx?|jsx?)$/,
    /pages\/_document\.(tsx?|jsx?)$/,
    /pages\/api\/.*\.(tsx?|jsx?)$/,
  ],

  // Fastify/Express patterns (registered in server index)
  serverRoutes: [
    /routes\/[^/]+\.(ts|js)$/,
    /middleware\/[^/]+\.(ts|js)$/,
    /plugins\/[^/]+\.(ts|js)$/,
    /services\/[^/]+\.(ts|js)$/,
  ],

  // Package exports (typically barrel files)
  packageExports: [
    /^packages\/[^/]+\/src\/index\.(ts|js)$/,
    /^packages\/[^/]+\/src\/[^/]+\/index\.(ts|js)$/,
  ],
};

/**
 * Files that should NEVER be flagged as unused (always keep)
 */
const ALWAYS_KEEP_PATTERNS = [
  // Type definitions
  /\.d\.ts$/,
  // Config files
  /\.config\.(ts|js|mjs|cjs)$/,
  /tsconfig.*\.json$/,
  /package\.json$/,
  // Database
  /migrations?\//,
  /schema\.(ts|js|prisma)$/,
  /prisma\//,
  /drizzle\//,
  // Environment
  /\.env/,
  // Documentation
  /\.md$/,
  /\.ya?ml$/,
  // Docker
  /dockerfile/i,
  /docker-compose/i,
];

/**
 * Files that are typically imported dynamically or via barrel exports
 * These need review but are usually needed
 */
const REVIEW_PATTERNS = [
  // UI Components (often lazy loaded or barrel exported)
  /components\/ui\//,
  /components\/dashboard\//,
  /components\/landing\//,
  // Contexts (wrap app at root)
  /context\//,
  /contexts\//,
  /providers?\//,
  // Hooks (utility, may be used conditionally)
  /hooks\//,
  // Lib utilities
  /lib\//,
  /utils?\//,
  /helpers?\//,
];

function loadTsConfigPaths(projectPath) {
  const aliases = {};

  // Try multiple tsconfig locations
  const tsconfigPaths = [
    path.join(projectPath, "tsconfig.json"),
    path.join(projectPath, "apps", "web-ui", "tsconfig.json"),
    path.join(projectPath, "apps", "api", "tsconfig.json"),
  ];

  for (const tsconfigPath of tsconfigPaths) {
    try {
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
        const paths = tsconfig.compilerOptions?.paths || {};
        const baseUrl = tsconfig.compilerOptions?.baseUrl || ".";
        const tsconfigDir = path.dirname(tsconfigPath);

        for (const [alias, targets] of Object.entries(paths)) {
          const cleanAlias = alias.replace("/*", "");
          const cleanTarget = targets[0]?.replace("/*", "") || "";
          aliases[cleanAlias] = path.join(tsconfigDir, baseUrl, cleanTarget);
        }
      }
    } catch (err) {
      /* ignore */
    }
  }

  return aliases;
}

/**
 * Check if file matches any pattern in a list
 */
function matchesAnyPattern(filePath, patterns) {
  const normalized = filePath.replace(/\\/g, "/");
  return patterns.some((p) => p.test(normalized));
}

/**
 * Determine if a file is framework-managed (auto-discovered, no imports needed)
 */
function isFrameworkManagedFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");

  // Check all framework patterns
  for (const patterns of Object.values(FRAMEWORK_PATTERNS)) {
    if (matchesAnyPattern(normalized, patterns)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if a file should always be kept
 */
function isAlwaysKeepFile(relativePath) {
  return matchesAnyPattern(relativePath, ALWAYS_KEEP_PATTERNS);
}

/**
 * Determine if a file needs review (likely needed but verify)
 */
function isReviewFile(relativePath) {
  return matchesAnyPattern(relativePath, REVIEW_PATTERNS);
}

/**
 * Check if file is an entrypoint (explicitly imported or run directly)
 */
function isEntrypoint(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");

  const patterns = [
    // CLI and scripts (run directly)
    /^bin\//,
    /^scripts\//,
    /^src\/bin\//,

    // Server entrypoints
    /^(apps\/[^/]+\/src\/)?index\.(ts|js)$/,
    /^(apps\/[^/]+\/src\/)?start\.(ts|js)$/,
    /^(apps\/[^/]+\/src\/)?server\.(ts|js)$/,
    /^server\/index\.(ts|js)$/,
    /^(src\/)?index\.(ts|js)$/,

    // MCP server
    /^mcp-server\//,

    // Test setup
    /jest\.setup\.(ts|js)$/,
    /setupTests\.(ts|js)$/,
    /playwright\.config\./,
  ];

  // Also treat framework-managed files as entrypoints
  if (isFrameworkManagedFile(normalized)) {
    return true;
  }

  return patterns.some((p) => p.test(normalized));
}

/**
 * Check if file is a special file type (configs, types, etc.)
 */
function isSpecialFile(relativePath) {
  return isAlwaysKeepFile(relativePath) || isReviewFile(relativePath);
}

function isTestFile(relativePath) {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(relativePath) ||
    /^(__tests__|tests?|e2e)\//.test(relativePath) ||
    /\.stories\.(ts|tsx|js|jsx)$/.test(relativePath)
  );
}

function resolveFilePath(basePath) {
  const extensions = [
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    "/index.ts",
    "/index.tsx",
    "/index.js",
  ];
  for (const ext of extensions) {
    if (fs.existsSync(basePath + ext)) return basePath + ext;
  }
  return null;
}

function extractImports(content, filePath, projectPath, aliases) {
  const imports = [];
  const importRegex =
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](.*?)['"]/g;
  const requireRegex = /require\s*\(\s*['"](.*?)['"]\s*\)/g;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(line)) !== null) {
      imports.push({
        source: match[1],
        line: i + 1,
        ...resolveImport(match[1], filePath, projectPath, aliases),
      });
    }

    requireRegex.lastIndex = 0;
    while ((match = requireRegex.exec(line)) !== null) {
      imports.push({
        source: match[1],
        line: i + 1,
        ...resolveImport(match[1], filePath, projectPath, aliases),
      });
    }
  }
  return imports;
}

function resolveImport(source, fromFile, projectPath, aliases) {
  if (
    !source.startsWith(".") &&
    !source.startsWith("/") &&
    !source.startsWith("@/")
  ) {
    return { isExternal: true, resolved: null };
  }

  for (const [alias, target] of Object.entries(aliases)) {
    if (source === alias || source.startsWith(alias + "/")) {
      const resolved = resolveFilePath(
        path.join(target, source.slice(alias.length)),
      );
      if (resolved)
        return {
          isExternal: false,
          resolved: path.relative(projectPath, resolved),
        };
    }
  }

  const fromDir = path.dirname(fromFile);
  const resolved = resolveFilePath(path.join(fromDir, source));
  return resolved
    ? { isExternal: false, resolved: path.relative(projectPath, resolved) }
    : { isExternal: false, resolved: null };
}

function buildImportGraph(projectPath) {
  const graph = {
    nodes: new Map(),
    entrypoints: new Set(),
    aliases: loadTsConfigPaths(projectPath),
  };
  const files = getAllCodeFiles(projectPath);

  for (const file of files) {
    const relativePath = path.relative(projectPath, file);
    graph.nodes.set(relativePath, {
      imports: [],
      importedBy: [],
      isEntrypoint: isEntrypoint(relativePath),
      isSpecialFile: isSpecialFile(relativePath),
    });
    if (isEntrypoint(relativePath)) graph.entrypoints.add(relativePath);
  }

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      const imports = extractImports(content, file, projectPath, graph.aliases);
      const node = graph.nodes.get(relativePath);
      if (node) {
        node.imports = imports;
        for (const imp of imports) {
          const targetNode = graph.nodes.get(imp.resolved);
          if (targetNode) targetNode.importedBy.push(relativePath);
        }
      }
    } catch (err) {
      /* skip */
    }
  }
  return graph;
}

/**
 * Get detailed classification for why a file is considered unused
 */
function classifyUnusedFile(file, node, projectPath) {
  const normalized = file.replace(/\\/g, "/");

  // 1. Framework-managed files - NEVER flag as unused
  if (isFrameworkManagedFile(normalized)) {
    return {
      category: "framework",
      reason: "Framework-managed (auto-discovered)",
      importance: "critical",
      suggestion: "Keep - Next.js/Fastify auto-discovers this file",
      falsePositive: true,
    };
  }

  // 2. Always-keep files (configs, types, etc.) - NEVER flag
  if (isAlwaysKeepFile(normalized)) {
    return {
      category: "config",
      reason: "Configuration/type file",
      importance: "critical",
      suggestion: "Keep - required by build system",
      falsePositive: true,
    };
  }

  // 3. Review files (components, hooks, lib) - need verification
  if (isReviewFile(normalized)) {
    return {
      category: "review",
      reason: "Utility file (may be dynamically imported)",
      importance: "medium",
      suggestion: "Review - likely used via barrel exports or dynamic import",
      falsePositive: true,
    };
  }

  // 4. Test files
  if (isTestFile(file)) {
    return {
      category: "test",
      reason: "Test file",
      importance: "low",
      suggestion: "Verify test coverage is needed",
      falsePositive: false,
    };
  }

  // 5. Files only referenced by tests
  const testRefs = node.importedBy.filter((f) => isTestFile(f));
  if (testRefs.length > 0 && testRefs.length === node.importedBy.length) {
    return {
      category: "test",
      reason: "Only referenced by tests",
      importance: "low",
      suggestion: "Consider if tests are still relevant",
      falsePositive: false,
    };
  }

  // 6. Empty files - definitely safe to delete
  try {
    const fullPath = path.join(projectPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      return {
        category: "empty",
        reason: "Empty file (0 bytes)",
        importance: "none",
        suggestion: "Safe to delete - file is empty",
        falsePositive: false,
      };
    }
  } catch (err) {
    /* ignore */
  }

  // 7. Truly unused files with no imports
  if (node.importedBy.length === 0) {
    // Double-check it's not a known pattern we missed
    if (/\.(ts|tsx|js|jsx)$/.test(normalized)) {
      // Check for common false-positive directories
      if (
        /\/(components|hooks|lib|utils|context|services|helpers)\//.test(
          normalized,
        )
      ) {
        return {
          category: "review",
          reason: "No direct imports (may be barrel exported)",
          importance: "medium",
          suggestion: "Review - check if exported via index.ts",
          falsePositive: true,
        };
      }
    }

    return {
      category: "unused",
      reason: "No inbound imports found",
      importance: "low",
      suggestion: "Likely safe to delete after verification",
      falsePositive: false,
    };
  }

  // 8. Not reachable from entrypoints but has some imports
  return {
    category: "orphaned",
    reason: "Not reachable from entrypoints",
    importance: "medium",
    suggestion: "Review import chain - may be dead code",
    falsePositive: false,
  };
}

function findUnusedFiles(projectPath) {
  const graph = buildImportGraph(projectPath);
  const reachable = new Set();

  // BFS from all entrypoints to find reachable files
  const queue = [...graph.entrypoints];
  while (queue.length > 0) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    const node = graph.nodes.get(current);
    if (node) {
      for (const imp of node.imports) {
        if (imp.resolved && !reachable.has(imp.resolved))
          queue.push(imp.resolved);
      }
    }
  }

  // Categorize unreachable files with false-positive detection
  const unused = {
    definitelyUnused: [], // Safe to delete
    probablyUnused: [], // Needs review before deleting
    falsePositives: [], // Framework-managed, should NOT be deleted
    testOnly: [], // Test files
  };

  let falsePositiveCount = 0;
  let trueUnusedCount = 0;

  for (const [file, node] of graph.nodes) {
    if (reachable.has(file)) continue;

    const classification = classifyUnusedFile(file, node, projectPath);
    const fileInfo = {
      file,
      category: classification.category,
      reason: classification.reason,
      importance: classification.importance,
      suggestion: classification.suggestion,
      importedBy: node.importedBy,
      falsePositive: classification.falsePositive,
    };

    // Sort into appropriate bucket
    if (classification.falsePositive) {
      unused.falsePositives.push(fileInfo);
      falsePositiveCount++;
    } else if (
      classification.category === "empty" ||
      classification.category === "unused"
    ) {
      unused.definitelyUnused.push(fileInfo);
      trueUnusedCount++;
    } else if (classification.category === "test") {
      unused.testOnly.push(fileInfo);
    } else {
      unused.probablyUnused.push(fileInfo);
      trueUnusedCount++;
    }
  }

  return {
    unused,
    stats: {
      totalFiles: graph.nodes.size,
      entrypoints: graph.entrypoints.size,
      reachable: reachable.size,
      unreachable: graph.nodes.size - reachable.size,
      falsePositives: falsePositiveCount,
      trueUnused: trueUnusedCount,
    },
  };
}

module.exports = {
  findUnusedFiles,
  buildImportGraph,
  isEntrypoint,
  isSpecialFile,
  isTestFile,
  isFrameworkManagedFile,
  isAlwaysKeepFile,
  isReviewFile,
  FRAMEWORK_PATTERNS,
  ALWAYS_KEEP_PATTERNS,
  REVIEW_PATTERNS,
};
