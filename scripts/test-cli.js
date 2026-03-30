#!/usr/bin/env node

/**
 * CLI Test Script for guardrail
 * Tests basic CLI functionality without requiring installation
 */

const { spawn } = require("child_process");
const https = require("https");

// Test configuration
const TEST_CONFIG = {
  apiEndpoint: "http://localhost:3000/api/auth/api-key",
  testRepo: "https://github.com/guardrail/test-repo",
  testFile: "test.js",
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

// Test functions
async function testAPIConnection() {
  logInfo("Testing API connection...");

  return new Promise((resolve) => {
    const req = https.request(TEST_CONFIG.apiEndpoint, (res) => {
      logSuccess(`API responded with status: ${res.statusCode}`);
      resolve(res.statusCode === 200 || res.statusCode === 401); // 401 is OK (means API is up)
    });

    req.on("error", () => {
      logError("Could not connect to API");
      resolve(false);
    });

    req.setTimeout(5000, () => {
      logError("API connection timeout");
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function testCLIInstallation() {
  logInfo("Testing CLI installation...");

  return new Promise((resolve) => {
    const child = spawn("guardrail", ["--version"], {
      stdio: "pipe",
      shell: true,
    });

    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        logError("CLI not found. Install with: npm install -g @guardrail/cli");
        resolve(false);
      } else {
        logError(`CLI error: ${error.message}`);
        resolve(false);
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        logSuccess("CLI is installed and responding");
        resolve(true);
      } else {
        logError(`CLI exited with code: ${code}`);
        resolve(false);
      }
    });

    // Capture output
    child.stdout.on("data", (data) => {
      const version = data.toString().trim();
      if (version) {
        logSuccess(`CLI version: ${version}`);
      }
    });

    child.stderr.on("data", (data) => {
      const error = data.toString().trim();
      if (error && !error.includes("ENOENT")) {
        logWarning(`CLI stderr: ${error}`);
      }
    });
  });
}

async function testMCPConfig() {
  logInfo("Testing MCP configuration...");

  const config = {
    mcpServers: {
      guardrail: {
        command: "npx",
        args: ["-y", "@guardrail/mcp-server"],
        env: {
          GUARDRAIL_API_KEY: "test-key-12345678",
        },
      },
    },
  };

  try {
    const configString = JSON.stringify(config, null, 2);
    logSuccess("MCP configuration is valid JSON");
    logInfo("Config file location:");
    log("  VS Code: ~/.vscode/mcp-servers.json");
    log("  Cursor: ~/.cursor/mcp.json");
    log("  Windsurf: ~/.windsurf/mcp_config.json");
    return true;
  } catch (error) {
    logError(`Invalid MCP config: ${error.message}`);
    return false;
  }
}

async function testNodeVersion() {
  logInfo("Checking Node.js version...");

  return new Promise((resolve) => {
    const child = spawn("node", ["--version"], { stdio: "pipe" });

    child.on("error", () => {
      logError("Node.js not found");
      resolve(false);
    });

    child.on("close", (code) => {
      if (code === 0) {
        logSuccess("Node.js is available");
        resolve(true);
      } else {
        logError("Node.js check failed");
        resolve(false);
      }
    });

    child.stdout.on("data", (data) => {
      const version = data.toString().trim();
      const majorVersion = parseInt(version.slice(1).split(".")[0]);
      if (majorVersion >= 16) {
        logSuccess(`Node.js version: ${version} (supported)`);
      } else {
        logWarning(
          `Node.js version: ${version} (may not support all features)`,
        );
      }
    });
  });
}

async function runAllTests() {
  log("\n🚀 guardrail CLI & MCP Test Suite", colors.blue);
  log("=====================================\n");

  const results = {
    node: await testNodeVersion(),
    api: await testAPIConnection(),
    cli: await testCLIInstallation(),
    mcp: await testMCPConfig(),
  };

  log("\n📊 Test Results:", colors.blue);
  log("==================");

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  if (passed === total) {
    logSuccess(`All tests passed! (${passed}/${total})`);
    log("\n✨ You're ready to use guardrail CLI and MCP!", colors.green);
  } else {
    logWarning(`Some tests failed (${passed}/${total})`);
    log("\n🔧 Setup Instructions:", colors.yellow);
    log("==================");

    if (!results.node) {
      log("• Install Node.js: https://nodejs.org/");
    }

    if (!results.cli) {
      log("• Install CLI: npm install -g @guardrail/cli");
    }

    if (!results.api) {
      log("• Start the API server: npm run dev");
    }

    if (!results.mcp) {
      log("• Check MCP configuration format");
    }
  }

  log("\n📚 Documentation: https://docs.guardrail.dev");
  log("🐛 Issues: https://github.com/guardrail/issues");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testAPIConnection,
  testCLIInstallation,
  testMCPConfig,
  testNodeVersion,
  runAllTests,
};
