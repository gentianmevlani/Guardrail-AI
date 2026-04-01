// bin/runners/runVerifyAgentOutput.js
// CLI command for verifying agent output

const fs = require("fs");
const path = require("path");
const { EXIT_CODES } = require("./lib/error-handler");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function printHelp() {
  console.log(`
${c.cyan}guardrail verify-agent-output${c.reset}

Verify AI agent output in guardrail-v1 format.

${c.bold}USAGE:${c.reset}
  guardrail verify-agent-output [options]
  cat response.json | guardrail verify-agent-output --file -

${c.bold}OPTIONS:${c.reset}
  --file <path>     Path to file containing agent response, or "-" for stdin
  --mode <mode>     Verification mode: build (default), explore, ship
  --strict          Enable strict mode (typecheck, lint)
  --run-tests       Run tests specified in the agent output
  --json            Output results as JSON
  --help, -h        Show this help

${c.bold}EXAMPLES:${c.reset}
  ${c.dim}# Verify from file${c.reset}
  guardrail verify-agent-output --file response.json

  ${c.dim}# Verify from clipboard (pipe)${c.reset}
  pbpaste | guardrail verify-agent-output --file -

  ${c.dim}# Strict ship mode with JSON output${c.reset}
  guardrail verify-agent-output --file response.json --mode ship --strict --json

${c.bold}AGENT OUTPUT FORMAT:${c.reset}
  The agent must respond with JSON in this format:
  {
    "format": "guardrail-v1",
    "diff": "<unified diff>",
    "commands": ["optional commands"],
    "tests": ["optional test commands"],
    "notes": "optional notes"
  }
`);
}

function parseArgs(args) {
  const options = {
    file: null,
    mode: "build",
    strict: false,
    runTests: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--file" && args[i + 1]) {
      options.file = args[++i];
    } else if (arg === "--mode" && args[i + 1]) {
      const mode = args[++i];
      if (["build", "explore", "ship"].includes(mode)) {
        options.mode = mode;
      } else {
        console.error(`${c.red}Invalid mode: ${mode}. Use build, explore, or ship.${c.reset}`);
        console.error(`${c.dim}Receipt: --mode flag validation${c.reset}`);
        console.error(`${c.info("Next steps:")}`);
        console.error(`  ${c.dim("•")} Use one of: build, explore, ship${c.reset}`);
        throw new Error(`Invalid mode: ${mode}`);
      }
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--run-tests") {
      options.runTests = true;
    } else if (arg === "--json") {
      options.json = true;
    }
  }

  return options;
}

async function readInput(filePath) {
  if (filePath === "-") {
    // Read from stdin
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("readable", () => {
        let chunk;
        while ((chunk = process.stdin.read()) !== null) {
          data += chunk;
        }
      });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  }

  // Read from file
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, "utf-8");
}

function formatCheckStatus(status) {
  switch (status) {
    case "pass":
      return `${c.green}✓${c.reset}`;
    case "fail":
      return `${c.red}✗${c.reset}`;
    case "warn":
      return `${c.yellow}⚠${c.reset}`;
    case "skip":
      return `${c.dim}○${c.reset}`;
    default:
      return "?";
  }
}

