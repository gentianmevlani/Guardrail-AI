/**
 * guardrail fixpacks - Fix Pack Management
 *
 * Usage:
 *   guardrail fixpacks list              List all fix packs for current project
 *   guardrail fixpacks show <id>         Show details of a specific fix pack
 *   guardrail fixpacks generate          Generate fix packs from scan results
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { withErrorHandling } = require("./lib/error-handler");
const {
  printBanner,
  printCommandHeader,
  colors: c,
  printSectionHeader,
} = require("./cli-utils");
const { trackUsage } = require("./lib/entitlements");

const SEVERITY_COLORS = {
  critical: c.bgRed + c.white,
  high: c.red,
  medium: c.yellow,
  low: c.blue,
  info: c.dim,
};

const SEVERITY_ICONS = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

function parseArgs(args) {
  const opts = {
    subcommand: args[0] || "list",
    packId: null,
    path: ".",
    format: "text",
    verbose: false,
    help: false,
    refresh: false,
  };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    else if (a === "--path" || a === "-p") opts.path = args[++i];
    else if (a === "--format" && args[i + 1]) opts.format = args[++i];
    else if (a === "--verbose" || a === "-v") opts.verbose = true;
    else if (a === "--refresh" || a === "-r") opts.refresh = true;
    else if (!a.startsWith("-") && !opts.packId && opts.subcommand === "show") {
      opts.packId = a;
    } else if (!a.startsWith("-") && i === 1) {
      opts.packId = a;
    }
  }

  return opts;
}

function printFixPacksHelp() {
  console.log(`
${c.bold}USAGE${c.reset}
  guardrail fixpacks <command> [options]

${c.bold}COMMANDS${c.reset}
  list                 List all fix packs for current project
  show <id>            Show details of a specific fix pack
  generate             Generate fix packs from scan results

${c.bold}OPTIONS${c.reset}
  --path, -p <dir>     Project path (default: current directory)
  --format json        Output as JSON
  --verbose, -v        Show detailed information
  --refresh, -r        Force regenerate fix packs
  --help, -h           Show this help

${c.bold}EXAMPLES${c.reset}
  guardrail fixpacks list
  guardrail fixpacks show FP-SEC-001-abc123
  guardrail fixpacks generate --path ./my-project
  guardrail fixpacks list --format json

${c.bold}FIX PACK ID FORMAT${c.reset}
  FP-<CAT>-<NUM>-<HASH>
  
  CAT: Category prefix (SEC=secrets, ROU=routes, MOC=mocks, etc.)
  NUM: Sequential number
  HASH: Deterministic hash for stability
`);
}

function getFixPacksCachePath(projectPath) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  return path.join(guardrailDir, "fix-packs.json");
}

function loadCachedFixPacks(projectPath) {
  const cachePath = getFixPacksCachePath(projectPath);
  try {
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      const cacheAge = Date.now() - new Date(data.generatedAt).getTime();
      if (cacheAge < 3600000) {
        return data;
      }
    }
  } catch {
    // Cache miss
  }
  return null;
}

function saveCachedFixPacks(projectPath, data) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  try {
    if (!fs.existsSync(guardrailDir)) {
      fs.mkdirSync(guardrailDir, { recursive: true });
    }
    fs.writeFileSync(
      getFixPacksCachePath(projectPath),
      JSON.stringify(data, null, 2)
    );
  } catch {
    // Ignore cache write failures
  }
}

function generateRepoFingerprint(projectPath) {
  const name = path.basename(projectPath);
  let hasTypeScript = false;
  let hasTests = false;
  let packageManager;

  try {
    hasTypeScript = fs.existsSync(path.join(projectPath, "tsconfig.json"));
  } catch { /* ignore */ }

  try {
    const testDirs = ["tests", "test", "__tests__", "spec"];
    hasTests = testDirs.some((dir) =>
      fs.existsSync(path.join(projectPath, dir))
    );
  } catch { /* ignore */ }

  try {
    if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) {
      packageManager = "pnpm";
    } else if (fs.existsSync(path.join(projectPath, "yarn.lock"))) {
      packageManager = "yarn";
    } else if (fs.existsSync(path.join(projectPath, "package-lock.json"))) {
      packageManager = "npm";
    }
  } catch { /* ignore */ }

  const fingerprintData = `${name}:${hasTypeScript}:${hasTests}:${packageManager || ""}`;
  const hash = crypto
    .createHash("sha256")
    .update(fingerprintData)
    .digest("hex")
    .slice(0, 12);

  return {
    id: `repo-${hash}`,
    name,
    hasTypeScript,
    hasTests,
    packageManager,
    hash,
  };
}

