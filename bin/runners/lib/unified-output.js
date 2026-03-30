/**
 * Unified Output System
 * 
 * Provides consistent, deterministic output across all guardrail commands.
 * This is what makes guardrail feel "enterprise-grade".
 *
 * `dist/lib/cli/*` is produced by `pnpm run build:cli-lib` (not committed; `dist/` is gitignored).
 * If missing, we fall back so the CLI still loads; run the build for full formatting.
 */

const FALLBACK_EXIT_CODES = {
  PASS: 0,
  FAIL: 1,
  MISCONFIG: 2,
  INTERNAL: 3,
};

function loadCliDist() {
  try {
    const outputContract = require('../../../dist/lib/cli/output-contract');
    const verdictFormatter = require('../../../dist/lib/cli/verdict-formatter');
    return {
      EXIT_CODES: outputContract.EXIT_CODES,
      formatVerdictOutput: verdictFormatter.formatVerdictOutput,
      _fromDist: true,
    };
  } catch (e) {
    if (process.env.GUARDRAIL_DEBUG) {
      console.warn(
        '[guardrail] dist/lib/cli not found; run: pnpm run build:cli-lib\n',
        e.message,
      );
    }
    return {
      EXIT_CODES: FALLBACK_EXIT_CODES,
      formatVerdictOutput(verdict) {
        if (verdict && typeof verdict === 'object') {
          return JSON.stringify(verdict, null, 2);
        }
        return String(verdict);
      },
      _fromDist: false,
    };
  }
}

const { EXIT_CODES, formatVerdictOutput } = loadCliDist();

/**
 * Format scan output with unified contract
 */
function formatScanOutput(result, options = {}) {
  const { verbose = false, json = false } = options;
  
  if (json) {
    return JSON.stringify(result, null, 2);
  }
  
  return formatVerdictOutput(result.verdict, { verbose, json });
}

/**
 * Get exit code from verdict
 */
function getExitCode(verdict) {
  if (!verdict) return EXIT_CODES.INTERNAL;
  
  switch (verdict.verdict) {
    case 'PASS':
      return EXIT_CODES.PASS;
    case 'FAIL':
      return EXIT_CODES.FAIL;
    case 'WARN':
      return EXIT_CODES.PASS; // Warnings don't block
    case 'ERROR':
      return EXIT_CODES.MISCONFIG;
    default:
      return EXIT_CODES.INTERNAL;
  }
}

/**
 * Handle errors with proper exit codes
 */
function handleError(error, context = '') {
  const errorType = classifyError(error);
  
  let exitCode = EXIT_CODES.INTERNAL;
  let message = error.message || 'Unknown error';
  let nextStep = 'Run: guardrail doctor';
  
  switch (errorType) {
    case 'MISCONFIG':
      exitCode = EXIT_CODES.MISCONFIG;
      message = `Configuration error: ${message}`;
      nextStep = 'Run: guardrail doctor --fix';
      break;
    case 'MISSING_DEPS':
      exitCode = EXIT_CODES.MISCONFIG;
      message = `Missing dependencies: ${message}`;
      nextStep = 'Run: guardrail doctor';
      break;
    case 'PERMISSION':
      exitCode = EXIT_CODES.MISCONFIG;
      message = `Permission error: ${message}`;
      nextStep = 'Check file permissions and run: guardrail doctor';
      break;
    default:
      exitCode = EXIT_CODES.INTERNAL;
      message = `Internal error: ${message}`;
      nextStep = 'This looks like a bug. Run: guardrail doctor';
  }
  
  return {
    exitCode,
    message: `${context ? `[${context}] ` : ''}${message}`,
    nextStep,
    errorType,
  };
}

function classifyError(error) {
  const message = (error.message || '').toLowerCase();
  const code = error.code || '';
  
  if (code === 'ENOENT' || message.includes('not found') || message.includes('missing')) {
    return 'MISSING_DEPS';
  }
  
  if (code === 'EACCES' || code === 'EPERM' || message.includes('permission')) {
    return 'PERMISSION';
  }
  
  if (message.includes('config') || message.includes('environment') || message.includes('env')) {
    return 'MISCONFIG';
  }
  
  return 'INTERNAL';
}

/**
 * Print error with proper formatting
 */
function printError(error, context = '') {
  const handled = handleError(error, context);
  
  console.error(`\n${handled.message}`);
  console.error(`\n${handled.nextStep}\n`);
  
  return handled.exitCode;
}

module.exports = {
  formatScanOutput,
  getExitCode,
  handleError,
  printError,
  EXIT_CODES,
};