function printResult(result, jsonOutput) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      success: result.success,
      blockers: result.blockers,
      warnings: result.warnings,
      checks: result.checks.map(c => ({
        name: c.check,
        status: c.status,
        message: c.message,
        file: c.file,
        line: c.line,
        suggestedFix: c.suggestedFix,
      })),
      failureContext: result.failureContext,
    }, null, 2));
    return;
  }

  // Human-readable output
  console.log("");

  if (result.success) {
    console.log(`${c.green}${c.bold}✓ VERIFICATION PASSED${c.reset}`);
  } else {
    console.log(`${c.red}${c.bold}✗ VERIFICATION FAILED${c.reset}`);
  }

  console.log("");
  console.log(`${c.bold}Checks:${c.reset}`);

  for (const check of result.checks) {
    const status = formatCheckStatus(check.status);
    console.log(`  ${status} ${c.cyan}[${check.check}]${c.reset} ${check.message}`);
    
    if (check.status === "fail" && check.details) {
      const detailLines = check.details.split("\n").slice(0, 3);
      for (const line of detailLines) {
        console.log(`      ${c.dim}${line}${c.reset}`);
      }
    }
    
    if (check.status === "fail" && check.suggestedFix) {
      console.log(`      ${c.yellow}💡 ${check.suggestedFix}${c.reset}`);
    }
  }

  if (result.blockers.length > 0) {
    console.log("");
    console.log(`${c.red}${c.bold}Blockers (${result.blockers.length}):${c.reset}`);
    for (const blocker of result.blockers.slice(0, 5)) {
      console.log(`  ${c.red}•${c.reset} ${blocker}`);
    }
    if (result.blockers.length > 5) {
      console.log(`  ${c.dim}... and ${result.blockers.length - 5} more${c.reset}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log(`${c.yellow}${c.bold}Warnings (${result.warnings.length}):${c.reset}`);
    for (const warning of result.warnings) {
      console.log(`  ${c.yellow}•${c.reset} ${warning}`);
    }
  }

  if (!result.success && result.failureContext) {
    console.log("");
    console.log(`${c.cyan}${c.bold}Retry Prompt:${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────${c.reset}`);
    console.log(result.failureContext);
    console.log(`${c.dim}─────────────────────────────────────────${c.reset}`);
  }

  console.log("");
}

async function runVerifyAgentOutput(args) {
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  if (!options.file) {
    console.error(`${c.red}Error: --file is required${c.reset}`);
    console.error(`${c.dim}Use --help for usage information${c.reset}`);
    return EXIT_CODES.INVALID_INPUT;
  }

  // Load the JavaScript verification module
  const { verifyAgentOutput } = require("./lib/verification");

  // Read input
  let rawResponse;
  try {
    rawResponse = await readInput(options.file);
  } catch (err) {
    console.error(`${c.red}Error reading input: ${err.message}${c.reset}`);
    console.error(`${c.dim}Receipt: ${options.file}${c.reset}`);
    return EXIT_CODES.SYSTEM_ERROR;
  }

  if (!rawResponse || rawResponse.trim().length === 0) {
    console.error(`${c.red}Error: Empty input${c.reset}`);
    console.error(`${c.dim}Receipt: ${options.file}${c.reset}`);
    return EXIT_CODES.INVALID_INPUT;
  }

  // Build context
  const context = {
    projectRoot: process.cwd(),
    mode: options.mode,
    strict: options.strict,
    runTests: options.runTests,
  };

  // Run verification
  if (!options.json) {
    console.log(`${c.cyan}Verifying agent output...${c.reset}`);
    console.log(`${c.dim}Mode: ${options.mode}, Strict: ${options.strict}${c.reset}`);
  }

  try {
    const result = await verifyAgentOutput(rawResponse, context);
    printResult(result, options.json);
    return result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.SCAN_FAILED;
  } catch (err) {
    if (options.json) {
      const { createErrorOutput } = require("./lib/json-output");
      console.log(JSON.stringify(createErrorOutput(err, {
        receipt: options.file !== "-" ? options.file : "stdin",
        code: "VERIFICATION_ERROR",
        exitCode: EXIT_CODES.INTERNAL_ERROR,
      }), null, 2));
    } else {
      console.error(`${c.red}Verification error: ${err.message}${c.reset}`);
      if (options.file !== "-") {
        console.error(`${c.dim}Receipt: ${options.file}${c.reset}`);
      }
      if (err.stack && (process.env.DEBUG || process.env.GUARDRAIL_DEBUG)) {
        console.error(`${c.dim}${err.stack}${c.reset}`);
      }
      console.error(`\n${c.info("Verify it's fixed:")}`);
      console.error(`  ${c.dim("•")} guardrail verify-agent-output --file ${options.file || "-"}${c.reset}`);
    }
    return EXIT_CODES.INTERNAL_ERROR;
  }
}

module.exports = { runVerifyAgentOutput };
