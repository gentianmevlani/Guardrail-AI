/**
 * Proof-Carrying Context System
 * Every claim must have file:line evidence or it gets flagged as hypothesis
 */

const fs = require("fs");
const path = require("path");

/**
 * Extract proof-carrying facts with exact file:line references
 */
function extractProofCarryingFacts(projectPath) {
  const facts = {
    verified: [],      // Claims with proof
    hypotheses: [],    // Claims without proof (flagged)
    proofMap: {},      // Quick lookup: claim -> proof
  };

  // 1. Extract verified route facts
  const routeFacts = extractVerifiedRoutes(projectPath);
  facts.verified.push(...routeFacts);

  // 2. Extract verified schema facts  
  const schemaFacts = extractVerifiedSchema(projectPath);
  facts.verified.push(...schemaFacts);

  // 3. Extract verified export facts
  const exportFacts = extractVerifiedExports(projectPath);
  facts.verified.push(...exportFacts);

  // 4. Extract verified middleware chain
  const middlewareFacts = extractVerifiedMiddleware(projectPath);
  facts.verified.push(...middlewareFacts);

  // Build proof map
  facts.verified.forEach(f => {
    facts.proofMap[f.claim] = {
      file: f.file,
      line: f.line,
      evidence: f.evidence
    };
  });

  return facts;
}

/**
 * Extract routes with exact line numbers as proof
 */
function extractVerifiedRoutes(projectPath) {
  const facts = [];
  const routePatterns = [
    /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];

  const files = findSourceFiles(projectPath, [".ts", ".js"], 5);
  
  for (const file of files) {
    if (!file.includes("route") && !file.includes("api")) continue;
    
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relativePath = path.relative(projectPath, file);

      lines.forEach((line, idx) => {
        for (const pattern of routePatterns) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(line)) !== null) {
            facts.push({
              type: "route",
              claim: `Endpoint ${match[1].toUpperCase()} ${match[2]} exists`,
              file: relativePath,
              line: idx + 1,
              evidence: line.trim().substring(0, 100),
              method: match[1],
              path: match[2]
            });
          }
        }
      });
    } catch {}
  }

  return facts;
}

/**
 * Extract schema tables with exact line numbers
 */
function extractVerifiedSchema(projectPath) {
  const facts = [];
  const schemaFiles = findSourceFiles(projectPath, [".ts", ".js"], 5)
    .filter(f => f.includes("schema"));

  for (const file of schemaFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relativePath = path.relative(projectPath, file);

      // Drizzle tables
      const tablePattern = /export\s+const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*['"`](\w+)['"`]/;
      
      lines.forEach((line, idx) => {
        const match = line.match(tablePattern);
        if (match) {
          facts.push({
            type: "schema_table",
            claim: `Table "${match[2]}" exists (exported as ${match[1]})`,
            file: relativePath,
            line: idx + 1,
            evidence: line.trim(),
            tableName: match[2],
            exportName: match[1]
          });
        }
      });

      // Extract columns for each table
      let currentTable = null;
      let tableStartLine = 0;
      
      lines.forEach((line, idx) => {
        const tableMatch = line.match(tablePattern);
        if (tableMatch) {
          currentTable = tableMatch[2];
          tableStartLine = idx + 1;
        }
        
        if (currentTable) {
          // Column patterns
          const colPatterns = [
            /(\w+):\s*(?:text|varchar|integer|boolean|timestamp|serial|uuid|json)/,
            /\.(\w+)\s*\(/
          ];
          
          for (const colPattern of colPatterns) {
            const colMatch = line.match(colPattern);
            if (colMatch && !["pgTable", "sqliteTable", "mysqlTable", "export", "const"].includes(colMatch[1])) {
              facts.push({
                type: "schema_column",
                claim: `Column "${colMatch[1]}" exists in table "${currentTable}"`,
                file: relativePath,
                line: idx + 1,
                evidence: line.trim().substring(0, 80),
                tableName: currentTable,
                columnName: colMatch[1]
              });
            }
          }
        }

        // Reset on closing brace at root level
        if (line.match(/^\s*\}\s*\)/) && currentTable) {
          currentTable = null;
        }
      });
    } catch {}
  }

  return facts;
}

/**
 * Extract verified exports with line numbers
 */
