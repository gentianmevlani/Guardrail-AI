/**
 * Report Generation Module
 *
 * Generates comprehensive hygiene reports in Markdown format.
 * Calculates hygiene score and provides actionable recommendations.
 */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function calculateHygieneScore(results) {
  let score = 100;

  // Duplicates (max -20)
  const exactDupes = results.duplicates?.exact?.length || 0;
  const nearDupes = results.duplicates?.near?.length || 0;
  score -= Math.min(10, exactDupes * 3);
  score -= Math.min(10, nearDupes * 2);

  // Unused files (max -20)
  const unusedDef = results.unused?.unused?.definitelyUnused?.length || 0;
  score -= Math.min(20, unusedDef * 1);

  // Errors (max -30)
  const errorsErr = results.errors?.summary?.bySeverity?.error || 0;
  score -= Math.min(30, errorsErr * 0.5);

  // Root issues (max -15)
  const junk = results.rootCleanup?.junkFiles?.length || 0;
  const missing =
    results.rootCleanup?.missingStandards?.filter(
      (s) => s.importance === "required",
    )?.length || 0;
  score -= Math.min(5, junk);
  score -= Math.min(10, missing * 3);

  score = Math.max(0, Math.round(score));

  let grade, status;
  if (score >= 90) {
    grade = "A";
    status = "✨ Excellent hygiene";
  } else if (score >= 80) {
    grade = "B";
    status = "👍 Good, minor issues";
  } else if (score >= 70) {
    grade = "C";
    status = "⚠️ Needs attention";
  } else if (score >= 60) {
    grade = "D";
    status = "🔴 Significant debt";
  } else {
    grade = "F";
    status = "🚨 Critical cleanup needed";
  }

  return { score, grade, status, timestamp: new Date().toISOString() };
}

