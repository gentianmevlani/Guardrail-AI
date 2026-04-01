/**
 * JSON Output Utilities
 * 
 * Provides versioned JSON output schema helpers for CLI commands
 */

const VERSION = "1.0.0";
const SCHEMA_BASE = "guardrail-cli-tool/v1";

/**
 * Create a versioned JSON output envelope
 * @param {Object} data - The actual output data
 * @param {string} schemaType - Schema type (e.g., "scan", "gate", "ship")
 * @returns {Object} Versioned output object
 */
function createVersionedOutput(data, schemaType = "generic") {
  return {
    version: VERSION,
    schema: `${SCHEMA_BASE}/${schemaType}`,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Create a versioned error output
 * @param {string|Error} error - Error message or Error object
 * @param {Object} metadata - Additional error metadata
 * @returns {Object} Versioned error output
 */
function createErrorOutput(error, metadata = {}) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorOutput = {
    version: VERSION,
    schema: `${SCHEMA_BASE}/error`,
    timestamp: new Date().toISOString(),
    success: false,
    error: errorMessage,
  };

  if (metadata.receipt) {
    errorOutput.receipt = metadata.receipt;
  }
  if (metadata.code) {
    errorOutput.code = metadata.code;
  }
  if (metadata.exitCode) {
    errorOutput.exitCode = metadata.exitCode;
  }
  if (metadata.verifyCommand) {
    errorOutput.verifyCommand = metadata.verifyCommand;
  }

  return errorOutput;
}

/**
 * Create a versioned success output
 * @param {Object} data - Success data
 * @param {string} schemaType - Schema type
 * @returns {Object} Versioned success output
 */
function createSuccessOutput(data, schemaType = "generic") {
  return createVersionedOutput({
    success: true,
    ...data,
  }, schemaType);
}

module.exports = {
  VERSION,
  SCHEMA_BASE,
  createVersionedOutput,
  createErrorOutput,
  createSuccessOutput,
};
