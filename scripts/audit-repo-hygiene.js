#!/usr/bin/env node

/**
 * guardrail Repo Hygiene + Debt Radar
 *
 * Comprehensive repository cleanup and analysis tool.
 * NEVER deletes automatically - generates plans only.
 *
 * Usage: node scripts/audit-repo-hygiene.js [projectPath] [--mode=report|safe-fix]
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const CONFIG = {
  codeExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  skipDirs: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ".cache",
  ],
  similarityThreshold: 0.85,
  minDuplicateLines: 10,
};

// Import sub-modules
const { findDuplicates } = require("./hygiene/duplicates");
const { findUnusedFiles } = require("./hygiene/unused");
const { collectAllErrors } = require("./hygiene/errors");
const { analyzeRootDirectory } = require("./hygiene/root-cleanup");
const {
  generateHygieneReport,
  calculateHygieneScore,
} = require("./hygiene/report");

async function auditRepoHygiene(projectPath = ".", options = {}) {
  const resolvedPath = path.resolve(projectPath);
  console.log("🧹 Running Repo Hygiene + Debt Radar...\n");

  const results = { projectPath: resolvedPath, mode: options.mode || "report" };

  console.log("🔍 Scanning for duplicate files...");
  results.duplicates = findDuplicates(resolvedPath);

  console.log("📦 Building import graph & finding unused files...");
  results.unused = findUnusedFiles(resolvedPath);

  console.log("🔴 Collecting lint/type/import errors...");
  results.errors = collectAllErrors(resolvedPath);

  console.log("🏠 Analyzing root directory...");
  results.rootCleanup = analyzeRootDirectory(resolvedPath);

  return results;
}

if (require.main === module) {
  const projectPath = process.argv[2] || ".";

  auditRepoHygiene(projectPath)
    .then((results) => {
      const report = generateHygieneReport(results);
      console.log(report);

      const reportDir = path.join(projectPath, ".guardrail");
      if (!fs.existsSync(reportDir))
        fs.mkdirSync(reportDir, { recursive: true });

      fs.writeFileSync(path.join(reportDir, "hygiene-report.md"), report);
      fs.writeFileSync(
        path.join(reportDir, "duplicates.json"),
        JSON.stringify(results.duplicates, null, 2),
      );
      fs.writeFileSync(
        path.join(reportDir, "unused-files.json"),
        JSON.stringify(results.unused, null, 2),
      );
      fs.writeFileSync(
        path.join(reportDir, "errors.json"),
        JSON.stringify(results.errors, null, 2),
      );
      fs.writeFileSync(
        path.join(reportDir, "hygiene-score.json"),
        JSON.stringify(calculateHygieneScore(results), null, 2),
      );

      console.log(`\n📄 Reports saved to: ${reportDir}/`);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { auditRepoHygiene, CONFIG };
