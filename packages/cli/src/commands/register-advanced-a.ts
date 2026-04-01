import { Command } from 'commander';
import { icons, styles, printLogo } from '../ui';
<<<<<<< HEAD
import type { RealityGraphBuilder } from '../reality/reality-graph';
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

export function registerAdvancedCommandsPartA(program: Command): void {
  program
  .command('reality:graph')
  .description('Generate and analyze Reality Graph')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--receipt <receiptId>', 'Load graph from receipt')
  .option('--export <format>', 'Export format: json, dot, mermaid', 'json')
  .option('--query <query>', 'Query: unexecuted, unhit-routes, unguarded-writes, incomplete-flags')
  .action(async (options) => {
    printLogo();
    
<<<<<<< HEAD
    const {
      RealityGraphBuilder,
    }: typeof import('../reality/reality-graph') = require('../reality/reality-graph');
=======
    const { RealityGraphBuilder } = require('../reality/reality-graph');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    const { existsSync, readFileSync, writeFileSync } = require('fs');
    const { resolve, join } = require('path');
    
    const projectPath = resolve(options.path);
    
    console.log('');
    console.log(`  ${styles.brightCyan}${styles.bold}🗺️  REALITY GRAPH${styles.reset}`);
    console.log('');
    
    try {
<<<<<<< HEAD
      let graphBuilder: RealityGraphBuilder;
=======
      let graphBuilder: any;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      
      if (options.receipt) {
        // Load graph from receipt
        const receiptPath = join(projectPath, '.guardrail', 'receipts', options.receipt, 'reality-graph.json');
        if (!existsSync(receiptPath)) {
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Receipt graph not found`);
          process.exit(1);
        }
        
<<<<<<< HEAD
        const graphData = JSON.parse(readFileSync(receiptPath, 'utf-8')) as {
          nodes?: unknown;
          edges?: unknown;
          snapshots?: import('../reality/reality-graph').RealityGraph['snapshots'];
        };
        graphBuilder = new RealityGraphBuilder(projectPath);
        if (!Array.isArray(graphData.nodes) || !Array.isArray(graphData.edges)) {
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} Invalid graph JSON (expected nodes and edges arrays)`);
          process.exit(1);
        }
        graphBuilder.importFromParsedExport({
          nodes: graphData.nodes as import('../reality/reality-graph').RealityNode[],
          edges: graphData.edges as import('../reality/reality-graph').RealityEdge[],
          snapshots: graphData.snapshots,
        });
=======
        const graphData = JSON.parse(readFileSync(receiptPath, 'utf-8'));
        graphBuilder = new RealityGraphBuilder(projectPath);
        // TODO: Load graph from JSON
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
    
    const { VerifiedAutopatch } = require('../autopatch/verified-autopatch');
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
<<<<<<< HEAD
        fix.gates.filter((g: { passed: boolean }) => !g.passed).forEach((gate: { gate: string; error?: string }) => {
=======
        fix.gates.filter(g => !g.passed).forEach(gate => {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
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
    
    const { VerifiedAutopatch } = require('../autopatch/verified-autopatch');
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
    
    const { verifyReceipt, generateReceiptSummary } = require('../reality/receipt-generator');
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
}
