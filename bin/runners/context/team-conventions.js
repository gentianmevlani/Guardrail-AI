/**
 * Team Conventions Learning Module
 * Learns individual developer styles from git blame
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Execute git command safely
 */
function execGit(command, cwd = process.cwd()) {
  try {
    return execSync(command, { cwd, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Analyze author's coding style from git blame
 */
function analyzeAuthorStyle(author, projectPath, fileLimit = 20) {
  // Get files touched by author
  const output = execGit(`log --author="${author}" --name-only --pretty=format:"" | sort | uniq`, projectPath);
  if (!output) return null;
  
  const files = output.split("\n")
    .filter(f => f && (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".jsx")))
    .slice(0, fileLimit);
  
  const style = {
    author,
    filesAnalyzed: files.length,
    patterns: {
      imports: {},
      naming: {
        components: {},
        functions: {},
        variables: {},
      },
      formatting: {
        semicolons: 0,
        quotes: { single: 0, double: 0 },
        trailingCommas: 0,
      },
      comments: {
        jsdoc: 0,
        inline: 0,
        block: 0,
      },
      react: {
        functional: 0,
        class: 0,
        hooks: [],
      },
      typescript: {
        explicitTypes: 0,
        interfaces: 0,
        types: 0,
      },
    },
  };
  
  for (const file of files) {
    try {
      const blameOutput = execGit(`blame --line-porcelain "${file}"`, projectPath);
      if (!blameOutput) continue;
      
      const lines = blameOutput.split("\n");
      let currentAuthor = null;
      let code = "";
      
      for (const line of lines) {
        if (line.startsWith(`author ${author}`)) {
          currentAuthor = author;
        } else if (line.startsWith("author ") && currentAuthor === author) {
          currentAuthor = null;
        } else if (line.startsWith("\t") && currentAuthor === author) {
          code += line.slice(1) + "\n";
        }
      }
      
      // Analyze the collected code
      analyzeCodeStyle(code, style);
    } catch {}
  }
  
  // Calculate percentages
  const totalLines = style.patterns.formatting.semicolons + 
                    style.patterns.formatting.quotes.single + 
                    style.patterns.formatting.quotes.double;
  
  if (totalLines > 0) {
    style.patterns.formatting.semiconPercentage = (style.patterns.formatting.semicolons / totalLines) * 100;
    style.patterns.formatting.singleQuotePercentage = (style.patterns.formatting.quotes.single / totalLines) * 100;
  }
  
  return style;
}

/**
 * Analyze code patterns from content
 */
function analyzeCodeStyle(content, style) {
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Import patterns
    if (trimmed.startsWith("import ")) {
      if (trimmed.includes(" { ")) {
        style.patterns.imports.named = (style.patterns.imports.named || 0) + 1;
      } else if (trimmed.includes(" * as ")) {
        style.patterns.imports.namespace = (style.patterns.imports.namespace || 0) + 1;
      } else {
        style.patterns.imports.default = (style.patterns.imports.default || 0) + 1;
      }
    }
    
    // Naming patterns
    if (trimmed.includes("function ") || trimmed.includes("const ")) {
      if (/^[A-Z]/.test(trimmed)) {
        style.patterns.naming.components.pascalCase = (style.patterns.naming.components.pascalCase || 0) + 1;
      } else if (/^[a-z][A-Z]/.test(trimmed)) {
        style.patterns.naming.functions.camelCase = (style.patterns.naming.functions.camelCase || 0) + 1;
      }
    }
    
    // Formatting
    if (trimmed.endsWith(";")) {
      style.patterns.formatting.semicolons++;
    }
    if (trimmed.includes("'")) {
      style.patterns.formatting.quotes.single++;
    }
    if (trimmed.includes('"')) {
      style.patterns.formatting.quotes.double++;
    }
    if (trimmed.includes(",") && !trimmed.includes(", ")) {
      style.patterns.formatting.trailingCommas++;
    }
    
    // Comments
    if (trimmed.startsWith("/**") || trimmed.startsWith(" *")) {
      style.patterns.comments.jsdoc++;
    } else if (trimmed.startsWith("//")) {
      style.patterns.comments.inline++;
    } else if (trimmed.startsWith("/*")) {
      style.patterns.comments.block++;
    }
    
    // React patterns
    if (trimmed.includes("function ") && /^[A-Z]/.test(trimmed)) {
      style.patterns.react.functional++;
    } else if (trimmed.includes("class ") && trimmed.includes("extends")) {
      style.patterns.react.class++;
    }
    
    // Hooks
    const hookMatch = trimmed.match(/(use[A-Z]\w+)/);
    if (hookMatch) {
      if (!style.patterns.react.hooks.includes(hookMatch[1])) {
        style.patterns.react.hooks.push(hookMatch[1]);
      }
    }
    
    // TypeScript
    if (trimmed.includes(": ")) {
      style.patterns.typescript.explicitTypes++;
    }
    if (trimmed.includes("interface ")) {
      style.patterns.typescript.interfaces++;
    }
    if (trimmed.includes("type ")) {
      style.patterns.typescript.types++;
    }
  }
}

/**
 * Get team conventions summary
 */
function getTeamConventions(projectPath) {
  const authorsOutput = execGit("log --format='%an' | sort | uniq", projectPath);
  if (!authorsOutput) return null;
  
  const authors = authorsOutput.split("\n").filter(a => a && a !== "GitHub Actions");
  const conventions = {
    authors: [],
    commonPatterns: {
      imports: {},
      formatting: {
        semicolons: { with: 0, without: 0 },
        quotes: { single: 0, double: 0 },
      },
      naming: {
        components: "PascalCase",
        functions: "camelCase",
      },
    },
    recommendations: [],
  };
  
  // Analyze top contributors
  for (const author of authors.slice(0, 5)) {
    const style = analyzeAuthorStyle(author, projectPath, 10);
    if (style) {
      conventions.authors.push({
        name: author,
        filesContributed: style.filesAnalyzed,
        patterns: style.patterns,
      });
    }
  }
  
  // Find common patterns
  if (conventions.authors.length > 0) {
    // Import preferences
    const importCounts = { named: 0, default: 0, namespace: 0 };
    for (const author of conventions.authors) {
      importCounts.named += author.patterns.imports.named || 0;
      importCounts.default += author.patterns.imports.default || 0;
      importCounts.namespace += author.patterns.imports.namespace || 0;
    }
    
    const totalImports = importCounts.named + importCounts.default + importCounts.namespace;
    if (totalImports > 0) {
      if (importCounts.named / totalImports > 0.5) {
        conventions.commonPatterns.imports.preferred = "named imports";
      } else if (importCounts.default / totalImports > 0.5) {
        conventions.commonPatterns.imports.preferred = "default imports";
      }
    }
    
    // Formatting preferences
    for (const author of conventions.authors) {
      if (author.patterns.formatting.semiconPercentage > 70) {
        conventions.commonPatterns.formatting.semicons.with++;
      } else {
        conventions.commonPatterns.formatting.semicons.without++;
      }
      
      if (author.patterns.formatting.singleQuotePercentage > 70) {
        conventions.commonPatterns.formatting.quotes.single++;
      } else {
        conventions.commonPatterns.formatting.quotes.double++;
      }
    }
    
    // Generate recommendations
    if (conventions.commonPatterns.formatting.semicons.with > conventions.commonPatterns.formatting.semicons.without) {
      conventions.recommendations.push("Use semicolons consistently (team preference)");
    }
    
    if (conventions.commonPatterns.formatting.quotes.single > conventions.commonPatterns.formatting.quotes.double) {
      conventions.recommendations.push("Use single quotes for strings (team preference)");
    }
  }
  
  return conventions;
}

/**
 * Generate team conventions report
 */
function generateTeamReport(projectPath) {
  const conventions = getTeamConventions(projectPath);
  if (!conventions) {
    return {
      available: false,
      message: "No git history found",
    };
  }
  
  const report = {
    available: true,
    summary: {
      teamSize: conventions.authors.length,
      totalFilesAnalyzed: conventions.authors.reduce((sum, a) => sum + a.filesContributed, 0),
    },
    conventions: conventions.commonPatterns,
    contributors: conventions.authors.map(a => ({
      name: a.name,
      filesContributed: a.filesContributed,
      style: {
        imports: a.patterns.imports,
        formatting: {
          usesSemicolons: a.patterns.formatting.semiconPercentage > 70,
          prefersSingleQuotes: a.patterns.formatting.singleQuotePercentage > 70,
        },
        typescript: {
          usesExplicitTypes: a.patterns.typescript.explicitTypes > 0,
          prefersInterfaces: a.patterns.typescript.interfaces > a.patterns.typescript.types,
        },
      },
    })),
    recommendations: conventions.recommendations,
  };
  
  return report;
}

module.exports = {
  analyzeAuthorStyle,
  getTeamConventions,
  generateTeamReport,
};
