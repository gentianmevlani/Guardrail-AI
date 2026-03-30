/**
 * Root Directory Cleanup Module
 *
 * Analyzes root directory for junk, missing standards, duplicate configs,
 * and misplaced files. Generates cleanup suggestions without auto-deleting.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_STANDARDS = {
  required: [".gitignore", "README.md", "package.json"],
  recommended: [".editorconfig", ".env.example", "LICENSE"],
  junkPatterns: [
    /\.log$/,
    /\.tmp$/,
    /\.bak$/,
    /\.swp$/,
    /^\.DS_Store$/,
    /^Thumbs\.db$/,
    /^~\$/,
    /\.orig$/,
    /^npm-debug\.log/,
    /^yarn-error\.log/,
    /^pnpm-debug\.log/,
  ],
};

function isJunkFile(filename) {
  return ROOT_STANDARDS.junkPatterns.some((p) => p.test(filename));
}

function suggestFilePlacement(filename) {
  const suggestions = {
    "CHANGELOG.md": { location: "docs/", reason: "Documentation file" },
    "CONTRIBUTING.md": { location: "docs/", reason: "Documentation file" },
    "ARCHITECTURE.md": {
      location: "docs/architecture/",
      reason: "Architecture doc",
    },
    "CODE_OF_CONDUCT.md": { location: "docs/", reason: "Documentation file" },
  };

  if (filename.endsWith(".sh") || filename.endsWith(".ps1")) {
    return {
      location: "scripts/",
      reason: "Shell script should be in scripts/",
    };
  }

  return suggestions[filename] || null;
}

function findDuplicateConfigs(rootItems) {
  const duplicates = [];
  const configGroups = {
    eslint: [
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.json",
      ".eslintrc.yml",
      "eslint.config.js",
      "eslint.config.mjs",
    ],
    prettier: [
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.json",
      ".prettierrc.yml",
      "prettier.config.js",
    ],
    babel: [".babelrc", ".babelrc.js", "babel.config.js", "babel.config.json"],
  };

  for (const [type, patterns] of Object.entries(configGroups)) {
    const found = rootItems.filter((item) =>
      patterns.some((p) => item === p || item.startsWith(p.split(".")[0])),
    );
    if (found.length > 1) {
      duplicates.push({
        type,
        files: found,
        suggestion: `Consolidate ${type} configs into single file`,
      });
    }
  }
  return duplicates;
}

function checkGitignore(projectPath) {
  const issues = [];
  const gitignorePath = path.join(projectPath, ".gitignore");

  if (!fs.existsSync(gitignorePath)) {
    issues.push({
      type: "missing_gitignore",
      suggestion: "Create .gitignore with standard patterns",
    });
    return issues;
  }

  const content = fs.readFileSync(gitignorePath, "utf-8");
  const lines = content.split("\n").map((l) => l.trim());

  const shouldHave = [
    "node_modules",
    ".env",
    ".env.local",
    "dist",
    ".next",
    "coverage",
  ];
  for (const pattern of shouldHave) {
    if (!lines.some((l) => l === pattern || l.startsWith(pattern))) {
      const checkPath = path.join(projectPath, pattern);
      if (fs.existsSync(checkPath) || pattern.startsWith(".env")) {
        issues.push({
          type: "missing_gitignore_pattern",
          pattern,
          suggestion: `Add '${pattern}' to .gitignore`,
        });
      }
    }
  }
  return issues;
}

function findCommittedBuildOutputs(projectPath) {
  const outputs = [];
  const buildDirs = ["dist", "build", ".next", "out", ".turbo"];

  for (const dir of buildDirs) {
    const dirPath = path.join(projectPath, dir);
    if (fs.existsSync(dirPath)) {
      try {
        execSync(`git ls-files --error-unmatch "${dir}" 2>/dev/null`, {
          cwd: projectPath,
          encoding: "utf-8",
        });
        outputs.push(dir);
      } catch {
        /* not in git - good */
      }
    }
  }
  return outputs;
}

