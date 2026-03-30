const path = require("path");
const { execSync } = require("child_process");

function runMcp(args) {
  console.log("\n  🔌 Starting guardrail MCP Server...\n");

  const mcpServer = path.join(__dirname, "../../mcp-server/index.js");

  try {
    execSync(`node "${mcpServer}"`, { stdio: "inherit" });
  } catch (error) {
    console.error("  ❌ MCP Server failed to start");
    return 1;
  }

  return 0;
}

module.exports = { runMcp };
