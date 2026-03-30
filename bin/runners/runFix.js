/**
 * guardrail fix - Autofix findings
 * 
 * Automatically fixes findings that support autofix.
 */

const path = require('path');
const fs = require('fs');
const { withErrorHandling, printError } = require('./lib/error-handler');
const { EXIT_CODES } = require('./lib/unified-output');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

async function runFix(args) {
  const opts = parseArgs(args);
  
  if (opts.help) {
    printHelp();
    return 0;
  }

  if (!opts.id && !opts.all) {
    console.error(`\n${c.red}Error:${c.reset} Specify --id <finding-id> or --all\n`);
    printHelp();
    return EXIT_CODES.MISCONFIG;
  }

  const projectPath = path.resolve(opts.path || process.cwd());
  
  try {
    if (opts.all) {
      return await fixAll(projectPath, opts);
    } else {
      return await fixFinding(projectPath, opts.id, opts);
    }
  } catch (error) {
    return printError(error, 'Fix');
  }
}

async function fixFinding(projectPath, findingId, options) {
  console.log(`\n🔧 Fixing ${findingId}...\n`);

  // Load finding from latest scan
  const scanResult = await loadLatestScan(projectPath);
  if (!scanResult) {
    console.error(`${c.red}Error:${c.reset} No scan results found. Run 'guardrail scan' first.\n`);
    return EXIT_CODES.MISCONFIG;
  }

  const finding = scanResult.findings.find(f => f.id?.full === findingId || f.id === findingId);
  if (!finding) {
    console.error(`${c.red}Error:${c.reset} Finding ${findingId} not found.\n`);
    return EXIT_CODES.MISCONFIG;
  }

  if (!finding.autofixAvailable) {
    console.error(`${c.yellow}Warning:${c.reset} Autofix not available for ${findingId}.\n`);
    console.log(`Fix manually: ${finding.fixSuggestion}\n`);
    return EXIT_CODES.FAIL;
  }

  // Apply autofix based on rule type
  const fixed = await applyAutofix(projectPath, finding, options);
  
  if (fixed) {
    console.log(`${c.green}✓${c.reset} Fixed ${findingId}\n`);
    console.log(`Run ${c.cyan}guardrail scan${c.reset} to verify.\n`);
    return EXIT_CODES.PASS;
  } else {
    console.error(`${c.red}Error:${c.reset} Failed to apply autofix.\n`);
    return EXIT_CODES.INTERNAL;
  }
}

