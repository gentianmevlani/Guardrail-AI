/**
 * Shared Context Module
 * Cross-project pattern sharing and context registry
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const GUARDRAIL_HOME = path.join(os.homedir(), ".guardrail");
const SHARED_CONTEXT_FILE = path.join(GUARDRAIL_HOME, "shared-context.json");

/**
 * Initialize shared context file
 */
function initializeSharedContext() {
  if (!fs.existsSync(GUARDRAIL_HOME)) {
    fs.mkdirSync(GUARDRAIL_HOME, { recursive: true });
  }
  
  if (!fs.existsSync(SHARED_CONTEXT_FILE)) {
    fs.writeFileSync(SHARED_CONTEXT_FILE, JSON.stringify({
      version: "1.0.0",
      projects: {},
      sharedPatterns: {},
      sharedHooks: {},
      sharedComponents: {},
      lastUpdated: null,
    }, null, 2));
  }
}

/**
 * Register project in shared context
 */
function registerSharedContext(projectPath, analysis) {
  initializeSharedContext();
  
  let shared;
  try {
    shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
  } catch {
    shared = { 
      projects: {}, 
      sharedPatterns: {}, 
      sharedHooks: {},
      sharedComponents: {},
      lastUpdated: null 
    };
  }

  const projectId = crypto.createHash("md5").update(projectPath).digest("hex").slice(0, 8);
  
  // Store project info
  shared.projects[projectId] = {
    path: projectPath,
    name: analysis.name,
    framework: analysis.framework,
    language: analysis.language,
    hooks: analysis.patterns?.hooks || [],
    components: analysis.components?.slice(0, 30) || [],
    models: analysis.models?.slice(0, 20) || [],
    stateManagement: analysis.patterns?.stateManagement,
    validation: analysis.patterns?.validation,
    lastUpdated: new Date().toISOString(),
  };

  // Build shared hooks index
  shared.sharedHooks = {};
  for (const [id, proj] of Object.entries(shared.projects)) {
    for (const hook of proj.hooks || []) {
      shared.sharedHooks[hook] = shared.sharedHooks[hook] || [];
      if (!shared.sharedHooks[hook].includes(proj.name)) {
        shared.sharedHooks[hook].push(proj.name);
      }
    }
  }

  // Build shared components index
  shared.sharedComponents = {};
  for (const [id, proj] of Object.entries(shared.projects)) {
    for (const component of proj.components || []) {
      shared.sharedComponents[component] = shared.sharedComponents[component] || [];
      if (!shared.sharedComponents[component].includes(proj.name)) {
        shared.sharedComponents[component].push(proj.name);
      }
    }
  }

  // Build shared patterns index
  shared.sharedPatterns = {};
  for (const [id, proj] of Object.entries(shared.projects)) {
    if (proj.stateManagement) {
      shared.sharedPatterns[proj.stateManagement] = shared.sharedPatterns[proj.stateManagement] || [];
      if (!shared.sharedPatterns[proj.stateManagement].includes(proj.name)) {
        shared.sharedPatterns[proj.stateManagement].push(proj.name);
      }
    }
    if (proj.validation) {
      shared.sharedPatterns[proj.validation] = shared.sharedPatterns[proj.validation] || [];
      if (!shared.sharedPatterns[proj.validation].includes(proj.name)) {
        shared.sharedPatterns[proj.validation].push(proj.name);
      }
    }
  }

  shared.lastUpdated = new Date().toISOString();
  fs.writeFileSync(SHARED_CONTEXT_FILE, JSON.stringify(shared, null, 2));
  
  return shared;
}

/**
 * Get patterns shared across projects
 */
function getSharedPatterns() {
  try {
    if (!fs.existsSync(SHARED_CONTEXT_FILE)) return null;
    const shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
    
    // Find patterns used in multiple projects
    const multiProjectPatterns = Object.entries(shared.sharedPatterns || {})
      .filter(([_, projects]) => projects.length > 1)
      .map(([pattern, projects]) => ({ pattern, projects, count: projects.length }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalProjects: Object.keys(shared.projects || {}).length,
      sharedPatterns: multiProjectPatterns.slice(0, 20),
      projects: Object.values(shared.projects || {}).map(p => ({
        name: p.name,
        framework: p.framework,
        lastUpdated: p.lastUpdated,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Get hooks shared across projects
 */
function getSharedHooks() {
  try {
    if (!fs.existsSync(SHARED_CONTEXT_FILE)) return [];
    const shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
    
    return Object.entries(shared.sharedHooks || {})
      .filter(([_, projects]) => projects.length > 1)
      .map(([hook, projects]) => ({ hook, projects, count: projects.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  } catch {
    return [];
  }
}

/**
 * Get components shared across projects
 */
function getSharedComponents() {
  try {
    if (!fs.existsSync(SHARED_CONTEXT_FILE)) return [];
    const shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
    
    return Object.entries(shared.sharedComponents || {})
      .filter(([_, projects]) => projects.length > 1)
      .map(([component, projects]) => ({ component, projects, count: projects.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  } catch {
    return [];
  }
}

/**
 * Find similar projects based on tech stack
 */
function findSimilarProjects(analysis) {
  try {
    if (!fs.existsSync(SHARED_CONTEXT_FILE)) return [];
    const shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
    
    const similar = [];
    for (const [id, proj] of Object.entries(shared.projects || {})) {
      let score = 0;
      if (proj.framework === analysis.framework) score += 3;
      if (proj.language === analysis.language) score += 2;
      if (proj.stateManagement === analysis.patterns?.stateManagement) score += 2;
      if (proj.validation === analysis.patterns?.validation) score += 1;
      
      if (score > 0 && proj.name !== analysis.name) {
        similar.push({ ...proj, similarityScore: score });
      }
    }
    
    return similar.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Get all registered projects
 */
function getAllProjects() {
  try {
    if (!fs.existsSync(SHARED_CONTEXT_FILE)) return [];
    const shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
    return Object.values(shared.projects || {});
  } catch {
    return [];
  }
}

/**
 * Remove project from shared context
 */
function removeProject(projectPath) {
  try {
    if (!fs.existsSync(SHARED_CONTEXT_FILE)) return false;
    const shared = JSON.parse(fs.readFileSync(SHARED_CONTEXT_FILE, "utf-8"));
    const projectId = crypto.createHash("md5").update(projectPath).digest("hex").slice(0, 8);
    
    if (shared.projects[projectId]) {
      delete shared.projects[projectId];
      fs.writeFileSync(SHARED_CONTEXT_FILE, JSON.stringify(shared, null, 2));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Clear all shared context
 */
function clearSharedContext() {
  const shared = {
    version: "1.0.0",
    projects: {},
    sharedPatterns: {},
    sharedHooks: {},
    sharedComponents: {},
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(SHARED_CONTEXT_FILE, JSON.stringify(shared, null, 2));
}

module.exports = {
  SHARED_CONTEXT_FILE,
  initializeSharedContext,
  registerSharedContext,
  getSharedPatterns,
  getSharedHooks,
  getSharedComponents,
  findSimilarProjects,
  getAllProjects,
  removeProject,
  clearSharedContext,
};
