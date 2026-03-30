/**
 * Hygiene Module Index
 *
 * Exports all hygiene analysis functions for use by CLI and MCP tools.
 */

const {
  findDuplicates,
  findExactDuplicates,
  findNearDuplicates,
  findCopyPasteBlocks,
  getAllCodeFiles,
  CONFIG,
} = require("./duplicates");
const {
  findUnusedFiles,
  buildImportGraph,
  isEntrypoint,
  isSpecialFile,
  isTestFile,
} = require("./unused");
const {
  collectAllErrors,
  collectTypeScriptErrors,
  collectESLintErrors,
  collectSyntaxErrors,
  collectImportErrors,
} = require("./errors");
const {
  analyzeRootDirectory,
  generateRootCleanupPlan,
  ROOT_STANDARDS,
} = require("./root-cleanup");
const {
  generateHygieneReport,
  calculateHygieneScore,
  formatBytes,
} = require("./report");

module.exports = {
  // Duplicates
  findDuplicates,
  findExactDuplicates,
  findNearDuplicates,
  findCopyPasteBlocks,
  getAllCodeFiles,

  // Unused
  findUnusedFiles,
  buildImportGraph,
  isEntrypoint,
  isSpecialFile,
  isTestFile,

  // Errors
  collectAllErrors,
  collectTypeScriptErrors,
  collectESLintErrors,
  collectSyntaxErrors,
  collectImportErrors,

  // Root Cleanup
  analyzeRootDirectory,
  generateRootCleanupPlan,
  ROOT_STANDARDS,

  // Report
  generateHygieneReport,
  calculateHygieneScore,
  formatBytes,

  // Config
  CONFIG,
};
