/**
 * AI Memory System Module
 * Self-learning memory that persists across projects
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// Global memory directory
const GUARDRAIL_HOME = path.join(os.homedir(), ".guardrail");
const MEMORY_FILE = path.join(GUARDRAIL_HOME, "global-memory.json");

/**
 * Initialize global memory directory
 */
function initializeMemory() {
  if (!fs.existsSync(GUARDRAIL_HOME)) {
    fs.mkdirSync(GUARDRAIL_HOME, { recursive: true });
  }
  
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
      version: "1.0.0",
      created: new Date().toISOString(),
      projects: {},
      learnings: [],
      patterns: {},
      preferences: {},
    }, null, 2));
  }
}

/**
 * Load global AI memory
 */
function loadMemory() {
  initializeMemory();
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch {
    return { projects: {}, learnings: [], patterns: {}, preferences: {} };
  }
}

/**
 * Save to global AI memory
 */
function saveMemory(memory) {
  initializeMemory();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

/**
 * Learn from project analysis and update memory
 */
function learnFromProject(projectPath, analysis) {
  const memory = loadMemory();
  const projectId = crypto.createHash("md5").update(projectPath).digest("hex").slice(0, 8);
  
  // Store project info
  memory.projects[projectId] = {
    path: projectPath,
    name: analysis.name,
    framework: analysis.framework,
    language: analysis.language,
    lastAnalyzed: new Date().toISOString(),
    patterns: analysis.patterns,
    stats: analysis.stats,
  };

  // Learn patterns across projects
  if (analysis.patterns?.stateManagement) {
    memory.patterns.stateManagement = memory.patterns.stateManagement || {};
    memory.patterns.stateManagement[analysis.patterns.stateManagement] = 
      (memory.patterns.stateManagement[analysis.patterns.stateManagement] || 0) + 1;
  }

  if (analysis.patterns?.validation) {
    memory.patterns.validation = memory.patterns.validation || {};
    memory.patterns.validation[analysis.patterns.validation] = 
      (memory.patterns.validation[analysis.patterns.validation] || 0) + 1;
  }

  if (analysis.framework) {
    memory.patterns.frameworks = memory.patterns.frameworks || {};
    memory.patterns.frameworks[analysis.framework] = 
      (memory.patterns.frameworks[analysis.framework] || 0) + 1;
  }

  // Add learning entry
  memory.learnings.push({
    timestamp: new Date().toISOString(),
    project: analysis.name,
    action: "context_generated",
    details: {
      files: analysis.stats?.totalFiles || 0,
      components: analysis.components?.length || 0,
      hooks: analysis.patterns?.hooks?.length || 0,
    },
  });

  // Keep only last 100 learnings
  if (memory.learnings.length > 100) {
    memory.learnings = memory.learnings.slice(-100);
  }

  saveMemory(memory);
  return memory;
}

/**
 * Get recommendations based on learned patterns
 */
function getRecommendations(analysis) {
  const memory = loadMemory();
  const recommendations = [];

  // Recommend popular patterns from other projects
  if (!analysis.patterns?.stateManagement && memory.patterns.stateManagement) {
    const popular = Object.entries(memory.patterns.stateManagement)
      .sort((a, b) => b[1] - a[1])[0];
    if (popular) {
      recommendations.push({
        type: "state_management",
        message: `Consider using ${popular[0]} for state management (used in ${popular[1]} of your projects)`,
      });
    }
  }

  if (!analysis.patterns?.validation && memory.patterns.validation) {
    const popular = Object.entries(memory.patterns.validation)
      .sort((a, b) => b[1] - a[1])[0];
    if (popular) {
      recommendations.push({
        type: "validation",
        message: `Consider using ${popular[0]} for validation (used in ${popular[1]} of your projects)`,
      });
    }
  }

  return recommendations;
}

/**
 * Get memory statistics
 */
function getMemoryStats() {
  const memory = loadMemory();
  return {
    projectCount: Object.keys(memory.projects || {}).length,
    learningCount: memory.learnings?.length || 0,
    patterns: memory.patterns || {},
    created: memory.created,
  };
}

/**
 * Clear memory for a specific project
 */
function clearProjectMemory(projectPath) {
  const memory = loadMemory();
  const projectId = crypto.createHash("md5").update(projectPath).digest("hex").slice(0, 8);
  
  if (memory.projects[projectId]) {
    delete memory.projects[projectId];
    saveMemory(memory);
    return true;
  }
  return false;
}

/**
 * Clear all memory
 */
function clearAllMemory() {
  const memory = {
    version: "1.0.0",
    created: new Date().toISOString(),
    projects: {},
    learnings: [],
    patterns: {},
    preferences: {},
  };
  saveMemory(memory);
}

module.exports = {
  GUARDRAIL_HOME,
  MEMORY_FILE,
  initializeMemory,
  loadMemory,
  saveMemory,
  learnFromProject,
  getRecommendations,
  getMemoryStats,
  clearProjectMemory,
  clearAllMemory,
};
