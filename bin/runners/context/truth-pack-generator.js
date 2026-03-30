/**
 * Truth Pack Generator - Standardized JSON Output
 *
 * Generates 10 core JSON files that form the "Truth Pack" -
 * the canonical representation of repo truth for AI consumption.
 *
 * Output Location: .guardrail-context/
 *
 * Files Generated:
 * 1. truthpack.json      - Stack + metadata
 * 2. symbols.json        - Every symbol with file:line
 * 3. deps.json           - Exact deps + versions
 * 4. graph.json          - Import graph / blast radius
 * 5. routes.json         - Real API endpoints with proof
 * 6. risk.json           - Auth/payments/db/security tags
 * 7. importance.json     - Risk × centrality
 * 8. patterns.json       - Golden patterns extracted from repo
 * 9. antipatterns.json   - Code smells/security footguns
 * 10. vulnerabilities.json - Dependency CVEs
 *
 * @module truth-pack-generator
 */

const fs = require("fs");
const path = require("path");
const { analyzeProject, findFilesRecursive } = require("./analyzer");
const { detectPatterns, detectAntiPatterns } = require("./patterns");
const { buildDependencyGraph } = require("./dependency-graph");
const { extractAPIContracts } = require("./api-contracts");
const { scanProject } = require("./security-scanner");

// ANSI colors for output
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

/**
 * Generate all Truth Pack files
 * @param {string} projectPath - Path to project root
 * @param {object} options - Generation options
 * @returns {Promise<object>} - Generation results
 */
