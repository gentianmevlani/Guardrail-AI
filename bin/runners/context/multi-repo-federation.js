/**
 * Multi-Repo Context Federation Module
 * Unified context across related repositories
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const GUARDRAIL_HOME = path.join(os.homedir(), ".guardrail");
const FEDERATION_FILE = path.join(GUARDRAIL_HOME, "repo-federation.json");

/**
 * Initialize federation config
 */
function initializeFederation() {
  if (!fs.existsSync(GUARDRAIL_HOME)) {
    fs.mkdirSync(GUARDRAIL_HOME, { recursive: true });
  }
  
  if (!fs.existsSync(FEDERATION_FILE)) {
    fs.writeFileSync(FEDERATION_FILE, JSON.stringify({
      version: "1.0.0",
      groups: {},
      repositories: {},
      sharedArtifacts: {},
    }, null, 2));
  }
}

/**
 * Load federation config
 */
function loadFederation() {
  initializeFederation();
  try {
    return JSON.parse(fs.readFileSync(FEDERATION_FILE, "utf-8"));
  } catch {
    return { groups: {}, repositories: {}, sharedArtifacts: {} };
  }
}

/**
 * Save federation config
 */
function saveFederation(config) {
  initializeFederation();
  fs.writeFileSync(FEDERATION_FILE, JSON.stringify(config, null, 2));
}

/**
 * Register repository in federation
 */
function registerRepository(repoPath, options = {}) {
  const config = loadFederation();
  const repoId = path.basename(repoPath);
  
  // Detect repo type and patterns
  const packageJsonPath = path.join(repoPath, "package.json");
  let repoInfo = {
    id: repoId,
    path: repoPath,
    type: "unknown",
    registered: new Date().toISOString(),
    ...options,
  };
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      repoInfo.type = pkg.private ? "private" : "public";
      repoInfo.name = pkg.name;
      repoInfo.description = pkg.description;
      repoInfo.dependencies = Object.keys(pkg.dependencies || {});
      repoInfo.devDependencies = Object.keys(pkg.devDependencies || {});
      
      // Detect framework
      if (pkg.dependencies?.next) repoInfo.framework = "Next.js";
      else if (pkg.dependencies?.react) repoInfo.framework = "React";
      else if (pkg.dependencies?.express) repoInfo.framework = "Express";
      else if (pkg.dependencies?.vue) repoInfo.framework = "Vue";
    } catch {}
  }
  
  config.repositories[repoId] = repoInfo;
  
  // Auto-add to groups based on patterns
  if (repoInfo.framework) {
    const groupName = `${repoInfo.framework.toLowerCase()}-projects`;
    if (!config.groups[groupName]) {
      config.groups[groupName] = {
        name: groupName,
        description: `${repoInfo.framework} projects`,
        repositories: [],
      };
    }
    if (!config.groups[groupName].repositories.includes(repoId)) {
      config.groups[groupName].repositories.push(repoId);
    }
  }
  
  saveFederation(config);
  return repoInfo;
}

/**
 * Create repository group
 */
function createGroup(name, description, repoIds = []) {
  const config = loadFederation();
  
  config.groups[name] = {
    name,
    description,
    repositories: repoIds,
    created: new Date().toISOString(),
  };
  
  saveFederation(config);
}

/**
 * Get shared artifacts across repositories
 */
function getSharedArtifacts(groupName = null) {
  const config = loadFederation();
  const artifacts = {
    components: new Map(),
    hooks: new Map(),
    utilities: new Map(),
    types: new Map(),
    patterns: new Map(),
  };
  
  const repos = groupName 
    ? config.groups[groupName]?.repositories || []
    : Object.keys(config.repositories);
  
  for (const repoId of repos) {
    const repo = config.repositories[repoId];
    if (!repo) continue;
    
    // Load context from each repo
    const contextFile = path.join(repo.path, ".guardrail", "context.json");
    if (fs.existsSync(contextFile)) {
      try {
        const context = JSON.parse(fs.readFileSync(contextFile, "utf-8"));
        
        // Collect components
        if (context.structure?.components) {
          for (const comp of context.structure.components) {
            if (!artifacts.components.has(comp)) {
              artifacts.components.set(comp, []);
            }
            artifacts.components.get(comp).push({
              repo: repoId,
              path: comp,
              framework: context.project?.framework,
            });
          }
        }
        
        // Collect hooks
        if (context.patterns?.hooks) {
          for (const hook of context.patterns.hooks) {
            if (!artifacts.hooks.has(hook)) {
              artifacts.hooks.set(hook, []);
            }
            artifacts.hooks.get(hook).push({
              repo: repoId,
              name: hook,
            });
          }
        }
        
        // Collect patterns
        if (context.patterns?.stateManagement) {
          const pattern = context.patterns.stateManagement;
          if (!artifacts.patterns.has(pattern)) {
            artifacts.patterns.set(pattern, []);
          }
          artifacts.patterns.get(pattern).push(repoId);
        }
        
        // Collect types
        if (context.types?.interfaces) {
          for (const type of context.types.interfaces) {
            if (!artifacts.types.has(type)) {
              artifacts.types.set(type, []);
            }
            artifacts.types.get(type).push({
              repo: repoId,
              interface: type,
            });
          }
        }
      } catch {}
    }
  }
  
  // Convert Maps to arrays and filter for shared items
  const shared = {};
  for (const [key, map] of Object.entries(artifacts)) {
    shared[key] = Array.from(map.entries())
      .filter(([_, items]) => items.length > 1) // Only keep items shared across repos
      .map(([name, items]) => ({
        name,
        repositories: items,
        count: items.length,
      }))
      .sort((a, b) => b.count - a.count);
  }
  
  return shared;
}

