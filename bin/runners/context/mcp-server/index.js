#!/usr/bin/env node
/**
 * guardrail Context Engine - MCP Server
 * 
 * A repo-installed Context OS that exposes verified repo facts + patterns + constraints
 * as tool calls, so Cursor/Windsurf/Copilot can't "invent reality".
 * 
 * Commands:
 *   index  - Build truth pack (symbols/graphs/patterns)
 *   serve  - Start MCP tool server
 *   verify - Run verification gates
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

// MCP Protocol version
const MCP_VERSION = "2024-11-05";

class ContextEngine {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.truthPack = null;
    this.indexed = false;
  }

  /**
   * Index the project and build the truth pack
   */
  async index() {
    console.log("📦 Building truth pack...");
    
    const startTime = Date.now();
    
    this.truthPack = {
      version: "1.0.0",
      indexedAt: new Date().toISOString(),
      projectPath: this.projectPath,
      
      // Symbol index
      symbols: this.buildSymbolIndex(),
      
      // Route map
      routes: this.buildRouteMap(),
      
      // Component graph
      components: this.buildComponentGraph(),
      
      // Dependency versions
      versions: this.buildVersionTruth(),
      
      // Security/auth map
      security: this.buildSecurityMap(),
      
      // Test obligations
      tests: this.buildTestObligations(),
      
      // Golden patterns
      patterns: this.buildGoldenPatterns(),
      
      // File importance/risk
      riskMap: this.buildRiskMap(),
    };

    // Save truth pack
    const guardrailDir = path.join(this.projectPath, ".guardrail");
    if (!fs.existsSync(guardrailDir)) {
      fs.mkdirSync(guardrailDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(guardrailDir, "truth-pack.json"),
      JSON.stringify(this.truthPack, null, 2)
    );

    this.indexed = true;
    const duration = Date.now() - startTime;
    
    console.log(`✅ Truth pack built in ${duration}ms`);
    console.log(`   Symbols: ${Object.keys(this.truthPack.symbols.exports).length}`);
    console.log(`   Routes: ${this.truthPack.routes.endpoints.length}`);
    console.log(`   Packages: ${Object.keys(this.truthPack.versions.installed).length}`);
    
    return this.truthPack;
  }

  /**
   * Build symbol index (what exists in the codebase)
   */
  buildSymbolIndex() {
    const symbols = {
      exports: {},      // name -> { file, line, type }
      imports: {},      // package -> [files using it]
      functions: [],    // all function names
      components: [],   // React components
      types: [],        // TypeScript types/interfaces
      hooks: [],        // Custom hooks
    };

    const files = this.findSourceFiles([".ts", ".tsx", ".js", ".jsx"]);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        const relativePath = path.relative(this.projectPath, file);

        lines.forEach((line, idx) => {
          // Exported functions/consts
          const exportMatch = line.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/);
          if (exportMatch) {
            symbols.exports[exportMatch[1]] = {
              file: relativePath,
              line: idx + 1,
              type: line.includes("function") ? "function" : 
                    line.includes("class") ? "class" :
                    line.includes("type") ? "type" :
                    line.includes("interface") ? "interface" : "const"
            };
            
            if (exportMatch[1].startsWith("use")) {
              symbols.hooks.push(exportMatch[1]);
            }
            if (/^[A-Z]/.test(exportMatch[1]) && file.endsWith(".tsx")) {
              symbols.components.push(exportMatch[1]);
            }
          }

          // Imports from packages
          const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^./][^'"]+)['"]/);
          if (importMatch) {
            const pkg = importMatch[1].startsWith("@") 
              ? importMatch[1].split("/").slice(0, 2).join("/")
              : importMatch[1].split("/")[0];
            
            if (!symbols.imports[pkg]) {
              symbols.imports[pkg] = [];
            }
            if (!symbols.imports[pkg].includes(relativePath)) {
              symbols.imports[pkg].push(relativePath);
            }
          }
        });
      } catch {}
    }

    return symbols;
  }

  /**
   * Build route map (API endpoints)
   */
  buildRouteMap() {
    const routes = {
      endpoints: [],
      files: [],
    };

    const routePatterns = [
      /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ];

    const files = this.findSourceFiles([".ts", ".js"]);
    
    for (const file of files) {
      if (!file.includes("route") && !file.includes("api")) continue;
      
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        const relativePath = path.relative(this.projectPath, file);
        let hasRoutes = false;

        lines.forEach((line, idx) => {
          for (const pattern of routePatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(line)) !== null) {
              routes.endpoints.push({
                method: match[1].toUpperCase(),
                path: match[2],
                file: relativePath,
                line: idx + 1
              });
              hasRoutes = true;
            }
          }
        });

        if (hasRoutes) {
          routes.files.push(relativePath);
        }
      } catch {}
    }

    return routes;
  }

  /**
   * Build component graph
   */
  buildComponentGraph() {
    const graph = {
      components: {},
      importedBy: {},
    };

    const files = this.findSourceFiles([".tsx"]);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const relativePath = path.relative(this.projectPath, file);

        // Find component definitions
        const componentMatch = content.match(/(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w+)/);
        if (componentMatch) {
          const name = componentMatch[1];
          graph.components[name] = {
            file: relativePath,
            imports: [],
          };

          // Find what this component imports
          const imports = content.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g);
          for (const imp of imports) {
            const names = imp[1].split(",").map(n => n.trim());
            graph.components[name].imports.push(...names);
            
            // Track reverse dependency
            for (const importedName of names) {
              if (!graph.importedBy[importedName]) {
                graph.importedBy[importedName] = [];
              }
              graph.importedBy[importedName].push(name);
            }
          }
        }
      } catch {}
    }

    return graph;
  }

  /**
   * Build version truth (installed packages)
   */
  buildVersionTruth() {
    const versions = {
      installed: {},
      devDependencies: {},
      peerDependencies: {},
    };

    // Check multiple possible package.json locations
    const pkgPaths = [
      path.join(this.projectPath, "package.json"),
      path.join(this.projectPath, "client", "package.json"),
      path.join(this.projectPath, "server", "package.json"),
    ];

    for (const pkgPath of pkgPaths) {
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          Object.assign(versions.installed, pkg.dependencies || {});
          Object.assign(versions.devDependencies, pkg.devDependencies || {});
          Object.assign(versions.peerDependencies, pkg.peerDependencies || {});
        } catch {}
      }
    }

    return versions;
  }

  /**
   * Build security/auth map
   */
  buildSecurityMap() {
    const security = {
      authFiles: [],
      middlewareFiles: [],
      protectedRoutes: [],
      envSecrets: [],
    };

    const files = this.findSourceFiles([".ts", ".js"]);
    
    for (const file of files) {
      const relativePath = path.relative(this.projectPath, file);
      const lowerPath = relativePath.toLowerCase();

      if (lowerPath.includes("auth") || lowerPath.includes("login") || lowerPath.includes("session")) {
        security.authFiles.push(relativePath);
      }
      if (lowerPath.includes("middleware")) {
        security.middlewareFiles.push(relativePath);
      }

      try {
        const content = fs.readFileSync(file, "utf-8");
        
        // Check for protected route patterns
        if (content.includes("requireAuth") || content.includes("isAuthenticated") || content.includes("protect")) {
          security.protectedRoutes.push(relativePath);
        }
      } catch {}
    }

    // Check for secret env vars
    const envFiles = [".env", ".env.local", ".env.example"];
    for (const envFile of envFiles) {
      const envPath = path.join(this.projectPath, envFile);
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, "utf-8");
          const secretPatterns = /^(.*(?:SECRET|KEY|TOKEN|PASSWORD|API_KEY).*)=/gim;
          let match;
          while ((match = secretPatterns.exec(content)) !== null) {
            security.envSecrets.push(match[1].split("=")[0]);
          }
        } catch {}
      }
    }

    return security;
  }

  /**
   * Build test obligations
   */
  buildTestObligations() {
    const tests = {
      framework: null,
      testFiles: [],
      setupFiles: [],
      coverageRequired: [],
    };

    // Detect test framework
    const versions = this.truthPack?.versions?.installed || {};
    if (versions["vitest"]) tests.framework = "vitest";
    else if (versions["jest"]) tests.framework = "jest";
    else if (versions["mocha"]) tests.framework = "mocha";

    // Find test files
    const files = this.findSourceFiles([".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.js", ".spec.js"]);
    tests.testFiles = files.map(f => path.relative(this.projectPath, f));

    // Find setup files
    const setupPatterns = ["setup", "setupTests", "test-setup", "vitest.setup", "jest.setup"];
    const allFiles = this.findSourceFiles([".ts", ".js"]);
    for (const file of allFiles) {
      const basename = path.basename(file, path.extname(file));
      if (setupPatterns.some(p => basename.includes(p))) {
        tests.setupFiles.push(path.relative(this.projectPath, file));
      }
    }

    return tests;
  }

  /**
   * Build golden patterns
   */
  buildGoldenPatterns() {
    const patterns = {};
    const files = this.findSourceFiles([".ts", ".tsx", ".js", ".jsx"]);

    // Find API route pattern
    for (const file of files) {
      if (!file.includes("route")) continue;
      try {
        const content = fs.readFileSync(file, "utf-8");
        const match = content.match(/router\.(get|post|put|delete)\s*\([^)]+\)\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[\s\S]{50,400}?\}/);
        if (match && !patterns["api-route"]) {
          patterns["api-route"] = {
            file: path.relative(this.projectPath, file),
            code: match[0].substring(0, 300),
            description: "Standard API route handler pattern"
          };
        }
      } catch {}
    }

    // Find component pattern
    for (const file of files) {
      if (!file.endsWith(".tsx")) continue;
      try {
        const content = fs.readFileSync(file, "utf-8");
        const match = content.match(/export\s+(?:default\s+)?function\s+([A-Z]\w+)[^{]*\{[\s\S]{50,300}?return\s*\(/);
        if (match && !patterns["component"]) {
          patterns["component"] = {
            file: path.relative(this.projectPath, file),
            code: match[0].substring(0, 250),
            description: "Standard React component pattern"
          };
        }
      } catch {}
    }

    // Find hook pattern
    for (const file of files) {
      if (!file.includes("hook")) continue;
      try {
        const content = fs.readFileSync(file, "utf-8");
        const match = content.match(/export\s+function\s+(use\w+)[^{]*\{[\s\S]{50,300}?\}/);
        if (match && !patterns["hook"]) {
          patterns["hook"] = {
            file: path.relative(this.projectPath, file),
            code: match[0].substring(0, 250),
            description: "Standard custom hook pattern"
          };
        }
      } catch {}
    }

    return patterns;
  }

  /**
   * Build risk map
   */
  buildRiskMap() {
    const riskMap = {
      critical: [],
      high: [],
      medium: [],
    };

    const files = this.findSourceFiles([".ts", ".tsx", ".js", ".jsx"]);
    
    for (const file of files) {
      const relativePath = path.relative(this.projectPath, file);
      const lowerPath = relativePath.toLowerCase();

      // Critical: auth, schema, config
      if (lowerPath.includes("schema") || lowerPath.includes("auth") || 
          lowerPath.includes("config") || lowerPath.includes("middleware")) {
        riskMap.critical.push(relativePath);
      }
      // High: routes, api, payments
      else if (lowerPath.includes("route") || lowerPath.includes("api") || 
               lowerPath.includes("payment") || lowerPath.includes("billing")) {
        riskMap.high.push(relativePath);
      }
      // Medium: components, hooks
      else if (lowerPath.includes("component") || lowerPath.includes("hook")) {
        riskMap.medium.push(relativePath);
      }
    }

    return riskMap;
  }

  /**
   * Find source files
   */
  findSourceFiles(extensions, maxDepth = 5) {
    const results = [];
    
    const walk = (dir, depth = 0) => {
      if (depth >= maxDepth) return;
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
            continue;
          }

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath, depth + 1);
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            results.push(fullPath);
          }
        }
      } catch {}
    };

    walk(this.projectPath);
    return results;
  }

  /**
   * Load existing truth pack
   */
  loadTruthPack() {
    const packPath = path.join(this.projectPath, ".guardrail", "truth-pack.json");
    if (fs.existsSync(packPath)) {
      try {
        this.truthPack = JSON.parse(fs.readFileSync(packPath, "utf-8"));
        this.indexed = true;
        return true;
      } catch {}
    }
    return false;
  }

  // ========== MCP TOOL IMPLEMENTATIONS ==========

  /**
   * repo.map() - Get project architecture and boundaries
   */
  repoMap() {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed. Run 'index' first." };

    return {
      projectPath: this.projectPath,
      indexedAt: this.truthPack.indexedAt,
      stats: {
        symbols: Object.keys(this.truthPack.symbols.exports).length,
        routes: this.truthPack.routes.endpoints.length,
        components: this.truthPack.symbols.components.length,
        packages: Object.keys(this.truthPack.versions.installed).length,
      },
      boundaries: {
        routeFiles: this.truthPack.routes.files,
        authFiles: this.truthPack.security.authFiles,
        middlewareFiles: this.truthPack.security.middlewareFiles,
      },
      riskMap: this.truthPack.riskMap,
    };
  }

  /**
   * symbols.exists(name) - Check if a symbol exists
   */
  symbolsExists(name) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const symbol = this.truthPack.symbols.exports[name];
    if (symbol) {
      return {
        exists: true,
        name,
        file: symbol.file,
        line: symbol.line,
        type: symbol.type,
        proof: `${symbol.file}:${symbol.line}`
      };
    }

    return {
      exists: false,
      name,
      suggestion: "Symbol not found. Do not invent it."
    };
  }

  /**
   * versions.allowed(package) - Check if package is installed
   */
  versionsAllowed(packageName) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const version = this.truthPack.versions.installed[packageName] ||
                    this.truthPack.versions.devDependencies[packageName];
    
    if (version) {
      return {
        allowed: true,
        package: packageName,
        version,
        proof: "package.json"
      };
    }

    return {
      allowed: false,
      package: packageName,
      suggestion: "Package not installed. Do not suggest using it."
    };
  }

  /**
   * routes.exists(method, path) - Check if route exists
   */
  routesExists(method, routePath) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const route = this.truthPack.routes.endpoints.find(
      r => r.method === method.toUpperCase() && r.path === routePath
    );

    if (route) {
      return {
        exists: true,
        method: route.method,
        path: route.path,
        file: route.file,
        line: route.line,
        proof: `${route.file}:${route.line}`
      };
    }

    return {
      exists: false,
      method,
      path: routePath,
      suggestion: "Route not found. Do not invent it."
    };
  }

  /**
   * patterns.get(type) - Get golden pattern
   */
  patternsGet(type) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const pattern = this.truthPack.patterns[type];
    if (pattern) {
      return {
        found: true,
        type,
        file: pattern.file,
        description: pattern.description,
        code: pattern.code
      };
    }

    return {
      found: false,
      type,
      available: Object.keys(this.truthPack.patterns)
    };
  }

  /**
   * security.authFlow() - Get auth flow info
   */
  securityAuthFlow() {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    return {
      authFiles: this.truthPack.security.authFiles,
      middlewareFiles: this.truthPack.security.middlewareFiles,
      protectedRoutes: this.truthPack.security.protectedRoutes,
      envSecrets: this.truthPack.security.envSecrets,
      warning: "Do not bypass auth without explicit approval"
    };
  }

  /**
   * tests.required(files) - Get required tests for changed files
   */
  testsRequired(changedFiles) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const required = [];
    
    for (const file of changedFiles) {
      // Find corresponding test file
      const baseName = path.basename(file, path.extname(file));
      const testFile = this.truthPack.tests.testFiles.find(
        t => t.includes(baseName) && (t.includes(".test.") || t.includes(".spec."))
      );
      
      if (testFile) {
        required.push({
          sourceFile: file,
          testFile,
          mustRun: true
        });
      } else {
        required.push({
          sourceFile: file,
          testFile: null,
          mustRun: false,
          warning: "No test file found - consider adding tests"
        });
      }
    }

    return {
      framework: this.truthPack.tests.framework,
      required,
      setupFiles: this.truthPack.tests.setupFiles
    };
  }

  /**
   * risk.blastRadius(files) - Compute blast radius for changes
   */
  riskBlastRadius(files) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const analysis = {
      files: [],
      overallRisk: "low",
      warnings: [],
      requiresApproval: false
    };

    for (const file of files) {
      let risk = "low";
      
      if (this.truthPack.riskMap.critical.some(f => file.includes(f) || f.includes(file))) {
        risk = "critical";
        analysis.warnings.push(`CRITICAL: ${file} is a critical file`);
        analysis.requiresApproval = true;
      } else if (this.truthPack.riskMap.high.some(f => file.includes(f) || f.includes(file))) {
        risk = "high";
        analysis.warnings.push(`HIGH: ${file} is a high-risk file`);
      } else if (this.truthPack.riskMap.medium.some(f => file.includes(f) || f.includes(file))) {
        risk = "medium";
      }

      // Check if file is imported by many others
      const importedBy = this.truthPack.components.importedBy || {};
      const baseName = path.basename(file, path.extname(file));
      if (importedBy[baseName]?.length > 5) {
        analysis.warnings.push(`HIGH IMPACT: ${file} is imported by ${importedBy[baseName].length} files`);
        risk = risk === "low" ? "medium" : risk;
      }

      analysis.files.push({ file, risk });
    }

    // Overall risk
    if (analysis.files.some(f => f.risk === "critical")) {
      analysis.overallRisk = "critical";
    } else if (analysis.files.some(f => f.risk === "high")) {
      analysis.overallRisk = "high";
    } else if (analysis.files.some(f => f.risk === "medium")) {
      analysis.overallRisk = "medium";
    }

    return analysis;
  }

  /**
   * graph.related(file) - Get related files
   */
  graphRelated(file) {
    if (!this.truthPack) this.loadTruthPack();
    if (!this.truthPack) return { error: "Not indexed" };

    const related = {
      imports: [],
      importedBy: [],
      sameDirectory: [],
    };

    const baseName = path.basename(file, path.extname(file));
    const dirName = path.dirname(file);

    // Find what this file imports (from component graph)
    const component = Object.entries(this.truthPack.components.components || {})
      .find(([name, data]) => data.file.includes(baseName));
    
    if (component) {
      related.imports = component[1].imports;
    }

    // Find what imports this file
    related.importedBy = this.truthPack.components.importedBy[baseName] || [];

    // Find files in same directory
    const allExports = Object.values(this.truthPack.symbols.exports);
    related.sameDirectory = allExports
      .filter(exp => exp.file.includes(dirName) && !exp.file.includes(baseName))
      .map(exp => exp.file)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);

    return related;
  }

  // ========== VERIFICATION GATES ==========

  /**
   * Verify a proposed change
   */
  verify(changes) {
    const results = {
      passed: true,
      checks: [],
    };

    // Symbol reality check
    for (const change of changes.newSymbols || []) {
      const exists = this.symbolsExists(change);
      if (!exists.exists) {
        results.passed = false;
        results.checks.push({
          type: "symbol_reality",
          passed: false,
          message: `Symbol "${change}" does not exist`
        });
      }
    }

    // Version check
    for (const pkg of changes.newPackages || []) {
      const allowed = this.versionsAllowed(pkg);
      if (!allowed.allowed) {
        results.passed = false;
        results.checks.push({
          type: "version_constraint",
          passed: false,
          message: `Package "${pkg}" is not installed`
        });
      }
    }

    // Blast radius check
    if (changes.files?.length > 0) {
      const blast = this.riskBlastRadius(changes.files);
      if (blast.requiresApproval) {
        results.checks.push({
          type: "blast_radius",
          passed: false,
          message: "Changes touch critical files - requires approval",
          warnings: blast.warnings
        });
      }
    }

    return results;
  }
}