async function generateFixPacksFromScan(projectPath, verbose) {
  const { execSync } = require("child_process");
  
  if (verbose) {
    console.log(`${c.dim}Running scan to collect findings...${c.reset}`);
  }

  let scanOutput = "";
  try {
    scanOutput = execSync("npx guardrail scan --json", {
      cwd: projectPath,
      encoding: "utf8",
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    scanOutput = e.stdout || "";
  }

  const findings = parseFindingsFromOutput(scanOutput);
  const repoFingerprint = generateRepoFingerprint(projectPath);

  const result = generateFixPacksInternal(findings, repoFingerprint);

  const cacheData = {
    ...result,
    generatedAt: new Date().toISOString(),
    repoFingerprint,
  };

  saveCachedFixPacks(projectPath, cacheData);

  return cacheData;
}

function parseFindingsFromOutput(output) {
  const findings = [];
  
  try {
    const json = JSON.parse(output);
    if (Array.isArray(json.findings)) {
      return json.findings.map((f, i) => normalizeFinding(f, i));
    }
    if (Array.isArray(json.issues)) {
      return json.issues.map((f, i) => normalizeFinding(f, i));
    }
    if (Array.isArray(json)) {
      return json.map((f, i) => normalizeFinding(f, i));
    }
  } catch {
    // Try text parsing
    const lines = output.split("\n");
    let index = 0;
    
    for (const line of lines) {
      const match = line.match(/^(.+):(\d+):(\d+):\s*(error|warning|info):\s*(.+)$/i);
      if (match) {
        findings.push({
          id: `text-finding-${index++}`,
          category: "security",
          severity: normalizeSeverity(match[4]),
          title: match[5],
          description: line,
          file: match[1],
          line: parseInt(match[2], 10),
        });
      }
    }
  }

  return findings;
}

function normalizeFinding(raw, index) {
  return {
    id: raw.id || raw.ruleId || `finding-${index}`,
    category: normalizeCategory(raw.category || raw.type || "security"),
    severity: normalizeSeverity(raw.severity || raw.level || "medium"),
    title: raw.title || raw.message || raw.description || "Unknown issue",
    description: raw.description || raw.message || "",
    file: raw.file || raw.filePath || raw.path || "unknown",
    line: raw.line || raw.startLine || (raw.location && raw.location.line),
    suggestion: raw.suggestion || raw.fix || raw.recommendation,
  };
}

function normalizeCategory(category) {
  const categoryMap = {
    secret: "secrets",
    secrets: "secrets",
    credential: "secrets",
    route: "routes",
    routes: "routes",
    mock: "mocks",
    mocks: "mocks",
    demo: "mocks",
    auth: "auth",
    authentication: "auth",
    placeholder: "placeholders",
    placeholders: "placeholders",
    dep: "deps",
    deps: "deps",
    dependency: "deps",
    type: "types",
    types: "types",
    test: "tests",
    tests: "tests",
    security: "security",
  };

  return categoryMap[category.toLowerCase()] || "security";
}

function normalizeSeverity(severity) {
  const severityMap = {
    critical: "critical",
    blocker: "critical",
    high: "high",
    error: "high",
    medium: "medium",
    warning: "medium",
    low: "low",
    minor: "low",
    info: "info",
  };

  return severityMap[severity.toLowerCase()] || "medium";
}

function generateFixPacksInternal(findings, repoFingerprint) {
  if (findings.length === 0) {
    return {
      packs: [],
      ungrouped: [],
      stats: {
        totalFindings: 0,
        totalPacks: 0,
        byCategory: {},
        bySeverity: {},
      },
    };
  }

  const CATEGORY_PRIORITY = {
    secrets: 0,
    auth: 1,
    security: 2,
    routes: 3,
    mocks: 4,
    placeholders: 5,
    deps: 6,
    types: 7,
    tests: 8,
    performance: 9,
  };

  const SEVERITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  const sortedFindings = [...findings].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return (CATEGORY_PRIORITY[a.category] || 9) - (CATEGORY_PRIORITY[b.category] || 9);
  });

  const groups = new Map();
  for (const finding of sortedFindings) {
    const key = finding.category;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(finding);
  }

  const packs = [];
  let packIndex = 0;

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    return (CATEGORY_PRIORITY[a[0]] || 9) - (CATEGORY_PRIORITY[b[0]] || 9);
  });

  for (const [category, groupFindings] of sortedGroups) {
    const MAX_PACK_SIZE = 10;
    for (let i = 0; i < groupFindings.length; i += MAX_PACK_SIZE) {
      const chunk = groupFindings.slice(i, i + MAX_PACK_SIZE);
      const pack = createFixPack(chunk, category, repoFingerprint, packIndex++);
      packs.push(pack);
    }
  }

  packs.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return (CATEGORY_PRIORITY[a.category] || 9) - (CATEGORY_PRIORITY[b.category] || 9);
  });

  const stats = {
    totalFindings: findings.length,
    totalPacks: packs.length,
    byCategory: {},
    bySeverity: {},
  };

  for (const f of findings) {
    stats.byCategory[f.category] = (stats.byCategory[f.category] || 0) + 1;
    stats.bySeverity[f.severity] = (stats.bySeverity[f.severity] || 0) + 1;
  }

  return { packs, ungrouped: [], stats };
}

