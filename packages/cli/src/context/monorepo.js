/**
 * Monorepo Detection Module
 * Detects monorepo structures and workspaces
 */

const fs = require("fs");
const path = require("path");

/**
 * Find workspaces from glob patterns
 */
function findWorkspaces(projectPath, patterns) {
  const workspaces = [];
  
  for (const pattern of patterns) {
    const baseDir = pattern.replace(/\/\*$/, "").replace(/\*\*$/, "");
    const searchPath = path.join(projectPath, baseDir);
    
    if (fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()) {
      try {
        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pkgJson = path.join(searchPath, entry.name, "package.json");
            if (fs.existsSync(pkgJson)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
                workspaces.push({
                  name: pkg.name || entry.name,
                  path: path.join(baseDir, entry.name),
                  description: pkg.description || "",
                  dependencies: Object.keys(pkg.dependencies || {}),
                  devDependencies: Object.keys(pkg.devDependencies || {}),
                  version: pkg.version,
                });
              } catch {}
            }
          }
        }
      } catch {}
    }
  }

  return workspaces;
}

/**
 * Find packages used across multiple workspaces
 */
function findSharedPackages(projectPath, workspaces) {
  const packageUsage = new Map();
  
  for (const workspace of workspaces) {
    const allDeps = [...(workspace.dependencies || []), ...(workspace.devDependencies || [])];
    for (const dep of allDeps) {
      if (dep.startsWith("@") || !dep.includes("/")) {
        packageUsage.set(dep, (packageUsage.get(dep) || 0) + 1);
      }
    }
  }

  // Return packages used in multiple workspaces
  return Array.from(packageUsage.entries())
    .filter(([_, count]) => count > 1)
    .map(([name, count]) => ({ name, usedIn: count }))
    .sort((a, b) => b.usedIn - a.usedIn)
    .slice(0, 20);
}

/**
 * Detect if project is a monorepo and find all workspaces
 */
function detectMonorepo(projectPath) {
  const monorepo = {
    isMonorepo: false,
    type: null,
    workspaces: [],
    sharedPackages: [],
    rootConfig: null,
    tools: [],
  };

  const pkgPath = path.join(projectPath, "package.json");
  if (!fs.existsSync(pkgPath)) return monorepo;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    
    // Check for npm/yarn workspaces
    if (pkg.workspaces) {
      monorepo.isMonorepo = true;
      monorepo.type = "npm/yarn";
      const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages || [];
      monorepo.workspaces = findWorkspaces(projectPath, patterns);
    }

    // Check for pnpm workspaces
    const pnpmWorkspace = path.join(projectPath, "pnpm-workspace.yaml");
    if (fs.existsSync(pnpmWorkspace)) {
      monorepo.isMonorepo = true;
      monorepo.type = "pnpm";
      try {
        const content = fs.readFileSync(pnpmWorkspace, "utf-8");
        const patterns = content.match(/- ['"]?([^'"]+)['"]?/g)?.map(m => 
          m.replace(/- ['"]?/, "").replace(/['"]?$/, "")
        ) || [];
        monorepo.workspaces = findWorkspaces(projectPath, patterns);
      } catch {}
    }

    // Check for Turborepo
    if (fs.existsSync(path.join(projectPath, "turbo.json"))) {
      monorepo.tools.push("Turborepo");
      if (!monorepo.type) monorepo.type = "turborepo";
      monorepo.rootConfig = "turbo.json";
    }

    // Check for Nx
    if (fs.existsSync(path.join(projectPath, "nx.json"))) {
      monorepo.isMonorepo = true;
      monorepo.tools.push("Nx");
      if (!monorepo.type) monorepo.type = "nx";
      monorepo.rootConfig = "nx.json";
      
      // Nx projects are in workspace.json or project.json files
      const workspaceJson = path.join(projectPath, "workspace.json");
      if (fs.existsSync(workspaceJson)) {
        try {
          const workspace = JSON.parse(fs.readFileSync(workspaceJson, "utf-8"));
          if (workspace.projects) {
            for (const [name, config] of Object.entries(workspace.projects)) {
              const projectPath = typeof config === "string" ? config : config.root;
              monorepo.workspaces.push({
                name,
                path: projectPath,
                description: "",
                dependencies: [],
              });
            }
          }
        } catch {}
      }
    }

    // Check for Lerna
    if (fs.existsSync(path.join(projectPath, "lerna.json"))) {
      monorepo.isMonorepo = true;
      monorepo.tools.push("Lerna");
      if (!monorepo.type) monorepo.type = "lerna";
      monorepo.rootConfig = "lerna.json";
      
      try {
        const lerna = JSON.parse(fs.readFileSync(path.join(projectPath, "lerna.json"), "utf-8"));
        if (lerna.packages && monorepo.workspaces.length === 0) {
          monorepo.workspaces = findWorkspaces(projectPath, lerna.packages);
        }
      } catch {}
    }

    // Check for Rush
    if (fs.existsSync(path.join(projectPath, "rush.json"))) {
      monorepo.isMonorepo = true;
      monorepo.tools.push("Rush");
      if (!monorepo.type) monorepo.type = "rush";
      monorepo.rootConfig = "rush.json";
    }

    // Find shared packages
    if (monorepo.isMonorepo && monorepo.workspaces.length > 0) {
      monorepo.sharedPackages = findSharedPackages(projectPath, monorepo.workspaces);
    }
  } catch {}

  return monorepo;
}

/**
 * Get workspace by name
 */
function getWorkspace(projectPath, workspaceName) {
  const monorepo = detectMonorepo(projectPath);
  return monorepo.workspaces.find(w => w.name === workspaceName);
}

/**
 * Get internal dependencies (workspaces that depend on other workspaces)
 */
function getInternalDependencies(projectPath) {
  const monorepo = detectMonorepo(projectPath);
  if (!monorepo.isMonorepo) return [];

  const workspaceNames = new Set(monorepo.workspaces.map(w => w.name));
  const internalDeps = [];

  for (const workspace of monorepo.workspaces) {
    const deps = [...(workspace.dependencies || []), ...(workspace.devDependencies || [])];
    const internal = deps.filter(d => workspaceNames.has(d));
    if (internal.length > 0) {
      internalDeps.push({
        workspace: workspace.name,
        dependsOn: internal,
      });
    }
  }

  return internalDeps;
}

module.exports = {
  detectMonorepo,
  findWorkspaces,
  findSharedPackages,
  getWorkspace,
  getInternalDependencies,
};