// ========== MCP SERVER ==========

class MCPServer {
  constructor(engine) {
    this.engine = engine;
    this.tools = this.defineMCPTools();
  }

  defineMCPTools() {
    return [
      {
        name: "repo_map",
        description: "Get project architecture, boundaries, and risk map. Call this FIRST before planning any changes.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "symbols_exists",
        description: "Check if a symbol (function, class, component, hook) exists in the codebase. MUST call before using any symbol.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "The symbol name to check" }
          },
          required: ["name"]
        }
      },
      {
        name: "versions_allowed",
        description: "Check if a package is installed and get its version. MUST call before suggesting any package usage.",
        inputSchema: {
          type: "object",
          properties: {
            package: { type: "string", description: "The package name to check" }
          },
          required: ["package"]
        }
      },
      {
        name: "routes_exists",
        description: "Check if an API route exists. MUST call before claiming any endpoint exists.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", description: "HTTP method (GET, POST, etc.)" },
            path: { type: "string", description: "Route path" }
          },
          required: ["method", "path"]
        }
      },
      {
        name: "patterns_get",
        description: "Get a golden pattern (verified code example) for a given type. Call when creating new code.",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Pattern type: api-route, component, hook" }
          },
          required: ["type"]
        }
      },
      {
        name: "security_auth_flow",
        description: "Get authentication flow info: auth files, middleware, protected routes. Call before touching auth.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "tests_required",
        description: "Get required tests for a list of changed files.",
        inputSchema: {
          type: "object",
          properties: {
            files: { type: "array", items: { type: "string" }, description: "Files being changed" }
          },
          required: ["files"]
        }
      },
      {
        name: "risk_blast_radius",
        description: "Compute blast radius and risk level for proposed changes. Call before making changes.",
        inputSchema: {
          type: "object",
          properties: {
            files: { type: "array", items: { type: "string" }, description: "Files to analyze" }
          },
          required: ["files"]
        }
      },
      {
        name: "graph_related",
        description: "Get files related to a given file (imports, importers, same directory).",
        inputSchema: {
          type: "object",
          properties: {
            file: { type: "string", description: "File path to analyze" }
          },
          required: ["file"]
        }
      },
      {
        name: "verify_changes",
        description: "Verify proposed changes against reality checks (symbols, versions, blast radius).",
        inputSchema: {
          type: "object",
          properties: {
            newSymbols: { type: "array", items: { type: "string" }, description: "New symbols being used" },
            newPackages: { type: "array", items: { type: "string" }, description: "New packages being used" },
            files: { type: "array", items: { type: "string" }, description: "Files being changed" }
          },
          required: []
        }
      }
    ];
  }

  handleToolCall(toolName, args) {
    switch (toolName) {
      case "repo_map":
        return this.engine.repoMap();
      case "symbols_exists":
        return this.engine.symbolsExists(args.name);
      case "versions_allowed":
        return this.engine.versionsAllowed(args.package);
      case "routes_exists":
        return this.engine.routesExists(args.method, args.path);
      case "patterns_get":
        return this.engine.patternsGet(args.type);
      case "security_auth_flow":
        return this.engine.securityAuthFlow();
      case "tests_required":
        return this.engine.testsRequired(args.files || []);
      case "risk_blast_radius":
        return this.engine.riskBlastRadius(args.files || []);
      case "graph_related":
        return this.engine.graphRelated(args.file);
      case "verify_changes":
        return this.engine.verify(args);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * Start MCP server (stdio mode for Cursor)
   */
  startStdio() {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on("line", (line) => {
      try {
        const request = JSON.parse(line);
        const response = this.handleMCPRequest(request);
        console.log(JSON.stringify(response));
      } catch (err) {
        console.log(JSON.stringify({ error: err.message }));
      }
    });

    // Send server info
    console.error("guardrail Context Engine MCP Server started");
  }

  /**
   * Start HTTP server (for debugging/testing)
   */
  startHttp(port = 3847) {
    const server = http.createServer((req, res) => {
      if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
          try {
            const request = JSON.parse(body);
            const response = this.handleMCPRequest(request);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response, null, 2));
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      } else if (req.method === "GET" && req.url === "/tools") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ tools: this.tools }, null, 2));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", tools: this.tools.map(t => t.name) }));
      }
    });

    server.listen(port, () => {
      console.log(`🚀 Context Engine HTTP server running on http://localhost:${port}`);
      console.log(`   Tools: ${this.tools.map(t => t.name).join(", ")}`);
    });

    return server;
  }

  handleMCPRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_VERSION,
            serverInfo: {
              name: "guardrail-context",
              version: "1.0.0"
            },
            capabilities: {
              tools: {}
            }
          }
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: { tools: this.tools }
        };

      case "tools/call":
        const { name, arguments: args } = params;
        const result = this.handleToolCall(name, args || {});
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
        };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        };
    }
  }
}

