/**
 * secrets:allowlist command
 * Manage allowlisted secret detections
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { SecretsGuardian, Allowlist } from 'guardrail-security';
import { readFileSync } from 'fs';

const c = {
  reset: '\x1b[0m',
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  success: (s: string) => `\x1b[32m${s}\x1b[0m`,
  info: (s: string) => `\x1b[34m${s}\x1b[0m`,
  error: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

export function registerSecretsAllowlistCommand(program: Command, requireAuth: () => any, printLogo: () => void): void {
  const allowlistCmd = program
    .command('secrets:allowlist')
    .description('Manage secrets allowlist');

  allowlistCmd
    .command('add')
    .description('Add a fingerprint to the allowlist')
    .argument('<fingerprint>', 'SHA256 fingerprint to allowlist')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (fingerprint: string, opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🔐 SECRETS ALLOWLIST - ADD')}\n`);

      const projectPath = resolve(opts.path);
      const allowlistManager = new Allowlist(projectPath);

      try {
        allowlistManager.add(fingerprint);
        allowlistManager.save();
        console.log(`  ${c.success('✓')} Added fingerprint to allowlist: ${c.dim(fingerprint)}`);
        console.log(`  ${c.info('ℹ')} Total allowlisted: ${allowlistManager.size()}\n`);
      } catch (err) {
        console.error(`  ${c.error('✗')} ${(err as Error).message}\n`);
        process.exit(1);
      }
    });

  allowlistCmd
    .command('from-baseline')
    .description('Add fingerprints from a baseline file')
    .argument('<file>', 'Baseline file (JSON scan results or line-delimited fingerprints)')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (file: string, opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🔐 SECRETS ALLOWLIST - FROM BASELINE')}\n`);

      const projectPath = resolve(opts.path);
      const baselinePath = resolve(file);
      const allowlistManager = new Allowlist(projectPath);

      try {
        const added = allowlistManager.addFromBaseline(baselinePath);
        allowlistManager.save();
        console.log(`  ${c.success('✓')} Added ${added} fingerprints from baseline`);
        console.log(`  ${c.info('ℹ')} Total allowlisted: ${allowlistManager.size()}\n`);
      } catch (err) {
        console.error(`  ${c.error('✗')} ${(err as Error).message}\n`);
        process.exit(1);
      }
    });

  allowlistCmd
    .command('list')
    .description('List all allowlisted fingerprints')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (opts) => {
      requireAuth();
      printLogo();
      console.log(`\n${c.bold('🔐 SECRETS ALLOWLIST - LIST')}\n`);

      const projectPath = resolve(opts.path);
      const allowlistManager = new Allowlist(projectPath);

      if (allowlistManager.size() === 0) {
        console.log(`  ${c.dim('No fingerprints in allowlist')}\n`);
        return;
      }

      console.log(`  ${c.info('Total:')} ${allowlistManager.size()} fingerprints\n`);
      console.log(`  ${c.dim('Allowlist file:')} .guardrail/secrets.allowlist\n`);
    });
}
