/**
 * guardrail Scan - Route Integrity & Code Analysis
 * 
 * The ultimate scanner combining:
 * - Route integrity (dead links, orphan routes, coverage)
 * - Security analysis (secrets, auth, vulnerabilities)
 * - Code quality (mocks, placeholders, hygiene)
 * 
 * Modes:
 * - guardrail scan: Layer 1 (AST) - Fast static analysis
 * - guardrail scan --truth: Layer 1+2 (+ build manifests) - CI/ship
 * - guardrail scan --reality --url <url>: Layer 1+2+3 (+ Playwright) - Full proof
 */

const path = require("path");
const fs = require("fs");
const { withErrorHandling, createUserError } = require("./lib/error-handler");
const { enforceLimit, trackUsage } = require("./lib/entitlements");
const { emitScanStart, emitScanComplete } = require("./lib/audit-bridge");

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED TERMINAL - ANSI CODES & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strike: '\x1b[9m',
  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright colors
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  // Background
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  bgBrightBlack: '\x1b[100m',
  bgBrightRed: '\x1b[101m',
  bgBrightGreen: '\x1b[102m',
  bgBrightYellow: '\x1b[103m',
  // Cursor
  cursorUp: (n = 1) => `\x1b[${n}A`,
  cursorDown: (n = 1) => `\x1b[${n}B`,
  cursorRight: (n = 1) => `\x1b[${n}C`,
  cursorLeft: (n = 1) => `\x1b[${n}D`,
  clearLine: '\x1b[2K',
  clearScreen: '\x1b[2J',
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

// 256-color support
const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const bgRgb = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;

// Gradient colors for the banner
const gradientCyan = rgb(0, 255, 255);
const gradientBlue = rgb(100, 149, 237);
const gradientPurple = rgb(138, 43, 226);
const gradientPink = rgb(255, 105, 180);
const gradientOrange = rgb(255, 165, 0);

const BANNER = `
${rgb(0, 200, 255)}   ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗██╗     ${c.reset}
${rgb(30, 180, 255)}  ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║██║     ${c.reset}
${rgb(60, 160, 255)}  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║██████╔╝███████║██║██║     ${c.reset}
${rgb(90, 140, 255)}  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══██╗██╔══██║██║██║     ${c.reset}
${rgb(120, 120, 255)}  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║██║███████╗${c.reset}
${rgb(150, 100, 255)}   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝${c.reset}

${c.dim}  ┌─────────────────────────────────────────────────────────────────────┐${c.reset}
${c.dim}  │${c.reset}  ${rgb(255, 255, 255)}${c.bold}Route Integrity${c.reset} ${c.dim}•${c.reset} ${rgb(200, 200, 200)}Security${c.reset} ${c.dim}•${c.reset} ${rgb(150, 150, 150)}Quality${c.reset} ${c.dim}•${c.reset} ${rgb(100, 100, 100)}Ship with Confidence${c.reset}  ${c.dim}│${c.reset}
${c.dim}  └─────────────────────────────────────────────────────────────────────┘${c.reset}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// TERMINAL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const BOX_CHARS = {
  topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯',
  horizontal: '─', vertical: '│',
  teeRight: '├', teeLeft: '┤', teeDown: '┬', teeUp: '┴',
  cross: '┼',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;
let spinnerInterval = null;

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

function progressBar(percent, width = 30) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const filledColor = percent >= 80 ? rgb(0, 255, 100) : percent >= 50 ? rgb(255, 200, 0) : rgb(255, 80, 80);
  return `${filledColor}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
}