function generateHygieneReport(results) {
  const lines = [];
  const timestamp = new Date().toISOString();
  const score = calculateHygieneScore(results);

  lines.push("# 🧹 Repo Hygiene + Debt Radar Report\n");
  lines.push(`**Generated:** ${timestamp}`);
  lines.push(`**Project:** ${results.projectPath}\n`);

  // Score display
  lines.push("## 📊 Hygiene Score\n");
  lines.push("```");
  lines.push(`┌─────────────────────────────────┐`);
  lines.push(`│                                 │`);
  lines.push(
    `│     HYGIENE SCORE: ${score.score.toString().padStart(3)}         │`,
  );
  lines.push(`│     GRADE: ${score.grade.padStart(2)}                    │`);
  lines.push(`│                                 │`);
  lines.push(`│     ${score.status.padEnd(25)}  │`);
  lines.push(`│                                 │`);
  lines.push(`└─────────────────────────────────┘`);
  lines.push("```\n");

  // Quick Stats
  lines.push("## 📈 Quick Stats\n");
  lines.push("| Metric | Count | Status |");
  lines.push("|--------|-------|--------|");

  const exactDupes = results.duplicates?.exact?.length || 0;
  const nearDupes = results.duplicates?.near?.length || 0;
  const copyPaste = results.duplicates?.copyPaste?.length || 0;
  lines.push(
    `| Exact Duplicate Files | ${exactDupes} | ${exactDupes === 0 ? "✅" : "🔴"} |`,
  );
  lines.push(
    `| Near-Duplicate Files | ${nearDupes} | ${nearDupes === 0 ? "✅" : "⚠️"} |`,
  );
  lines.push(
    `| Copy-Paste Blocks | ${copyPaste} | ${copyPaste === 0 ? "✅" : "⚠️"} |`,
  );

  const unusedDef = results.unused?.unused?.definitelyUnused?.length || 0;
  const unusedProb = results.unused?.unused?.probablyUnused?.length || 0;
  lines.push(
    `| Definitely Unused Files | ${unusedDef} | ${unusedDef === 0 ? "✅" : "🔴"} |`,
  );
  lines.push(
    `| Probably Unused Files | ${unusedProb} | ${unusedProb === 0 ? "✅" : "⚠️"} |`,
  );

  const errors = results.errors?.summary?.total || 0;
  const errorsErr = results.errors?.summary?.bySeverity?.error || 0;
  lines.push(
    `| Total Lint/Type Errors | ${errors} | ${errorsErr === 0 ? "✅" : "🔴"} |`,
  );

  const junk = results.rootCleanup?.junkFiles?.length || 0;
  const missing =
    results.rootCleanup?.missingStandards?.filter(
      (s) => s.importance === "required",
    )?.length || 0;
  lines.push(`| Junk Files in Root | ${junk} | ${junk === 0 ? "✅" : "⚠️"} |`);
  lines.push(
    `| Missing Required Standards | ${missing} | ${missing === 0 ? "✅" : "🔴"} |`,
  );
  lines.push("");

  // Deletion Plan
  lines.push("## 🗑️ Safe Deletion Plan\n");

  const safeToDelete = [];
  const reviewFirst = [];
  const doNotDelete = [];

  // Exact duplicates
  if (results.duplicates?.exact?.length > 0) {
    for (const group of results.duplicates.exact) {
      const [keep, ...remove] = group.files;
      safeToDelete.push(
        ...remove.map((f) => ({
          file: f.path,
          reason: `Exact duplicate of ${keep.path}`,
          bytes: f.size,
        })),
      );
    }
  }

  // Definitely unused
  if (results.unused?.unused?.definitelyUnused?.length > 0) {
    safeToDelete.push(
      ...results.unused.unused.definitelyUnused.map((f) => ({
        file: f.file,
        reason: f.reason,
      })),
    );
  }

  // Probably unused
  if (results.unused?.unused?.probablyUnused?.length > 0) {
    reviewFirst.push(
      ...results.unused.unused.probablyUnused.map((f) => ({
        file: f.file,
        reason: f.reason,
      })),
    );
  }

  // Special files
  if (results.unused?.unused?.special?.length > 0) {
    doNotDelete.push(
      ...results.unused.unused.special.map((f) => ({
        file: f.file,
        reason: f.reason,
      })),
    );
  }

  if (safeToDelete.length > 0) {
    lines.push("### ✅ Safe to Delete Now\n");
    lines.push("| File | Reason |");
    lines.push("|------|--------|");
    for (const item of safeToDelete.slice(0, 30)) {
      lines.push(`| \`${item.file}\` | ${item.reason} |`);
    }
    if (safeToDelete.length > 30)
      lines.push(`| ... | ${safeToDelete.length - 30} more files |`);
    lines.push("");
  }

  if (reviewFirst.length > 0) {
    lines.push("### 🟡 Review Before Deleting\n");
    lines.push("| File | Reason |");
    lines.push("|------|--------|");
    for (const item of reviewFirst.slice(0, 20)) {
      lines.push(`| \`${item.file}\` | ${item.reason} |`);
    }
    if (reviewFirst.length > 20)
      lines.push(`| ... | ${reviewFirst.length - 20} more files |`);
    lines.push("");
  }

  if (doNotDelete.length > 0) {
    lines.push("### 🔵 Do Not Delete (Special Files)\n");
    lines.push("| File | Reason |");
    lines.push("|------|--------|");
    for (const item of doNotDelete.slice(0, 15)) {
      lines.push(`| \`${item.file}\` | ${item.reason} |`);
    }
    lines.push("");
  }

  // Duplicates Detail
  if (
    results.duplicates?.exact?.length > 0 ||
    results.duplicates?.near?.length > 0
  ) {
    lines.push("---\n## 📋 Duplicate Analysis\n");

    if (results.duplicates.exact?.length > 0) {
      lines.push("### Tier A: Exact Duplicates\n");
      for (const group of results.duplicates.exact.slice(0, 10)) {
        lines.push(
          `**Hash:** \`${group.hash}\` | **Wasted:** ${formatBytes(group.totalWastedBytes)}`,
        );
        for (const f of group.files) lines.push(`- \`${f.path}\``);
        lines.push(`- 💡 ${group.suggestion}\n`);
      }
    }

    if (results.duplicates.near?.length > 0) {
      lines.push("### Tier B: Near-Duplicates (≥85% Similar)\n");
      for (const group of results.duplicates.near.slice(0, 10)) {
        lines.push(`**Similarity:** ${group.similarity}%`);
        for (const f of group.files) lines.push(`- \`${f}\``);
        lines.push(`- 💡 ${group.suggestion}\n`);
      }
    }

    if (results.duplicates.copyPaste?.length > 0) {
      lines.push("### Tier C: Top Copy-Paste Blocks\n");
      lines.push("| Block | Locations | LOC |");
      lines.push("|-------|-----------|-----|");
      for (const block of results.duplicates.copyPaste.slice(0, 15)) {
        const locs = block.locations
          .map((l) => `${l.file}:${l.line}`)
          .slice(0, 2)
          .join(", ");
        lines.push(
          `| \`${block.hash}\` | ${locs}... | ${block.totalDuplicatedLOC} |`,
        );
      }
      lines.push("");
    }
  }

  // Errors Detail
  if (results.errors?.summary?.total > 0) {
    lines.push("---\n## 🔴 Lint/Type/Import Errors\n");
    lines.push(
      `**Total:** ${results.errors.summary.total} | **Errors:** ${results.errors.summary.bySeverity.error} | **Auto-fixable:** ${results.errors.summary.autoFixable}\n`,
    );

    if (results.errors.topOffenders?.length > 0) {
      lines.push("### Top Offending Files\n");
      lines.push("| File | Errors |");
      lines.push("|------|--------|");
      for (const offender of results.errors.topOffenders.slice(0, 15)) {
        lines.push(`| \`${offender.file}\` | ${offender.count} |`);
      }
      lines.push("");
    }
  }

  // Root Cleanup
  if (results.rootCleanup) {
    const hasIssues =
      results.rootCleanup.junkFiles?.length > 0 ||
      results.rootCleanup.missingStandards?.length > 0;
    if (hasIssues) {
      lines.push("---\n## 🏠 Root Directory Cleanup\n");

      if (results.rootCleanup.junkFiles?.length > 0) {
        lines.push("### Junk Files\n");
        for (const junk of results.rootCleanup.junkFiles)
          lines.push(`- \`${junk.file}\` - ${junk.reason}`);
        lines.push("");
      }

      if (results.rootCleanup.missingStandards?.length > 0) {
        lines.push("### Missing Standards\n");
        for (const std of results.rootCleanup.missingStandards) {
          const icon = std.importance === "required" ? "🔴" : "🟡";
          lines.push(`- ${icon} ${std.suggestion}`);
        }
        lines.push("");
      }
    }
  }

  // Action Items
  lines.push("---\n## 🎯 Recommended Actions\n");
  const actions = [];

  if (exactDupes > 0)
    actions.push({
      priority: "P1",
      action: "Delete exact duplicate files",
      count: exactDupes,
    });
  if (errorsErr > 0)
    actions.push({
      priority: "P1",
      action: "Fix TypeScript/ESLint errors",
      count: errorsErr,
    });
  if (unusedDef > 0)
    actions.push({
      priority: "P2",
      action: "Remove definitely unused files",
      count: unusedDef,
    });
  if (missing > 0)
    actions.push({
      priority: "P2",
      action: "Add missing repo standards",
      count: missing,
    });
  if (nearDupes > 0)
    actions.push({
      priority: "P3",
      action: "Consolidate near-duplicate files",
      count: nearDupes,
    });
  if (copyPaste > 0)
    actions.push({
      priority: "P3",
      action: "Extract duplicated code blocks",
      count: copyPaste,
    });
  if (junk > 0)
    actions.push({
      priority: "P3",
      action: "Clean up junk files",
      count: junk,
    });

  if (actions.length > 0) {
    lines.push("| Priority | Action | Items |");
    lines.push("|----------|--------|-------|");
    for (const a of actions)
      lines.push(`| ${a.priority} | ${a.action} | ${a.count} |`);
  } else {
    lines.push("🎉 No major hygiene issues found!\n");
  }

  lines.push("\n---\n## 📄 Generated Artifacts\n");
  lines.push("- `.guardrail/hygiene-report.md` - This report");
  lines.push("- `.guardrail/duplicates.json` - Duplicate file data");
  lines.push("- `.guardrail/unused-files.json` - Unused file analysis");
  lines.push("- `.guardrail/errors.json` - Error collection");
  lines.push("- `.guardrail/hygiene-score.json` - Score data\n");

  return lines.join("\n");
}

module.exports = { generateHygieneReport, calculateHygieneScore, formatBytes };
