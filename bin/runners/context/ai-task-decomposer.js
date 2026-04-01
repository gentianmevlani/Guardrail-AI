/**
 * AI Task Decomposer Module
 * Analyzes user prompts and selects relevant context
 */

const { semanticSearch, loadSearchIndex } = require("./semantic-search");

/**
 * Task type patterns
 */
const TASK_PATTERNS = {
  create: {
    keywords: ["create", "add", "build", "make", "new", "implement", "write"],
    contextTypes: ["components", "hooks", "types", "patterns"],
    priority: ["components", "hooks", "types"],
  },
  fix: {
    keywords: ["fix", "bug", "error", "issue", "problem", "broken"],
    contextTypes: ["components", "utils", "error-handling", "logs"],
    priority: ["error-handling", "components", "utils"],
  },
  refactor: {
    keywords: ["refactor", "improve", "optimize", "clean", "reorganize"],
    contextTypes: ["architecture", "patterns", "utils", "components"],
    priority: ["architecture", "patterns", "components"],
  },
  test: {
    keywords: ["test", "spec", "coverage", "unit", "integration"],
    contextTypes: ["test-files", "components", "utils", "mocks"],
    priority: ["test-files", "components", "utils"],
  },
  api: {
    keywords: ["api", "endpoint", "route", "server", "backend"],
    contextTypes: ["api-routes", "types", "validation", "models"],
    priority: ["api-routes", "types", "validation"],
  },
  style: {
    keywords: ["style", "css", "design", "ui", "theme", "layout"],
    contextTypes: ["styles", "components", "themes"],
    priority: ["styles", "components", "themes"],
  },
  config: {
    keywords: ["config", "setup", "install", "deploy", "build"],
    contextTypes: ["config-files", "package-json", "env-vars"],
    priority: ["config-files", "package-json", "env-vars"],
  },
};

/**
 * Extract task type from prompt
 */
function extractTaskType(prompt) {
  const lower = prompt.toLowerCase();
  let bestMatch = null;
  let maxScore = 0;
  
  for (const [type, pattern] of Object.entries(TASK_PATTERNS)) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = type;
    }
  }
  
  return bestMatch || "general";
}

/**
 * Extract entities from prompt
 */
function extractEntities(prompt) {
  const entities = {
    components: [],
    files: [],
    technologies: [],
    features: [],
  };
  
  // Component names (PascalCase)
  const componentMatches = prompt.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
  entities.components = [...new Set(componentMatches)];
  
  // File paths
  const fileMatches = prompt.match(/[\w\-\/]+\.(ts|tsx|js|jsx|json|css|md)/g) || [];
  entities.files = fileMatches;
  
  // Technology keywords
  const techKeywords = [
    "react", "nextjs", "typescript", "prisma", "tailwind", "zustand",
    "zod", "jest", "playwright", "express", "mongodb", "postgresql",
    "graphql", "apollo", "redux", "webpack", "vite", "eslint"
  ];
  
  for (const tech of techKeywords) {
    if (prompt.toLowerCase().includes(tech)) {
      entities.technologies.push(tech);
    }
  }
  
  // Feature keywords
  const featureKeywords = [
    "auth", "authentication", "login", "signup", "dashboard", "admin",
    "profile", "settings", "search", "filter", "pagination", "modal",
    "form", "input", "button", "navigation", "header", "footer"
  ];
  
  for (const feature of featureKeywords) {
    if (prompt.toLowerCase().includes(feature)) {
      entities.features.push(feature);
    }
  }
  
  return entities;
}

/**
 * Build search query from entities
 */
function buildSearchQuery(entities, taskType) {
  const terms = [];
  
  // Add task-specific terms
  if (taskType && TASK_PATTERNS[taskType]) {
    terms.push(...TASK_PATTERNS[taskType].keywords.slice(0, 2));
  }
  
  // Add entities
  terms.push(...entities.components);
  terms.push(...entities.features);
  terms.push(...entities.technologies);
  
  // Add file-specific terms
  if (entities.files.length > 0) {
    const file = entities.files[0];
    const parts = file.split("/");
    if (parts.length > 1) {
      terms.push(parts[parts.length - 2]); // Directory
    }
    terms.push(path.basename(file, path.extname(file))); // Filename without ext
  }
  
  return terms.join(" ");
}

/**
 * Select relevant context based on task
 */
