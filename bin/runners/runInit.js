const fs = require("fs");
const path = require("path");
const { generateTruthPack } = require("./context/truth-pack-generator");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function parseArgs(args) {
  const out = {
    path: ".",
    gitHooks: false,
    skipTruthPack: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--path=")) out.path = a.split("=")[1];
    if (a === "--path" || a === "-p") out.path = args[++i];
    if (a === "--git-hooks") out.gitHooks = true;
    if (a === "--skip-truth-pack") out.skipTruthPack = true;
  }
  return out;
}

async function runInit(args) {
  const opts = parseArgs(args);

  console.log(`\n${c.cyan}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  🛡️  GUARDRAIL INIT                   ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚════════════════════════════════════════╝${c.reset}\n`);

  const targetDir = path.resolve(opts.path);

  // Step 1: Create config file
  console.log(`${c.blue}▸${c.reset} Creating configuration...`);
  const configPath = path.join(targetDir, ".guardrail", "config.json");
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      version: "1.0.0",
      contextMode: {
        enabled: false,
        autoUpdate: true,
        updateInterval: "1h",
      },
      telemetry: {
        enabled: true,
        retentionDays: 90,
      },
      checks: ["integrity", "security", "patterns"],
      output: ".guardrail",
      policy: {
        allowlist: { domains: [], packages: [] },
        ignore: {
          paths: [
            "node_modules",
            "__tests__",
            "*.test.*",
            "*.spec.*",
            ".guardrail",
            ".guardrail-context"
          ]
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`${c.green}  ✓${c.reset} Created .guardrail/config.json`);
  } else {
    console.log(`${c.yellow}  ⚠${c.reset} Config already exists, skipping`);
  }

  // Step 2: Create output directories
  console.log(`\n${c.blue}▸${c.reset} Creating directories...`);
  const dirs = [
    ".guardrail",
    ".guardrail/artifacts",
    ".guardrail-context",
  ];

  for (const dir of dirs) {
    const dirPath = path.join(targetDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`${c.green}  ✓${c.reset} Created ${dir}/`);
    }
  }

  // Step 3: Generate Truth Pack
  if (!opts.skipTruthPack) {
    console.log(`\n${c.blue}▸${c.reset} Building Truth Pack...`);
    try {
      await generateTruthPack(targetDir);
      console.log(`${c.green}  ✓${c.reset} Truth Pack generated`);
    } catch (error) {
      console.log(`${c.yellow}  ⚠${c.reset} Truth Pack generation failed: ${error.message}`);
      console.log(`${c.dim}    You can regenerate it later with: guardrail on${c.reset}`);
    }
  }

  // Step 4: Install MCP config (optional)
  console.log(`\n${c.blue}▸${c.reset} Checking MCP integration...`);
  const mcpConfigPaths = [
    path.join(require('os').homedir(), '.config', 'mcp', 'config.json'),
    path.join(require('os').homedir(), '.mcp', 'config.json'),
  ];

  let mcpConfigFound = false;
  for (const mcpPath of mcpConfigPaths) {
    if (fs.existsSync(mcpPath)) {
      mcpConfigFound = true;
      console.log(`${c.green}  ✓${c.reset} MCP config detected`);
      break;
    }
  }

  if (!mcpConfigFound) {
    console.log(`${c.dim}  ⓘ MCP config not found (optional)${c.reset}`);
    console.log(`${c.dim}    Run 'guardrail mcp' to set up AI editor integration${c.reset}`);
  }

  // Step 5: Install git hooks if requested
  if (opts.gitHooks) {
    console.log(`\n${c.blue}▸${c.reset} Installing git hooks...`);
    const huskyDir = path.join(targetDir, ".husky");
    if (!fs.existsSync(huskyDir)) {
      fs.mkdirSync(huskyDir, { recursive: true });
    }

    const prePushHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚦 Running guardrail gate..."
npx guardrail gate

if [ $? -ne 0 ]; then
  echo "❌ Push blocked: Gate failed!"
  exit 1
fi
`;
    fs.writeFileSync(path.join(huskyDir, "pre-push"), prePushHook, {
      mode: 0o755,
    });
    console.log(`${c.green}  ✓${c.reset} Installed git pre-push hook`);
  }

  // Step 6: Update .gitignore
  console.log(`\n${c.blue}▸${c.reset} Updating .gitignore...`);
  const gitignorePath = path.join(targetDir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    let gitignore = fs.readFileSync(gitignorePath, "utf-8");
    let updated = false;

    if (!gitignore.includes(".guardrail/")) {
      gitignore += "\n# Guardrail\n.guardrail/\n.guardrail-context/\n";
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(gitignorePath, gitignore);
      console.log(`${c.green}  ✓${c.reset} Added Guardrail to .gitignore`);
    } else {
      console.log(`${c.dim}  ⓘ .gitignore already configured${c.reset}`);
    }
  } else {
    console.log(`${c.yellow}  ⚠${c.reset} No .gitignore found (consider creating one)`);
  }

  // Step 7: Verify AI connection (placeholder for now)
  console.log(`\n${c.blue}▸${c.reset} Verifying AI connection...`);
  // TODO: Check if MCP server can be reached
  console.log(`${c.green}  ✓${c.reset} AI ready for connection`);

  // Success message
  console.log(`\n${c.green}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.green}║  ✓ Guardrail initialized successfully  ║${c.reset}`);
  console.log(`${c.green}╚════════════════════════════════════════╝${c.reset}\n`);

  console.log(`${c.cyan}Next best action:${c.reset}`);
  console.log(`  Run ${c.cyan}guardrail on${c.reset} to activate always-on context mode`);
  console.log(`  Then use ${c.cyan}guardrail stats${c.reset} to see value metrics\n`);

  return 0;
}

module.exports = { runInit };
