const path = require("path");
const { execSync } = require("child_process");

function runMcp(args) {
<<<<<<< HEAD
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  guardrail mcp

  Starts the guardrail MCP server over stdio (for Cursor / Claude / other hosts).
  This process blocks — configure your IDE to spawn:

    node ${path.join(__dirname, "../../mcp-server/index.js")}

  Options:
    --help, -h   Show this message
`);
    return 0;
  }

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
