/**
 * baseline command
 * Generate and manage baseline files for suppressing known findings
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { BaselineManager } from '../scanner/baseline';
import { scanSecrets } from './scan-secrets';
import { scanVulnerabilities } from './scan-vulnerabilities';

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  success: (s: string) => `\x1b[32m${s}\x1b[0m`,
  info: (s: string) => `\x1b[34m${s}\x1b[0m`,
};

export function registerBaselineCommand(program: Command, requireAuth: () => any, printLogo: () => void): void {
  program
    .command('baseline')
    .description('Generate baseline file to suppress known findings')
    .option('-p, --path <path>', 'Project path to scan', '.')
    .option('--write <file>', 'Write baseline to file', '.guardrail/baseline.json')
    .option('-t, --type <type>', 'Scan type: all, secrets, vulnerabilities', 'all')
    .action(async (opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('📋 BASELINE GENERATION')}\n`);
      
      const projectPath = resolve(opts.path);
      const baselinePath = resolve(opts.write);
      
      console.log(`  ${c.dim('Project:')} ${projectPath}`);
      console.log(`  ${c.dim('Baseline:')} ${baselinePath}`);
      console.log(`  ${c.dim('Type:')} ${opts.type}\n`);
      
      const allFindings: any[] = [];
      
      if (opts.type === 'all' || opts.type === 'secrets') {
        console.log(`  ${c.info('→')} Scanning for secrets...`);
        const secretsResult = await scanSecrets(projectPath, {
          path: projectPath,
          format: 'json',
          excludeTests: false,
          failOnDetection: false,
          evidence: false,
        });
        
        for (const finding of secretsResult.findings) {
          allFindings.push({
            type: finding.type,
            category: 'secrets',
            title: finding.type,
            file: finding.file,
            line: finding.line,
            snippet: finding.match,
          });
        }
        console.log(`  ${c.success('✓')} Found ${secretsResult.findings.length} secrets\n`);
      }
      
      if (opts.type === 'all' || opts.type === 'vulnerabilities') {
        console.log(`  ${c.info('→')} Scanning for vulnerabilities...`);
        const vulnResult = await scanVulnerabilities(projectPath, {
          format: 'json',
        });
        
        for (const finding of vulnResult.findings) {
          allFindings.push({
            category: 'vulnerability',
            title: `${finding.cve}: ${finding.title}`,
            file: 'package.json',
            line: 1,
            snippet: `${finding.package}@${finding.version}`,
          });
        }
        console.log(`  ${c.success('✓')} Found ${vulnResult.findings.length} vulnerabilities\n`);
      }
      
      BaselineManager.saveBaseline(baselinePath, allFindings);
      
      console.log(`${c.success('✓')} ${c.bold('Baseline created successfully!')}`);
      console.log(`  ${c.dim('File:')} ${baselinePath}`);
      console.log(`  ${c.dim('Findings:')} ${allFindings.length}`);
      console.log(`\n  ${c.dim('Use')} ${c.bold(`--baseline ${baselinePath}`)} ${c.dim('with scan commands to suppress these findings.')}\n`);
    });
}
