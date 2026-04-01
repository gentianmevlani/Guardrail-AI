/**
 * Context Diff Module
 * Tracks changes in context between generations
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Generate hash for context snapshot
 */
function generateContextHash(context) {
  const content = JSON.stringify(context, null, 2);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Save context snapshot
 */
function saveSnapshot(projectPath, context) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  if (!fs.existsSync(guardrailDir)) {
    fs.mkdirSync(guardrailDir, { recursive: true });
  }
  
  const snapshot = {
    timestamp: new Date().toISOString(),
    hash: generateContextHash(context),
    context: {
      version: context.version,
      project: context.project,
      techStack: context.techStack,
      structure: {
        directories: context.structure?.directories || [],
        componentsCount: context.structure?.components?.length || 0,
        apiRoutesCount: context.structure?.apiRoutes?.length || 0,
      },
      patterns: {
        hooks: context.patterns?.hooks || [],
        stateManagement: context.patterns?.stateManagement,
        validation: context.patterns?.validation,
      },
      monorepo: context.monorepo,
    },
  };
  
  const snapshotFile = path.join(guardrailDir, "context-snapshot.json");
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  
  return snapshot;
}

/**
 * Load previous snapshot
 */
function loadSnapshot(projectPath) {
  const snapshotFile = path.join(projectPath, ".guardrail", "context-snapshot.json");
  
  if (!fs.existsSync(snapshotFile)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(snapshotFile, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Generate diff between contexts
 */
function generateContextDiff(previous, current) {
  if (!previous) {
    return {
      isFirstRun: true,
      changes: {
        added: [],
        removed: [],
        modified: [],
      },
    };
  }
  
  const diff = {
    timestamp: new Date().toISOString(),
    previousTimestamp: previous.timestamp,
    changes: {
      added: [],
      removed: [],
      modified: [],
    },
    summary: {
      totalChanges: 0,
      breakingChanges: 0,
      additions: 0,
      removals: 0,
    },
  };
  
  // Compare tech stack
  if (previous.context.techStack && current.techStack) {
    for (const [key, value] of Object.entries(current.techStack)) {
      if (previous.context.techStack[key] !== value) {
        diff.changes.modified.push({
          type: "techStack",
          field: key,
          from: previous.context.techStack[key],
          to: value,
        });
        diff.summary.totalChanges++;
      }
    }
  }
  
  // Compare directories
  const prevDirs = new Set(previous.context.structure?.directories || []);
  const currDirs = new Set(current.structure?.directories || []);
  
  for (const dir of currDirs) {
    if (!prevDirs.has(dir)) {
      diff.changes.added.push({
        type: "directory",
        name: dir,
      });
      diff.summary.additions++;
      diff.summary.totalChanges++;
    }
  }
  
  for (const dir of prevDirs) {
    if (!currDirs.has(dir)) {
      diff.changes.removed.push({
        type: "directory",
        name: dir,
      });
      diff.summary.removals++;
      diff.summary.totalChanges++;
    }
  }
  
  // Compare components
  const prevComponents = new Set(previous.context.structure?.components || []);
  const currComponents = new Set(current.structure?.components || []);
  
  for (const comp of currComponents) {
    if (!prevComponents.has(comp)) {
      diff.changes.added.push({
        type: "component",
        name: comp,
      });
      diff.summary.additions++;
      diff.summary.totalChanges++;
    }
  }
  
  for (const comp of prevComponents) {
    if (!currComponents.has(comp)) {
      diff.changes.removed.push({
        type: "component",
        name: comp,
      });
      diff.summary.removals++;
      diff.summary.totalChanges++;
    }
  }
  
  // Compare API routes
  const prevRoutes = new Set(previous.context.structure?.apiRoutes || []);
  const currRoutes = new Set(current.structure?.apiRoutes || []);
  
  for (const route of currRoutes) {
    if (!prevRoutes.has(route)) {
      diff.changes.added.push({
        type: "apiRoute",
        name: route,
      });
      diff.summary.additions++;
      diff.summary.totalChanges++;
    }
  }
  
  for (const route of prevRoutes) {
    if (!currRoutes.has(route)) {
      diff.changes.removed.push({
        type: "apiRoute",
        name: route,
      });
      diff.summary.removals++;
      diff.summary.totalChanges++;
    }
  }
  
  // Compare patterns
  const prevHooks = new Set(previous.context.patterns?.hooks || []);
  const currHooks = new Set(current.patterns?.hooks || []);
  
  for (const hook of currHooks) {
    if (!prevHooks.has(hook)) {
      diff.changes.added.push({
        type: "hook",
        name: hook,
      });
      diff.summary.additions++;
      diff.summary.totalChanges++;
    }
  }
  
  // Check for breaking changes
  if (previous.context.patterns?.stateManagement !== current.patterns?.stateManagement) {
    diff.changes.modified.push({
      type: "breaking",
      field: "stateManagement",
      from: previous.context.patterns?.stateManagement,
      to: current.patterns?.stateManagement,
    });
    diff.summary.breakingChanges++;
    diff.summary.totalChanges++;
  }
  
  if (previous.context.patterns?.validation !== current.patterns?.validation) {
    diff.changes.modified.push({
      type: "breaking",
      field: "validation",
      from: previous.context.patterns?.validation,
      to: current.patterns?.validation,
    });
    diff.summary.breakingChanges++;
    diff.summary.totalChanges++;
  }
  
  return diff;
}

/**
 * Generate diff report
 */
function generateDiffReport(diff) {
  if (diff.isFirstRun) {
    return `
# First Context Generation

This is the first time context has been generated for this project.
`;
  }
  
  let report = `# Context Changes Report
Generated: ${new Date(diff.timestamp).toLocaleString()}
Since: ${new Date(diff.previousTimestamp).toLocaleString()}

## Summary
- Total Changes: ${diff.summary.totalChanges}
- Additions: ${diff.summary.additions}
- Removals: ${diff.summary.removals}
- Breaking Changes: ${diff.summary.breakingChanges}

`;
  
  if (diff.changes.added.length > 0) {
    report += "## Added\n\n";
    for (const change of diff.changes.added) {
      const icon = {
        directory: "📁",
        component: "🧩",
        apiRoute: "🔌",
        hook: "🪝",
      }[change.type] || "➕";
      
      report += `- ${icon} **${change.type}**: ${change.name}\n`;
    }
    report += "\n";
  }
  
  if (diff.changes.removed.length > 0) {
    report += "## Removed\n\n";
    for (const change of diff.changes.removed) {
      const icon = {
        directory: "📁",
        component: "🧩",
        apiRoute: "🔌",
        hook: "🪝",
      }[change.type] || "➖";
      
      report += `- ${icon} **${change.type}**: ${change.name}\n`;
    }
    report += "\n";
  }
  
  if (diff.changes.modified.length > 0) {
    report += "## Modified\n\n";
    for (const change of diff.changes.modified) {
      const icon = change.type === "breaking" ? "⚠️" : "🔄";
      report += `- ${icon} **${change.field}**: \`${change.from}\` → \`${change.to}\`\n`;
    }
    report += "\n";
  }
  
  if (diff.summary.breakingChanges > 0) {
    report += "## ⚠️ Breaking Changes\n\n";
    report += "Breaking changes detected. Review AI rules files to ensure compatibility.\n\n";
  }
  
  return report;
}

/**
 * Save diff report
 */
function saveDiffReport(projectPath, diff) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  if (!fs.existsSync(guardrailDir)) {
    fs.mkdirSync(guardrailDir, { recursive: true });
  }
  
  const report = generateDiffReport(diff);
  const reportFile = path.join(guardrailDir, "context-diff.md");
  
  fs.writeFileSync(reportFile, report);
  
  return reportFile;
}

/**
 * Check if context needs regeneration
 */
function needsRegeneration(projectPath, currentContext) {
  const previous = loadSnapshot(projectPath);
  if (!previous) return true;
  
  const currentHash = generateContextHash(currentContext);
  return previous.hash !== currentHash;
}

module.exports = {
  saveSnapshot,
  loadSnapshot,
  generateContextDiff,
  generateDiffReport,
  saveDiffReport,
  needsRegeneration,
};