function createFixPack(findings, category, repoFingerprint, index) {
  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  
  const severities = findings.map((f) => f.severity);
  const severity = severities.reduce((highest, current) =>
    SEVERITY_ORDER[current] < SEVERITY_ORDER[highest] ? current : highest
  );

  const files = [...new Set(findings.map((f) => f.file))];
  
  const data = findings.map((f) => `${f.id}:${f.file}:${f.line || 0}`).sort().join("|");
  const combined = `${repoFingerprint.hash}:${data}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex").slice(0, 6);

  const catPrefix = category.slice(0, 3).toUpperCase();
  const id = `FP-${catPrefix}-${String(index).padStart(3, "0")}-${hash}`;

  const CATEGORY_NAMES = {
    secrets: "Secret Exposure",
    auth: "Authentication Issues",
    security: "Security Vulnerabilities",
    routes: "Route Integrity",
    mocks: "Mock/Demo Code",
    placeholders: "Placeholder Content",
    deps: "Dependency Issues",
    types: "Type Errors",
    tests: "Test Failures",
    performance: "Performance Issues",
  };

  const CATEGORY_STRATEGY = {
    secrets: "auto",
    auth: "guided",
    security: "guided",
    routes: "auto",
    mocks: "auto",
    placeholders: "auto",
    deps: "guided",
    types: "ai-assisted",
    tests: "ai-assisted",
    performance: "manual",
  };

  const CATEGORY_REQUIRES_REVIEW = {
    secrets: false,
    auth: true,
    security: true,
    routes: false,
    mocks: false,
    placeholders: false,
    deps: true,
    types: false,
    tests: true,
    performance: true,
  };

  const severityPrefix =
    severity === "critical" || severity === "high"
      ? `[${severity.toUpperCase()}] `
      : "";

  const title = `${severityPrefix}${CATEGORY_NAMES[category] || category} (${findings.length} ${findings.length === 1 ? "issue" : "issues"})`;

  const requiresHumanReview =
    CATEGORY_REQUIRES_REVIEW[category] ||
    severity === "critical" ||
    files.length > 10;

  return {
    id,
    title,
    severity,
    findings,
    files,
    strategy: CATEGORY_STRATEGY[category] || "manual",
    estimatedImpact: {
      filesAffected: files.length,
      linesChanged: findings.reduce((sum, f) => sum + 1, 0),
      riskLevel: severity === "critical" || files.length > 10 ? "high" : severity === "high" ? "medium" : "low",
      confidence: Math.min(100, 50 + findings.filter((f) => f.suggestion).length * 10),
      timeEstimateMinutes: Math.ceil(findings.length * 2 + files.length * 3),
    },
    requiresHumanReview,
    category,
    createdAt: new Date().toISOString(),
    metadata: {
      repoFingerprint: repoFingerprint.hash,
      generatedBy: "guardrail-fix-packs",
      version: "1.0.0",
    },
  };
}

function printPackList(data, verbose) {
  const { packs, stats } = data;

  printSectionHeader("FIX PACKS");
  
  if (packs.length === 0) {
    console.log(`  ${c.green}✓${c.reset} No issues found - your code is clean!\n`);
    return;
  }

  console.log(`  ${c.bold}${stats.totalPacks}${c.reset} pack(s) containing ${c.bold}${stats.totalFindings}${c.reset} finding(s)\n`);

  for (const pack of packs) {
    const icon = SEVERITY_ICONS[pack.severity] || "⚪";
    const color = SEVERITY_COLORS[pack.severity] || "";
    const reviewBadge = pack.requiresHumanReview ? ` ${c.yellow}[REVIEW]${c.reset}` : "";
    
    console.log(`  ${icon} ${c.bold}${pack.id}${c.reset}${reviewBadge}`);
    console.log(`     ${color}${pack.title}${c.reset}`);
    console.log(`     ${c.dim}Files: ${pack.files.length} | Strategy: ${pack.strategy} | ~${pack.estimatedImpact.timeEstimateMinutes}min${c.reset}`);
    
    if (verbose && pack.findings.length > 0) {
      console.log(`     ${c.dim}Top issues:${c.reset}`);
      for (const f of pack.findings.slice(0, 3)) {
        console.log(`       • ${f.file}${f.line ? `:${f.line}` : ""} - ${f.title.slice(0, 50)}`);
      }
      if (pack.findings.length > 3) {
        console.log(`       ${c.dim}... and ${pack.findings.length - 3} more${c.reset}`);
      }
    }
    console.log("");
  }

  console.log(`${c.dim}Run ${c.cyan}guardrail fixpacks show <id>${c.dim} for details${c.reset}`);
  console.log(`${c.dim}Run ${c.cyan}guardrail fix <pack-id>${c.dim} to apply fixes${c.reset}\n`);
}

function printPackDetails(pack) {
  printSectionHeader(`FIX PACK: ${pack.id}`);

  const icon = SEVERITY_ICONS[pack.severity] || "⚪";
  const color = SEVERITY_COLORS[pack.severity] || "";

  console.log(`  ${c.bold}Title:${c.reset} ${pack.title}`);
  console.log(`  ${c.bold}Severity:${c.reset} ${icon} ${color}${pack.severity.toUpperCase()}${c.reset}`);
  console.log(`  ${c.bold}Category:${c.reset} ${pack.category}`);
  console.log(`  ${c.bold}Strategy:${c.reset} ${pack.strategy}`);
  console.log(`  ${c.bold}Human Review:${c.reset} ${pack.requiresHumanReview ? `${c.yellow}Required${c.reset}` : `${c.green}Not required${c.reset}`}`);
  console.log("");

  console.log(`  ${c.bold}Impact Estimate:${c.reset}`);
  console.log(`    Files affected: ${pack.estimatedImpact.filesAffected}`);
  console.log(`    Lines changed:  ~${pack.estimatedImpact.linesChanged}`);
  console.log(`    Risk level:     ${pack.estimatedImpact.riskLevel}`);
  console.log(`    Confidence:     ${pack.estimatedImpact.confidence}%`);
  console.log(`    Time estimate:  ~${pack.estimatedImpact.timeEstimateMinutes} minutes`);
  console.log("");

  console.log(`  ${c.bold}Files (${pack.files.length}):${c.reset}`);
  for (const file of pack.files.slice(0, 10)) {
    console.log(`    • ${file}`);
  }
  if (pack.files.length > 10) {
    console.log(`    ${c.dim}... and ${pack.files.length - 10} more${c.reset}`);
  }
  console.log("");

  console.log(`  ${c.bold}Findings (${pack.findings.length}):${c.reset}`);
  for (const finding of pack.findings) {
    const fIcon = SEVERITY_ICONS[finding.severity] || "⚪";
    console.log(`    ${fIcon} ${c.bold}${finding.title}${c.reset}`);
    console.log(`      ${c.dim}${finding.file}${finding.line ? `:${finding.line}` : ""}${c.reset}`);
    if (finding.description && finding.description !== finding.title) {
      console.log(`      ${finding.description.slice(0, 80)}${finding.description.length > 80 ? "..." : ""}`);
    }
    if (finding.suggestion) {
      console.log(`      ${c.green}💡 ${finding.suggestion.slice(0, 80)}${c.reset}`);
    }
    console.log("");
  }

  console.log(`${c.dim}Run ${c.cyan}guardrail fix ${pack.id}${c.dim} to apply fixes${c.reset}\n`);
}

async function runFixPacks(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    printBanner();
    printFixPacksHelp();
    return 0;
  }

  printBanner();
  printCommandHeader("FIXPACKS", "Fix Pack Management");

  const projectPath = path.resolve(opts.path);
  console.log(`${c.dim}Project:${c.reset} ${projectPath}\n`);

  try {
    await trackUsage("scans", 1);
  } catch {
    // Ignore tracking errors
  }

  let data = null;

  if (!opts.refresh) {
    data = loadCachedFixPacks(projectPath);
  }

  if (!data || opts.subcommand === "generate") {
    console.log(`${c.cyan}Generating fix packs...${c.reset}\n`);
    data = await generateFixPacksFromScan(projectPath, opts.verbose);
  }

  if (opts.format === "json") {
    if (opts.subcommand === "show" && opts.packId) {
      const pack = data.packs.find((p) => p.id === opts.packId);
      if (pack) {
        console.log(JSON.stringify(pack, null, 2));
      } else {
        console.log(JSON.stringify({ error: `Pack not found: ${opts.packId}` }));
        return 1;
      }
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    return 0;
  }

  switch (opts.subcommand) {
    case "show":
      if (!opts.packId) {
        console.log(`${c.red}Error: Pack ID required${c.reset}`);
        console.log(`${c.dim}Usage: guardrail fixpacks show <pack-id>${c.reset}\n`);
        return 1;
      }
      const pack = data.packs.find((p) => p.id === opts.packId);
      if (!pack) {
        console.log(`${c.red}Error: Pack not found: ${opts.packId}${c.reset}`);
        console.log(`${c.dim}Available packs:${c.reset}`);
        for (const p of data.packs.slice(0, 5)) {
          console.log(`  • ${p.id}`);
        }
        return 1;
      }
      printPackDetails(pack);
      break;

    case "generate":
      console.log(`${c.green}✓${c.reset} Fix packs generated successfully\n`);
      printPackList(data, opts.verbose);
      break;

    case "list":
    default:
      printPackList(data, opts.verbose);
      break;
  }

  return 0;
}

module.exports = {
  runFixPacks: withErrorHandling(runFixPacks, "Fix packs command failed"),
  generateFixPacksFromScan,
  loadCachedFixPacks,
  generateRepoFingerprint,
};
