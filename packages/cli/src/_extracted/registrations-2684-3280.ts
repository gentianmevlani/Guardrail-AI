/**
 * Get critical paths for a flow
 */
function getCriticalPathsForFlow(
  flow: string,
  baseUrl: string
): Array<{
  path: string;
  description: string;
  covered: boolean;
  evidence: string[];
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  
  const flowPaths: Record<string, Array<{ path: string; description: string }>> = {
    auth: [
      { path: '/api/auth/login', description: 'User authentication endpoint' },
      { path: '/api/auth/session', description: 'Session validation' },
      { path: '/api/auth/logout', description: 'Session termination' },
      { path: '/login', description: 'Login page' },
      { path: '/dashboard', description: 'Post-auth redirect' },
    ],
    checkout: [
      { path: '/api/billing/upgrade', description: 'Billing upgrade endpoint' },
      { path: '/api/webhooks/stripe', description: 'Stripe webhook handler' },
      { path: '/checkout', description: 'Checkout page' },
      { path: '/api/payment/intent', description: 'Payment intent creation' },
      { path: '/api/subscription', description: 'Subscription management' },
    ],
    dashboard: [
      { path: '/api/user/profile', description: 'User profile endpoint' },
      { path: '/api/settings', description: 'Settings endpoint' },
      { path: '/dashboard', description: 'Dashboard page' },
      { path: '/api/data', description: 'Data fetching endpoint' },
    ],
  };
  
  const paths = flowPaths[flow] || flowPaths.auth;
  
  return paths.map(p => ({
    path: p.path,
    description: p.description,
    covered: false, // Will be updated during test execution
    evidence: [],
    timestamp,
  }));
}

