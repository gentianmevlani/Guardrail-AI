/**
 * Git-Aware Context Module
 * Extracts commit patterns, branch conventions, and PR templates
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Check if directory is a git repository
 */
function isGitRepo(projectPath) {
  return fs.existsSync(path.join(projectPath, ".git"));
}

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
 * Get recent commits with patterns
 */
function getRecentCommits(projectPath, limit = 20) {
  if (!isGitRepo(projectPath)) return null;
  
  const output = execGit(`log --oneline -${limit}`, projectPath);
  if (!output) return null;
  
  const commits = output.split("\n").map(line => {
    const [hash, ...messageParts] = line.split(" ");
    const message = messageParts.join(" ");
    
    // Detect patterns
    const patterns = {
      hasTicket: /(FEAT|FIX|CHORE|DOCS|REFACTOR|TEST|PERF)-\d+/i.test(message),
      ticketType: message.match(/(FEAT|FIX|CHORE|DOCS|REFACTOR|TEST|PERF)-\d+/i)?.[1],
      isBreaking: /BREAKING CHANGE/i.test(message),
      hasScope: /\([^)]+\):/.test(message),
      scope: message.match(/\(([^)]+)\):/)?.[1],
      isWIP: /wip|work in progress/i.test(message),
      isMerge: /^Merge /i.test(message),
    };
    
    return {
      hash,
      message,
      patterns,
    };
  });
  
  // Analyze patterns
  const analysis = {
    totalCommits: commits.length,
    withTickets: commits.filter(c => c.patterns.hasTicket).length,
    breakingChanges: commits.filter(c => c.patterns.isBreaking).length,
    withScopes: commits.filter(c => c.patterns.hasScope).length,
    commonScopes: {},
    ticketTypes: {},
  };
  
  // Count common patterns
  for (const commit of commits) {
    if (commit.patterns.scope) {
      analysis.commonScopes[commit.patterns.scope] = (analysis.commonScopes[commit.patterns.scope] || 0) + 1;
    }
    if (commit.patterns.ticketType) {
      analysis.ticketTypes[commit.patterns.ticketType] = (analysis.ticketTypes[commit.patterns.ticketType] || 0) + 1;
    }
  }
  
  return {
    commits,
    analysis,
  };
}

/**
 * Get branch information and conventions
 */
