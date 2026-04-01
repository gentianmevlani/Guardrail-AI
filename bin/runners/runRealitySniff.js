/**
 * Reality Sniff - Advanced AI Artifact Detection
 * 
 * A three-layer verifier that detects AI-generated fake logic:
 * - Layer 1: Lexical evidence (fast regex)
 * - Layer 2: Structural evidence (AST)
 * - Layer 3: Runtime witness (proof traces)
 */

const path = require('path');
const { withErrorHandling } = require('./lib/error-handler');

async function runRealitySniff(args) {
  const opts = parseArgs(args);
  
  if (opts.help) {
    printHelp();
    return 0;
  }

  const projectPath = path.resolve(opts.path || process.cwd());

  // Handle replay
  if (opts.replay) {
    try {
      const { ReplayEngine } = require('../../dist/lib/reality-sniff/replay-engine');
      const replayEngine = new ReplayEngine(projectPath);
      const replayResult = await replayEngine.replay(opts.replay);
      printReplayResults(replayResult);
      return replayResult.replayVerdict === 'FAIL' ? 1 : 0;
    } catch (error) {
      console.error(`\n❌ Replay failed: ${error.message}\n`);
      return 1;
    }
  }

  // Handle list scans
  if (opts.list) {
    try {
      const { ReplayEngine } = require('../../dist/lib/reality-sniff/replay-engine');
      const replayEngine = new ReplayEngine(projectPath);
      const scans = await replayEngine.listScans();
      printScansList(scans);
      return 0;
    } catch (error) {
      console.error(`\n❌ List failed: ${error.message}\n`);
      return 1;
    }
  }

  try {
    // Import the scanner (compiled JS)
    const { scanRealitySniff } = require('../../dist/lib/reality-sniff/reality-sniff-scanner');
    const { RealityProofGraph } = require('../../dist/lib/reality-sniff/reality-proof-graph');

    console.log('\n🔍 Reality Sniff Scanner\n');
    console.log(`Project: ${path.basename(projectPath)}`);
    console.log(`Path: ${projectPath}\n`);

    const startTime = Date.now();

    // Run scan
    const result = await scanRealitySniff({
      projectPath,
      layers: {
        lexical: true,
        structural: opts.structural !== false,
        runtime: opts.runtime === true,
      },
      verbose: opts.verbose,
    });

    // Build proof graph
    const graph = new RealityProofGraph();
    for (const finding of result.findings) {
      graph.addFinding(finding);
    }

    // Save scan for replay
    const scanId = `scan_${Date.now()}`;
    result.id = scanId;
    result.timestamp = new Date().toISOString();
    
    try {
      const { ReplayEngine } = require('../../dist/lib/reality-sniff/replay-engine');
      const replayEngine = new ReplayEngine(projectPath);
      await replayEngine.saveScan(scanId, result);
    } catch (error) {
      // Replay engine not available - continue
    }

    // Display results
    printResults(result, graph, scanId);

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Execution time: ${duration}ms\n`);
    console.log(`📋 Scan ID: ${scanId}`);
    console.log(`🔄 Replay: guardrail reality-sniff --replay ${scanId}\n`);

    return result.verdict === 'FAIL' ? 1 : 0;
  } catch (error) {
    console.error(`\n❌ Scan failed: ${error.message}\n`);
    if (opts.verbose) {
      console.error(error.stack);
    }
    return 1;
  }
}

function parseArgs(args) {
  const opts = {
    path: process.cwd(),
    structural: true,
    runtime: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--no-structural') opts.structural = false;
    else if (arg === '--runtime' || arg === '-r') opts.runtime = true;
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--path' || arg === '-p') opts.path = args[++i];
    else if (!arg.startsWith('-')) opts.path = path.resolve(arg);
  }

  return opts;
}

function printHelp() {
  console.log(`
🔍 Reality Sniff - Advanced AI Artifact Detection

Usage: guardrail reality-sniff [path] [options]

Options:
  --no-structural    Skip AST-based structural verification
  --runtime, -r     Enable runtime witness collection (experimental)
  --replay <id>     Replay a previous scan
  --list            List available scans
  --verbose, -v     Show detailed progress
  --help, -h        Show this help

Examples:
  guardrail reality-sniff
  guardrail reality-sniff --no-structural
  guardrail reality-sniff --runtime --verbose
  guardrail reality-sniff --replay scan_1234567890
  guardrail reality-sniff --list
`);
}

function printReplayResults(replayResult) {
  console.log('\n🔄 Replay Results\n');
  console.log(`Original Verdict: ${replayResult.originalVerdict}`);
  console.log(`Replay Verdict: ${replayResult.replayVerdict}`);
  console.log(`\nFixed: ${replayResult.fixed.length}`);
  console.log(`Still Blocking: ${replayResult.stillBlocking.length}`);
  console.log(`\n⏱️  Duration: ${replayResult.duration}ms`);
  
  if (replayResult.proofBundle) {
    console.log(`\n📦 Proof Bundle: ${replayResult.proofBundle}`);
  }

  if (replayResult.fixed.length > 0) {
    console.log('\n✅ Fixed Issues:');
    for (const finding of replayResult.fixed) {
      console.log(`  • ${finding.ruleName}: ${finding.message}`);
    }
  }

  if (replayResult.stillBlocking.length > 0) {
    console.log('\n❌ Still Blocking:');
    for (const finding of replayResult.stillBlocking) {
      console.log(`  • ${finding.ruleName}: ${finding.message}`);
    }
  }
}

function printScansList(scans) {
  console.log('\n📋 Available Scans:\n');
  if (scans.length === 0) {
    console.log('  No scans found.');
    return;
  }
  
  for (const scan of scans) {
    const verdictEmoji = scan.verdict === 'FAIL' ? '❌' : scan.verdict === 'WARN' ? '⚠️' : '✅';
    console.log(`  ${verdictEmoji} ${scan.id}`);
    console.log(`     ${new Date(scan.timestamp).toLocaleString()} - ${scan.verdict}`);
    console.log(`     Replay: guardrail reality-sniff --replay ${scan.id}\n`);
  }
}

function printResults(result, graph, scanId) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`VERDICT: ${result.verdict === 'FAIL' ? '❌ FAIL' : result.verdict === 'WARN' ? '⚠️  WARN' : '✅ PASS'}`);
  console.log(`SCORE: ${result.score}/100`);
  console.log(`${'═'.repeat(70)}\n`);

  // Summary
  console.log('SUMMARY:');
  console.log(`  Total findings: ${result.summary.totalFindings}`);
  console.log(`  Critical: ${result.summary.criticalCount}`);
  console.log(`  High: ${result.summary.highCount}`);
  console.log(`  Medium: ${result.summary.mediumCount}`);
  console.log(`  Low: ${result.summary.lowCount}`);
  console.log(`  Info: ${result.summary.infoCount}`);
  console.log(`\n  Evidence levels:`);
  console.log(`    Lexical: ${result.summary.byEvidenceLevel.lexical}`);
  console.log(`    Structural: ${result.summary.byEvidenceLevel.structural}`);
  console.log(`    Runtime: ${result.summary.byEvidenceLevel.runtime}`);
  console.log(`\n  Files scanned: ${result.filesScanned}`);

  // Top blockers
  if (result.blockers.length > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`🚨 TOP BLOCKERS (${result.blockers.length}):\n`);
    
    const topBlockers = graph.getTopBlockers(5);
    for (let i = 0; i < topBlockers.length; i++) {
      const blocker = topBlockers[i];
      const fileDisplay = path.basename(blocker.file) + (blocker.line ? `:${blocker.line}` : '');
      
      console.log(`  ${i + 1}. ${blocker.ruleName}`);
      console.log(`     ${blocker.message}`);
      console.log(`     ${fileDisplay}`);
      if (blocker.fixSuggestion) {
        console.log(`     → ${blocker.fixSuggestion}`);
      }
      console.log();
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log(`${'─'.repeat(70)}`);
    console.log(`⚠️  WARNINGS (${result.warnings.length}):\n`);
    
    for (const warning of result.warnings.slice(0, 5)) {
      const fileDisplay = path.basename(warning.file) + (warning.line ? `:${warning.line}` : '');
      console.log(`  • ${warning.ruleName}: ${warning.message}`);
      console.log(`    ${fileDisplay}\n`);
    }

    if (result.warnings.length > 5) {
      console.log(`  ... and ${result.warnings.length - 5} more warnings\n`);
    }
  }

  // Receipts
  if (result.blockers.length > 0) {
    console.log(`${'─'.repeat(70)}`);
    console.log(`📄 RECEIPTS:\n`);
    console.log(`Run 'guardrail reality-sniff --receipt <finding-id>' to view detailed receipt`);
    console.log(`Or check .guardrail/reality-sniff/receipts/ directory\n`);
  }
}

module.exports = {
  runRealitySniff: withErrorHandling(runRealitySniff, 'Reality Sniff failed'),
};
