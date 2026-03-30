/**
 * guardrail on
 * 
 * Always-on Context Mode (watcher + MCP server + telemetry). This is the relationship.
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { TruthPackGenerator } from '../truth-pack';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

export function registerOnCommand(program: Command): void {
  program
    .command('on')
    .description('Start always-on Context Mode (watcher + MCP server + telemetry)')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--port <port>', 'MCP server port', '3001')
    .option('--watch', 'Watch for file changes and regenerate Truth Pack', true)
    .action(async (options) => {
      printLogo();
      
      const projectPath = resolve(options.path);
      
      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} STARTING CONTEXT MODE${styles.reset}\n`);

      // Check if Truth Pack exists
      const generator = new TruthPackGenerator(projectPath);
      if (!generator.isFresh(168)) { // 7 days
        console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} Truth Pack is stale or missing`);
        console.log(`  ${styles.dim}Run ${styles.bold}guardrail init${styles.reset}${styles.dim} first${styles.reset}\n`);
        process.exit(1);
      }

      console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Truth Pack found`);
      console.log(`  ${styles.dim}Location: ${generator.getPath()}${styles.reset}\n`);

      // Start MCP server
      console.log(`  ${styles.brightCyan}${icons.info}${styles.reset} Starting MCP server...`);
      
      try {
        const { startMCPServer } = await import('../mcp/server');
        await startMCPServer(projectPath, {
          port: parseInt(options.port),
          telemetry: true,
        });
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} MCP server started`);
      } catch (error: any) {
        console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} MCP server: ${error.message}`);
      }
      
      // Start file watcher if enabled
      if (options.watch) {
        console.log(`  ${styles.brightCyan}${icons.info}${styles.reset} File watcher enabled`);
        try {
          // File watcher - use a simple implementation for now
          // TODO: Import from proper location when available
          const chokidar = await import('chokidar').catch(() => null);
          if (chokidar) {
            const watcher = chokidar.watch(projectPath, {
              ignored: /(^|[\/\\])\../, // ignore dotfiles
              persistent: true,
            });
            
            watcher.on('change', async (file) => {
              if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                console.log(`  ${styles.dim}File changed: ${file} - regenerating Truth Pack...${styles.reset}`);
                try {
                  await generator.generate();
                } catch {
                  // Ignore errors during watch regeneration
                }
              }
            });
          } else {
            console.log(`  ${styles.dim}File watcher: chokidar not available, skipping${styles.reset}`);
          }
        } catch (error: any) {
          console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} File watcher: ${error.message}`);
        }
      }

      console.log('');
      console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Context Mode active${styles.reset}`);
      console.log(`  ${styles.dim}Press Ctrl+C to stop${styles.reset}\n`);

      // Keep process alive
      process.on('SIGINT', () => {
        console.log(`\n  ${styles.dim}Stopping Context Mode...${styles.reset}\n`);
        process.exit(0);
      });

      // Keep process alive (telemetry is logged by MCP server when tools are called)
      // Process will stay alive until Ctrl+C
    });
}