async function generateTruthPack(projectPath, options = {}) {
  const startTime = Date.now();
  const outputDir = path.join(projectPath, ".guardrail-context");

  console.log(`\n${c.cyan}▸ Truth Pack Generator${c.reset}`);
  console.log(`${c.dim}Building canonical repo representation...${c.reset}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = {
    success: false,
    files: [],
    errors: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      projectPath,
      version: "1.0.0",
    }
  };

  try {
    // 1. Generate truthpack.json (stack + metadata)
    console.log(`${c.dim}[1/10]${c.reset} Analyzing project stack...`);
    const truthpack = await generateTruthPackJson(projectPath);
    writeJson(outputDir, "truthpack.json", truthpack);
    results.files.push("truthpack.json");
    console.log(`${c.green}✓${c.reset} truthpack.json`);

    // 2. Generate symbols.json (every symbol with file:line)
    console.log(`${c.dim}[2/10]${c.reset} Extracting symbols...`);
    const symbols = await generateSymbolsJson(projectPath);
    writeJson(outputDir, "symbols.json", symbols);
    results.files.push("symbols.json");
    console.log(`${c.green}✓${c.reset} symbols.json ${c.dim}(${symbols.symbols.length} symbols)${c.reset}`);

    // 3. Generate deps.json (exact deps + versions)
    console.log(`${c.dim}[3/10]${c.reset} Analyzing dependencies...`);
    const deps = await generateDepsJson(projectPath);
    writeJson(outputDir, "deps.json", deps);
    results.files.push("deps.json");
    console.log(`${c.green}✓${c.reset} deps.json ${c.dim}(${deps.dependencies.length} packages)${c.reset}`);

    // 4. Generate graph.json (import graph / blast radius)
    console.log(`${c.dim}[4/10]${c.reset} Building dependency graph...`);
    const graph = await generateGraphJson(projectPath);
    writeJson(outputDir, "graph.json", graph);
    results.files.push("graph.json");
    console.log(`${c.green}✓${c.reset} graph.json ${c.dim}(${Object.keys(graph.nodes).length} nodes)${c.reset}`);

    // 5. Generate routes.json (real API endpoints with proof)
    console.log(`${c.dim}[5/10]${c.reset} Extracting API routes...`);
    const routes = await generateRoutesJson(projectPath);
    writeJson(outputDir, "routes.json", routes);
    results.files.push("routes.json");
    console.log(`${c.green}✓${c.reset} routes.json ${c.dim}(${routes.routes.length} endpoints)${c.reset}`);

    // 6. Generate risk.json (auth/payments/db/security tags)
    console.log(`${c.dim}[6/10]${c.reset} Identifying risk areas...`);
    const risk = await generateRiskJson(projectPath, { symbols, routes });
    writeJson(outputDir, "risk.json", risk);
    results.files.push("risk.json");
    console.log(`${c.green}✓${c.reset} risk.json ${c.dim}(${risk.highRiskFiles.length} risky files)${c.reset}`);

    // 7. Generate importance.json (risk × centrality)
    console.log(`${c.dim}[7/10]${c.reset} Calculating importance scores...`);
    const importance = await generateImportanceJson(projectPath, { graph, risk });
    writeJson(outputDir, "importance.json", importance);
    results.files.push("importance.json");
    console.log(`${c.green}✓${c.reset} importance.json ${c.dim}(${importance.files.length} files ranked)${c.reset}`);

    // 8. Generate patterns.json (golden patterns)
    console.log(`${c.dim}[8/10]${c.reset} Extracting patterns...`);
    const patterns = await generatePatternsJson(projectPath);
    writeJson(outputDir, "patterns.json", patterns);
    results.files.push("patterns.json");
    console.log(`${c.green}✓${c.reset} patterns.json ${c.dim}(${patterns.patterns.length} patterns)${c.reset}`);

    // 9. Generate antipatterns.json (code smells)
    console.log(`${c.dim}[9/10]${c.reset} Detecting antipatterns...`);
    const antipatterns = await generateAntipatternsJson(projectPath);
    writeJson(outputDir, "antipatterns.json", antipatterns);
    results.files.push("antipatterns.json");
    console.log(`${c.green}✓${c.reset} antipatterns.json ${c.dim}(${antipatterns.antipatterns.length} issues)${c.reset}`);

    // 10. Generate vulnerabilities.json (dependency CVEs)
    console.log(`${c.dim}[10/10]${c.reset} Scanning vulnerabilities...`);
    const vulnerabilities = await generateVulnerabilitiesJson(projectPath);
    writeJson(outputDir, "vulnerabilities.json", vulnerabilities);
    results.files.push("vulnerabilities.json");
    console.log(`${c.green}✓${c.reset} vulnerabilities.json ${c.dim}(${vulnerabilities.vulnerabilities.length} CVEs)${c.reset}`);

    // Write metadata file
    results.success = true;
    results.metadata.duration = Date.now() - startTime;
    results.metadata.stats = {
      symbols: symbols.symbols.length,
      dependencies: deps.dependencies.length,
      routes: routes.routes.length,
      patterns: patterns.patterns.length,
      antipatterns: antipatterns.antipatterns.length,
      vulnerabilities: vulnerabilities.vulnerabilities.length,
    };

    writeJson(outputDir, ".metadata.json", results.metadata);

    console.log(`\n${c.green}✓ Truth Pack generated successfully${c.reset}`);
    console.log(`${c.dim}Location: ${outputDir}${c.reset}`);
    console.log(`${c.dim}Duration: ${results.metadata.duration}ms${c.reset}\n`);

    return results;

  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
    console.error(`\n${c.red}✗ Truth Pack generation failed:${c.reset} ${error.message}\n`);
    throw error;
  }
}

/**
 * 1. Generate truthpack.json - Stack + metadata
 */
async function generateTruthPackJson(projectPath) {
  const analysis = await analyzeProject(projectPath);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    project: {
      path: projectPath,
      name: path.basename(projectPath),
    },
    stack: {
      languages: analysis.languages || [],
      frameworks: analysis.frameworks || [],
      runtime: analysis.runtime || {},
      database: analysis.database || [],
      stateManagement: analysis.stateManagement || [],
      uiLibrary: analysis.uiLibrary || [],
      buildTool: analysis.buildTool || "",
      packageManager: analysis.packageManager || "",
    },
    structure: {
      type: analysis.projectType || "unknown",
      isMonorepo: analysis.isMonorepo || false,
      workspaces: analysis.workspaces || [],
      entryPoints: analysis.entryPoints || [],
    },
    metadata: {
      totalFiles: analysis.totalFiles || 0,
      linesOfCode: analysis.linesOfCode || 0,
      hasTests: analysis.hasTests || false,
      hasCI: analysis.hasCI || false,
      hasDocs: analysis.hasDocs || false,
    }
  };
}

/**
 * 2. Generate symbols.json - Every symbol with file:line
 */
async function generateSymbolsJson(projectPath) {
  const parser = require("@babel/parser");
  const traverse = require("@babel/traverse").default;
  const babel = require("@babel/core");

  const symbols = [];
  const files = findFilesRecursive(projectPath, [".js", ".ts", ".jsx", ".tsx"]);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const ast = parser.parse(content, {
        sourceType: "module",
        plugins: ["jsx", "typescript", "decorators-legacy"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          if (path.node.id) {
            symbols.push({
              name: path.node.id.name,
              type: "function",
              file: file.replace(projectPath, "").replace(/^\//, ""),
              line: path.node.loc?.start.line || 0,
              exported: isExported(path),
            });
          }
        },
        ClassDeclaration(path) {
          if (path.node.id) {
            symbols.push({
              name: path.node.id.name,
              type: "class",
              file: file.replace(projectPath, "").replace(/^\//, ""),
              line: path.node.loc?.start.line || 0,
              exported: isExported(path),
            });
          }
        },
        VariableDeclarator(path) {
          if (path.node.id.name && path.node.init &&
              (path.node.init.type === "ArrowFunctionExpression" ||
               path.node.init.type === "FunctionExpression")) {
            symbols.push({
              name: path.node.id.name,
              type: "function",
              file: file.replace(projectPath, "").replace(/^\//, ""),
              line: path.node.loc?.start.line || 0,
              exported: isExported(path.parentPath),
            });
          } else if (path.node.id.name) {
            symbols.push({
              name: path.node.id.name,
              type: "variable",
              file: file.replace(projectPath, "").replace(/^\//, ""),
              line: path.node.loc?.start.line || 0,
              exported: isExported(path.parentPath),
            });
          }
        },
      });
    } catch (e) {
      // Skip files that can't be parsed
    }
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    symbolCount: symbols.length,
    symbols: symbols.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function isExported(path) {
  let current = path;
  while (current) {
    if (current.node.type === "ExportNamedDeclaration" ||
        current.node.type === "ExportDefaultDeclaration") {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

/**
 * 3. Generate deps.json - Exact deps + versions
 */
async function generateDepsJson(projectPath) {
  const dependencies = [];

  // Read package.json
  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
      ...pkg.optionalDependencies,
    };

    for (const [name, version] of Object.entries(allDeps)) {
      let category = "production";
      if (pkg.devDependencies?.[name]) category = "development";
      if (pkg.peerDependencies?.[name]) category = "peer";
      if (pkg.optionalDependencies?.[name]) category = "optional";

      dependencies.push({
        name,
        version: version.replace(/^[\^~]/, ""), // Remove ^ or ~
        versionRange: version,
        category,
      });
    }
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    dependencyCount: dependencies.length,
    dependencies: dependencies.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * 4. Generate graph.json - Import graph / blast radius
 */
async function generateGraphJson(projectPath) {
  const depGraph = await buildDependencyGraph(projectPath);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    nodes: depGraph.nodes || {},
    edges: depGraph.edges || [],
    metrics: {
      totalNodes: Object.keys(depGraph.nodes || {}).length,
      totalEdges: (depGraph.edges || []).length,
      maxDepth: depGraph.maxDepth || 0,
    }
  };
}

/**
 * 5. Generate routes.json - Real API endpoints with proof
 */
async function generateRoutesJson(projectPath) {
  const contracts = await extractAPIContracts(projectPath);

  const routes = [];
  if (contracts && contracts.routes) {
    for (const route of contracts.routes) {
      routes.push({
        method: route.method || "GET",
        path: route.path || route.route,
        file: route.file,
        line: route.line || 0,
        handler: route.handler || "",
        auth: route.auth || false,
        params: route.params || [],
        responses: route.responses || [],
      });
    }
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/**
 * 6. Generate risk.json - Auth/payments/db/security tags
 */
async function generateRiskJson(projectPath, context) {
  const riskFiles = [];
  const files = findFilesRecursive(projectPath, [".js", ".ts", ".jsx", ".tsx"]);

  const riskKeywords = {
    auth: ["password", "authenticate", "login", "jwt", "token", "session"],
    payment: ["stripe", "payment", "charge", "subscription", "invoice"],
    database: ["query", "execute", "raw", "sql", "prisma", "mongoose"],
    security: ["secret", "key", "credential", "hash", "encrypt"],
  };

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8").toLowerCase();
    const relativePath = file.replace(projectPath, "").replace(/^\//, "");
    const tags = [];
    let riskScore = 0;

    for (const [category, keywords] of Object.entries(riskKeywords)) {
      if (keywords.some(kw => content.includes(kw))) {
        tags.push(category);
        riskScore += 1;
      }
    }

    if (tags.length > 0) {
      riskFiles.push({
        file: relativePath,
        tags,
        riskScore,
      });
    }
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    highRiskFiles: riskFiles.sort((a, b) => b.riskScore - a.riskScore),
    riskCategories: Object.keys(riskKeywords),
  };
}

/**
 * 7. Generate importance.json - Risk × centrality
 */
async function generateImportanceJson(projectPath, context) {
  const { graph, risk } = context;
  const files = [];

  // Calculate centrality from graph
  const centrality = {};
  for (const [node, data] of Object.entries(graph.nodes || {})) {
    const inDegree = (graph.edges || []).filter(e => e.target === node).length;
    const outDegree = (graph.edges || []).filter(e => e.source === node).length;
    centrality[node] = inDegree + outDegree;
  }

  // Combine with risk
  const riskMap = {};
  for (const file of risk.highRiskFiles) {
    riskMap[file.file] = file.riskScore;
  }

  for (const file of Object.keys(graph.nodes || {})) {
    const riskScore = riskMap[file] || 0;
    const centralityScore = centrality[file] || 0;
    const importance = riskScore * 10 + centralityScore;

    if (importance > 0) {
      files.push({
        file,
        importance,
        riskScore,
        centralityScore,
      });
    }
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    files: files.sort((a, b) => b.importance - a.importance),
  };
}

/**
 * 8. Generate patterns.json - Golden patterns
 */
async function generatePatternsJson(projectPath) {
  const patterns = await detectPatterns(projectPath);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    patternCount: patterns.length,
    patterns: patterns.map(p => ({
      name: p.name,
      description: p.description,
      example: p.example,
      files: p.files || [],
      category: p.category || "general",
    })),
  };
}

/**
 * 9. Generate antipatterns.json - Code smells
 */
async function generateAntipatternsJson(projectPath) {
  const antipatterns = await detectAntiPatterns(projectPath);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    antipatternCount: antipatterns.length,
    antipatterns: antipatterns.map(a => ({
      name: a.name,
      severity: a.severity || "medium",
      description: a.description,
      file: a.file,
      line: a.line || 0,
      suggestion: a.suggestion || "",
    })),
  };
}

/**
 * 10. Generate vulnerabilities.json - Dependency CVEs
 */
async function generateVulnerabilitiesJson(projectPath) {
  const scan = await scanProject(projectPath);

  const vulnerabilities = [];
  if (scan && scan.vulnerabilities) {
    for (const vuln of scan.vulnerabilities) {
      vulnerabilities.push({
        cve: vuln.cve || vuln.id,
        severity: vuln.severity || "unknown",
        package: vuln.package || vuln.name,
        version: vuln.version || "",
        title: vuln.title || vuln.description || "",
        url: vuln.url || "",
        fixAvailable: vuln.fixAvailable || false,
        fixedIn: vuln.fixedIn || "",
      });
    }
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    vulnerabilityCount: vulnerabilities.length,
    vulnerabilities: vulnerabilities.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    }),
  };
}

/**
 * Helper: Write JSON file with pretty formatting
 */
function writeJson(dir, filename, data) {
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Check if Truth Pack is fresh (generated within last 24 hours)
 */
function isTruthPackFresh(projectPath) {
  const metadataPath = path.join(projectPath, ".guardrail-context", ".metadata.json");
  if (!fs.existsSync(metadataPath)) {
    return false;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    const generatedAt = new Date(metadata.generatedAt);
    const age = Date.now() - generatedAt.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return age < oneDayMs;
  } catch (e) {
    return false;
  }
}

/**
 * Get Truth Pack stats
 */
function getTruthPackStats(projectPath) {
  const metadataPath = path.join(projectPath, ".guardrail-context", ".metadata.json");
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  } catch (e) {
    return null;
  }
}

module.exports = {
  generateTruthPack,
  isTruthPackFresh,
  getTruthPackStats,
};
