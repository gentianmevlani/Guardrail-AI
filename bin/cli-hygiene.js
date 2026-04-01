#!/usr/bin/env node

/**
 * guardrail Repo Hygiene CLI
 *
 * Enhanced false-positive detection for framework-managed files.
 *
 * Usage:
 *   node bin/cli-hygiene.js [command] [options]
 *
 * Commands:
 *   scan          Full hygiene scan (default)
 *   duplicates    Scan for duplicate files only
 *   unused        Scan for unused files only
 *   errors        Scan for lint/type errors only
 *
 * Options:
 *   --path, -p        Project path (default: current directory)
 *   --json            Output JSON instead of markdown
 *   --no-interactive  Skip prompts
 */

const path = require("path");
const fs = require("fs");

// Import hygiene modules
const {
  findDuplicates,
  findUnusedFiles,
  collectAllErrors,
  analyzeRootDirectory,
  generateHygieneReport,
  calculateHygieneScore,
} = require("../scripts/hygiene");

// Parse arguments
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("-")) || "scan";
const projectPath = getArg("--path", "-p") || ".";
const jsonOutput = args.includes("--json");

function getArg(long, short) {
  const longIdx = args.findIndex((a) => a.startsWith(long + "=") || a === long);
  if (longIdx !== -1) {
    if (args[longIdx].includes("=")) return args[longIdx].split("=")[1];
    return args[longIdx + 1];
  }
  if (short) {
    const shortIdx = args.findIndex((a) => a === short);
    if (shortIdx !== -1) return args[shortIdx + 1];
  }
  return null;
}

async function runFullScan(resolvedPath) {
  console.log("🔍 Scanning for duplicates...");
  const duplicates = findDuplicates(resolvedPath);

  console.log("📦 Building import graph...");
  const unused = findUnusedFiles(resolvedPath);

  console.log("🔴 Collecting errors...");
  const errors = collectAllErrors(resolvedPath);

  console.log("🏠 Analyzing root directory...");
  const rootCleanup = analyzeRootDirectory(resolvedPath);

  return { projectPath: resolvedPath, duplicates, unused, errors, rootCleanup };
}

async function main() {
  const resolvedPath = path.resolve(projectPath);

  console.log(`\n🧹 guardrail Repo Hygiene\n`);
  console.log(`📁 Project: ${resolvedPath}\n`);

  switch (command) {
    case "scan":
      await handleScan(resolvedPath);
      break;
    case "duplicates":
      await handleDuplicates(resolvedPath);
      break;
    case "unused":
      await handleUnused(resolvedPath);
      break;
    case "errors":
      await handleErrors(resolvedPath);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Available: scan, duplicates, unused, errors");
      process.exit(1);
  }
}

async function handleScan(resolvedPath) {
  const results = await runFullScan(resolvedPath);
  const score = calculateHygieneScore(results);

  if (jsonOutput) {
    console.log(JSON.stringify({ ...results, score }, null, 2));
    return;
  }

  // Print report
  const report = generateHygieneReport(results);
  console.log("\n" + report);

  // Print false-positive summary
  printFalsePositiveSummary(results.unused);

  // Save artifacts
  const reportDir = path.join(resolvedPath, ".guardrail");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  fs.writeFileSync(path.join(reportDir, "hygiene-report.md"), report);
  fs.writeFileSync(
    path.join(reportDir, "hygiene-results.json"),
    JSON.stringify(results, null, 2),
  );
  fs.writeFileSync(
    path.join(reportDir, "hygiene-score.json"),
    JSON.stringify(score, null, 2),
  );
  fs.writeFileSync(
    path.join(reportDir, "unused-files.json"),
    JSON.stringify(results.unused, null, 2),
  );
  fs.writeFileSync(
    path.join(reportDir, "duplicates.json"),
    JSON.stringify(results.duplicates, null, 2),
  );

  console.log(`\n📄 Reports saved to: ${reportDir}/\n`);

  // Exit code based on score
  if (score.score < 60) {
    process.exit(1);
  }
}

function printFalsePositiveSummary(unused) {
  if (!unused?.stats) return;

  const { falsePositives, trueUnused } = unused.stats;

  console.log("\n" + "─".repeat(60));
  console.log("\n📊 **False-Positive Detection Summary**\n");
  console.log(`   ✅ Framework-managed files detected: ${falsePositives || 0}`);
  console.log(`   🗑️  Truly unused files: ${trueUnused || 0}`);

  if (unused.unused?.definitelyUnused?.length > 0) {
    console.log("\n   **Safe to delete:**");
    for (const file of unused.unused.definitelyUnused.slice(0, 10)) {
      console.log(`      - ${file.file}`);
    }
    if (unused.unused.definitelyUnused.length > 10) {
      console.log(
        `      ... and ${unused.unused.definitelyUnused.length - 10} more`,
      );
    }
  }

  console.log("");
}

async function handleDuplicates(resolvedPath) {
  console.log("🔍 Scanning for duplicates...");
  const duplicates = findDuplicates(resolvedPath);

  if (jsonOutput) {
    console.log(JSON.stringify(duplicates, null, 2));
    return;
  }

  console.log("\n## Duplicate Analysis\n");
  console.log(`| Type | Count |`);
  console.log(`|------|-------|`);
  console.log(`| Exact duplicates | ${duplicates.exact?.length || 0} |`);
  console.log(`| Near-duplicates | ${duplicates.near?.length || 0} |`);
  console.log(`| Copy-paste blocks | ${duplicates.copyPaste?.length || 0} |`);

  if (duplicates.exact?.length > 0) {
    console.log("\n### Exact Duplicates\n");
    for (const dup of duplicates.exact.slice(0, 10)) {
      console.log(
        `- ${dup.files?.map((f) => f.path).join(" = ") || JSON.stringify(dup)}`,
      );
    }
  }
}

async function handleUnused(resolvedPath) {
  console.log("📦 Building import graph...");
  const unused = findUnusedFiles(resolvedPath);

  if (jsonOutput) {
    console.log(JSON.stringify(unused, null, 2));
    return;
  }

  console.log("\n## Unused File Analysis\n");
  console.log(`| Category | Count |`);
  console.log(`|----------|-------|`);
  console.log(
    `| Framework-managed (false positives) | ${unused.unused?.falsePositives?.length || 0} |`,
  );
  console.log(
    `| Definitely unused | ${unused.unused?.definitelyUnused?.length || 0} |`,
  );
  console.log(
    `| Probably unused | ${unused.unused?.probablyUnused?.length || 0} |`,
  );
  console.log(`| Test files | ${unused.unused?.testOnly?.length || 0} |`);

  printFalsePositiveSummary(unused);
}

async function handleErrors(resolvedPath) {
  console.log("🔴 Collecting errors...");
  const errors = collectAllErrors(resolvedPath);

  if (jsonOutput) {
    console.log(JSON.stringify(errors, null, 2));
    return;
  }

  console.log("\n## Error Analysis\n");
  console.log(`| Type | Count |`);
  console.log(`|------|-------|`);
  console.log(`| TypeScript errors | ${errors.typescript?.length || 0} |`);
  console.log(`| ESLint errors | ${errors.eslint?.length || 0} |`);
  console.log(`| Syntax errors | ${errors.syntax?.length || 0} |`);
  console.log(`| Import errors | ${errors.imports?.length || 0} |`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