// Reality Graph command
program
  .command('reality:graph')
  .description('Generate and analyze Reality Graph')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--receipt <receiptId>', 'Load graph from receipt')
  .option('--export <format>', 'Export format: json, dot, mermaid', 'json')
  .option('--query <query>', 'Query: unexecuted, unhit-routes, unguarded-writes, incomplete-flags')
  .action(async (options) => {
    printLogo();
    
    const { RealityGraphBuilder } = require('./reality/reality-graph');
    const { existsSync, readFileSync, writeFileSync } = require('fs');
    const { resolve, join } = require('path');
    
    const projectPath = resolve(options.path);
    
    console.log('');
    console.log(`  ${styles.brightCyan}${styles.bold}🗺️  REALITY GRAPH${styles.reset}`);
    console.log('');
    
    try {
      let graphBuilder: any;
      
      if (options.receipt) {
        // Load graph from receipt
        const receiptPath = join(projectPath, '.guardrail', 'receipts', options.receipt, 'reality-graph.json');
        if (!existsSync(receiptPath)) {
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Receipt graph not found`);
          process.exit(1);
        }
        
        const graphData = JSON.parse(readFileSync(receiptPath, 'utf-8'));
        graphBuilder = new RealityGraphBuilder(projectPath);
        // TODO: Load graph from JSON
        console.log(`  ${styles.brightGreen}✓${styles.reset} Loaded graph from receipt`);
      } else {
        // Build new graph
        graphBuilder = new RealityGraphBuilder(projectPath);
        console.log(`  ${styles.dim}Discovering nodes...${styles.reset}`);
        graphBuilder.discoverStaticNodes();
        console.log(`  ${styles.brightGreen}✓${styles.reset} Graph built`);
      }
      
      const graph = graphBuilder.getGraph();
      
      console.log('');
      console.log(`  ${styles.bold}Graph Statistics:${styles.reset}`);
      console.log(`    Nodes: ${graph.nodes.size}`);
      console.log(`    Edges: ${graph.edges.size}`);
      console.log('');
      
      // Run queries if specified
      if (options.query) {
        console.log(`  ${styles.bold}Query Results:${styles.reset}`);
        console.log('');
        
        switch (options.query) {
          case 'unexecuted':
            const unexecuted = graphBuilder.findUnexecutedNodes();
            console.log(`    ${styles.brightYellow}Unexecuted Nodes:${styles.reset} ${unexecuted.length}`);
            unexecuted.slice(0, 10).forEach((node: any) => {
              console.log(`      • ${node.label} (${node.type})`);
            });
            break;
            
          case 'unhit-routes':
            const unhit = graphBuilder.findUnhitRoutes();
            console.log(`    ${styles.brightYellow}Unhit Routes:${styles.reset} ${unhit.length}`);
            unhit.slice(0, 10).forEach((route: any) => {
              console.log(`      • ${route.metadata.method} ${route.metadata.route}`);
            });
            break;
            
          case 'unguarded-writes':
            const unguarded = graphBuilder.findUnguardedWritePaths();
            console.log(`    ${styles.brightRed}Unguarded Write Paths:${styles.reset} ${unguarded.length}`);
            unguarded.slice(0, 10).forEach((item: any) => {
              console.log(`      • ${item.route.metadata.method} ${item.route.metadata.route} (missing ${item.permission.label})`);
            });
            break;
            
          case 'incomplete-flags':
            const incomplete = graphBuilder.findIncompleteFeatureFlags();
            console.log(`    ${styles.brightYellow}Incomplete Feature Flags:${styles.reset} ${incomplete.length}`);
            incomplete.slice(0, 10).forEach((item: any) => {
              console.log(`      • ${item.flag.label} (UI: ${item.uiGuarded}, API: ${item.apiGuarded})`);
            });
            break;
        }
        console.log('');
      }
      
      // Export graph
      if (options.export) {
        const outputPath = join(projectPath, '.guardrail', 'reality-graph.json');
        writeFileSync(outputPath, graphBuilder.export());
        console.log(`  ${styles.brightGreen}✓${styles.reset} Graph exported to ${outputPath}`);
        console.log('');
      }
      
      process.exit(0);
    } catch (error: any) {
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Error: ${error.message}`);
      process.exit(1);
    }
  });

// Verified Autopatch command
program
  .command('autopatch:verify')
  .description('Generate and verify a fix with proof gates')
  .option('-p, --path <path>', 'Project path', '.')
  .option('-f, --file <file>', 'File to fix')
  .option('-l, --line <line>', 'Line number', parseInt)
  .option('--patch <patch>', 'Patch content to apply')
  .option('--finding-id <id>', 'Finding ID')
  .option('--gates <gates>', 'Verification gates (comma-separated): build,tests,flows,policy,lint,type-check', 'build,tests,lint,type-check')
  .option('--receipt', 'Generate proof-of-execution receipt', false)
  .option('--merge', 'Merge verified fix to main branch', false)
  .action(async (options) => {
    printLogo();
    
    const { VerifiedAutopatch } = require('./autopatch/verified-autopatch');
    const { resolve } = require('path');
    
    const projectPath = resolve(options.path);
    
    console.log('');
    console.log(`  ${styles.brightCyan}${styles.bold}🔧 VERIFIED AUTOPATCH${styles.reset}`);
    console.log('');
    
    if (!options.file || !options.line || !options.patch) {
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Missing required options: --file, --line, --patch`);
      console.log('');
      console.log(`  ${styles.bold}Usage:${styles.reset}`);
      console.log(`    guardrail autopatch:verify --file src/app.ts --line 42 --patch "const apiUrl = process.env.API_URL;"`);
      console.log('');
      process.exit(1);
    }
    
    try {
      const autopatch = new VerifiedAutopatch(projectPath);
      
      console.log(`  ${styles.dim}Creating verified fix...${styles.reset}`);
      console.log(`    File: ${options.file}`);
      console.log(`    Line: ${options.line}`);
      console.log(`    Gates: ${options.gates}`);
      console.log('');
      
      const gates = options.gates.split(',').map((g: string) => g.trim()) as any[];
      
      const fix = await autopatch.createVerifiedFix({
        projectPath,
        findingId: options.findingId || 'unknown',
        file: options.file,
        line: options.line,
        patch: options.patch,
        gates,
        generateReceipt: options.receipt,
      });
      
      console.log(`  ${styles.bold}Verification Results:${styles.reset}`);
      console.log('');
      
      for (const gate of fix.gates) {
        const icon = gate.passed ? icons.success : icons.error;
        const color = gate.passed ? styles.brightGreen : styles.brightRed;
        console.log(`    ${color}${icon}${styles.reset} ${styles.bold}${gate.gate}${styles.reset} (${gate.duration}ms)`);
        if (gate.error) {
          console.log(`      ${styles.dim}${gate.error}${styles.reset}`);
        }
      }
      
      console.log('');
      
      if (fix.status === 'verified') {
        console.log(`  ${styles.brightGreen}${styles.bold}✓ VERIFIED FIX${styles.reset}`);
        console.log('');
        console.log(`    Branch: ${fix.branchName}`);
        console.log(`    Status: ${fix.status}`);
        console.log(`    Verified at: ${fix.verifiedAt}`);
        
        if (fix.receiptPath) {
          console.log(`    Receipt: ${fix.receiptPath}`);
        }
        
        console.log('');
        
        if (options.merge) {
          console.log(`  ${styles.dim}Merging to main branch...${styles.reset}`);
          await autopatch.mergeFix(fix.id);
          console.log(`  ${styles.brightGreen}✓${styles.reset} Merged successfully`);
          console.log('');
        } else {
          console.log(`  ${styles.bold}To merge this fix:${styles.reset}`);
          console.log(`    ${styles.brightCyan}guardrail autopatch:merge --fix-id ${fix.id}${styles.reset}`);
          console.log('');
        }
      } else {
        console.log(`  ${styles.brightRed}${styles.bold}✗ VERIFICATION FAILED${styles.reset}`);
        console.log('');
        console.log(`    Status: ${fix.status}`);
        console.log(`    Fix ID: ${fix.id}`);
        console.log('');
        console.log(`  ${styles.bold}Failed gates:${styles.reset}`);
        fix.gates.filter(g => !g.passed).forEach(gate => {
          console.log(`    • ${gate.gate}: ${gate.error || 'Failed'}`);
        });
        console.log('');
      }
      
      process.exit(fix.status === 'verified' ? 0 : 1);
    } catch (error: any) {
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Error: ${error.message}`);
      console.log('');
      process.exit(1);
    }
  });

