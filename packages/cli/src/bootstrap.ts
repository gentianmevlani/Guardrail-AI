import { execSync } from 'child_process';
import { program } from './cli-program';
import { registerAllCommands } from './commands';
import { isInteractiveAllowed } from './runtime/cli-config';
import { c } from './ui/cli-terminal';

async function main(): Promise<void> {
  if (process.platform === 'win32') {
    try {
      execSync('chcp 65001', { stdio: 'ignore' });
    } catch {
      // Ignore failures
    }
  }

  const argv = process.argv.slice(2);

  if (argv.length === 0 && isInteractiveAllowed(argv)) {
    const { runInteractiveLauncher } = await import('./commands/launcher');
    await runInteractiveLauncher();
    return;
  }

  registerAllCommands(program);
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n${c.critical('ERROR')} ${msg}\n`);
  process.exit(3);
});
