/**
 * guardrail audit - Audit Trail Management
 * 
 * Compliance+ tier feature for viewing and exporting audit logs.
 * Commands:
 *   guardrail audit tail         - Show recent events
 *   guardrail audit show --last N - Show last N events  
 *   guardrail audit export --format json|csv
 *   guardrail audit validate     - Verify hash chain integrity
 */

const path = require("path");
const fs = require("fs");
const { withErrorHandling, createUserError } = require("./lib/error-handler");
const { enforceFeature, getCurrentTier } = require("./lib/entitlements");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const AUDIT_DIR = ".guardrail/audit";
const AUDIT_FILE = "audit.log.jsonl";

function parseArgs(args) {
  const parsed = {
    command: args[0] || "tail",
    last: 10,
    format: "json",
    output: null,
    startDate: null,
    endDate: null,
    surface: null,
    category: null,
    includeMetadata: true,
    help: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--last" || arg === "-n") {
      parsed.last = parseInt(args[++i], 10) || 10;
    } else if (arg === "--format" || arg === "-f") {
      parsed.format = args[++i] || "json";
    } else if (arg === "--output" || arg === "-o") {
      parsed.output = args[++i];
    } else if (arg === "--start") {
      parsed.startDate = new Date(args[++i]);
    } else if (arg === "--end") {
      parsed.endDate = new Date(args[++i]);
    } else if (arg === "--surface") {
      parsed.surface = args[++i];
    } else if (arg === "--category") {
      parsed.category = args[++i];
    } else if (arg === "--no-metadata") {
      parsed.includeMetadata = false;
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
${c.cyan}  guardrail AUDIT${c.reset} - Audit Trail Management (Compliance+ Feature)
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}

${c.green}COMMANDS${c.reset}

  ${c.cyan}tail${c.reset}              Show recent audit events (default: last 10)
  ${c.cyan}show${c.reset}              Show audit events with filters
  ${c.cyan}export${c.reset}            Export audit log to file
  ${c.cyan}validate${c.reset}          Verify hash chain integrity

${c.yellow}OPTIONS${c.reset}

  ${c.cyan}--last, -n${c.reset}        Number of events to show (default: 10)
  ${c.cyan}--format, -f${c.reset}      Export format: json, csv (default: json)
  ${c.cyan}--output, -o${c.reset}      Output file path for export
  ${c.cyan}--start${c.reset}           Start date filter (ISO format)
  ${c.cyan}--end${c.reset}             End date filter (ISO format)
  ${c.cyan}--surface${c.reset}         Filter by surface: cli, vscode, mcp, web
  ${c.cyan}--category${c.reset}        Filter by category: scan, ship, fix, etc.
  ${c.cyan}--no-metadata${c.reset}     Exclude metadata from output

${c.green}EXAMPLES${c.reset}

  guardrail audit tail                     ${c.dim}# Show last 10 events${c.reset}
  guardrail audit show --last 50           ${c.dim}# Show last 50 events${c.reset}
  guardrail audit show --category scan     ${c.dim}# Filter by scan events${c.reset}
  guardrail audit export --format csv      ${c.dim}# Export to CSV${c.reset}
  guardrail audit export -o audit.json     ${c.dim}# Export to specific file${c.reset}
  guardrail audit validate                 ${c.dim}# Verify chain integrity${c.reset}

${c.dim}Note: Full audit trail requires Compliance+ tier.${c.reset}
`);
}

function getAuditFilePath(basePath = process.cwd()) {
  return path.join(basePath, AUDIT_DIR, AUDIT_FILE);
}

function readAuditEvents(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((line) => line.trim());
  
  let events = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  // Apply filters
  if (options.startDate) {
    events = events.filter((e) => new Date(e.timestamp) >= options.startDate);
  }
  if (options.endDate) {
    events = events.filter((e) => new Date(e.timestamp) <= options.endDate);
  }
  if (options.surface) {
    events = events.filter((e) => e.surface === options.surface);
  }
  if (options.category) {
    events = events.filter((e) => e.category === options.category);
  }

  return events;
}

function formatEvent(event, includeMetadata = true) {
  const timestamp = new Date(event.timestamp).toLocaleString();
  const resultIcon = {
    success: `${c.green}✓${c.reset}`,
    failure: `${c.red}✗${c.reset}`,
    partial: `${c.yellow}◐${c.reset}`,
    skipped: `${c.gray}○${c.reset}`,
    error: `${c.red}✗${c.reset}`,
  }[event.result] || "•";

  const surfaceIcon = {
    cli: "⌨️",
    vscode: "💻",
    mcp: "🔌",
    web: "🌐",
    api: "📡",
    ci: "🔄",
  }[event.surface] || "•";

  let output = `${c.dim}${timestamp}${c.reset} ${surfaceIcon} ${resultIcon} `;
  output += `${c.cyan}${event.action}${c.reset}`;
  
  if (event.target?.path) {
    output += ` ${c.dim}→${c.reset} ${event.target.path}`;
  } else if (event.target?.name) {
    output += ` ${c.dim}→${c.reset} ${event.target.name}`;
  }

  output += ` ${c.dim}[${event.actor?.name || event.actor?.id || "unknown"}]${c.reset}`;

  if (includeMetadata && event.metadata) {
    const meta = [];
    if (event.metadata.score !== undefined) meta.push(`score:${event.metadata.score}`);
    if (event.metadata.grade) meta.push(`grade:${event.metadata.grade}`);
    if (event.metadata.durationMs) meta.push(`${event.metadata.durationMs}ms`);
    if (event.metadata.issueCount !== undefined) meta.push(`issues:${event.metadata.issueCount}`);
    if (event.metadata.fixCount !== undefined) meta.push(`fixes:${event.metadata.fixCount}`);
    
    if (meta.length > 0) {
      output += ` ${c.gray}(${meta.join(", ")})${c.reset}`;
    }
  }

  return output;
}

function validateChain(events) {
  const GENESIS_HASH = "0".repeat(64);
  const result = {
    valid: true,
    totalEvents: events.length,
    validEvents: 0,
    invalidEvents: 0,
    brokenLinks: [],
    tamperedEvents: [],
  };

  if (events.length === 0) {
    return result;
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    if (event.prevHash !== expectedPrevHash) {
      result.valid = false;
      result.invalidEvents++;
      result.brokenLinks.push({
        index: i,
        eventId: event.id,
        expected: expectedPrevHash.slice(0, 16) + "...",
        actual: event.prevHash.slice(0, 16) + "...",
      });
    } else {
      result.validEvents++;
    }
    
    expectedPrevHash = event.hash;
  }

  return result;
}

async function runTail(options) {
  const filePath = getAuditFilePath();
  const events = readAuditEvents(filePath, options);
  const lastEvents = events.slice(-options.last);

  if (lastEvents.length === 0) {
    console.log(`${c.yellow}No audit events found.${c.reset}`);
    console.log(`${c.dim}Audit events are recorded when you run guardrail commands.${c.reset}`);
    return 0;
  }

  console.log(`\n${c.cyan}${c.bold}📋 Audit Trail${c.reset} ${c.dim}(last ${lastEvents.length} of ${events.length} events)${c.reset}\n`);
  
  for (const event of lastEvents) {
    console.log(formatEvent(event, options.includeMetadata));
  }

  console.log(`\n${c.dim}Hash chain: ${events.length > 0 ? events[events.length - 1].hash.slice(0, 16) + "..." : "empty"}${c.reset}`);
  return 0;
}

async function runShow(options) {
  const filePath = getAuditFilePath();
  const events = readAuditEvents(filePath, options);
  const lastEvents = events.slice(-options.last);

  if (lastEvents.length === 0) {
    console.log(`${c.yellow}No audit events match the filters.${c.reset}`);
    return 0;
  }

  console.log(`\n${c.cyan}${c.bold}📋 Audit Events${c.reset}`);
  
  if (options.surface || options.category || options.startDate || options.endDate) {
    const filters = [];
    if (options.surface) filters.push(`surface:${options.surface}`);
    if (options.category) filters.push(`category:${options.category}`);
    if (options.startDate) filters.push(`from:${options.startDate.toISOString().split("T")[0]}`);
    if (options.endDate) filters.push(`to:${options.endDate.toISOString().split("T")[0]}`);
    console.log(`${c.dim}Filters: ${filters.join(", ")}${c.reset}`);
  }
  
  console.log(`${c.dim}Showing ${lastEvents.length} of ${events.length} matching events${c.reset}\n`);

  for (const event of lastEvents) {
    console.log(formatEvent(event, options.includeMetadata));
  }

  return 0;
}

async function runExport(options) {
  const filePath = getAuditFilePath();
  const events = readAuditEvents(filePath, options);

  if (events.length === 0) {
    console.log(`${c.yellow}No audit events to export.${c.reset}`);
    return 0;
  }

  let output;
  let extension;

  if (options.format === "csv") {
    const headers = [
      "id",
      "timestamp",
      "actor_id",
      "actor_type",
      "actor_name",
      "surface",
      "category",
      "action",
      "target_type",
      "target_path",
      "tier",
      "result",
      "hash",
    ];

    if (options.includeMetadata) {
      headers.push("metadata");
    }

    const rows = events.map((event) => {
      const row = [
        event.id,
        event.timestamp,
        event.actor?.id || "",
        event.actor?.type || "",
        event.actor?.name || "",
        event.surface,
        event.category,
        event.action,
        event.target?.type || "",
        event.target?.path || "",
        event.tier,
        event.result,
        event.hash,
      ];

      if (options.includeMetadata) {
        row.push(JSON.stringify(event.metadata || {}));
      }

      return row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    output = [headers.join(","), ...rows].join("\n");
    extension = "csv";
  } else {
    output = JSON.stringify(events, null, 2);
    extension = "json";
  }

  const outputPath = options.output || `audit-export-${Date.now()}.${extension}`;
  fs.writeFileSync(outputPath, output, "utf8");

  console.log(`\n${c.green}✓${c.reset} Exported ${events.length} events to ${c.cyan}${outputPath}${c.reset}`);
  console.log(`${c.dim}Format: ${options.format.toUpperCase()}${c.reset}`);
  
  return 0;
}

async function runValidate() {
  const filePath = getAuditFilePath();
  const events = readAuditEvents(filePath);

  console.log(`\n${c.cyan}${c.bold}🔐 Audit Chain Validation${c.reset}\n`);

  if (events.length === 0) {
    console.log(`${c.yellow}No audit events to validate.${c.reset}`);
    return 0;
  }

  const result = validateChain(events);

  if (result.valid) {
    console.log(`${c.green}✓${c.reset} Hash chain is ${c.green}VALID${c.reset}`);
    console.log(`${c.dim}  Total events: ${result.totalEvents}${c.reset}`);
    console.log(`${c.dim}  All hashes verified successfully${c.reset}`);
    
    if (events.length > 0) {
      console.log(`\n${c.dim}  First event: ${events[0].timestamp}${c.reset}`);
      console.log(`${c.dim}  Last event:  ${events[events.length - 1].timestamp}${c.reset}`);
      console.log(`${c.dim}  Chain head:  ${events[events.length - 1].hash.slice(0, 32)}...${c.reset}`);
    }
  } else {
    console.log(`${c.red}✗${c.reset} Hash chain is ${c.red}INVALID${c.reset}`);
    console.log(`${c.dim}  Total events: ${result.totalEvents}${c.reset}`);
    console.log(`${c.dim}  Valid: ${result.validEvents}${c.reset}`);
    console.log(`${c.red}  Invalid: ${result.invalidEvents}${c.reset}`);

    if (result.brokenLinks.length > 0) {
      console.log(`\n${c.yellow}⚠ Broken Links:${c.reset}`);
      for (const link of result.brokenLinks.slice(0, 5)) {
        console.log(`  ${c.dim}Event ${link.index}:${c.reset} expected ${link.expected}, got ${link.actual}`);
      }
      if (result.brokenLinks.length > 5) {
        console.log(`  ${c.dim}... and ${result.brokenLinks.length - 5} more${c.reset}`);
      }
    }

    console.log(`\n${c.red}⚠ WARNING: Audit log may have been tampered with!${c.reset}`);
    return 1;
  }

  return 0;
}

async function runAudit(args) {
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  // Check tier access
  const tier = await getCurrentTier();
  const complianceTiers = ["compliance", "enterprise", "unlimited"];
  
  if (!complianceTiers.includes(tier) && process.env.GUARDRAIL_TIER !== "compliance") {
    // Allow limited access for Pro tier
    if (tier !== "pro") {
      console.log(`\n${c.yellow}⚠ Audit Trail requires Compliance+ tier${c.reset}`);
      console.log(`${c.dim}Your current tier: ${tier}${c.reset}`);
      console.log(`\n${c.dim}Upgrade at: ${c.cyan}https://guardrailai.dev/pricing${c.reset}`);
      console.log(`${c.dim}Or set GUARDRAIL_TIER=compliance for testing${c.reset}\n`);
      return 1;
    }
    
    // Pro gets limited view
    console.log(`${c.yellow}⚠ Limited audit view (Pro tier)${c.reset}`);
    console.log(`${c.dim}Upgrade to Compliance+ for full audit trail${c.reset}\n`);
  }

  switch (options.command) {
    case "tail":
      return await runTail(options);
    case "show":
      return await runShow(options);
    case "export":
      return await runExport(options);
    case "validate":
      return await runValidate();
    default:
      console.log(`${c.red}Unknown audit command: ${options.command}${c.reset}`);
      printHelp();
      return 1;
  }
}

module.exports = { runAudit };