// ========== CLI ==========

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const projectPath = args.find(a => a.startsWith("--path="))?.split("=")[1] || process.cwd();

  const engine = new ContextEngine(projectPath);

  switch (command) {
    case "index":
      await engine.index();
      break;

    case "serve":
      const mode = args.includes("--http") ? "http" : "stdio";
      const port = parseInt(args.find(a => a.startsWith("--port="))?.split("=")[1] || "3847");
      
      // Load or build index first
      if (!engine.loadTruthPack()) {
        console.log("No truth pack found, indexing first...");
        await engine.index();
      }

      const server = new MCPServer(engine);
      if (mode === "http") {
        server.startHttp(port);
      } else {
        server.startStdio();
      }
      break;

    case "verify":
      if (!engine.loadTruthPack()) {
        console.error("Not indexed. Run 'index' first.");
        process.exit(1);
      }
      // Read changes from stdin or args
      const changes = JSON.parse(args[1] || "{}");
      const result = engine.verify(changes);
      console.log(JSON.stringify(result, null, 2));
      break;

    case "query":
      // Quick query mode for testing
      if (!engine.loadTruthPack()) {
        console.error("Not indexed. Run 'index' first.");
        process.exit(1);
      }
      const tool = args[1];
      const toolArgs = JSON.parse(args[2] || "{}");
      const mcpServer = new MCPServer(engine);
      const queryResult = mcpServer.handleToolCall(tool, toolArgs);
      console.log(JSON.stringify(queryResult, null, 2));
      break;

    default:
      console.log(`
guardrail Context Engine - MCP Server

Usage:
  node index.js index [--path=<project>]     Build truth pack
  node index.js serve [--http] [--port=3847] Start MCP server
  node index.js verify <changes-json>        Verify proposed changes
  node index.js query <tool> [args-json]     Query a tool directly

Tools:
  repo_map          - Get project architecture
  symbols_exists    - Check if symbol exists
  versions_allowed  - Check if package is installed
  routes_exists     - Check if route exists
  patterns_get      - Get golden pattern
  security_auth_flow - Get auth flow info
  tests_required    - Get required tests
  risk_blast_radius - Compute blast radius
  graph_related     - Get related files
  verify_changes    - Verify proposed changes
      `);
  }
}

module.exports = { ContextEngine, MCPServer };

if (require.main === module) {
  main().catch(console.error);
}