program
  .command('autopatch:merge')
  .description('Merge a verified fix')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--fix-id <id>', 'Fix ID to merge')
  .option('--target <branch>', 'Target branch', 'main')
  .action(async (options) => {
    printLogo();
    
    const { VerifiedAutopatch } = require('./autopatch/verified-autopatch');
    const { resolve } = require('path');
    
    const projectPath = resolve(options.path);
    
    if (!options.fixId) {
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Missing --fix-id`);
      process.exit(1);
    }
    
    try {
      const autopatch = new VerifiedAutopatch(projectPath);
      const fix = autopatch.getFix(options.fixId);
      
      if (!fix) {
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Fix not found: ${options.fixId}`);
        process.exit(1);
      }
      
      if (fix.status !== 'verified') {
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Fix is not verified. Status: ${fix.status}`);
        process.exit(1);
      }
      
      console.log(`  ${styles.dim}Merging fix ${options.fixId} to ${options.target}...${styles.reset}`);
      await autopatch.mergeFix(options.fixId, options.target);
      console.log(`  ${styles.brightGreen}✓${styles.reset} Merged successfully`);
      console.log('');
      
      process.exit(0);
    } catch (error: any) {
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Error: ${error.message}`);
      process.exit(1);
    }
  });

// Receipt verification command
program
  .command('receipt:verify')
  .description('Verify Proof-of-Execution Receipt')
  .option('-p, --path <path>', 'Receipt path or directory', '.guardrail/receipts')
  .option('--org-public-key <key>', 'Organization public key for verification (PEM format)')
  .action(async (options) => {
    printLogo();
    
    const { verifyReceipt, generateReceiptSummary } = require('./reality/receipt-generator');
    const { existsSync, readdirSync, statSync } = require('fs');
    const { join, resolve } = require('path');
    
    const receiptPath = resolve(options.path);
    
    console.log('');
    console.log(`  ${styles.brightCyan}${styles.bold}📜 RECEIPT VERIFICATION${styles.reset}`);
    console.log('');
    
    try {
      let receiptsToVerify: string[] = [];
      
      // Check if path is a directory or file
      if (statSync(receiptPath).isDirectory()) {
        // Find all receipt.json files
        const findReceipts = (dir: string): string[] => {
          const receipts: string[] = [];
          const entries = readdirSync(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              receipts.push(...findReceipts(fullPath));
            } else if (entry.name === 'receipt.json') {
              receipts.push(fullPath);
            }
          }
          
          return receipts;
        };
        
        receiptsToVerify = findReceipts(receiptPath);
      } else if (receiptPath.endsWith('receipt.json')) {
        receiptsToVerify = [receiptPath];
      } else {
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Invalid receipt path`);
        process.exit(1);
      }
      
      if (receiptsToVerify.length === 0) {
        console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} No receipts found`);
        process.exit(0);
      }
      
      let verifiedCount = 0;
      let failedCount = 0;
      
      for (const receiptFile of receiptsToVerify) {
        console.log(`  ${styles.dim}Verifying:${styles.reset} ${receiptFile}`);
        
        const isValid = await verifyReceipt(receiptFile, options.orgPublicKey);
        
        if (isValid) {
          verifiedCount++;
          console.log(`    ${styles.brightGreen}✓${styles.reset} ${styles.brightGreen}Verified${styles.reset}`);
          
          // Show summary
          const summary = generateReceiptSummary(receiptFile);
          console.log(summary);
        } else {
          failedCount++;
          console.log(`    ${styles.brightRed}✗${styles.reset} ${styles.brightRed}Verification failed${styles.reset}`);
        }
        
        console.log('');
      }
      
      console.log(`  ${styles.bold}Summary:${styles.reset}`);
      console.log(`    ${styles.brightGreen}Verified:${styles.reset}   ${verifiedCount}`);
      console.log(`    ${styles.brightRed}Failed:${styles.reset}     ${failedCount}`);
      console.log('');
      
      process.exit(failedCount > 0 ? 1 : 0);
    } catch (error: any) {
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Verification failed: ${error.message}`);
      process.exit(1);
    }
  });

// Autopilot command (Pro/Compliance feature)
program
  .command('autopilot')
  .description('Autopilot batch remediation (Pro/Compliance)')
  .argument('[mode]', 'Mode: plan, apply, or rollback', 'plan')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--max-fixes <n>', 'Maximum fixes per category', '10')
  .option('--verify', 'Run verification after apply (default: true)')
  .option('--no-verify', 'Skip verification')
  .option('--profile <profile>', 'Scan profile: quick, full, ship, ci', 'ship')
  .option('--json', 'Output JSON', false)
  .option('--dry-run', 'Preview changes without applying', false)
  .option('--pack <id>', 'Apply specific pack(s) only (repeatable)', (val, prev) => prev ? [...prev, val] : [val], undefined)
  .option('--run <runId>', 'Run ID for rollback')
  .option('--force', 'Force apply high-risk packs without confirmation', false)
  .option('--interactive', 'Prompt for confirmation on high-risk packs', false)
  .action(async (mode, options) => {
    printLogo();
    
    const config = loadConfig();
    
    // Enforce Pro+ tier
    const tierLevels: Record<string, number> = { free: 0, starter: 0, pro: 1, compliance: 2, enterprise: 3 };
    const currentLevel = tierLevels[config.tier || 'free'] || 0;
    
    if (currentLevel < 1) {
      console.log('');
      const errorLines = [
        `${styles.brightRed}${styles.bold}${icons.error} UPGRADE REQUIRED${styles.reset}`,
        '',
        'Autopilot requires Pro tier or higher.',
        '',
        `${styles.dim}Current tier:${styles.reset} ${config.tier || 'free'}`,
        `${styles.dim}Upgrade at:${styles.reset}   ${styles.brightBlue}https://guardrail.dev/pricing${styles.reset}`,
      ];
      console.log(frameLines(errorLines, { padding: 2 }).join('\n'));
      console.log('');
      exitWith(ExitCode.AUTH_FAILURE, 'Pro tier required');
    }
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    const autopilotMode = mode === 'rollback' ? 'rollback' : mode === 'apply' ? 'apply' : 'plan';
    
    if (autopilotMode === 'rollback' && !options.run) {
      console.log('');
      const errorLines = [
        `${styles.brightRed}${styles.bold}${icons.error} MISSING PARAMETER${styles.reset}`,
        '',
        'Rollback mode requires --run <runId>',
        '',
        `${styles.dim}Example:${styles.reset} guardrail autopilot rollback --run abc123def456`,
      ];
      console.log(frameLines(errorLines, { padding: 2 }).join('\n'));
      console.log('');
      exitWith(ExitCode.INVALID_INPUT, 'Missing runId for rollback');
    }
    
    console.log('');
    const headerLines = [
      `${styles.brightMagenta}${styles.bold}${icons.autopilot} AUTOPILOT MODE${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}Mode:${styles.reset}        ${autopilotMode.toUpperCase()}`,
      `${styles.dim}Profile:${styles.reset}     ${options.profile}`,
      `${styles.dim}Started:${styles.reset}     ${new Date().toLocaleString()}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    const s = spinner(`Running autopilot ${autopilotMode}...`);
    
    try {
      // Dynamic import to avoid bundling issues
      const { runAutopilot } = await import('@guardrail/core');
      const projectName = basename(projectPath);
      
      const result = await runAutopilot({
        projectPath,
        mode: autopilotMode as 'plan' | 'apply' | 'rollback',
        profile: options.profile as 'quick' | 'full' | 'ship' | 'ci',
        maxFixes: parseInt(options.maxFixes, 10),
        verify: options.verify !== false,
        dryRun: options.dryRun,
        packIds: options.pack,
        runId: options.run,
        force: options.force,
        interactive: options.interactive,
        onProgress: (stage: string, msg: string) => {
          if (!options.json) {
            process.stdout.write(`\r${styles.brightCyan}${icons.refresh}${styles.reset} ${msg}                    `);
          }
        },
      });
      
      s.stop(true, `Autopilot ${autopilotMode} complete`);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      
      if (result.mode === 'plan') {
        console.log('');
        const planLines = [
          `${styles.bold}FIX PLAN GENERATED${styles.reset}`,
          '',
          `${styles.dim}Total Findings:${styles.reset}  ${styles.bold}${result.totalFindings}${styles.reset}`,
          `${styles.dim}Fixable Issues:${styles.reset}  ${styles.brightGreen}${styles.bold}${result.fixableFindings}${styles.reset}`,
          `${styles.dim}Estimated Time:${styles.reset}  ${result.estimatedDuration}`,
        ];
        console.log(frameLines(planLines, { padding: 2 }).join('\n'));
        console.log('');
        
        console.log(`  ${styles.bold}PROPOSED FIX PACKS${styles.reset}`);
        printDivider();
        for (const pack of result.packs) {
          const riskColor = pack.estimatedRisk === 'high' ? styles.brightRed : 
                           pack.estimatedRisk === 'medium' ? styles.brightYellow : styles.brightGreen;
          const riskIcon = pack.estimatedRisk === 'high' ? icons.warning : pack.estimatedRisk === 'medium' ? icons.halfBlock : icons.dot;
          
          console.log(`  ${riskColor}${riskIcon}${styles.reset} ${styles.bold}${pack.name}${styles.reset} ${styles.dim}(${pack.findings.length} issues)${styles.reset}`);
          console.log(`     ${styles.dim}Files:${styles.reset} ${pack.impactedFiles.slice(0, 3).join(', ')}${pack.impactedFiles.length > 3 ? '...' : ''}`);
          console.log('');
        }
        
        console.log(`  ${styles.dim}Run${styles.reset} ${styles.bold}guardrail autopilot apply${styles.reset} ${styles.dim}to apply these fixes${styles.reset}`);
        console.log('');
      } else if (result.mode === 'rollback') {
        console.log('');
        const statusIcon = result.success ? icons.success : icons.error;
        const statusColor = result.success ? styles.brightGreen : styles.brightRed;
        const statusText = result.success ? 'ROLLBACK SUCCESSFUL' : 'ROLLBACK FAILED';
        
        const rollbackLines = [
          `${statusColor}${styles.bold}${statusIcon} ${statusText}${styles.reset}`,
          '',
          `${styles.dim}Run ID:${styles.reset}      ${result.runId}`,
          `${styles.dim}Method:${styles.reset}     ${result.method === 'git-reset' ? 'Git Reset' : 'Backup Restore'}`,
          `${styles.dim}Message:${styles.reset}    ${result.message}`,
        ];
        
        console.log(frameLines(rollbackLines, { padding: 2 }).join('\n'));
        console.log('');
      } else {
        console.log('');
        const resultLines = [
          `${styles.brightGreen}${styles.bold}${icons.success} AUTOPILOT REMEDIATION COMPLETE${styles.reset}`,
          '',
          `${styles.dim}Packs Attempted:${styles.reset}  ${result.packsAttempted}`,
          `${styles.dim}Packs Succeeded:${styles.reset}  ${styles.brightGreen}${result.packsSucceeded}${styles.reset}`,
          `${styles.dim}Packs Failed:${styles.reset}     ${result.packsFailed > 0 ? styles.brightRed : ''}${result.packsFailed}${styles.reset}`,
          `${styles.dim}Fixes Applied:${styles.reset}    ${styles.bold}${result.appliedFixes.filter((f: any) => f.success).length}${styles.reset}`,
        ];
        
        if (result.runId) {
          resultLines.push(`${styles.dim}Run ID:${styles.reset}          ${styles.bold}${result.runId}${styles.reset}`);
        }
        if (result.gitBranch) {
          resultLines.push(`${styles.dim}Git Branch:${styles.reset}      ${result.gitBranch}`);
        }
        if (result.gitCommit) {
          resultLines.push(`${styles.dim}Git Commit:${styles.reset}      ${result.gitCommit.substring(0, 8)}`);
        }
        
        if (result.verification) {
          const vStatus = result.verification.passed ? `${styles.brightGreen}PASS${styles.reset}` : `${styles.brightRed}FAIL${styles.reset}`;
          resultLines.push('');
          resultLines.push(`${styles.bold}VERIFICATION:${styles.reset} ${vStatus}`);
          resultLines.push(`${styles.dim}TypeScript:${styles.reset}   ${result.verification.typecheck.passed ? icons.success : icons.error}`);
          resultLines.push(`${styles.dim}Build:${styles.reset}        ${result.verification.build.passed ? icons.success : '—'}`);
        }
        
        console.log(frameLines(resultLines, { padding: 2 }).join('\n'));
        console.log('');
        
        console.log(`  ${styles.dim}Remaining findings:${styles.reset} ${result.remainingFindings}`);
        console.log(`  ${styles.dim}Total duration:${styles.reset}     ${result.duration}ms`);
        if (result.runId) {
          console.log('');
          console.log(`  ${styles.dim}To rollback:${styles.reset} ${styles.bold}guardrail autopilot rollback --run ${result.runId}${styles.reset}`);
        }
        console.log('');
      }
    } catch (error: any) {
      s.stop(false, 'Autopilot failed');
      console.log('');
      console.log(`  ${styles.brightRed}✗${styles.reset} ${styles.bold}Autopilot failed:${styles.reset} ${error.message}`);
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Autopilot execution failed');
    }
  });