/**
 * Generate federated context
 */
function generateFederatedContext(groupName = null, options = {}) {
  const { maxTokens = 8000, includePatterns = true } = options;
  const config = loadFederation();
  
  const repos = groupName 
    ? config.groups[groupName]?.repositories || []
    : Object.keys(config.repositories);
  
  const federated = {
    version: "1.0.0",
    generated: new Date().toISOString(),
    group: groupName,
    repositories: repos.map(id => ({
      id,
      ...config.repositories[id],
    })),
    sharedArtifacts: getSharedArtifacts(groupName),
    context: {
      components: [],
      hooks: [],
      patterns: [],
      types: [],
    },
    stats: {
      totalRepos: repos.length,
      sharedComponents: 0,
      sharedHooks: 0,
      sharedPatterns: 0,
    },
  };
  
  // Build unified context
  let totalTokens = 0;
  
  // Add shared components
  for (const comp of federated.sharedArtifacts.components.slice(0, 20)) {
    if (totalTokens > maxTokens * 0.4) break;
    
    federated.context.components.push({
      name: comp.name,
      usage: comp.repositories,
      example: comp.repositories[0],
    });
    federated.stats.sharedComponents++;
  }
  
  // Add shared hooks
  for (const hook of federated.sharedArtifacts.hooks.slice(0, 15)) {
    if (totalTokens > maxTokens * 0.6) break;
    
    federated.context.hooks.push({
      name: hook.name,
      repos: hook.repositories,
    });
    federated.stats.sharedHooks++;
  }
  
  // Add shared patterns
  for (const pattern of federated.sharedArtifacts.patterns) {
    if (totalTokens > maxTokens * 0.8) break;
    
    federated.context.patterns.push({
      name: pattern.name,
      repos: pattern.repositories,
    });
    federated.stats.sharedPatterns++;
  }
  
  return federated;
}

/**
 * Find related repositories
 */
function findRelatedRepositories(repoPath, limit = 5) {
  const config = loadFederation();
  const repoId = path.basename(repoPath);
  const repo = config.repositories[repoId];
  
  if (!repo) return [];
  
  const related = [];
  
  // Find repos with similar dependencies
  for (const [id, otherRepo] of Object.entries(config.repositories)) {
    if (id === repoId) continue;
    
    let similarity = 0;
    
    // Same framework
    if (repo.framework === otherRepo.framework) {
      similarity += 3;
    }
    
    // Shared dependencies
    const sharedDeps = (repo.dependencies || []).filter(d => 
      (otherRepo.dependencies || []).includes(d)
    ).length;
    similarity += sharedDeps * 0.5;
    
    // Same type (private/public)
    if (repo.type === otherRepo.type) {
      similarity += 1;
    }
    
    if (similarity > 0) {
      related.push({
        id,
        ...otherRepo,
        similarity,
      });
    }
  }
  
  return related
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Sync federation with remote
 */
function syncFederation(remoteUrl) {
  // In a real implementation, this would sync with a remote service
  // For now, just mark as synced
  const config = loadFederation();
  config.lastSync = new Date().toISOString();
  config.remoteUrl = remoteUrl;
  saveFederation(config);
}

/**
 * Generate federation report
 */
function generateFederationReport(federated) {
  let report = `# Multi-Repository Federation Report\n\n`;
  report += `Generated: ${new Date(federated.generated).toLocaleString()}\n`;
  report += `Group: ${federated.group || "All"}\n`;
  report += `Repositories: ${federated.stats.totalRepos}\n\n`;
  
  // Repositories
  report += `## Repositories\n\n`;
  for (const repo of federated.repositories) {
    report += `- **${repo.name || repo.id}** (${repo.framework || "Unknown"})\n`;
    report += `  - Path: ${repo.path}\n`;
    report += `  - Dependencies: ${repo.dependencies?.length || 0}\n`;
  }
  
  // Shared artifacts
  report += `\n## Shared Artifacts\n\n`;
  
  if (federated.sharedArtifacts.components.length > 0) {
    report += `### Components (${federated.stats.sharedComponents})\n\n`;
    for (const comp of federated.sharedArtifacts.components.slice(0, 10)) {
      report += `- **${comp.name}** - Used in ${comp.count} repos\n`;
    }
  }
  
  if (federated.sharedArtifacts.hooks.length > 0) {
    report += `\n### Hooks (${federated.stats.sharedHooks})\n\n`;
    for (const hook of federated.sharedArtifacts.hooks.slice(0, 10)) {
      report += `- **${hook.name}** - Used in ${hook.count} repos\n`;
    }
  }
  
  if (federated.sharedArtifacts.patterns.length > 0) {
    report += `\n### Patterns (${federated.stats.sharedPatterns})\n\n`;
    for (const pattern of federated.sharedArtifacts.patterns) {
      report += `- **${pattern.name}** - Used in ${pattern.count} repos\n`;
    }
  }
  
  return report;
}

module.exports = {
  registerRepository,
  createGroup,
  getSharedArtifacts,
  generateFederatedContext,
  findRelatedRepositories,
  syncFederation,
  generateFederationReport,
  loadFederation,
};