function getBranchInfo(projectPath) {
  if (!isGitRepo(projectPath)) return null;
  
  const currentBranch = execGit("branch --show-current", projectPath);
  const allBranches = execGit("branch -a", projectPath);
  const defaultBranch = execGit("symbolic-ref refs/remotes/origin/HEAD | sed 's@^.*/@@'", projectPath);
  
  if (!currentBranch || !allBranches) return null;
  
  const branches = allBranches.split("\n").map(b => b.replace("*", "").trim());
  const localBranches = branches.filter(b => !b.startsWith("remotes/"));
  const remoteBranches = branches.filter(b => b.startsWith("remotes/")).map(b => b.replace("remotes/origin/", ""));
  
  // Analyze naming patterns
  const patterns = {
    hasFeaturePrefix: localBranches.some(b => /^feature\//.test(b)),
    hasBugfixPrefix: localBranches.some(b => /^bugfix\//.test(b) || /^fix\//.test(b)),
    hasHotfixPrefix: localBranches.some(b => /^hotfix\//.test(b)),
    hasIssueNumber: localBranches.some(b => /\d+$/.test(b)),
    usesSlashes: localBranches.some(b => b.includes("/")),
    usesKebabCase: localBranches.some(b => /-/.test(b)),
  };
  
  // Common prefixes
  const prefixes = {};
  for (const branch of localBranches) {
    if (branch.includes("/")) {
      const prefix = branch.split("/")[0];
      prefixes[prefix] = (prefixes[prefix] || 0) + 1;
    }
  }
  
  return {
    current: currentBranch,
    default: defaultBranch,
    total: localBranches.length,
    local: localBranches,
    remote: remoteBranches,
    patterns,
    commonPrefixes: Object.entries(prefixes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  };
}

/**
 * Get PR template information
 */
function getPRTemplate(projectPath) {
  const templates = [
    ".github/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "PULL_REQUEST_TEMPLATE.md",
  ];
  
  for (const template of templates) {
    const templatePath = path.join(projectPath, template);
    if (fs.existsSync(templatePath)) {
      try {
        const content = fs.readFileSync(templatePath, "utf-8");
        
        // Analyze template sections
        const sections = [];
        const lines = content.split("\n");
        let currentSection = null;
        
        for (const line of lines) {
          if (line.startsWith("##") || line.startsWith("###")) {
            if (currentSection) {
              sections.push(currentSection);
            }
            currentSection = {
              title: line.replace(/^#+\s*/, ""),
              required: line.includes("Required") || line.includes("MUST"),
              content: [],
            };
          } else if (currentSection && line.trim()) {
            currentSection.content.push(line);
          }
        }
        
        if (currentSection) {
          sections.push(currentSection);
        }
        
        return {
          file: template,
          sections,
          hasRequiredSections: sections.some(s => s.required),
          sectionCount: sections.length,
        };
      } catch {}
    }
  }
  
  return null;
}

/**
 * Get git blame information for team patterns
 */
function getTeamPatterns(projectPath, fileLimit = 10) {
  if (!isGitRepo(projectPath)) return null;
  
  // Get recent files
  const output = execGit("ls-files -z", projectPath);
  if (!output) return null;
  
  const files = output.split("\0")
    .filter(f => f && (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js")))
    .slice(0, fileLimit);
  
  const authorStats = {};
  const patterns = {
    commonImports: {},
    commentStyles: {},
    functionPatterns: {},
  };
  
  for (const file of files) {
    const blameOutput = execGit(`blame --line-porcelain "${file}"`, projectPath);
    if (!blameOutput) continue;
    
    const lines = blameOutput.split("\n");
    let currentAuthor = null;
    
    for (const line of lines) {
      if (line.startsWith("author ")) {
        currentAuthor = line.slice(7);
        authorStats[currentAuthor] = (authorStats[currentAuthor] || 0) + 1;
      } else if (line.startsWith("\t") && currentAuthor) {
        const codeLine = line.slice(1);
        
        // Track patterns by author
        if (!patterns.authorPatterns) patterns.authorPatterns = {};
        if (!patterns.authorPatterns[currentAuthor]) {
          patterns.authorPatterns[currentAuthor] = {
            imports: [],
            comments: [],
            functions: [],
          };
        }
        
        // Import patterns
        if (codeLine.includes("import ")) {
          const importType = codeLine.includes(" from ") ? "named" : "default";
          patterns.authorPatterns[currentAuthor].imports.push(importType);
        }
        
        // Comment patterns
        if (codeLine.includes("//")) {
          patterns.authorPatterns[currentAuthor].comments.push(codeLine);
        }
        
        // Function patterns
        if (codeLine.includes("function ") || codeLine.includes("=>")) {
          patterns.authorPatterns[currentAuthor].functions.push(codeLine);
        }
      }
    }
  }
  
  // Analyze top contributors
  const topAuthors = Object.entries(authorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, lines]) => ({ name, lines }));
  
  return {
    topAuthors,
    totalAuthors: Object.keys(authorStats).length,
    patterns,
  };
}

/**
 * Get complete git context
 */
function getGitContext(projectPath) {
  if (!isGitRepo(projectPath)) {
    return {
      isRepo: false,
      message: "Not a git repository",
    };
  }
  
  const commits = getRecentCommits(projectPath);
  const branches = getBranchInfo(projectPath);
  const prTemplate = getPRTemplate(projectPath);
  const teamPatterns = getTeamPatterns(projectPath);
  
  return {
    isRepo: true,
    commits,
    branches,
    prTemplate,
    teamPatterns,
    conventions: {
      commitMessages: commits?.analysis || null,
      branchNaming: branches?.patterns || null,
      hasPRTemplate: !!prTemplate,
      teamSize: teamPatterns?.totalAuthors || 0,
    },
  };
}

module.exports = {
  isGitRepo,
  getGitContext,
  getRecentCommits,
  getBranchInfo,
  getPRTemplate,
  getTeamPatterns,
};
