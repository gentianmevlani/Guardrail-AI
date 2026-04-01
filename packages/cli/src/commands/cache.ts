/**
 * Cache management commands
 * 
 * Commands:
 * - cache:clear - Clear the OSV vulnerability cache
 * - cache:status - Show cache statistics
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync, statSync, readdirSync, rmSync, mkdirSync } from 'fs';

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  success: (s: string) => `\x1b[32m${s}\x1b[0m`,
  error: (s: string) => `\x1b[31m${s}\x1b[0m`,
  info: (s: string) => `\x1b[34m${s}\x1b[0m`,
  warning: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

/**
 * Get cache directory path
 */
function getCacheDir(projectPath: string = '.'): string {
  return join(projectPath, '.guardrail', 'cache');
}

/**
 * Get cache statistics
 */
function getCacheStats(cacheDir: string): {
  exists: boolean;
  totalSize: number;
  fileCount: number;
  files: { name: string; size: number; modified: Date }[];
} {
  if (!existsSync(cacheDir)) {
    return { exists: false, totalSize: 0, fileCount: 0, files: [] };
  }

  const files: { name: string; size: number; modified: Date }[] = [];
  let totalSize = 0;

  try {
    const entries = readdirSync(cacheDir);
    for (const entry of entries) {
      const filePath = join(cacheDir, entry);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        files.push({
          name: entry,
          size: stat.size,
          modified: stat.mtime,
        });
        totalSize += stat.size;
      }
    }
  } catch {
    // Failed to read cache directory
  }

  return {
    exists: true,
    totalSize,
    fileCount: files.length,
    files,
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clear cache directory
 */
function clearCache(cacheDir: string): { success: boolean; error?: string } {
  try {
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
    mkdirSync(cacheDir, { recursive: true });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register cache commands
 */
export function registerCacheCommands(
  program: Command,
  printLogo: () => void
): void {
  program
    .command('cache:clear')
    .description('Clear the guardrail cache (OSV vulnerability data)')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--global', 'Clear global cache instead of project cache')
    .action(async (opts) => {
      printLogo();
      console.log(`\n${c.bold('🗑️  CACHE CLEAR')}\n`);

      let cacheDir: string;
      if (opts.global) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
        cacheDir = join(homeDir, '.guardrail', 'cache');
      } else {
        cacheDir = getCacheDir(opts.path);
      }

      const stats = getCacheStats(cacheDir);
      
      if (!stats.exists || stats.fileCount === 0) {
        console.log(`  ${c.info('ℹ')} Cache is already empty\n`);
        console.log(`  ${c.dim('Path:')} ${cacheDir}\n`);
        return;
      }

      console.log(`  ${c.dim('Path:')} ${cacheDir}`);
      console.log(`  ${c.dim('Files:')} ${stats.fileCount}`);
      console.log(`  ${c.dim('Size:')} ${formatBytes(stats.totalSize)}\n`);

      const result = clearCache(cacheDir);

      if (result.success) {
        console.log(`  ${c.success('✓')} Cache cleared successfully\n`);
      } else {
        console.log(`  ${c.error('✗')} Failed to clear cache: ${result.error}\n`);
        process.exit(1);
      }
    });

  program
    .command('cache:status')
    .description('Show cache statistics')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--global', 'Show global cache instead of project cache')
    .action(async (opts) => {
      printLogo();
      console.log(`\n${c.bold('📊 CACHE STATUS')}\n`);

      let cacheDir: string;
      if (opts.global) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
        cacheDir = join(homeDir, '.guardrail', 'cache');
      } else {
        cacheDir = getCacheDir(opts.path);
      }

      const stats = getCacheStats(cacheDir);

      console.log(`  ${c.dim('Path:')} ${cacheDir}`);
      console.log(`  ${c.dim('Exists:')} ${stats.exists ? c.success('yes') : c.warning('no')}`);
      console.log(`  ${c.dim('Files:')} ${stats.fileCount}`);
      console.log(`  ${c.dim('Total size:')} ${formatBytes(stats.totalSize)}\n`);

      if (stats.files.length > 0) {
        console.log(`  ${c.bold('Cached files:')}\n`);
        for (const file of stats.files) {
          const age = Date.now() - file.modified.getTime();
          const ageHours = Math.floor(age / (1000 * 60 * 60));
          const ageStr = ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;
          
          console.log(`  ${c.info('•')} ${file.name}`);
          console.log(`    ${c.dim('Size:')} ${formatBytes(file.size)} | ${c.dim('Modified:')} ${ageStr}`);
        }
        console.log('');
      }

      // Show TTL info
      console.log(`  ${c.dim('Cache TTL:')} 24 hours`);
      console.log(`  ${c.dim('Tip:')} Use ${c.bold('--no-cache')} flag to bypass cache\n`);
    });
}
