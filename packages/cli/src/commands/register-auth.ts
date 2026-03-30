import { Command } from 'commander';
import { loadAuthState, clearAuthState } from '../runtime/creds';
import { CLI_VERSION } from '../cli-program';
import { icons, styles } from '../ui/cli-styles';
import { frameLines } from '../ui/cli-frame-inline';
import { printLogo, c } from '../ui/cli-terminal';
import { runAuthOptionsAction } from './auth-command-action';

export function registerAuthCommands(program: Command): void {
  program
    .name('guardrail')
    .description('guardrail AI - Security scanning for your codebase')
    .version(CLI_VERSION);

  program
    .command('login')
    .description('Login with your guardrail API key')
    .option('-k, --key <apiKey>', 'Your API key from guardrail.dev')
    .action(async (options: { key?: string }) => {
      await runAuthOptionsAction({
        key: options.key,
        logout: false,
        status: false,
        refresh: false,
      });
    });

  program
    .command('logout')
    .description('Remove stored credentials')
    .action(async () => {
      printLogo();
      try {
        await clearAuthState();
        console.log(`\n${c.success('✓')} ${c.bold('Logged out successfully')}\n`);
      } catch {
        console.log(`\n${c.info('ℹ')} No credentials found\n`);
      }
    });

  program
    .command('whoami')
    .description('Show current authentication status')
    .action(async () => {
      printLogo();
      const state = await loadAuthState();
      console.log('');
      if (state.apiKey) {
        const tierBadge =
          state.tier === 'enterprise'
            ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}`
            : state.tier === 'pro'
              ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}`
              : state.tier === 'starter'
                ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}`
                : `${styles.dim} FREE ${styles.reset}`;
        console.log(`  ${c.success('✓')} ${c.bold('Authenticated')}`);
        console.log(`  ${c.dim('Tier:')}   ${tierBadge}`);
        console.log(`  ${c.dim('Email:')}  ${state.email || 'N/A'}`);
        console.log(`  ${c.dim('Since:')}  ${state.authenticatedAt || 'N/A'}\n`);
      } else {
        console.log(`  ${c.high('✗')} ${c.bold('Not authenticated')}\n`);
      }
    });

  program
    .command('auth')
    .description('Authenticate with your guardrail API key')
    .option('-k, --key <apiKey>', 'Your API key from guardrail.dev')
    .option('--logout', 'Remove stored credentials')
    .option('--status', 'Check authentication status')
    .option('--refresh', 'Force revalidation of cached entitlements')
    .action(
      async (options: {
        key?: string;
        logout?: boolean;
        status?: boolean;
        refresh?: boolean;
      }) => {
        await runAuthOptionsAction(options);
      }
    );
}
