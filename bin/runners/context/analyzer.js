/**
 * Project Analyzer Module
 * Analyzes project structure, framework, and conventions
 */

const fs = require("fs");
const path = require("path");
const { detectPatterns } = require("./patterns");
const { detectMonorepo } = require("./monorepo");

const c = {
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

/**
 * Find files recursively in a directory
 */
function findFilesRecursive(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFilesRecursive(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Detect environment variables used in the codebase
 */
function detectEnvVars(projectPath) {
  const envVars = new Set();
  const envFiles = [];
  
  const envFileNames = [".env", ".env.local", ".env.example", ".env.development", ".env.production"];
  for (const envFile of envFileNames) {
    const envPath = path.join(projectPath, envFile);
    if (fs.existsSync(envPath)) {
      envFiles.push(envFile);
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const matches = content.match(/^([A-Z][A-Z0-9_]+)=/gm) || [];
        matches.forEach(m => envVars.add(m.replace("=", "")));
      } catch {}
    }
  }

  const srcFiles = findFilesRecursive(projectPath, [".ts", ".tsx", ".js", ".jsx"], 4);
  for (const file of srcFiles.slice(0, 50)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.match(/process\.env\.([A-Z][A-Z0-9_]+)/g) || [];
      matches.forEach(m => envVars.add(m.replace("process.env.", "")));
      const viteMatches = content.match(/import\.meta\.env\.([A-Z][A-Z0-9_]+)/g) || [];
      viteMatches.forEach(m => envVars.add(m.replace("import.meta.env.", "")));
    } catch {}
  }

  return {
    files: envFiles,
    variables: Array.from(envVars).sort(),
  };
}

/**
 * Extract key types and interfaces from the codebase
 */
function extractTypes(projectPath) {
  const types = {
    interfaces: [],
    types: [],
    enums: [],
    examples: {},
  };

  const srcFiles = findFilesRecursive(projectPath, [".ts", ".tsx"], 5);
  
  for (const file of srcFiles.slice(0, 80)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      const interfaceMatches = content.match(/export\s+interface\s+(\w+)/g) || [];
      interfaceMatches.forEach(m => {
        const name = m.match(/interface\s+(\w+)/)?.[1];
        if (name && !types.interfaces.includes(name)) {
          types.interfaces.push(name);
          if (!types.examples.interface) {
            const fullMatch = content.match(new RegExp(`export\\s+interface\\s+${name}\\s*\\{[^}]+\\}`, 's'));
            if (fullMatch && fullMatch[0].length < 300) {
              types.examples.interface = { name, code: fullMatch[0], file: relativePath };
            }
          }
        }
      });

      const typeMatches = content.match(/export\s+type\s+(\w+)\s*=/g) || [];
      typeMatches.forEach(m => {
        const name = m.match(/type\s+(\w+)/)?.[1];
        if (name && !types.types.includes(name)) {
          types.types.push(name);
        }
      });

      const enumMatches = content.match(/export\s+enum\s+(\w+)/g) || [];
      enumMatches.forEach(m => {
        const name = m.match(/enum\s+(\w+)/)?.[1];
        if (name && !types.enums.includes(name)) {
          types.enums.push(name);
        }
      });
    } catch {}
  }

  return types;
}

/**
 * Analyze import graph
 */
function analyzeImports(projectPath) {
  const imports = {
    externalPackages: new Set(),
    internalAliases: [],
    importPatterns: [],
  };

  const srcFiles = findFilesRecursive(projectPath, [".ts", ".tsx", ".js", ".jsx"], 4);

  for (const file of srcFiles.slice(0, 60)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
      
      importMatches.forEach(m => {
        const source = m.match(/from\s+['"]([^'"]+)['"]/)?.[1];
        if (source) {
          if (source.startsWith("@/") || source.startsWith("~/")) {
            if (!imports.internalAliases.includes(source.split("/")[0])) {
              imports.internalAliases.push(source.split("/")[0]);
            }
          } else if (!source.startsWith(".") && !source.startsWith("/")) {
            imports.externalPackages.add(source.split("/")[0]);
          }
        }
      });
    } catch {}
  }

  if (imports.internalAliases.includes("@/")) {
    imports.importPatterns.push("Uses @/ path alias for src imports");
  }

  return {
    externalPackages: Array.from(imports.externalPackages).slice(0, 30),
    internalAliases: imports.internalAliases,
    importPatterns: imports.importPatterns,
  };
}

/**
 * Calculate file statistics
 */
