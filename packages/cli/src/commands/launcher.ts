/**
 * Interactive CLI Launcher
 * 
 * Running guardrail with no args opens a slick interactive menu:
 * - Shows connected status, Truth Pack freshness, tier, last 24h stats
 * - Lets you run: on / checkpoint / stats / ship / init / doctor / login
 * - Has Pro lock indicator for ship
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { TruthPackGenerator } from '../truth-pack';
import { loadAuthState } from '../runtime/creds';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

export async function runInteractiveLauncher(): Promise<void> {
  printLogo();
  
  const cfg = await loadAuthState();
  const projectPath = (cfg as any).lastProjectPath || '.';
  
  // Check Truth Pack status
  const generator = new TruthPackGenerator(projectPath);
  const truthPackFresh = generator.isFresh(24);
  const truthPackExists = existsSync(generator.getPath());
  
  // Load stats
  const statsFile = join(projectPath, '.guardrail', 'stats.json');
  let last24hStats = { hallucinationsBlocked: 0, symbolsVerified: 0 };
  if (existsSync(statsFile)) {
    try {
      const stats = JSON.parse(readFileSync(statsFile, 'utf-8'));
      last24hStats = {
        hallucinationsBlocked: stats.hallucinationsBlocked?.last24h || 0,
        symbolsVerified: stats.symbolsVerified || 0,
      };
    } catch {
      // Ignore
    }
  }

  // Build status bar
  const statusBar = buildStatusBar(cfg, truthPackExists, truthPackFresh, last24hStats);
  
  console.log(`\n${statusBar}\n`);

<<<<<<< HEAD
  const { promptSelect } = await import('../ui/cli-prompts');
=======
  // Import promptSelect dynamically
  const { promptSelect } = await import('../index');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  
  // Main menu
  const action = await promptSelect<'init' | 'on' | 'stats' | 'checkpoint' | 'ship' | 'doctor' | 'login' | 'exit'>(
    'What would you like to do?',
    [
      {
        name: `${styles.brightCyan}${icons.info}${styles.reset} Init                  ${styles.dim}One-time setup, builds Truth Pack${styles.reset}`,
        value: 'init',
      },
      {
        name: `${styles.brightGreen}${icons.success}${styles.reset} On                   ${styles.dim}Start Context Mode (watcher + MCP)${styles.reset}`,
        value: 'on',
      },
      {
        name: `${styles.brightBlue}${icons.scan}${styles.reset} Stats                 ${styles.dim}Hallucinations blocked, saved moments${styles.reset}`,
        value: 'stats',
      },
      {
        name: `${styles.brightYellow}${icons.warning}${styles.reset} Checkpoint           ${styles.dim}Fast pre-write verification${styles.reset}`,
        value: 'checkpoint',
      },
      {
        name: `${styles.brightGreen}${icons.ship}${styles.reset} Ship                  ${(cfg as any).tier === 'pro' || (cfg as any).tier === 'enterprise' ? '' : `${styles.magenta}${styles.bold}PRO${styles.reset} `}${styles.dim}GO/WARN/NO-GO + premium report${styles.reset}`,
        value: 'ship',
      },
      {
        name: `${styles.dim}${icons.error}${styles.reset} Doctor                 ${styles.dim}Fix setup issues${styles.reset}`,
        value: 'doctor',
      },
      {
        name: `${styles.brightMagenta}${icons.auth}${styles.reset} Login / Logout / Whoami ${styles.dim}Auth management${styles.reset}`,
        value: 'login',
      },
      {
        name: `${styles.dim}${icons.error} Exit${styles.reset}`,
        value: 'exit',
      },
    ]
  );

  if (action === 'exit') {
    return;
  }

  // Execute action
  const { execSync } = await import('child_process');
  try {
    switch (action) {
      case 'init':
        execSync(`guardrail init -p "${projectPath}"`, { stdio: 'inherit' });
        break;
      case 'on':
        execSync(`guardrail on -p "${projectPath}"`, { stdio: 'inherit' });
        break;
      case 'stats':
        execSync(`guardrail stats -p "${projectPath}"`, { stdio: 'inherit' });
        break;
      case 'checkpoint':
        execSync(`guardrail checkpoint -p "${projectPath}"`, { stdio: 'inherit' });
        break;
      case 'ship':
        execSync(`guardrail ship -p "${projectPath}"`, { stdio: 'inherit' });
        break;
      case 'doctor':
        execSync(`guardrail doctor -p "${projectPath}"`, { stdio: 'inherit' });
        break;
      case 'login':
        // Use existing interactive menu for auth
        // For now, just show auth command help
        console.log(`\n  ${styles.brightCyan}${icons.info}${styles.reset} Run ${styles.bold}guardrail login${styles.reset} to authenticate\n`);
        break;
    }
  } catch (error: any) {
    // Command execution errors are handled by the commands themselves
  }
}

function buildStatusBar(
  cfg: any,
  truthPackExists: boolean,
  truthPackFresh: boolean,
  stats: { hallucinationsBlocked: number; symbolsVerified: number }
): string {
  const lines: string[] = [];
  
  // Context Mode status
  const contextStatus = truthPackExists && truthPackFresh
    ? `${styles.brightGreen}connected ✅${styles.reset}`
    : `${styles.brightRed}not connected${styles.reset}`;
  lines.push(`  ${styles.bold}Context Mode:${styles.reset} ${contextStatus}`);

  // Truth Pack status
  const truthPackStatus = truthPackExists
    ? truthPackFresh
      ? `${styles.brightGreen}fresh${styles.reset}`
      : `${styles.brightYellow}stale${styles.reset}`
    : `${styles.brightRed}missing${styles.reset}`;
  lines.push(`  ${styles.bold}Truth Pack:${styles.reset} ${truthPackStatus}`);

  // Tier
  const tierBadge = cfg.tier === 'enterprise' ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}` :
                     cfg.tier === 'pro' ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}` :
                     cfg.tier === 'starter' ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}` :
                     `${styles.dim} FREE ${styles.reset}`;
  lines.push(`  ${styles.bold}Tier:${styles.reset} ${tierBadge}`);

  // Last 24h stats
  lines.push(`  ${styles.bold}Last 24h:${styles.reset} ${styles.brightCyan}${stats.hallucinationsBlocked}${styles.reset} hallucinations blocked, ${styles.brightCyan}${stats.symbolsVerified}${styles.reset} symbols verified`);

  return lines.join('\n');
}
