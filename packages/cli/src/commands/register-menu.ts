import type { Command } from 'commander';
import { c, printLogo } from '../ui/cli-terminal';
import { isInteractiveAllowed } from '../runtime/cli-config';
import { runInteractiveMenu } from './interactive-menu';

export function registerMenuCommand(program: Command): void {
  program
    .command('menu')
    .description('Open interactive menu')
    .action(async () => {
      if (!isInteractiveAllowed(process.argv.slice(2))) {
        console.error(`${c.high('✗')} Interactive menu disabled (TTY/CI/no-interactive)`);
        process.exit(2);
      }
      printLogo();
      await runInteractiveMenu();
    });
}