function selectRelevantContext(searchResults, taskType, maxTokens = 4000) {
  if (!searchResults || searchResults.length === 0) {
    return { files: [], totalTokens: 0 };
  }
  
  const priorities = taskType && TASK_PATTERNS[taskType] 
    ? TASK_PATTERNS[taskType].priority 
    : ["components", "hooks", "types", "utils"];
  
  // Score files based on type and relevance
  const scored = searchResults.map(result => {
    let score = result.similarity;
    
    // Boost based on file type priority
    for (let i = 0; i < priorities.length; i++) {
      if (result.file.includes(priorities[i]) || 
          result.type === priorities[i].slice(0, -1)) {
        score += (priorities.length - i) * 0.2;
        break;
      }
    }
    
    return { ...result, score };
  });
  
  // Sort by combined score
  scored.sort((a, b) => b.score - a.score);
  
  // Select files within token limit
  const selected = [];
  let totalTokens = 0;
  
  for (const file of scored) {
    const estimatedTokens = file.text.length / 4;
    if (totalTokens + estimatedTokens <= maxTokens) {
      selected.push({
        file: file.file,
        content: file.text,
        relevance: file.score,
        tokens: Math.round(estimatedTokens),
      });
      totalTokens += estimatedTokens;
    }
  }
  
  return {
    files: selected,
    totalTokens: Math.round(totalTokens),
  };
}

/**
 * Decompose task and generate context plan
 */
function decomposeTask(prompt, projectPath, options = {}) {
  const { maxTokens = 4000, includeSemantic = true } = options;
  
  // Extract task information
  const taskType = extractTaskType(prompt);
  const entities = extractEntities(prompt);
  const searchQuery = buildSearchQuery(entities, taskType);
  
  const plan = {
    prompt,
    taskType,
    entities,
    searchQuery,
    context: {
      files: [],
      totalTokens: 0,
    },
    recommendations: [],
  };
  
  // Semantic search if available
  if (includeSemantic) {
    const searchIndex = loadSearchIndex(projectPath);
    if (searchIndex) {
      const searchResults = semanticSearch(searchIndex, searchQuery, 20);
      plan.context = selectRelevantContext(searchResults, taskType, maxTokens);
    }
  }
  
  // Generate recommendations
  plan.recommendations = generateRecommendations(plan);
  
  return plan;
}

/**
 * Generate task-specific recommendations
 */
function generateRecommendations(plan) {
  const recommendations = [];
  const { taskType, entities } = plan;
  
  // Task-specific recommendations
  if (taskType === "create" && entities.components.length > 0) {
    recommendations.push("Check if similar components already exist");
    recommendations.push("Follow established component patterns");
  }
  
  if (taskType === "fix") {
    recommendations.push("Look for error handling patterns");
    recommendations.push("Check console logs and error boundaries");
  }
  
  if (taskType === "test") {
    recommendations.push("Review existing test patterns");
    recommendations.push("Use established mocking strategies");
  }
  
  if (taskType === "api") {
    recommendations.push("Follow API response patterns");
    recommendations.push("Include proper validation");
  }
  
  // Entity-specific recommendations
  if (entities.technologies.includes("typescript")) {
    recommendations.push("Define proper TypeScript types");
  }
  
  if (entities.technologies.includes("prisma")) {
    recommendations.push("Check Prisma schema for models");
  }
  
  if (entities.technologies.includes("tailwind")) {
    recommendations.push("Use Tailwind CSS classes");
  }
  
  return recommendations;
}

/**
 * Generate task decomposition report
 */
function generateDecompositionReport(plan) {
  let report = `# Task Decomposition Report\n\n`;
  report += `**Task Type:** ${plan.taskType}\n`;
  report += `**Search Query:** "${plan.searchQuery}"\n\n`;
  
  // Entities
  report += `## Extracted Entities\n\n`;
  if (plan.entities.components.length > 0) {
    report += `- Components: ${plan.entities.components.join(", ")}\n`;
  }
  if (plan.entities.files.length > 0) {
    report += `- Files: ${plan.entities.files.join(", ")}\n`;
  }
  if (plan.entities.technologies.length > 0) {
    report += `- Technologies: ${plan.entities.technologies.join(", ")}\n`;
  }
  if (plan.entities.features.length > 0) {
    report += `- Features: ${plan.entities.features.join(", ")}\n`;
  }
  
  // Context
  report += `\n## Selected Context (${plan.context.files.length} files)\n\n`;
  report += `Total Tokens: ${plan.context.totalTokens}\n\n`;
  
  for (const file of plan.context.files.slice(0, 10)) {
    report += `### ${file.file}\n`;
    report += `Relevance: ${(file.relevance * 100).toFixed(1)}%\n`;
    report += `Tokens: ${file.tokens}\n\n`;
  }
  
  // Recommendations
  if (plan.recommendations.length > 0) {
    report += `\n## Recommendations\n\n`;
    for (const rec of plan.recommendations) {
      report += `- ${rec}\n`;
    }
  }
  
  return report;
}

module.exports = {
  decomposeTask,
  generateDecompositionReport,
  extractTaskType,
  extractEntities,
  selectRelevantContext,
  TASK_PATTERNS,
};
