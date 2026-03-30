/**
 * guardrail explain
 * 
 * Get detailed explanation of a finding
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

export function registerExplainCommand(program: Command): void {
  program
    .command('explain')
    .description('Get detailed explanation of a finding')
    .argument('<finding-id>', 'Finding ID (e.g., GR-REALITY-001)')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (findingId, options) => {
      printLogo();

      const projectPath = resolve(options.path);
      const scanFile = join(projectPath, '.guardrail', 'scan.json');

      if (!existsSync(scanFile)) {
        console.error(`\n  ${styles.brightRed}${icons.error}${styles.reset} No scan results found`);
        console.log(`  ${styles.dim}Run ${styles.bold}guardrail scan${styles.reset}${styles.dim} first${styles.reset}\n`);
        process.exit(2);
      }

      const scanResult = JSON.parse(readFileSync(scanFile, 'utf-8'));
      const finding = scanResult.findings?.find((f: any) => f.id === findingId);

      if (!finding) {
        console.error(`\n  ${styles.brightRed}${icons.error}${styles.reset} Finding ${findingId} not found\n`);
        process.exit(1);
      }

      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} FINDING EXPLANATION${styles.reset}\n`);
      console.log(`  ${styles.bold}ID:${styles.reset} ${finding.id}`);
      console.log(`  ${styles.bold}Type:${styles.reset} ${finding.type}`);
      console.log(`  ${styles.bold}Severity:${styles.reset} ${finding.severity}`);
      console.log(`  ${styles.bold}File:${styles.reset} ${finding.file}:${finding.line}`);
      console.log(`  ${styles.bold}Verdict:${styles.reset} ${finding.verdict}`);
      console.log(`  ${styles.bold}Confidence:${styles.reset} ${(finding.confidence * 100).toFixed(0)}%`);
      console.log('');

      if (finding.evidence && finding.evidence.length > 0) {
        console.log(`  ${styles.bold}Evidence:${styles.reset}`);
        finding.evidence.forEach((e: any, i: number) => {
          console.log(`    ${i + 1}. Level: ${e.level}, Strength: ${(e.strength * 100).toFixed(0)}%`);
        });
        console.log('');
      }

      console.log(`  ${styles.bold}Fix:${styles.reset} ${styles.bold}guardrail fix --id ${finding.id}${styles.reset}\n`);
    });
}