function analyzeRootDirectory(projectPath) {
  const analysis = {
    junkFiles: [],
    missingStandards: [],
    duplicateConfigs: [],
    misplacedFiles: [],
    suggestions: [],
  };

  let rootItems;
  try {
    rootItems = fs.readdirSync(projectPath);
  } catch (err) {
    return analysis;
  }

  // Check for junk files
  for (const item of rootItems) {
    const fullPath = path.join(projectPath, item);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        if (isJunkFile(item)) {
          analysis.junkFiles.push({
            file: item,
            reason: "Matches junk pattern",
            suggestion: "Delete or add to .gitignore",
          });
        }

        const placement = suggestFilePlacement(item);
        if (placement) {
          analysis.misplacedFiles.push({
            file: item,
            currentLocation: "/",
            suggestedLocation: placement.location,
            reason: placement.reason,
          });
        }
      }
    } catch (err) {
      /* skip */
    }
  }

  // Check for missing standards
  for (const required of ROOT_STANDARDS.required) {
    if (!rootItems.includes(required)) {
      analysis.missingStandards.push({
        file: required,
        importance: "required",
        suggestion: `Create ${required}`,
      });
    }
  }

  for (const recommended of ROOT_STANDARDS.recommended) {
    if (!rootItems.includes(recommended)) {
      analysis.missingStandards.push({
        file: recommended,
        importance: "recommended",
        suggestion: `Consider adding ${recommended}`,
      });
    }
  }

  // Duplicate configs
  analysis.duplicateConfigs = findDuplicateConfigs(rootItems);

  // Gitignore issues
  const gitignoreIssues = checkGitignore(projectPath);
  if (gitignoreIssues.length > 0) {
    analysis.suggestions.push(...gitignoreIssues);
  }

  // Build outputs
  const committedOutputs = findCommittedBuildOutputs(projectPath);
  if (committedOutputs.length > 0) {
    analysis.suggestions.push({
      type: "build_outputs",
      files: committedOutputs,
      suggestion: "Remove build outputs from git and add to .gitignore",
    });
  }

  return analysis;
}

function generateRootCleanupPlan(rootCleanup) {
  const lines = ["# Root Directory Cleanup Plan\n"];

  if (rootCleanup.junkFiles?.length > 0) {
    lines.push("## Junk Files to Remove\n");
    for (const junk of rootCleanup.junkFiles) {
      lines.push(`- [ ] Delete \`${junk.file}\` - ${junk.reason}`);
    }
    lines.push("");
  }

  if (rootCleanup.missingStandards?.length > 0) {
    lines.push("## Missing Standards to Add\n");
    for (const std of rootCleanup.missingStandards) {
      const icon = std.importance === "required" ? "🔴" : "🟡";
      lines.push(`- [ ] ${icon} ${std.suggestion}`);
    }
    lines.push("");
  }

  if (rootCleanup.duplicateConfigs?.length > 0) {
    lines.push("## Duplicate Configs to Consolidate\n");
    for (const dup of rootCleanup.duplicateConfigs) {
      lines.push(`- [ ] **${dup.type}:** Merge ${dup.files.join(", ")}`);
    }
    lines.push("");
  }

  if (rootCleanup.misplacedFiles?.length > 0) {
    lines.push("## Files to Relocate\n");
    for (const f of rootCleanup.misplacedFiles) {
      lines.push(`- [ ] Move \`${f.file}\` → \`${f.suggestedLocation}\``);
    }
    lines.push("");
  }

  if (rootCleanup.suggestions?.length > 0) {
    lines.push("## Other Suggestions\n");
    for (const s of rootCleanup.suggestions) {
      lines.push(`- [ ] ${s.suggestion}`);
    }
  }

  return lines.join("\n");
}

module.exports = {
  analyzeRootDirectory,
  generateRootCleanupPlan,
  ROOT_STANDARDS,
};