async function fixAll(projectPath, options) {
  console.log(`\n🔧 Fixing all autofixable findings...\n`);

  const scanResult = await loadLatestScan(projectPath);
  if (!scanResult) {
    console.error(`${c.red}Error:${c.reset} No scan results found. Run 'guardrail scan' first.\n`);
    return EXIT_CODES.MISCONFIG;
  }

  const autofixable = scanResult.findings.filter(f => f.autofixAvailable && f.verdict === 'FAIL');
  
  if (autofixable.length === 0) {
    console.log(`${c.dim}No autofixable findings found.${c.reset}\n`);
    return EXIT_CODES.PASS;
  }

  console.log(`Found ${autofixable.length} autofixable finding(s)...\n`);

  let fixed = 0;
  let failed = 0;

  for (const finding of autofixable) {
    try {
      const result = await applyAutofix(projectPath, finding, options);
      if (result) {
        fixed++;
        console.log(`${c.green}✓${c.reset} Fixed ${finding.id?.full || finding.id}\n`);
      } else {
        failed++;
        console.log(`${c.yellow}⚠${c.reset} Failed to fix ${finding.id?.full || finding.id}\n`);
      }
    } catch (error) {
      failed++;
      console.log(`${c.red}✗${c.reset} Error fixing ${finding.id?.full || finding.id}: ${error.message}\n`);
    }
  }

  console.log(`\n${c.bold}Summary:${c.reset}`);
  console.log(`  Fixed: ${fixed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`\nRun ${c.cyan}guardrail scan${c.reset} to verify.\n`);

  return failed > 0 ? EXIT_CODES.FAIL : EXIT_CODES.PASS;
}

async function applyAutofix(projectPath, finding, options) {
  const filePath = path.join(projectPath, finding.file);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${finding.file}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const lineIndex = finding.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error(`Invalid line number: ${finding.line}`);
  }

  let newContent = content;
  const ruleId = finding.ruleId;

  // Apply fixes based on rule type
  switch (ruleId) {
    case 'empty-catch':
      newContent = fixEmptyCatch(lines, lineIndex, filePath);
      break;
    case 'dangerous-default':
      newContent = fixDangerousDefault(lines, lineIndex, filePath);
      break;
    case 'placeholder-value':
      newContent = fixPlaceholderValue(lines, lineIndex, filePath);
      break;
    default:
      return false;
  }

  if (newContent !== content) {
    if (!options.dryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
    return true;
  }

  return false;
}

function fixEmptyCatch(lines, lineIndex, filePath) {
  const line = lines[lineIndex];
  const newLines = [...lines];

  // Find the catch block
  if (line.includes('catch') && line.includes('{')) {
    // Simple case: catch {} on one line
    if (line.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/)) {
      const indent = line.match(/^(\s*)/)?.[1] || '';
      newLines[lineIndex] = line.replace(
        /catch\s*(?:\(([^)]*)\))?\s*\{\s*\}/,
        (match, errVar) => {
          const varName = errVar || 'err';
          return `catch (${varName}) {\n${indent}  console.error('Error:', ${varName});\n${indent}  throw ${varName};\n${indent}}`;
        }
      );
    }
  }

  return newLines.join('\n');
}

function fixDangerousDefault(lines, lineIndex, filePath) {
  const line = lines[lineIndex];
  const newLines = [...lines];

  // Remove dangerous default
  if (line.includes('process.env.') && (line.includes('||') || line.includes('??'))) {
    newLines[lineIndex] = line.replace(
      /\s*(\|\||\?\?)\s*['"][^'"]*['"]/,
      ''
    );
  }

  return newLines.join('\n');
}

function fixPlaceholderValue(lines, lineIndex, filePath) {
  const line = lines[lineIndex];
  const newLines = [...lines];

  // Replace placeholder with TODO comment
  newLines[lineIndex] = line.replace(
    /(CHANGEME|REPLACE_ME|YOUR_[A-Z0-9_]+|INSERT_[A-Z0-9_]+)/g,
    (match) => `/* TODO: Replace ${match} */ ''`
  );

  return newLines.join('\n');
}

async function loadLatestScan(projectPath) {
  const scanDir = path.join(projectPath, '.guardrail', 'reality-sniff', 'scans');
  
  if (!fs.existsSync(scanDir)) {
    return null;
  }

  try {
    const files = fs.readdirSync(scanDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(scanDir, f),
        mtime: fs.statSync(path.join(scanDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      return null;
    }

    const content = fs.readFileSync(files[0].path, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function parseArgs(args) {
  const opts = {
    id: null,
    all: false,
    path: process.cwd(),
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--id' || arg === '-i') opts.id = args[++i];
    else if (arg === '--all' || arg === '-a') opts.all = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--path' || arg === '-p') opts.path = args[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (!arg.startsWith('-')) opts.id = arg;
  }

  return opts;
}

function printHelp() {
  console.log(`
🔧 guardrail Fix

Automatically fixes findings that support autofix.

Usage: guardrail fix [options]

Options:
  --id, -i <id>     Fix a specific finding by ID (e.g., GR-REALITY-001)
  --all, -a         Fix all autofixable findings
  --dry-run         Show what would be fixed without making changes
  --path, -p        Project path (default: current directory)
  --help, -h        Show this help

Examples:
  guardrail fix --id GR-REALITY-001
  guardrail fix --all
  guardrail fix --all --dry-run
`);
}

module.exports = {
  runFix: withErrorHandling(runFix, 'Fix failed'),
};
