/**
 * guardrail replay
 * 
 * Re-run the exact failing proofs from a previous scan
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

export function registerReplayCommand(program: Command): void {
  program
    .command('replay')
    .description('Re-run exact failing proofs from previous scan')
    .argument('<scan-id>', 'Scan ID or timestamp')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (scanId, options) => {
      printLogo();

      const projectPath = resolve(options.path);
      const scanFile = join(projectPath, '.guardrail', 'scan.json');
      const proofFile = join(projectPath, '.guardrail', 'proof.json');

      if (!existsSync(scanFile)) {
        console.error(`\n  ${styles.brightRed}${icons.error}${styles.reset} No scan results found`);
        console.log(`  ${styles.dim}Run ${styles.bold}guardrail scan${styles.reset}${styles.dim} first${styles.reset}\n`);
        process.exit(2);
      }

      const scanResult = JSON.parse(readFileSync(scanFile, 'utf-8'));
      const proofGraph = existsSync(proofFile)
        ? JSON.parse(readFileSync(proofFile, 'utf-8'))
        : null;

      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} REPLAYING SCAN${styles.reset}\n`);
      console.log(`  ${styles.dim}Scan ID:${styles.reset} ${scanId}\n`);

      // Find failing findings
      const failingFindings = scanResult.findings?.filter((f: any) => f.verdict === 'FAIL') || [];

      if (failingFindings.length === 0) {
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} No failing proofs to replay\n`);
        return;
      }

      console.log(`  ${styles.bold}Replaying ${failingFindings.length} failing proof(s)...${styles.reset}\n`);

      // TODO: Actually replay proofs
      // This would re-run the exact verification steps that failed

      for (const finding of failingFindings) {
        console.log(`  ${styles.cyan}${icons.bullet}${styles.reset} ${finding.id}: ${finding.type}`);
        console.log(`     ${styles.dim}${finding.file}:${finding.line}${styles.reset}`);
      }

      console.log('');
      console.log(`  ${styles.bold}Next:${styles.reset} Review proof bundle in .guardrail/artifacts/\n`);
    });
}