function calculateStats(projectPath) {
  const stats = {
    totalFiles: 0,
    totalLines: 0,
    byExtension: {},
    largestFiles: [],
  };

  const allFiles = findFilesRecursive(projectPath, [".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".json"], 6);
  
  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n").length;
      const ext = path.extname(file);
      const relativePath = path.relative(projectPath, file);
      
      stats.totalFiles++;
      stats.totalLines += lines;
      stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
      stats.largestFiles.push({ path: relativePath, lines });
    } catch {}
  }

  stats.largestFiles.sort((a, b) => b.lines - a.lines);
  stats.largestFiles = stats.largestFiles.slice(0, 5);

  return stats;
}

/**
 * Get npm scripts from package.json
 */
function getNpmScripts(projectPath) {
  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) return [];
  
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return Object.entries(pkg.scripts || {}).map(([name, cmd]) => ({
      name,
      command: cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd,
    }));
  } catch {
    return [];
  }
}

/**
 * Main project analysis function
 */
function analyzeProject(projectPath) {
  const analysis = {
    name: path.basename(projectPath),
    framework: null,
    language: null,
    architecture: null,
    hasTypescript: false,
    hasPrisma: false,
    hasNextjs: false,
    hasReact: false,
    hasExpress: false,
    hasTailwind: false,
    directories: [],
    entryPoints: [],
    apiRoutes: [],
    components: [],
    models: [],
    patterns: {},
    conventions: {
      naming: {},
      imports: [],
      patterns: [],
    },
  };

  // Check package.json
  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // Full-stack frameworks (check first)
      if (deps.next) {
        analysis.framework = "Next.js";
        analysis.hasNextjs = true;
      } else if (deps.nuxt || deps["@nuxt/core"]) {
        analysis.framework = "Nuxt";
      } else if (deps["@remix-run/node"] || deps["@remix-run/react"]) {
        analysis.framework = "Remix";
      }
      // Frontend frameworks
      else if (deps.react || deps["react-dom"]) {
        // Check for Vite
        if (deps.vite || deps["@vitejs/plugin-react"] || 
            fs.existsSync(path.join(projectPath, "vite.config.ts")) ||
            fs.existsSync(path.join(projectPath, "vite.config.js"))) {
          analysis.framework = "Vite + React";
        } else {
          analysis.framework = "React";
        }
        analysis.hasReact = true;
      } else if (deps.vue) {
        // Check for Vite
        if (deps.vite || deps["@vitejs/plugin-vue"] ||
            fs.existsSync(path.join(projectPath, "vite.config.ts")) ||
            fs.existsSync(path.join(projectPath, "vite.config.js"))) {
          analysis.framework = "Vite + Vue";
        } else {
          analysis.framework = "Vue";
        }
      } else if (deps.svelte || deps["svelte-kit"]) {
        analysis.framework = "Svelte";
      } else if (deps["@angular/core"]) {
        analysis.framework = "Angular";
      }
      // Backend frameworks
      else if (deps.express) {
        analysis.framework = "Express";
        analysis.hasExpress = true;
      } else if (deps.fastify) {
        analysis.framework = "Fastify";
      } else if (deps["@nestjs/core"]) {
        analysis.framework = "NestJS";
      }
      
      analysis.hasTypescript = !!deps.typescript;
      analysis.hasPrisma = !!deps.prisma || !!deps["@prisma/client"];
      analysis.hasTailwind = !!deps.tailwindcss;
      analysis.language = analysis.hasTypescript ? "TypeScript" : "JavaScript";
    } catch {}
  }

  // Detect architecture
  if (fs.existsSync(path.join(projectPath, "src/app"))) {
    analysis.architecture = "Next.js App Router";
  } else if (fs.existsSync(path.join(projectPath, "src/pages"))) {
    analysis.architecture = "Next.js Pages Router";
  } else if (fs.existsSync(path.join(projectPath, "app"))) {
    analysis.architecture = "Next.js App Router (root)";
  } else if (fs.existsSync(path.join(projectPath, "src"))) {
    analysis.architecture = "Standard src/ layout";
  } else {
    analysis.architecture = "Flat structure";
  }

  // Find key directories
  const dirsToCheck = ["src", "app", "pages", "components", "lib", "utils", "services", "api", "server", "prisma"];
  for (const dir of dirsToCheck) {
    if (fs.existsSync(path.join(projectPath, dir))) {
      analysis.directories.push(dir);
    }
    if (fs.existsSync(path.join(projectPath, "src", dir))) {
      analysis.directories.push(`src/${dir}`);
    }
  }

  // Find API routes (including monorepo subdirectories)
  const apiPaths = [
    path.join(projectPath, "src/app/api"),
    path.join(projectPath, "app/api"),
    path.join(projectPath, "pages/api"),
    path.join(projectPath, "server"),
    // Monorepo common paths
    path.join(projectPath, "services", "scanner-dash", "src", "app", "api"),
    path.join(projectPath, "services", "scanner-dash", "src", "pages", "api"),
    path.join(projectPath, "dashboard", "src", "app", "api"),
    path.join(projectPath, "dashboard", "src", "pages", "api"),
    path.join(projectPath, "apps", "web-ui", "src", "app", "api"),
    path.join(projectPath, "apps", "web", "src", "app", "api"),
  ];
  
  // Also search recursively for API directories
  function findApiDirs(dir, depth = 0) {
    const found = [];
    if (depth > 3) return found; // Limit recursion depth
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !["node_modules", ".next", "dist", ".git", ".turbo"].includes(item.name)) {
          const itemPath = path.join(dir, item.name);
          
          // Check if this is an API directory
          if (item.name === "api" || itemPath.includes("/api/") || itemPath.includes("\\api\\")) {
            found.push(itemPath);
          }
          
          // Also check for server/routes directories
          if (item.name === "server" || item.name === "routes") {
            found.push(itemPath);
          }
          
          // Recursively search
          found.push(...findApiDirs(itemPath, depth + 1));
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
    
    return found;
  }
  
  // Combine hardcoded paths with recursive search
  const allApiPaths = [...apiPaths, ...findApiDirs(projectPath)];
  
  for (const apiPath of allApiPaths) {
    if (fs.existsSync(apiPath)) {
      const routes = findFilesRecursive(apiPath, [".ts", ".js", ".tsx", ".jsx"]).map(f => 
        f.replace(apiPath, "").replace(/\\/g, "/").replace(/\/route\.(ts|js|tsx|jsx)$/, "").replace(/\.(ts|js|tsx|jsx)$/, "")
      );
      analysis.apiRoutes.push(...routes);
    }
  }
  
  // Remove duplicates
  analysis.apiRoutes = [...new Set(analysis.apiRoutes)];

  // Find components
  const componentPaths = [
    path.join(projectPath, "src/components"),
    path.join(projectPath, "components"),
    path.join(projectPath, "src/app/components"),
  ];
  
  for (const compPath of componentPaths) {
    if (fs.existsSync(compPath)) {
      analysis.components = findFilesRecursive(compPath, [".tsx", ".jsx"])
        .map(f => path.basename(f, path.extname(f)))
        .filter(name => /^[A-Z]/.test(name));
      break;
    }
  }

  // Detect naming conventions
  if (analysis.components.length > 0) {
    const hasPascalCase = analysis.components.some(c => /^[A-Z][a-z]/.test(c));
    const hasKebabCase = analysis.components.some(c => c.includes("-"));
    analysis.conventions.naming.components = hasPascalCase ? "PascalCase" : hasKebabCase ? "kebab-case" : "mixed";
  }

  // Find models/schemas
  const prismaSchema = path.join(projectPath, "prisma/schema.prisma");
  if (fs.existsSync(prismaSchema)) {
    const schema = fs.readFileSync(prismaSchema, "utf-8");
    const modelMatches = schema.match(/model\s+(\w+)\s*{/g) || [];
    analysis.models = modelMatches.map(m => m.replace(/model\s+/, "").replace(/\s*{/, ""));
  }

  // Deep pattern detection
  console.log(`${c.dim}  Detecting patterns...${c.reset}`);
  analysis.patterns = detectPatterns(projectPath);

  // Environment variables
  console.log(`${c.dim}  Scanning env vars...${c.reset}`);
  analysis.envVars = detectEnvVars(projectPath);

  // Types and interfaces
  console.log(`${c.dim}  Extracting types...${c.reset}`);
  analysis.types = extractTypes(projectPath);

  // Import analysis
  console.log(`${c.dim}  Analyzing imports...${c.reset}`);
  analysis.imports = analyzeImports(projectPath);

  // File statistics
  console.log(`${c.dim}  Calculating stats...${c.reset}`);
  analysis.stats = calculateStats(projectPath);

  // NPM scripts
  analysis.scripts = getNpmScripts(projectPath);

  // Monorepo detection
  console.log(`${c.dim}  Detecting monorepo...${c.reset}`);
  analysis.monorepo = detectMonorepo(projectPath);

  return analysis;
}

module.exports = {
  analyzeProject,
  findFilesRecursive,
  detectEnvVars,
  extractTypes,
  analyzeImports,
  calculateStats,
  getNpmScripts,
};