function startSpinner(message) {
  process.stdout.write(c.hideCursor);
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r  ${c.cyan}${SPINNER_FRAMES[spinnerIndex]}${c.reset} ${message}    `);
    spinnerIndex = (spinnerIndex + 1) % SPINNER_FRAMES.length;
  }, 80);
}

function stopSpinner(message, success = true) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  const icon = success ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
  process.stdout.write(`\r${c.clearLine}  ${icon} ${message}\n`);
  process.stdout.write(c.showCursor);
}

function printBanner() {
  console.log(BANNER);
}

function printDivider(char = '─', color = c.dim) {
  console.log(`${color}  ${char.repeat(69)}${c.reset}`);
}

function printSection(title, icon = '◆') {
  console.log();
  console.log(`  ${rgb(100, 200, 255)}${icon}${c.reset} ${c.bold}${title}${c.reset}`);
  printDivider();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function getScoreColor(score) {
  if (score >= 90) return rgb(0, 255, 100);
  if (score >= 80) return rgb(100, 255, 100);
  if (score >= 70) return rgb(200, 255, 0);
  if (score >= 60) return rgb(255, 200, 0);
  if (score >= 50) return rgb(255, 150, 0);
  return rgb(255, 80, 80);
}

function getGradeColor(grade) {
  const colors = {
    'A': rgb(0, 255, 100),
    'B': rgb(100, 255, 100),
    'C': rgb(255, 200, 0),
    'D': rgb(255, 150, 0),
    'F': rgb(255, 80, 80),
  };
  return colors[grade] || c.white;
}

function printScoreCard(score, grade, canShip) {
  const scoreColor = getScoreColor(score);
  const gradeColor = getGradeColor(grade);
  
  console.log();
  console.log(`  ${c.dim}╭────────────────────────────────────────────────────────────────╮${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}                                                                ${c.dim}│${c.reset}`);
  
  const scoreStr = `${score}`;
  const scorePadding = ' '.repeat(Math.max(0, 3 - scoreStr.length));
  console.log(`  ${c.dim}│${c.reset}     ${c.dim}INTEGRITY SCORE${c.reset}    ${scoreColor}${c.bold}${scorePadding}${scoreStr}${c.reset}${c.dim}/100${c.reset}     ${c.dim}GRADE${c.reset}  ${gradeColor}${c.bold}${grade}${c.reset}            ${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}                                                                ${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}     ${progressBar(score, 40)}              ${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}                                                                ${c.dim}│${c.reset}`);
  
  if (canShip) {
    console.log(`  ${c.dim}│${c.reset}              ${bgRgb(0, 150, 80)}${c.bold}  ✓ CLEAR TO SHIP  ${c.reset}                       ${c.dim}│${c.reset}`);
  } else {
    console.log(`  ${c.dim}│${c.reset}              ${bgRgb(200, 50, 50)}${c.bold}  ✗ NOT SHIP READY  ${c.reset}                      ${c.dim}│${c.reset}`);
  }
  
  console.log(`  ${c.dim}│${c.reset}                                                                ${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}╰────────────────────────────────────────────────────────────────╯${c.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVERAGE MAP VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function printCoverageMap(coverageMap) {
  printSection('NAVIGATION COVERAGE', '🗺️');
  
  const pct = coverageMap.coveragePercent;
  const color = pct >= 80 ? rgb(0, 255, 100) : pct >= 60 ? rgb(255, 200, 0) : rgb(255, 80, 80);
  
  console.log();
  console.log(`  ${color}${c.bold}${pct}%${c.reset} ${c.dim}of shipped routes reachable from${c.reset} ${c.cyan}/${c.reset}`);
  console.log(`  ${progressBar(pct, 50)}`);
  console.log();
  console.log(`  ${c.dim}Routes:${c.reset} ${coverageMap.reachableFromRoot}${c.dim}/${c.reset}${coverageMap.totalShippedRoutes} ${c.dim}reachable${c.reset}`);
  
  if (coverageMap.isolatedClusters && coverageMap.isolatedClusters.length > 0) {
    console.log();
    console.log(`  ${c.yellow}⚠${c.reset} ${c.dim}Isolated clusters:${c.reset}`);
    for (const cluster of coverageMap.isolatedClusters.slice(0, 3)) {
      const auth = cluster.requiresAuth ? ` ${c.dim}(auth)${c.reset}` : '';
      console.log(`    ${c.dim}├─${c.reset} ${c.bold}${cluster.name}${c.reset}${auth} ${c.dim}(${cluster.nodeIds.length} routes)${c.reset}`);
    }
  }
  
  if (coverageMap.unreachableRoutes && coverageMap.unreachableRoutes.length > 0) {
    console.log();
    console.log(`  ${c.red}✗${c.reset} ${c.dim}Unreachable routes:${c.reset}`);
    for (const route of coverageMap.unreachableRoutes.slice(0, 5)) {
      console.log(`    ${c.dim}├─${c.reset} ${c.red}${route}${c.reset}`);
    }
    if (coverageMap.unreachableRoutes.length > 5) {
      console.log(`    ${c.dim}└─ ... and ${coverageMap.unreachableRoutes.length - 5} more${c.reset}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BREAKDOWN DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function printBreakdown(breakdown) {
  printSection('BREAKDOWN', '📊');
  console.log();
  
  const items = [
    { key: 'deadLinks', label: 'Dead Links', icon: '🔗', color: rgb(255, 100, 100) },
    { key: 'orphanRoutes', label: 'Orphan Routes', icon: '👻', color: rgb(200, 150, 255) },
    { key: 'runtimeFailures', label: 'Runtime 404s', icon: '💥', color: rgb(255, 80, 80) },
    { key: 'unresolvedDynamic', label: 'Unresolved Dynamic', icon: '❓', color: rgb(255, 200, 100) },
    { key: 'placeholders', label: 'Placeholders', icon: '📝', color: rgb(255, 180, 100) },
  ];
  
  for (const item of items) {
    const data = breakdown[item.key] || { count: 0, penalty: 0 };
    const status = data.count === 0 ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const countColor = data.count === 0 ? c.green : item.color;
    const countStr = String(data.count).padStart(3);
    const penaltyStr = data.penalty > 0 ? `${c.dim}-${data.penalty} pts${c.reset}` : `${c.dim}    ---${c.reset}`;
    
    console.log(`  ${status} ${item.icon} ${item.label.padEnd(22)} ${countColor}${c.bold}${countStr}${c.reset}  ${penaltyStr}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCKERS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function printBlockers(blockers) {
  if (!blockers || blockers.length === 0) {
    printSection('SHIP BLOCKERS', '🚀');
    console.log();
    console.log(`  ${c.green}${c.bold}✓ No blockers! You're clear to ship.${c.reset}`);
    return;
  }
  
  printSection(`SHIP BLOCKERS (${blockers.length})`, '🚨');
  console.log();
  
  for (const blocker of blockers.slice(0, 8)) {
    const sevColor = blocker.severity === 'critical' ? bgRgb(180, 40, 40) : bgRgb(180, 120, 0);
    const sevLabel = blocker.severity === 'critical' ? 'CRITICAL' : '  HIGH  ';
    
    console.log(`  ${sevColor}${c.bold} ${sevLabel} ${c.reset} ${c.bold}${truncate(blocker.title, 45)}${c.reset}`);
    console.log(`  ${c.dim}           ${truncate(blocker.description, 55)}${c.reset}`);
    if (blocker.file) {
      const fileDisplay = path.basename(blocker.file) + (blocker.line ? `:${blocker.line}` : '');
      console.log(`  ${c.dim}           ${c.reset}${c.cyan}${fileDisplay}${c.reset}`);
    }
    if (blocker.fixSuggestion) {
      console.log(`  ${c.dim}           ${c.green}→ ${blocker.fixSuggestion}${c.reset}`);
    }
    console.log();
  }
  
  if (blockers.length > 8) {
    console.log(`  ${c.dim}... and ${blockers.length - 8} more blockers (see full report)${c.reset}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYERS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

function printLayers(layers) {
  printSection('ANALYSIS LAYERS', '⚡');
  console.log();
  
  const layerInfo = {
    ast: { name: 'AST Analysis', icon: '🔍', desc: 'Static code analysis' },
    truth: { name: 'Build Truth', icon: '📦', desc: 'Manifest verification' },
    reality: { name: 'Reality Proof', icon: '🎭', desc: 'Playwright crawl' },
  };
  
  for (const layer of layers) {
    const info = layerInfo[layer.layer] || { name: layer.layer, icon: '○', desc: '' };
    const status = layer.executed ? `${c.green}✓${c.reset}` : `${c.dim}○${c.reset}`;
    const duration = layer.executed ? `${c.dim}${layer.duration}ms${c.reset}` : `${c.dim}skipped${c.reset}`;
    const findings = layer.executed ? `${c.cyan}${layer.findings}${c.reset} ${c.dim}findings${c.reset}` : '';
    
    console.log(`  ${status} ${info.icon} ${c.bold}${info.name.padEnd(15)}${c.reset} ${duration.padEnd(20)} ${findings}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARGS PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseArgs(args) {
  const opts = {
    path: process.cwd(),
    truth: false,
    reality: false,
    realitySniff: false,
    baseUrl: null,
    json: false,
    sarif: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--truth' || arg === '-t') opts.truth = true;
    else if (arg === '--reality' || arg === '-r') { opts.reality = true; opts.truth = true; }
    else if (arg === '--reality-sniff' || arg === '--sniff') opts.realitySniff = true;
    else if (arg === '--url' || arg === '-u') { opts.baseUrl = args[++i]; opts.reality = true; opts.truth = true; }
    else if (arg === '--json') opts.json = true;
    else if (arg === '--sarif') opts.sarif = true;
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--path' || arg === '-p') opts.path = args[++i];
    else if (arg.startsWith('--path=')) opts.path = arg.split('=')[1];
    else if (!arg.startsWith('-')) opts.path = path.resolve(arg);
  }
  
  return opts;
}

function printHelp() {
  console.log(BANNER);
  console.log(`
  ${c.bold}Usage:${c.reset} guardrail scan [path] [options]

  ${c.bold}Scan Modes:${c.reset}
    ${c.cyan}(default)${c.reset}       Layer 1: AST static analysis ${c.dim}(fast)${c.reset}
    ${c.cyan}--truth, -t${c.reset}     Layer 1+2: Include build manifest verification ${c.dim}(CI/ship)${c.reset}
    ${c.cyan}--reality, -r${c.reset}   Layer 1+2+3: Include Playwright runtime proof ${c.dim}(full)${c.reset}
    ${c.cyan}--reality-sniff${c.reset} Include Reality Sniff AI artifact detection ${c.dim}(recommended)${c.reset}

  ${c.bold}Options:${c.reset}
    ${c.cyan}--url, -u${c.reset}       Base URL for reality testing (e.g., http://localhost:3000)
    ${c.cyan}--verbose, -v${c.reset}   Show detailed progress
    ${c.cyan}--json${c.reset}          Output results as JSON
    ${c.cyan}--sarif${c.reset}         Output in SARIF format (GitHub code scanning)
    ${c.cyan}--help, -h${c.reset}      Show this help

  ${c.bold}Examples:${c.reset}
    ${c.dim}# Quick scan (AST only)${c.reset}
    guardrail scan

    ${c.dim}# CI/CD scan with manifest verification${c.reset}
    guardrail scan --truth

    ${c.dim}# Full proof with Playwright${c.reset}
    guardrail scan --reality --url http://localhost:3000
  `);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCAN FUNCTION - ROUTE INTEGRITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

async function runScan(args) {
  const opts = parseArgs(args);

  // Show help if requested
  if (opts.help) {
    printHelp();
    return 0;
  }

  // Entitlement check (graceful offline handling)
  try {
    await enforceLimit('scans');
    await trackUsage('scans');
  } catch (err) {
    if (err.code === 'LIMIT_EXCEEDED') {
      console.error(err.upgradePrompt || err.message);
      return 1;
    }
    // Network error - fall back to free tier only (SECURITY: never grant paid features offline)
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.name === 'NetworkError') {
      console.warn(`  ${c.yellow}⚠${c.reset} API unavailable, running in ${c.green}FREE${c.reset} tier mode`);
      console.warn(`  ${c.dim}Paid features require API connection. Continuing with free features only.${c.reset}\n`);
      // Continue with free tier features only - scan command is free tier
    } else {
      throw err; // Re-throw unexpected errors
    }
  }

  // Print banner
  printBanner();

  const projectPath = path.resolve(opts.path);
  const startTime = Date.now();

  // Emit audit event for scan start
  emitScanStart(projectPath, args);
  const projectName = path.basename(projectPath);

  // Validate project path
  if (!fs.existsSync(projectPath)) {
    throw createUserError(`Project path does not exist: ${projectPath}`, "ValidationError");
  }

  // Determine layers
  const layers = {
    ast: true,
    truth: opts.truth,
    reality: opts.reality,
    realitySniff: opts.realitySniff,
  };

  // Print scan info
  const layerNames = [];
  if (layers.ast) layerNames.push('AST');
  if (layers.truth) layerNames.push('Truth');
  if (layers.reality) layerNames.push('Reality');
  if (layers.realitySniff) layerNames.push('Reality Sniff');

  console.log(`  ${c.dim}Project:${c.reset}  ${c.bold}${projectName}${c.reset}`);
  console.log(`  ${c.dim}Path:${c.reset}     ${projectPath}`);
  console.log(`  ${c.dim}Layers:${c.reset}   ${c.cyan}${layerNames.join(' → ')}${c.reset}`);
  console.log();

  // Reality layer requires URL
  if (opts.reality && !opts.baseUrl) {
    console.log(`  ${c.yellow}⚠${c.reset} ${c.bold}Reality layer requires --url${c.reset}`);
    console.log(`  ${c.dim}Example: guardrail scan --reality --url http://localhost:3000${c.reset}`);
    console.log();
    return 1;
  }

  try {
    // Import systems (compiled from src/lib/route-integrity — dist/ is gitignored)
    let scanRouteIntegrity;
    try {
      ({ scanRouteIntegrity } = require('../../dist/lib/route-integrity'));
    } catch (e) {
      throw createUserError(
        `Scan engine not found (dist/lib/route-integrity). From a fresh clone, build compiled output first. Try: pnpm run build:cli-lib (CLI modules) — full scan also needs route-integrity under dist/. If pnpm run build:lib fails, use a release artifact or CI-built dist. (${e.message})`,
        'ValidationError',
      );
    }
    
    // Try to import new unified output system (may not be compiled yet)
    let buildVerdictOutput, normalizeFinding, formatStandardOutput, formatScanOutput, getExitCode, CacheManager;
    let useUnifiedOutput = false;
    
    try {
      const outputContract = require('../../dist/lib/cli/output-contract');
      buildVerdictOutput = outputContract.buildVerdictOutput;
      normalizeFinding = outputContract.normalizeFinding;
      formatStandardOutput = outputContract.formatStandardOutput;
      
      const unifiedOutput = require('./lib/unified-output');
      formatScanOutput = unifiedOutput.formatScanOutput;
      getExitCode = unifiedOutput.getExitCode;
      
      const cacheModule = require('../../dist/lib/cli/cache-manager');
      CacheManager = cacheModule.CacheManager;
      useUnifiedOutput = true;
    } catch (error) {
      // Fallback to old system if new one not available
      if (opts.verbose) {
        console.warn('Unified output system not available, using legacy format');
      }
      useUnifiedOutput = false;
    }

    // Initialize cache if available
    let cache = null;
    let cached = false;
    let cachedResult = null;
    
    if (CacheManager) {
      cache = new CacheManager(projectPath);
      const cacheKey = 'scan';
      
      // Compute project hash for caching
      const sourceFiles = await findSourceFiles(projectPath);
      const projectHash = await cache.computeProjectHash(sourceFiles, { layers, baseUrl: opts.baseUrl });

      // Check cache
      if (!opts.verbose) {
        cachedResult = await cache.get(cacheKey, projectHash);
        if (cachedResult && buildVerdictOutput) {
          cached = true;
          // Use cached result
          const verdict = buildVerdictOutput(cachedResult.findings, cachedResult.timings, true);
          const output = formatStandardOutput(verdict, cachedResult.findings, cachedResult.scanId, projectPath, {
            version: require('../../package.json').version || '1.0.0',
            nodeVersion: process.version,
            platform: process.platform,
          });

          if (opts.json) {
            console.log(JSON.stringify(output, null, 2));
            return getExitCode(verdict);
          }

          console.log(formatScanOutput({ verdict, findings: cachedResult.findings }, { verbose: opts.verbose, json: opts.json }));
          return getExitCode(verdict);
        }
      }
    }

    // Start scanning with spinner
    const timings = { discovery: 0, analysis: 0, verification: 0, total: 0 };
    const startTime = Date.now();
    timings.discovery = Date.now();

    startSpinner('Analyzing codebase...');

    const result = await scanRouteIntegrity({
      projectPath,
      layers,
      baseUrl: opts.baseUrl,
      verbose: opts.verbose,
      onProgress: opts.verbose ? (phase, progress) => {
        stopSpinner(`${phase}: ${Math.round(progress)}%`, true);
        if (progress < 100) startSpinner(`Running ${phase}...`);
      } : undefined,
    });

    timings.analysis = Date.now() - timings.discovery;
    timings.verification = Date.now() - timings.analysis - timings.discovery;
    timings.total = Date.now() - startTime;

    stopSpinner('Analysis complete', true);

    const { report, outputPaths } = result;

    // Normalize findings with stable IDs
    const existingIDs = new Set();
    const normalizedFindings = [];
    
    // Normalize route integrity findings
    if (report.shipBlockers) {
      for (let i = 0; i < report.shipBlockers.length; i++) {
        const blocker = report.shipBlockers[i];
        const category = blocker.category || 'ROUTE';
        const normalized = normalizeFinding(blocker, category, i, existingIDs);
        normalizedFindings.push(normalized);
      }
    }

    // Normalize Reality Sniff findings if present
    if (report.realitySniffFindings) {
      for (let i = 0; i < report.realitySniffFindings.length; i++) {
        const finding = report.realitySniffFindings[i];
        const category = finding.ruleId?.startsWith('auth') ? 'AUTH' : 'REALITY';
        const normalized = normalizeFinding(finding, category, normalizedFindings.length, existingIDs);
        normalizedFindings.push(normalized);
      }
    }

    // Use new unified output if available, otherwise fallback to old format
    if (useUnifiedOutput && buildVerdictOutput && normalizeFinding) {
      // Normalize findings with stable IDs
      const existingIDs = new Set();
      const normalizedFindings = [];
      
      // Normalize route integrity findings
      if (report.shipBlockers) {
        for (let i = 0; i < report.shipBlockers.length; i++) {
          const blocker = report.shipBlockers[i];
          const category = blocker.category || 'ROUTE';
          const normalized = normalizeFinding(blocker, category, i, existingIDs);
          normalizedFindings.push(normalized);
        }
      }

      // Normalize Reality Sniff findings if present
      if (report.realitySniffFindings) {
        for (let i = 0; i < report.realitySniffFindings.length; i++) {
          const finding = report.realitySniffFindings[i];
          const category = finding.ruleId?.startsWith('auth') ? 'AUTH' : 'REALITY';
          const normalized = normalizeFinding(finding, category, normalizedFindings.length, existingIDs);
          normalizedFindings.push(normalized);
        }
      }

      // Build verdict
      const verdict = buildVerdictOutput(normalizedFindings, timings, false);
      const scanId = `scan_${Date.now()}`;

      // Cache result
      if (cache) {
        const sourceFiles = await findSourceFiles(projectPath);
        const projectHash = await cache.computeProjectHash(sourceFiles, { layers, baseUrl: opts.baseUrl });
        await cache.set('scan', projectHash, {
          findings: normalizedFindings,
          timings,
          scanId,
        }, {
          filesScanned: sourceFiles.length,
          findings: normalizedFindings.length,
          duration: timings.total,
        });
      }

      // Build standard output
      const standardOutput = formatStandardOutput(verdict, normalizedFindings, scanId, projectPath, {
        version: require('../../package.json').version || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
      });

    // JSON output mode
    if (opts.json) {
      console.log(JSON.stringify(standardOutput, null, 2));
      return getExitCode(verdict);
    }

    // SARIF output mode
    if (opts.sarif) {
      const sarifContent = fs.readFileSync(outputPaths.sarif, 'utf8');
      console.log(sarifContent);
      return report.score.overall >= 70 ? 0 : 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UNIFIED OUTPUT
    // ═══════════════════════════════════════════════════════════════════════════

    // Use unified output formatter
    console.log(formatScanOutput({ verdict, findings: normalizedFindings }, { verbose: opts.verbose, json: false }));

    // Additional details if verbose
    if (opts.verbose) {
      printBreakdown(report.score.breakdown);
      printCoverageMap(report.coverageMap);
      printLayers(report.layers);
      
      printSection('REPORTS', '📄');
      console.log();
      console.log(`  ${c.cyan}${outputPaths.md}${c.reset}`);
      console.log(`  ${c.dim}${outputPaths.json}${c.reset}`);
      if (outputPaths.sarif) {
        console.log(`  ${c.dim}${outputPaths.sarif}${c.reset}`);
      }
    }

    // Emit audit event for scan complete
    emitScanComplete(projectPath, verdict.verdict === 'PASS' ? 'success' : 'failure', {
      score: report.score?.overall || (verdict.verdict === 'PASS' ? 100 : 50),
      grade: report.score?.grade || (verdict.verdict === 'PASS' ? 'A' : 'F'),
      issueCount: verdict.summary.blockers,
      durationMs: timings.total,
    });

    return getExitCode(verdict);
    }

  } catch (error) {
    stopSpinner(`Scan failed: ${error.message}`, false);
    
    // Use unified error handling
    const { printError, EXIT_CODES } = require('./lib/unified-output');
    const exitCode = printError(error, 'Scan');
    
    // Emit audit event for scan error
    emitScanComplete(projectPath, 'error', {
      errorCode: error.code || 'SCAN_ERROR',
      errorMessage: error.message,
      durationMs: Date.now() - startTime,
    });
    
    return exitCode;
  }
}

// Helper function to find source files for cache hash
async function findSourceFiles(projectPath) {
  const files = [];
  const fs = require('fs');
  const path = require('path');
  
  async function walk(dir) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  await walk(projectPath);
  return files;
}

// Export with error handling wrapper
module.exports = {
  runScan: withErrorHandling(runScan, "Scan failed"),
};
