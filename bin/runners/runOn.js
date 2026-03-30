/**
 * guardrail on - Always-On Context Mode
 *
 * The relationship infrastructure that makes AI dependent on repo truth.
 *
 * Features:
 * - File watcher for Truth Pack updates
 * - MCP server in background
 * - Telemetry logging
 * - Real-time metrics
 * - State persistence
 *
 * @module runOn
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const chokidar = require("chokidar");
const { generateTruthPack, isTruthPackFresh } = require("./context/truth-pack-generator");

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
};

function parseArgs(args) {
  const opts = {
    path: ".",
    daemon: false,
    stop: false,
    status: false,
    restart: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a === "--daemon" || a === "-d") opts.daemon = true;
    if (a === "--stop") opts.stop = true;
    if (a === "--status") opts.status = true;
    if (a === "--restart") opts.restart = true;
  }

  return opts;
}

async function runOn(args) {
  const opts = parseArgs(args);
  const projectPath = path.resolve(opts.path);
  const stateFile = path.join(projectPath, ".guardrail", "state.json");

  // Handle --status flag
  if (opts.status) {
    return showStatus(projectPath, stateFile);
  }

  // Handle --stop flag
  if (opts.stop) {
    return stopContextMode(projectPath, stateFile);
  }

  // Handle --restart flag
  if (opts.restart) {
    await stopContextMode(projectPath, stateFile);
    // Continue to start
  }

  // Start context mode
  return startContextMode(projectPath, stateFile, opts);
}

async function startContextMode(projectPath, stateFile, opts) {
  console.log(`\n${c.cyan}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  🛡️  GUARDRAIL ON                     ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  Always-On Context Mode               ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚════════════════════════════════════════╝${c.reset}\n`);

  // Check if already running
  const existingState = loadState(stateFile);
  if (existingState && existingState.contextMode === "active") {
    console.log(`${c.yellow}⚠ Context Mode already active${c.reset}\n`);
    console.log(`  PID: ${existingState.watcher?.pid || "unknown"}`);
    console.log(`  Started: ${existingState.startedAt || "unknown"}`);
    console.log(`\n  Run ${c.cyan}guardrail on --stop${c.reset} to stop, or ${c.cyan}guardrail on --restart${c.reset} to restart\n`);
    return 1;
  }

  // Step 1: Check/Generate Truth Pack
  console.log(`${c.blue}[1/4]${c.reset} Checking Truth Pack...`);
  const isFresh = isTruthPackFresh(projectPath);

  if (!isFresh) {
    console.log(`${c.dim}  Truth Pack is stale, regenerating...${c.reset}`);
    try {
      await generateTruthPack(projectPath);
      console.log(`${c.green}  ✓${c.reset} Truth Pack updated`);
    } catch (error) {
      console.log(`${c.red}  ✗${c.reset} Failed to generate Truth Pack: ${error.message}\n`);
      return 1;
    }
  } else {
    console.log(`${c.green}  ✓${c.reset} Truth Pack is fresh`);
  }

  // Step 2: Start MCP Server (if not running)
  console.log(`\n${c.blue}[2/4]${c.reset} Starting MCP Server...`);
  const mcpServer = await startMCPServer(projectPath);
  if (mcpServer.success) {
    console.log(`${c.green}  ✓${c.reset} MCP Server running (PID: ${mcpServer.pid})`);
  } else {
    console.log(`${c.yellow}  ⚠${c.reset} MCP Server not started: ${mcpServer.error}`);
    console.log(`${c.dim}    (MCP integration is optional)${c.reset}`);
  }

  // Step 3: Start File Watcher
  console.log(`\n${c.blue}[3/4]${c.reset} Starting file watcher...`);
  const watcher = startFileWatcher(projectPath);
  console.log(`${c.green}  ✓${c.reset} Watching ${c.dim}src/, lib/, packages/${c.reset}`);

  // Step 4: Enable Telemetry
  console.log(`\n${c.blue}[4/4]${c.reset} Enabling telemetry...`);
  const telemetryReady = await initTelemetry(projectPath);
  if (telemetryReady) {
    console.log(`${c.green}  ✓${c.reset} Telemetry enabled`);
  } else {
    console.log(`${c.yellow}  ⚠${c.reset} Telemetry initialization failed`);
  }

  // Save state
  const state = {
    contextMode: "active",
    startedAt: new Date().toISOString(),
    projectPath,
    mcpServer: {
      pid: mcpServer.pid || null,
      active: mcpServer.success,
    },
    watcher: {
      active: true,
      watching: ["src", "lib", "packages", "apps"],
    },
    telemetry: {
      enabled: telemetryReady,
      sessionId: generateSessionId(),
    },
    truthPack: {
      lastUpdate: new Date().toISOString(),
      fresh: true,
    }
  };

  saveState(stateFile, state);

  // Success message
  console.log(`\n${c.green}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.green}║  ✓ Context Mode Active                 ║${c.reset}`);
  console.log(`${c.green}╚════════════════════════════════════════╝${c.reset}\n`);

  console.log(`  ${c.cyan}Your AI now has repo truth.${c.reset}`);
  console.log(`  ${c.dim}Changes will auto-update the Truth Pack.${c.reset}\n`);

  console.log(`${c.cyan}Next best action:${c.reset}`);
  console.log(`  Use ${c.cyan}guardrail stats${c.reset} to see value metrics`);
  console.log(`  Run ${c.cyan}guardrail checkpoint${c.reset} before writing code\n`);

  // If not daemon mode, keep process running and show live updates
  if (!opts.daemon) {
    console.log(`${c.dim}Press Ctrl+C to stop Context Mode${c.reset}\n`);
    console.log(`${c.cyan}═══════════════════════════════════════${c.reset}`);
    console.log(`${c.cyan}  LIVE METRICS${c.reset}`);
    console.log(`${c.cyan}═══════════════════════════════════════${c.reset}\n`);

    // Show live metrics
    startLiveMetrics(projectPath, watcher);

    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
      console.log(`\n\n${c.yellow}Stopping Context Mode...${c.reset}`);
      watcher.close();
      if (mcpServer.process) {
        mcpServer.process.kill();
      }
      saveState(stateFile, { ...state, contextMode: "inactive" });
      console.log(`${c.green}✓ Context Mode stopped${c.reset}\n`);
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  }

  return 0;
}

function startFileWatcher(projectPath) {
  const watchPaths = [
    path.join(projectPath, "src"),
    path.join(projectPath, "lib"),
    path.join(projectPath, "packages"),
    path.join(projectPath, "apps"),
  ].filter(p => fs.existsSync(p));

  if (watchPaths.length === 0) {
    watchPaths.push(projectPath);
  }

  const watcher = chokidar.watch(watchPaths, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  let updateTimeout = null;

  watcher.on('change', (filePath) => {
    console.log(`${c.dim}  📝 Changed: ${path.relative(projectPath, filePath)}${c.reset}`);

    // Debounce Truth Pack updates
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(async () => {
      console.log(`${c.blue}  ↻ Updating Truth Pack...${c.reset}`);
      try {
        await generateTruthPack(projectPath);
        console.log(`${c.green}  ✓ Truth Pack updated${c.reset}`);
      } catch (error) {
        console.log(`${c.red}  ✗ Update failed: ${error.message}${c.reset}`);
      }
    }, 3000); // Wait 3s after last change
  });

  return watcher;
}

async function startMCPServer(projectPath) {
  try {
    const mcpServerPath = path.join(__dirname, "..", "..", "mcp-server", "index.js");

    if (!fs.existsSync(mcpServerPath)) {
      return { success: false, error: "MCP server not found" };
    }

    // Check if already running
    const stateFile = path.join(projectPath, ".guardrail", "state.json");
    const state = loadState(stateFile);
    if (state && state.mcpServer && state.mcpServer.pid) {
      try {
        process.kill(state.mcpServer.pid, 0); // Check if process exists
        return { success: true, pid: state.mcpServer.pid, alreadyRunning: true };
      } catch (e) {
        // Process doesn't exist, continue to start new one
      }
    }

    // Start MCP server as background process
    const mcpProcess = spawn('node', [mcpServerPath], {
      detached: true,
      stdio: 'ignore',
      cwd: path.join(__dirname, "..", ".."),
      env: { ...process.env, GUARDRAIL_PROJECT_PATH: projectPath }
    });

    mcpProcess.unref();

    return {
      success: true,
      pid: mcpProcess.pid,
      process: mcpProcess
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function initTelemetry(projectPath) {
  try {
    const telemetryDir = path.join(projectPath, ".guardrail");
    const dbPath = path.join(telemetryDir, "telemetry.db");

    // Create empty telemetry database (SQLite will be initialized on first write)
    // For now, just ensure directory exists
    if (!fs.existsSync(telemetryDir)) {
      fs.mkdirSync(telemetryDir, { recursive: true });
    }

    // Write initial telemetry config
    const configPath = path.join(telemetryDir, "telemetry.json");
    const config = {
      enabled: true,
      sessionId: generateSessionId(),
      startedAt: new Date().toISOString(),
      retentionDays: 90,
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return true;
  } catch (error) {
    console.error(`Telemetry init error: ${error.message}`);
    return false;
  }
}

function startLiveMetrics(projectPath, watcher) {
  // Show real-time stats (simplified for now)
  let fileChanges = 0;
  let truthPackUpdates = 0;

  watcher.on('change', () => {
    fileChanges++;
  });

  // Update metrics every 5 seconds
  setInterval(() => {
    console.log(`${c.dim}  Files changed: ${fileChanges} | Truth Pack updates: ${truthPackUpdates}${c.reset}`);
  }, 5000);
}

function stopContextMode(projectPath, stateFile) {
  console.log(`\n${c.yellow}Stopping Context Mode...${c.reset}\n`);

  const state = loadState(stateFile);
  if (!state || state.contextMode !== "active") {
    console.log(`${c.dim}  Context Mode is not active${c.reset}\n`);
    return 0;
  }

  // Kill MCP server if running
  if (state.mcpServer && state.mcpServer.pid) {
    try {
      process.kill(state.mcpServer.pid, 'SIGTERM');
      console.log(`${c.green}  ✓${c.reset} Stopped MCP Server (PID: ${state.mcpServer.pid})`);
    } catch (e) {
      console.log(`${c.dim}  MCP Server already stopped${c.reset}`);
    }
  }

  // Update state
  saveState(stateFile, {
    ...state,
    contextMode: "inactive",
    stoppedAt: new Date().toISOString(),
  });

  console.log(`\n${c.green}✓ Context Mode stopped${c.reset}\n`);
  return 0;
}

function showStatus(projectPath, stateFile) {
  console.log(`\n${c.cyan}╔════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║  GUARDRAIL CONTEXT MODE STATUS         ║${c.reset}`);
  console.log(`${c.cyan}╚════════════════════════════════════════╝${c.reset}\n`);

  const state = loadState(stateFile);
  if (!state) {
    console.log(`  ${c.dim}Status: ${c.red}Not initialized${c.reset}`);
    console.log(`\n  Run ${c.cyan}guardrail on${c.reset} to start\n`);
    return 0;
  }

  const isActive = state.contextMode === "active";
  const statusColor = isActive ? c.green : c.dim;
  const statusText = isActive ? "Active" : "Inactive";

  console.log(`  Status: ${statusColor}${statusText}${c.reset}`);

  if (isActive) {
    console.log(`  Started: ${c.dim}${state.startedAt || "unknown"}${c.reset}`);

    if (state.mcpServer) {
      const mcpStatus = state.mcpServer.active ? `${c.green}Running` : `${c.red}Stopped`;
      console.log(`  MCP Server: ${mcpStatus}${c.reset} ${c.dim}(PID: ${state.mcpServer.pid || "N/A"})${c.reset}`);
    }

    if (state.watcher) {
      console.log(`  Watcher: ${c.green}Active${c.reset} ${c.dim}(watching ${state.watcher.watching?.join(", ") || "project"})${c.reset}`);
    }

    if (state.telemetry) {
      const telStatus = state.telemetry.enabled ? `${c.green}Enabled` : `${c.dim}Disabled`;
      console.log(`  Telemetry: ${telStatus}${c.reset}`);
    }

    if (state.truthPack) {
      const freshness = state.truthPack.fresh ? `${c.green}Fresh` : `${c.yellow}Stale`;
      console.log(`  Truth Pack: ${freshness}${c.reset} ${c.dim}(updated ${state.truthPack.lastUpdate || "unknown"})${c.reset}`);
    }
  }

  console.log(`\n${c.cyan}Commands:${c.reset}`);
  if (isActive) {
    console.log(`  ${c.cyan}guardrail on --stop${c.reset}     Stop Context Mode`);
    console.log(`  ${c.cyan}guardrail on --restart${c.reset}  Restart Context Mode`);
  } else {
    console.log(`  ${c.cyan}guardrail on${c.reset}             Start Context Mode`);
  }
  console.log(`  ${c.cyan}guardrail stats${c.reset}          View metrics\n`);

  return 0;
}

function loadState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  } catch (e) {
    return null;
  }
}

function saveState(stateFile, state) {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = { runOn };
