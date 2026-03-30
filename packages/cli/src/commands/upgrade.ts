/**
 * guardrail upgrade
 * 
 * Clean upsell to Pro tier.
 */

import { Command } from 'commander';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Upgrade to Pro tier for unlimited checkpoints and ship reports')
    .action(async () => {
      printLogo();
      
      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} UPGRADE TO PRO${styles.reset}\n`);

      console.log(`  ${styles.bold}Pro Tier Benefits:${styles.reset}`);
      console.log(`  ${styles.cyan}${icons.bullet}${styles.reset} Unlimited checkpoints`);
      console.log(`  ${styles.cyan}${icons.bullet}${styles.reset} Ship reports with GO/WARN/NO-GO verdicts`);
      console.log(`  ${styles.cyan}${icons.bullet}${styles.reset} Premium HTML reports`);
      console.log(`  ${styles.cyan}${icons.bullet}${styles.reset} Proof artifacts`);
      console.log(`  ${styles.cyan}${icons.bullet}${styles.reset} Priority support`);
      console.log('');

      console.log(`  ${styles.bold}Price:${styles.reset} $29/month`);
      console.log('');

      console.log(`  ${styles.brightCyan}Upgrade now:${styles.reset} ${styles.bold}https://guardrail.dev/upgrade${styles.reset}\n`);
    });
}
