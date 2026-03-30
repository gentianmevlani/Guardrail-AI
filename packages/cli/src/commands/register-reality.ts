import { Command } from 'commander';
import { runRealityCommand } from './reality-command-action';

export function registerRealityCommands(program: Command): void {
  program
    .command('reality')
    .description('Reality Mode - Browser testing and fake data detection (Starter+)')
    .option('-p, --path <path>', 'Project path', '.')
    .option('-u, --url <url>', 'Base URL of running app', 'http://localhost:3000')
    .option('-f, --flow <flow>', 'Flow to test: auth, checkout, dashboard', 'auth')
    .option('-t, --timeout <timeout>', 'Timeout in seconds', '30')
    .option('--headless', 'Run in headless mode', false)
    .option('--run', 'Execute the test immediately with Playwright', false)
    .option('--record', 'Record user actions using Playwright codegen', false)
    .option('--workers <n>', 'Number of parallel workers', '1')
    .option('--reporter <type>', 'Test reporter: list, dot, html, json', 'list')
    .option('--trace <mode>', 'Trace mode: on, off, retain-on-failure', 'retain-on-failure')
    .option('--video <mode>', 'Video mode: on, off, retain-on-failure', 'retain-on-failure')
    .option('--screenshot <mode>', 'Screenshot mode: on, off, only-on-failure', 'only-on-failure')
    .option('--receipt', 'Generate Proof-of-Execution Receipt (Enterprise)', false)
    .option('--org-key-id <id>', 'Organization key ID for receipt signing')
    .option('--org-private-key <key>', 'Organization private key for receipt signing (PEM format)')
    .option('--button-sweep', 'Run button sweep test (clicks all buttons and validates)', false)
    .option('--no-dead-ui', 'Run static scan for dead UI patterns before tests', false)
    .option('--auth-email <email>', 'Email for button sweep authentication')
    .option('--auth-password <password>', 'Password for button sweep authentication')
    .action(async (options) => {
      await runRealityCommand(options as Record<string, unknown>);
    });
}
