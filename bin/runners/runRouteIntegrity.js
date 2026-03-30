/**
 * Route Integrity CLI Runner
 * 
 * Commands:
 * - guardrail scan: Layer 1 only (AST + TS) - Fast, actionable, low noise
 * - guardrail scan --truth: Layer 1 + Layer 2 (build manifest) - CI/ship
 * - guardrail scan --reality: Layer 1 + Layer 2 + Layer 3 (Playwright) - Best-in-class
 */

const path = require('path');
const fs = require('fs');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function parseArgs(args) {
  const options = {
    projectPath: process.cwd(),
    truth: false,
    reality: false,
    baseUrl: null,
    verbose: false,
    json: false,
    sarif: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--truth' || arg === '-t') {
      options.truth = true;
    } else if (arg === '--reality' || arg === '-r') {
      options.reality = true;
      options.truth = true;
    } else if (arg === '--url' || arg === '-u') {
      options.baseUrl = args[++i];
      options.reality = true;
      options.truth = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--sarif') {
      options.sarif = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      options.projectPath = path.resolve(arg);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${c.cyan}${c.bold}Route Integrity Scanner${c.reset}
${c.dim}Analyze navigation links, detect dead routes, and verify route health${c.reset}

${c.bold}Usage:${c.reset}
  guardrail routes [path] [options]

${c.bold}Scan Modes:${c.reset}
  ${c.cyan}(default)${c.reset}     Layer 1: AST analysis only (fast)
  ${c.cyan}--truth${c.reset}       Layer 1 + 2: Include build manifest verification
  ${c.cyan}--reality${c.reset}     Layer 1 + 2 + 3: Include Playwright runtime proof

${c.bold}Options:${c.reset}
  ${c.cyan}-t, --truth${c.reset}   Enable build manifest verification (Layer 2)
  ${c.cyan}-r, --reality${c.reset} Enable Playwright crawl (Layer 3, requires --url)
  ${c.cyan}-u, --url${c.reset}     Base URL for reality testing (e.g., http://localhost:3000)
  ${c.cyan}-v, --verbose${c.reset} Show detailed progress
  ${c.cyan}--json${c.reset}        Output results as JSON
  ${c.cyan}--sarif${c.reset}       Output results in SARIF format (GitHub code scanning)
  ${c.cyan}-h, --help${c.reset}    Show this help message

${c.bold}Examples:${c.reset}
  ${c.dim}# Quick static analysis${c.reset}
  guardrail routes

  ${c.dim}# Include build manifest verification${c.reset}
  guardrail routes --truth

  ${c.dim}# Full reality proof with Playwright${c.reset}
  guardrail routes --reality --url http://localhost:3000

  ${c.dim}# CI/CD integration with SARIF output${c.reset}
  guardrail routes --truth --sarif
`);
}

function printHeader() {
  console.log();
  console.log(`${c.magenta}${c.bold}  🗺️  ROUTE INTEGRITY SCANNER${c.reset}`);
  console.log(`${c.dim}  "Find dead links before your users do"${c.reset}`);
  console.log();
}

function printScore(score) {
  const getColor = (s) => {
    if (s >= 90) return c.green;
    if (s >= 70) return c.blue;
    if (s >= 50) return c.yellow;
    return c.red;
  };

  const scoreColor = getColor(score.overall);
  const canShip = score.overall >= 70;
  const verdict = canShip
    ? `${c.bgGreen}${c.bold} ✓ ROUTES HEALTHY ${c.reset}`
    : `${c.bgRed}${c.bold} ✗ ISSUES FOUND ${c.reset}`;

  console.log(`  ┌${'─'.repeat(48)}┐`);
  console.log(`  │${' '.repeat(48)}│`);
  console.log(
    `  │     ${c.bold}ROUTE HEALTH SCORE:${c.reset} ${scoreColor}${c.bold}${String(score.overall).padStart(3)}${c.reset}${c.dim}/100${c.reset}${' '.repeat(12)}│`
  );
  console.log(
    `  │     ${c.bold}GRADE:${c.reset} ${scoreColor}${c.bold}${score.grade.padEnd(2)}${c.reset}  ${c.bold}CONFIDENCE:${c.reset} ${score.confidence}%${' '.repeat(12)}│`
  );
  console.log(`  │${' '.repeat(48)}│`);
  console.log(`  │     ${verdict}${' '.repeat(Math.max(0, 19))}│`);
  console.log(`  │${' '.repeat(48)}│`);
  console.log(`  └${'─'.repeat(48)}┘`);
  console.log();
}

function printBreakdown(breakdown) {
  console.log(`  ${c.bold}📊 BREAKDOWN${c.reset}`);
  console.log();

  const categories = [
    { key: 'deadLinks', label: 'Dead Links', icon: '🔗' },
    { key: 'orphanRoutes', label: 'Orphan Routes', icon: '👻' },
    { key: 'runtimeFailures', label: 'Runtime 404s', icon: '💥' },
    { key: 'unresolvedDynamic', label: 'Unresolved Dynamic', icon: '❓' },
    { key: 'placeholders', label: 'Placeholders', icon: '📝' },
  ];

  for (const cat of categories) {
    const data = breakdown[cat.key];
    const count = data.count;
    const penalty = data.penalty;
    const status = count === 0 ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const countColor = count === 0 ? c.green : c.red;

    console.log(
      `  ${status} ${cat.icon} ${cat.label.padEnd(20)} ${countColor}${String(count).padStart(3)}${c.reset} ${c.dim}(-${penalty} pts)${c.reset}`
    );
  }
  console.log();
}

function printCoverage(coverageMap) {
  console.log(`  ${c.bold}📈 NAVIGATION COVERAGE${c.reset}`);
  console.log();

  const coverageColor = coverageMap.coveragePercent >= 80 ? c.green : 
                        coverageMap.coveragePercent >= 60 ? c.yellow : c.red;

  console.log(`  ${coverageColor}${c.bold}${coverageMap.coveragePercent}%${c.reset} of routes reachable from ${c.cyan}/${c.reset}`);
  console.log(`  ${c.dim}${coverageMap.reachableFromRoot}/${coverageMap.totalShippedRoutes} routes${c.reset}`);

  if (coverageMap.isolatedClusters.length > 0) {
    console.log();
    console.log(`  ${c.yellow}⚠ Isolated clusters:${c.reset}`);
    for (const cluster of coverageMap.isolatedClusters.slice(0, 3)) {
      const auth = cluster.requiresAuth ? ' (auth required)' : '';
      console.log(`    • ${cluster.name}${auth}: ${cluster.nodeIds.length} routes`);
    }
  }

  if (coverageMap.unreachableRoutes.length > 0) {
    console.log();
    console.log(`  ${c.red}✗ Unreachable routes:${c.reset}`);
    for (const route of coverageMap.unreachableRoutes.slice(0, 5)) {
      console.log(`    • ${c.dim}${route}${c.reset}`);
    }
    if (coverageMap.unreachableRoutes.length > 5) {
      console.log(`    ${c.dim}... and ${coverageMap.unreachableRoutes.length - 5} more${c.reset}`);
    }
  }
  console.log();
}

function printBlockers(blockers) {
  if (blockers.length === 0) {
    console.log(`  ${c.green}${c.bold}✓ No ship blockers!${c.reset}`);
    console.log();
    return;
  }

  console.log(`  ${c.bold}🚨 SHIP BLOCKERS${c.reset} ${c.dim}(${blockers.length} total)${c.reset}`);
  console.log();

  for (const blocker of blockers.slice(0, 10)) {
    const severity = blocker.severity === 'critical' ? c.red : c.yellow;
    const severityIcon = blocker.severity === 'critical' ? 'P0' : 'P1';

    console.log(`  ${severity}${severityIcon}${c.reset} ${blocker.title}`);
    console.log(`     ${c.dim}${blocker.description.slice(0, 60)}${c.reset}`);
    if (blocker.file) {
      console.log(`     ${c.cyan}${path.basename(blocker.file)}${blocker.line ? `:${blocker.line}` : ''}${c.reset}`);
    }
    console.log();
  }

  if (blockers.length > 10) {
    console.log(`  ${c.dim}... and ${blockers.length - 10} more (see full report)${c.reset}`);
    console.log();
  }
}

function printLayers(layers) {
  console.log(`  ${c.bold}⚡ LAYERS EXECUTED${c.reset}`);
  console.log();

  for (const layer of layers) {
    const icon = layer.executed ? '✓' : '○';
    const color = layer.executed ? c.green : c.dim;
    const name = layer.layer.toUpperCase().padEnd(8);
    const duration = layer.executed ? `${layer.duration}ms` : 'skipped';
    const findings = layer.executed ? `${layer.findings} findings` : '';

    console.log(`  ${color}${icon} ${name}${c.reset} ${c.dim}${duration} ${findings}${c.reset}`);
  }
  console.log();
}

function printReportLocation(outputPaths) {
  console.log(`  ${c.bold}📄 REPORTS${c.reset}`);
  console.log(`  ${c.cyan}${outputPaths.md}${c.reset}`);
  console.log(`  ${c.dim}${outputPaths.json}${c.reset}`);
  console.log(`  ${c.dim}${outputPaths.sarif}${c.reset}`);
  console.log();
}

async function runRouteIntegrity(args) {
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  printHeader();

  const layers = {
    ast: true,
    truth: options.truth,
    reality: options.reality,
  };

  const layerNames = [];
  if (layers.ast) layerNames.push('AST');
  if (layers.truth) layerNames.push('Truth');
  if (layers.reality) layerNames.push('Reality');

  console.log(`  ${c.dim}Scanning ${options.projectPath}${c.reset}`);
  console.log(`  ${c.dim}Layers: ${layerNames.join(' + ')}${c.reset}`);

  if (options.reality && !options.baseUrl) {
    console.log();
    console.log(`  ${c.yellow}⚠ Reality layer requires --url${c.reset}`);
    console.log(`  ${c.dim}Example: guardrail routes --reality --url http://localhost:3000${c.reset}`);
    console.log();
    return 1;
  }

  console.log();

  try {
    const { scanRouteIntegrity } = require('../../src/lib/route-integrity');

    const result = await scanRouteIntegrity({
      projectPath: options.projectPath,
      layers,
      baseUrl: options.baseUrl,
      verbose: options.verbose,
      onProgress: options.verbose ? (phase, progress) => {
        process.stdout.write(`\r  ${c.dim}[${phase}] ${Math.round(progress)}%${c.reset}    `);
      } : undefined,
    });

    if (options.verbose) {
      process.stdout.write('\r' + ' '.repeat(40) + '\r');
    }

    const { report, outputPaths } = result;

    if (options.json) {
      console.log(JSON.stringify(report, (key, value) => {
        if (value instanceof Map) return Object.fromEntries(value);
        if (value instanceof Set) return Array.from(value);
        return value;
      }, 2));
      return report.score.overall >= 70 ? 0 : 1;
    }

    if (options.sarif) {
      const sarifContent = fs.readFileSync(outputPaths.sarif, 'utf8');
      console.log(sarifContent);
      return report.score.overall >= 70 ? 0 : 1;
    }

    printScore(report.score);
    printBreakdown(report.score.breakdown);
    printCoverage(report.coverageMap);
    printBlockers(report.shipBlockers);
    printLayers(report.layers);
    printReportLocation(outputPaths);

    console.log(`  ${'─'.repeat(50)}`);
    console.log();

    if (report.score.overall >= 70) {
      console.log(`  ${c.green}${c.bold}✓ Routes are healthy!${c.reset}`);
      console.log(`  ${c.dim}Add the route health badge to your README:${c.reset}`);
      console.log(`  ${c.cyan}guardrail badge --routes${c.reset}`);
    } else {
      console.log(`  ${c.yellow}${c.bold}⚠ Route issues detected${c.reset}`);
      console.log(`  ${c.dim}Fix the blockers above or run:${c.reset}`);
      console.log(`  ${c.cyan}guardrail fix --routes${c.reset}`);
    }
    console.log();

    return report.score.overall >= 70 ? 0 : 1;
  } catch (error) {
    console.log(`  ${c.red}✗ Scan failed: ${error.message}${c.reset}`);
    if (options.verbose) {
      console.log(`  ${c.dim}${error.stack}${c.reset}`);
    }
    console.log();
    return 1;
  }
}

module.exports = { runRouteIntegrity };