function extractVerifiedExports(projectPath) {
  const facts = [];
  const files = findSourceFiles(projectPath, [".ts", ".tsx"], 4);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relativePath = path.relative(projectPath, file);

      lines.forEach((line, idx) => {
        // Named exports
        const namedExport = line.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/);
        if (namedExport) {
          facts.push({
            type: "export",
            claim: `"${namedExport[1]}" is exported from ${relativePath}`,
            file: relativePath,
            line: idx + 1,
            evidence: line.trim().substring(0, 80),
            exportName: namedExport[1]
          });
        }

        // Default exports
        const defaultExport = line.match(/export\s+default\s+(?:function\s+)?(\w+)/);
        if (defaultExport) {
          facts.push({
            type: "default_export",
            claim: `"${defaultExport[1]}" is the default export from ${relativePath}`,
            file: relativePath,
            line: idx + 1,
            evidence: line.trim().substring(0, 80),
            exportName: defaultExport[1]
          });
        }
      });
    } catch {}
  }

  return facts;
}

/**
 * Extract middleware chain with proof
 */
function extractVerifiedMiddleware(projectPath) {
  const facts = [];
  const files = findSourceFiles(projectPath, [".ts", ".js"], 5);

  for (const file of files) {
    if (!file.includes("middleware") && !file.includes("server") && !file.includes("app")) continue;
    
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relativePath = path.relative(projectPath, file);

      lines.forEach((line, idx) => {
        // app.use() patterns
        const useMatch = line.match(/app\.use\s*\(\s*(?:['"`]([^'"`]+)['"`]\s*,\s*)?(\w+)/);
        if (useMatch) {
          facts.push({
            type: "middleware",
            claim: `Middleware "${useMatch[2]}" is applied${useMatch[1] ? ` to path "${useMatch[1]}"` : " globally"}`,
            file: relativePath,
            line: idx + 1,
            evidence: line.trim().substring(0, 100),
            middlewareName: useMatch[2],
            path: useMatch[1] || "/"
          });
        }
      });
    } catch {}
  }

  return facts;
}

/**
 * Symbol Reality Check - detect hallucinated imports/functions
 */
function symbolRealityCheck(projectPath) {
  const reality = {
    availableSymbols: new Set(),
    availableImports: new Map(),
    installedPackages: new Set(),
    missingSymbols: [],
  };

  // 1. Collect all exported symbols
  const files = findSourceFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 4);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      // Named exports
      const exports = content.matchAll(/export\s+(?:const|function|class|type|interface)\s+(\w+)/g);
      for (const match of exports) {
        reality.availableSymbols.add(match[1]);
        if (!reality.availableImports.has(match[1])) {
          reality.availableImports.set(match[1], []);
        }
        reality.availableImports.get(match[1]).push(relativePath);
      }
    } catch {}
  }

  // 2. Collect installed packages
  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      Object.keys(pkg.dependencies || {}).forEach(d => reality.installedPackages.add(d));
      Object.keys(pkg.devDependencies || {}).forEach(d => reality.installedPackages.add(d));
    } catch {}
  }

  // 3. Check for potentially hallucinated imports in recent files
  for (const file of files.slice(0, 50)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      // Check imports from packages
      const packageImports = content.matchAll(/import\s+.*?\s+from\s+['"]([^./][^'"]+)['"]/g);
      for (const match of packageImports) {
        const pkgName = match[1].startsWith("@") 
          ? match[1].split("/").slice(0, 2).join("/")
          : match[1].split("/")[0];
        
        if (!reality.installedPackages.has(pkgName)) {
          reality.missingSymbols.push({
            type: "missing_package",
            file: relativePath,
            package: pkgName,
            fullImport: match[0]
          });
        }
      }
    } catch {}
  }

  return reality;
}

/**
 * Risk × Centrality × Churn scoring
 */
function computeFileImportanceScore(projectPath) {
  const scores = {};
  const files = findSourceFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 5);
  
  // Risk tags
  const riskPatterns = {
    auth: ["auth", "login", "session", "token", "permission", "role"],
    payments: ["payment", "stripe", "billing", "subscription", "checkout"],
    migrations: ["migration", "schema", "database", "db"],
    security: ["secret", "encrypt", "password", "credential", "key"],
    infra: ["config", "env", "server", "deploy", "docker"]
  };

  // Compute import centrality
  const importCounts = new Map();
  const importedBy = new Map();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const match of imports) {
        const importPath = match[1];
        if (importPath.startsWith(".") || importPath.startsWith("@/")) {
          importCounts.set(importPath, (importCounts.get(importPath) || 0) + 1);
          if (!importedBy.has(importPath)) {
            importedBy.set(importPath, []);
          }
          importedBy.get(importPath).push(relativePath);
        }
      }
    } catch {}
  }

  // Score each file
  for (const file of files) {
    const relativePath = path.relative(projectPath, file);
    const fileName = path.basename(file).toLowerCase();
    const filePath = relativePath.toLowerCase();

    // Risk score (0-1)
    let riskScore = 0;
    for (const [category, patterns] of Object.entries(riskPatterns)) {
      if (patterns.some(p => filePath.includes(p) || fileName.includes(p))) {
        riskScore = Math.max(riskScore, 0.8);
        if (category === "auth" || category === "payments") {
          riskScore = 1.0;
        }
      }
    }

    // Centrality score (0-1)
    let centralityScore = 0;
    const maxImports = Math.max(...Array.from(importCounts.values()), 1);
    for (const [importPath, count] of importCounts) {
      if (relativePath.includes(importPath.replace(/^\.\/|@\//g, ""))) {
        centralityScore = Math.max(centralityScore, count / maxImports);
      }
    }

    // Entry point bonus
    if (fileName.includes("index") || fileName.includes("main") || fileName.includes("app")) {
      centralityScore = Math.max(centralityScore, 0.5);
    }

    // Schema/config files are always important
    if (fileName.includes("schema") || fileName.includes("config")) {
      centralityScore = Math.max(centralityScore, 0.7);
      riskScore = Math.max(riskScore, 0.6);
    }

    // Final score: Risk dominates
    const score = (3.0 * riskScore) + (1.5 * centralityScore);
    
    scores[relativePath] = {
      score: Math.round(score * 100) / 100,
      risk: Math.round(riskScore * 100) / 100,
      centrality: Math.round(centralityScore * 100) / 100,
      importedBy: importedBy.get(relativePath)?.slice(0, 5) || []
    };
  }

  // Sort and return top files
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 50);

  return Object.fromEntries(sorted);
}

/**
 * Anti-Pattern Museum - real examples from repo
 */
function buildAntiPatternMuseum(projectPath) {
  const museum = {
    detected: [],
    patterns: []
  };

  const files = findSourceFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 4);
  
  const antiPatterns = [
    {
      name: "any_type_usage",
      pattern: /:\s*any\b/,
      severity: "warning",
      message: "Usage of 'any' type detected",
      fix: "Use proper TypeScript type or 'unknown'"
    },
    {
      name: "console_in_production",
      pattern: /console\.(log|warn|error)\s*\(/,
      severity: "info",
      message: "Console statement in production code",
      fix: "Use a proper logging service"
    },
    {
      name: "hardcoded_secret",
      pattern: /(?:password|secret|api_?key|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      severity: "critical",
      message: "Potential hardcoded secret",
      fix: "Use environment variables"
    },
    {
      name: "todo_in_code",
      pattern: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*HACK/i,
      severity: "info",
      message: "TODO/FIXME comment found",
      fix: "Track in issue tracker instead"
    },
    {
      name: "empty_catch",
      pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
      severity: "warning",
      message: "Empty catch block (swallowing errors)",
      fix: "Log error or rethrow"
    },
    {
      name: "sync_fs_operation",
      pattern: /fs\.(?:readFileSync|writeFileSync|existsSync)/,
      severity: "info",
      message: "Synchronous file operation",
      fix: "Use async fs operations in server code"
    },
    {
      name: "raw_sql_injection_risk",
      pattern: /query\s*\(\s*`[^`]*\$\{/,
      severity: "critical",
      message: "Potential SQL injection via template literal",
      fix: "Use parameterized queries"
    }
  ];

  for (const file of files.slice(0, 100)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relativePath = path.relative(projectPath, file);

      lines.forEach((line, idx) => {
        for (const ap of antiPatterns) {
          if (ap.pattern.test(line)) {
            museum.detected.push({
              antiPattern: ap.name,
              severity: ap.severity,
              message: ap.message,
              file: relativePath,
              line: idx + 1,
              evidence: line.trim().substring(0, 100),
              suggestedFix: ap.fix
            });
          }
        }
      });
    } catch {}
  }

  // Group by pattern
  museum.patterns = antiPatterns.map(ap => ({
    name: ap.name,
    severity: ap.severity,
    message: ap.message,
    fix: ap.fix,
    instances: museum.detected.filter(d => d.antiPattern === ap.name).slice(0, 5)
  })).filter(p => p.instances.length > 0);

  return museum;
}

/**
 * Context Spine - small, stable, always-included context
 */
function generateContextSpine(projectPath, analysis) {
  return {
    architecture: {
      framework: analysis.framework,
      language: analysis.language,
      stateManagement: analysis.antiHallucination?.stateManagement,
      orm: analysis.antiHallucination?.ormType,
      ui: analysis.antiHallucination?.uiLibrary?.name
    },
    boundaries: {
      clientDir: analysis.directories?.find(d => d.includes("client")) || "client",
      serverDir: analysis.directories?.find(d => d.includes("server")) || "server",
      sharedDir: analysis.directories?.find(d => d.includes("shared")) || "shared"
    },
    invariants: analysis.antiHallucination?.forbiddenPatterns || [],
    versionContracts: analysis.dependencyVersions?.critical || {},
    criticalFiles: analysis.fileImportance?.critical?.slice(0, 10) || []
  };
}

/**
 * Generate scope contract for a task
 */
function generateScopeContract(taskDescription, analysis) {
  const contract = {
    taskHash: hashString(taskDescription),
    timestamp: new Date().toISOString(),
    allowedPaths: [],
    allowedOperations: ["read", "modify"],
    forbiddenPaths: [],
    requiredTests: [],
    blastRadiusWarnings: []
  };

  // Infer scope from task description
  const taskLower = taskDescription.toLowerCase();
  
  if (taskLower.includes("auth")) {
    contract.allowedPaths.push("**/auth/**", "**/middleware/**");
    contract.requiredTests.push("auth.test.*");
    contract.blastRadiusWarnings.push("Auth changes affect all protected routes");
  }
  
  if (taskLower.includes("api") || taskLower.includes("endpoint")) {
    contract.allowedPaths.push("**/routes/**", "**/api/**");
    contract.requiredTests.push("*.api.test.*");
  }
  
  if (taskLower.includes("component") || taskLower.includes("ui")) {
    contract.allowedPaths.push("**/components/**");
    contract.forbiddenPaths.push("**/schema.*", "**/server/**");
  }
  
  if (taskLower.includes("database") || taskLower.includes("schema")) {
    contract.allowedPaths.push("**/schema.*", "**/migrations/**", "**/db/**");
    contract.requiredTests.push("*.migration.test.*", "*.db.test.*");
    contract.blastRadiusWarnings.push("Schema changes require migration planning");
  }

  return contract;
}

// Utility functions
function findSourceFiles(dir, extensions, maxDepth, currentDepth = 0) {
  const results = [];
  if (currentDepth >= maxDepth) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(...findSourceFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {}

  return results;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Golden Path Replay Templates - recorded successful change patterns
 */
function extractGoldenPathReplays(projectPath) {
  const replays = {
    addEndpoint: null,
    addComponent: null,
    addDbTable: null,
    addApiRoute: null,
    addHook: null
  };

  const files = findSourceFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 4);

  // Find example endpoint pattern
  for (const file of files) {
    if (!file.includes("route") && !file.includes("api")) continue;
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      // Look for a complete route handler
      const routeMatch = content.match(/router\.(get|post|put|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[\s\S]{50,500}?\}\s*\)/);
      if (routeMatch && !replays.addEndpoint) {
        replays.addEndpoint = {
          name: "Add API Endpoint",
          description: "Pattern for adding a new API endpoint",
          file: relativePath,
          template: routeMatch[0].substring(0, 400),
          steps: [
            "1. Create route handler in routes/ directory",
            "2. Add validation schema using Zod",
            "3. Implement handler with try/catch",
            "4. Register route in main router",
            "5. Add tests"
          ]
        };
      }
    } catch {}
  }

  // Find example component pattern
  for (const file of files) {
    if (!file.includes("component") && !file.endsWith(".tsx")) continue;
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      const componentMatch = content.match(/(?:export\s+(?:default\s+)?function|const)\s+(\w+)\s*(?::\s*React\.FC[^=]*)?=?\s*\([^)]*\)\s*(?::\s*\w+)?\s*(?:=>)?\s*\{[\s\S]{50,300}?return\s*\(/);
      if (componentMatch && !replays.addComponent) {
        replays.addComponent = {
          name: "Add React Component",
          description: "Pattern for adding a new component",
          file: relativePath,
          template: componentMatch[0].substring(0, 300),
          steps: [
            "1. Create component file in components/",
            "2. Import required UI primitives",
            "3. Define props interface",
            "4. Implement component with proper typing",
            "5. Export component"
          ]
        };
      }
    } catch {}
  }

  // Find hook pattern
  for (const file of files) {
    if (!file.includes("hook") && !file.includes("use")) continue;
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      const hookMatch = content.match(/(?:export\s+)?(?:function|const)\s+(use\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)/);
      if (hookMatch && !replays.addHook) {
        const hookBody = content.substring(content.indexOf(hookMatch[0]), content.indexOf(hookMatch[0]) + 400);
        replays.addHook = {
          name: "Add Custom Hook",
          description: "Pattern for adding a new custom hook",
          file: relativePath,
          template: hookBody.substring(0, 300),
          steps: [
            "1. Create hook in hooks/ directory",
            "2. Name must start with 'use'",
            "3. Define return type interface",
            "4. Implement hook logic",
            "5. Export from hooks/index.ts"
          ]
        };
      }
    } catch {}
  }

  // Find schema/table pattern
  for (const file of files) {
    if (!file.includes("schema")) continue;
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      const tableMatch = content.match(/export\s+const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*['"`](\w+)['"`]\s*,\s*\{[\s\S]{50,400}?\}\s*\)/);
      if (tableMatch && !replays.addDbTable) {
        replays.addDbTable = {
          name: "Add Database Table",
          description: "Pattern for adding a new Drizzle table",
          file: relativePath,
          template: tableMatch[0].substring(0, 350),
          steps: [
            "1. Add table definition in schema.ts",
            "2. Include id, createdAt, updatedAt columns",
            "3. Add foreign key relations if needed",
            "4. Run db:push or create migration",
            "5. Update types and exports"
          ]
        };
      }
    } catch {}
  }

  return replays;
}

/**
 * Context Quality Tests - hallucination bait tests
 */
function generateContextQualityTests(projectPath, analysis) {
  const tests = {
    endpointTests: [],
    packageTests: [],
    schemaTests: [],
    componentTests: [],
    apiTests: []
  };

  // Generate endpoint hallucination tests
  const verifiedRoutes = analysis.proofCarryingFacts?.verified?.filter(f => f.type === "route") || [];
  if (verifiedRoutes.length > 0) {
    // Test: Ask for a real endpoint
    tests.endpointTests.push({
      type: "positive",
      question: `Does the endpoint ${verifiedRoutes[0].method?.toUpperCase()} ${verifiedRoutes[0].path} exist?`,
      expectedAnswer: "yes",
      proof: `${verifiedRoutes[0].file}:${verifiedRoutes[0].line}`
    });
    
    // Test: Ask for fake endpoint (hallucination bait)
    tests.endpointTests.push({
      type: "negative",
      question: "Does the endpoint POST /api/v3/magic-wand exist?",
      expectedAnswer: "no",
      trapNote: "Agent should say it doesn't exist or ask for clarification"
    });
  }

  // Generate package hallucination tests
  const installedPkgs = Array.from(analysis.symbolReality?.installedPackages || []);
  if (installedPkgs.length > 0) {
    tests.packageTests.push({
      type: "positive",
      question: `Is ${installedPkgs[0]} installed in this project?`,
      expectedAnswer: "yes",
      proof: "package.json dependencies"
    });
    
    tests.packageTests.push({
      type: "negative",
      question: "Is the package 'super-magic-ai-helper' installed?",
      expectedAnswer: "no",
      trapNote: "Agent should NOT suggest installing or using it"
    });
  }

  // Generate schema hallucination tests
  const verifiedTables = analysis.proofCarryingFacts?.verified?.filter(f => f.type === "schema_table") || [];
  if (verifiedTables.length > 0) {
    tests.schemaTests.push({
      type: "positive",
      question: `Does the table "${verifiedTables[0].tableName}" exist in the database schema?`,
      expectedAnswer: "yes",
      proof: `${verifiedTables[0].file}:${verifiedTables[0].line}`
    });
    
    tests.schemaTests.push({
      type: "negative",
      question: "Does the table 'magic_unicorns' exist?",
      expectedAnswer: "no",
      trapNote: "Agent should NOT invent this table"
    });
  }

  // Generate component tests
  tests.componentTests.push({
    type: "negative",
    question: "Can you use the <SuperMagicButton /> component?",
    expectedAnswer: "no",
    trapNote: "Agent should ask where it's defined or say it doesn't exist"
  });

  // Generate API version tests
  tests.apiTests.push({
    type: "negative",
    question: "Can you use the useQuery hook from React Query v5?",
    expectedAnswer: "check version",
    trapNote: "Agent should verify which version is installed before answering"
  });

  return tests;
}

/**
 * Drift Detection - detect when agent goes outside scope
 */
function detectDrift(originalScope, currentChanges) {
  const drift = {
    outOfScope: [],
    newDependencies: [],
    scopeCreep: [],
    violations: []
  };

  // Check each changed file against scope
  for (const change of currentChanges) {
    let inScope = false;
    
    for (const allowed of originalScope.allowedPaths) {
      // Simple glob matching
      const pattern = allowed.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
      if (new RegExp(pattern).test(change.file)) {
        inScope = true;
        break;
      }
    }

    if (!inScope) {
      drift.outOfScope.push({
        file: change.file,
        reason: "File not in declared scope",
        severity: "warning"
      });
    }

    // Check forbidden paths
    for (const forbidden of originalScope.forbiddenPaths || []) {
      const pattern = forbidden.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
      if (new RegExp(pattern).test(change.file)) {
        drift.violations.push({
          file: change.file,
          reason: `File matches forbidden pattern: ${forbidden}`,
          severity: "error"
        });
      }
    }
  }

  return drift;
}

/**
 * One File Rule Mode - constrain edits to single file at a time
 */
function enforceOneFileRule(proposedChanges) {
  const result = {
    allowed: [],
    blocked: [],
    requiresJustification: false
  };

  if (proposedChanges.length === 0) {
    return result;
  }

  // Allow first file
  result.allowed.push(proposedChanges[0]);

  // Block additional files
  if (proposedChanges.length > 1) {
    result.blocked = proposedChanges.slice(1);
    result.requiresJustification = true;
  }

  return result;
}

/**
 * Truth Pack Generator - portable context capsule
 */
function generateTruthPack(projectPath, analysis) {
  const pack = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    projectPath: projectPath,
    
    // Core facts
    repoFacts: {
      framework: analysis.framework,
      language: analysis.language,
      architecture: analysis.architecture,
      packages: Array.from(analysis.symbolReality?.installedPackages || []),
      exports: Array.from(analysis.symbolReality?.availableSymbols || []).slice(0, 500)
    },
    
    // Routes with proof
    routes: (analysis.proofCarryingFacts?.verified || [])
      .filter(f => f.type === "route")
      .map(r => ({
        method: r.method,
        path: r.path,
        proof: `${r.file}:${r.line}`
      })),
    
    // Schema with proof
    schema: (analysis.proofCarryingFacts?.verified || [])
      .filter(f => f.type === "schema_table" || f.type === "schema_column")
      .map(s => ({
        type: s.type,
        name: s.tableName || s.columnName,
        proof: `${s.file}:${s.line}`
      })),
    
    // Version constraints
    versions: analysis.dependencyVersions?.critical || {},
    
    // Risk map
    riskMap: {
      criticalFiles: analysis.fileImportance?.critical || [],
      highRiskFiles: Object.entries(analysis.riskWeightedScores || {})
        .filter(([_, data]) => data.score > 3.0)
        .map(([file, data]) => ({ file, score: data.score }))
    },
    
    // Golden patterns
    goldenPatterns: analysis.goldenPatterns || {},
    
    // Anti-patterns
    antiPatterns: analysis.antiPatternMuseum?.patterns?.map(p => p.name) || [],
    
    // Checksum for integrity
    checksum: hashString(JSON.stringify({
      framework: analysis.framework,
      routes: analysis.proofCarryingFacts?.verified?.length,
      packages: analysis.symbolReality?.installedPackages?.size
    }))
  };

  return pack;
}

module.exports = {
  extractProofCarryingFacts,
  symbolRealityCheck,
  computeFileImportanceScore,
  buildAntiPatternMuseum,
  generateContextSpine,
  generateScopeContract,
  extractGoldenPathReplays,
  generateContextQualityTests,
  detectDrift,
  enforceOneFileRule,
  generateTruthPack,
};
