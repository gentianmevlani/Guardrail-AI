/**
 * Smart Context Pruning Module
 * Reduces context to most relevant subset based on current file/task
 */

const fs = require("fs");
const path = require("path");

/**
 * Find files recursively (local helper)
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Calculate relevance score for a file based on context
 */
function calculateRelevanceScore(filePath, context, analysis) {
  let score = 0;
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  
  // Base score for all files
  score += 1;
  
  // Boost for same directory
  if (context.currentFile) {
    const currentDir = path.dirname(context.currentFile);
    const fileDir = path.dirname(relativePath);
    if (currentDir === fileDir) score += 5;
  }
  
  // Boost for shared directory levels
  if (context.currentFile) {
    const currentParts = context.currentFile.split("/");
    const fileParts = relativePath.split("/");
    const sharedLevels = Math.min(
      currentParts.length - 1,
      fileParts.length - 1
    );
    for (let i = 0; i < sharedLevels; i++) {
      if (currentParts[i] === fileParts[i]) {
        score += 2;
      } else {
        break;
      }
    }
  }
  
  // Boost for commonly imported files
  if (analysis.imports?.internalAliases) {
    for (const alias of analysis.imports.internalAliases) {
      if (relativePath.startsWith(alias.replace("@", "src/"))) {
        score += 3;
      }
    }
  }
  
  // Boost based on file type
  const ext = path.extname(relativePath);
  const baseName = path.basename(relativePath, ext);
  
  // Components are highly relevant
  if (relativePath.includes("/components/") && /^[A-Z]/.test(baseName)) {
    score += 4;
  }
  
  // Hooks are moderately relevant
  if (relativePath.includes("/hooks/") || baseName.startsWith("use")) {
    score += 3;
  }
  
  // API routes for API-related tasks
  if (context.task === "api" && relativePath.includes("/api/")) {
    score += 5;
  }
  
  // Utils for utility tasks
  if (context.task === "utility" && (relativePath.includes("/utils/") || relativePath.includes("/lib/"))) {
    score += 4;
  }
  
  // Boost for files with many imports (likely core files)
  const fileStats = analysis.stats?.byExtension || {};
  if (fileStats[ext]) {
    score += Math.min(2, fileStats[ext] / 10);
  }
  
  // Boost for recently modified files (if git info available)
  if (context.recentFiles && context.recentFiles.includes(relativePath)) {
    score += 3;
  }
  
  // Boost for files mentioned in custom hooks
  if (analysis.patterns?.hooks?.includes(baseName)) {
    score += 2;
  }
  
  return score;
}

/**
 * Prune context to most relevant files
 */
function pruneContext(analysis, context = {}) {
  const {
    maxTokens = 8000,
    currentFile = "",
    task = "general",
    includeTypes = ["components", "hooks", "utils", "api"],
    excludePatterns = ["*.test.*", "*.spec.*", "node_modules"],
  } = context;
  
  // Get all relevant files
  const allFiles = findFiles(process.cwd(), [".ts", ".tsx", ".js", ".jsx"], 5);
  
  // Filter by type and exclude patterns
  const filteredFiles = allFiles.filter(file => {
    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, "/");
    
    // Check exclude patterns
    for (const pattern of excludePatterns) {
      if (relativePath.includes(pattern.replace("*", ""))) {
        return false;
      }
    }
    
    // Check include types
    const isInComponents = relativePath.includes("/components/");
    const isInHooks = relativePath.includes("/hooks/") || path.basename(file).startsWith("use");
    const isInUtils = relativePath.includes("/utils/") || relativePath.includes("/lib/");
    const isInApi = relativePath.includes("/api/") || relativePath.includes("/routes/");
    
    return (
      (includeTypes.includes("components") && isInComponents) ||
      (includeTypes.includes("hooks") && isInHooks) ||
      (includeTypes.includes("utils") && isInUtils) ||
      (includeTypes.includes("api") && isInApi) ||
      !includeTypes.length
    );
  });
  
  // Score and rank files
  const scoredFiles = filteredFiles.map(file => ({
    path: file,
    relativePath: path.relative(process.cwd(), file).replace(/\\/g, "/"),
    score: calculateRelevanceScore(file, context, analysis),
  }));
  
  // Sort by score (descending)
  scoredFiles.sort((a, b) => b.score - a.score);
  
  // Estimate token usage (rough estimate: ~4 tokens per character)
  let totalTokens = 0;
  const selectedFiles = [];
  
  for (const file of scoredFiles) {
    try {
      const content = fs.readFileSync(file.path, "utf-8");
      const fileTokens = content.length / 4;
      
      if (totalTokens + fileTokens <= maxTokens) {
        selectedFiles.push({
          ...file,
          content,
          tokens: Math.round(fileTokens),
        });
        totalTokens += fileTokens;
      } else {
        // Try to include partial content for important files
        if (file.score > 5) {
          const remainingTokens = maxTokens - totalTokens;
          const charsToFit = remainingTokens * 4;
          const partialContent = content.slice(0, charsToFit) + "\n... [truncated]";
          
          selectedFiles.push({
            ...file,
            content: partialContent,
            tokens: Math.round(partialContent.length / 4),
            truncated: true,
          });
          totalTokens += partialContent.length / 4;
        }
        break;
      }
    } catch {}
  }
  
  return {
    files: selectedFiles,
    totalTokens: Math.round(totalTokens),
    maxTokens,
    includedCount: selectedFiles.length,
    totalCount: filteredFiles.length,
    pruned: filteredFiles.length - selectedFiles.length,
  };
}

/**
 * Generate pruned context JSON for MCP
 */
function generatePrunedContext(analysis, context = {}) {
  const pruned = pruneContext(analysis, context);
  
  return {
    version: "3.0.0-pruned",
    generatedAt: new Date().toISOString(),
    context: {
      currentFile: context.currentFile || "",
      task: context.task || "general",
      maxTokens: context.maxTokens || 8000,
    },
    summary: {
      totalFiles: pruned.totalCount,
      includedFiles: pruned.includedCount,
      prunedFiles: pruned.pruned,
      estimatedTokens: pruned.totalTokens,
    },
    files: pruned.files.map(f => ({
      path: f.relativePath,
      score: f.score,
      tokens: f.tokens,
      truncated: f.truncated || false,
      content: f.content,
    })),
  };
}

/**
 * Get context for specific file
 */
function getContextForFile(filePath, analysis) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  
  // Extract imports from current file
  let imports = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const importMatches = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
    
    for (const match of importMatches) {
      const source = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
      if (source && source.startsWith(".")) {
        // Resolve relative import
        const fromDir = path.dirname(relativePath);
        const resolvedPath = path.resolve(process.cwd(), fromDir, source);
        imports.push(path.relative(process.cwd(), resolvedPath).replace(/\\/g, "/"));
      }
    }
  } catch {}
  
  // Prune with focus on imported files
  const context = generatePrunedContext(analysis, {
    currentFile: relativePath,
    maxTokens: 6000,
    task: "file-specific",
  });
  
  // Boost imported files in the results
  for (const file of context.files) {
    if (imports.includes(file.path)) {
      file.score += 10;
    }
  }
  
  // Re-sort
  context.files.sort((a, b) => b.score - a.score);
  
  return context;
}

module.exports = {
  pruneContext,
  generatePrunedContext,
  getContextForFile,
  calculateRelevanceScore,
};
