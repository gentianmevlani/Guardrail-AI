/**
 * guardrail watch
 *
 * Continuous scanning during development.
 * Watches for file changes, runs incremental scans,
 * shows inline results with a persistent status bar.
 * Think Vitest watch mode, but for code integrity.
 */

import { Command } from 'commander';
import { resolve, relative, basename } from 'path';
import { styles, icons } from '../ui';
import { renderCompactVerdict } from '../ui/summary';
import { printLogo } from '../ui';
import { ExitCode } from '../runtime/exit-codes';
import { validateProjectPath } from './shared';
import { RealitySniffScanner } from '../scan/reality-sniff';
import { VerificationEngine } from '../scan/verification-engine';

interface WatchState {
  totalFindings: number;
  score: number;
  lastScanMs: number;
  lastScanTime: Date;
  filesScanned: number;
}

function clearScreen(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

function printWatchHeader(projectName: string): void {
  console.log(
    `\n  ${styles.brightCyan}${styles.bold}${icons.scan} GUARDRAIL WATCH${styles.reset} ${styles.dim}— ${projectName}${styles.reset}`
  );
  console.log(`  ${styles.dim}Watching for changes... (press q to quit)${styles.reset}\n`);
}

function printStatusBar(state: WatchState): void {
  const timeAgo = getTimeAgo(state.lastScanTime);
  const verdict = state.totalFindings === 0 ? 'PASS' :
                  state.totalFindings <= 3 ? 'WARN' : 'FAIL';
  const line = renderCompactVerdict(verdict, state.score, state.totalFindings, state.lastScanMs);

  console.log('');
  console.log(`${styles.dim}${'─'.repeat(60)}${styles.reset}`);
  console.log(line);
  console.log(`  ${styles.dim}${state.filesScanned} files | last scan ${timeAgo}${styles.reset}`);
  console.log(`${styles.dim}${'─'.repeat(60)}${styles.reset}`);
}

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3600_000)}h ago`;
}

function printFinding(
  file: string,
  line: number,
  type: string,
  severity: string,
  projectPath: string,
): void {
  const relPath = relative(projectPath, file) || file;
  const sevColor = severity === 'critical' ? '\x1b[91m' :
                   severity === 'high' ? styles.brightMagenta :
                   severity === 'medium' ? styles.brightYellow :
                   styles.dim;
  const sevLabel = severity.toUpperCase().padEnd(8);

  console.log(
    `  ${sevColor}${icons.error}${styles.reset} ${sevColor}${sevLabel}${styles.reset} ${styles.dim}${relPath}:${line}${styles.reset}`
  );
  console.log(
    `             ${type}`
  );
}

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Continuous scanning — watch for changes, scan incrementally')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--debounce <ms>', 'Debounce interval in ms', '1000')
    .option('--clear', 'Clear screen between scans', true)
    .action(async (options) => {
      const projectPath = validateProjectPath(options.path);
      const projectName = basename(projectPath);
      const debounceMs = Math.max(200, Math.min(parseInt(options.debounce) || 1000, 30_000));

      printLogo();
      printWatchHeader(projectName);

      const state: WatchState = {
        totalFindings: 0,
        score: 100,
        lastScanMs: 0,
        lastScanTime: new Date(),
        filesScanned: 0,
      };

      // Run initial full scan
      console.log(`  ${styles.dim}Running initial scan...${styles.reset}`);
      await runScan(projectPath, state, options.clear, true);

      // Start file watcher
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let pendingFiles = new Set<string>();

      try {
        const chokidar = await import('chokidar');
        const watcher = chokidar.watch(projectPath, {
          ignored: [
            /(^|[/\\])\./,
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.guardrail/**',
          ],
          persistent: true,
          ignoreInitial: true,
        });

        watcher.on('change', (filePath) => {
          if (!isSourceFile(filePath)) return;
          pendingFiles.add(filePath);

          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            const files = Array.from(pendingFiles);
            pendingFiles.clear();

            if (options.clear) clearScreen();
            printWatchHeader(projectName);

            const relFiles = files.map(f => relative(projectPath, f));
            console.log(
              `  ${styles.brightCyan}${icons.refresh}${styles.reset} ${styles.dim}Changed:${styles.reset} ${relFiles.join(', ')}\n`
            );

            await runScan(projectPath, state, false, false);
          }, debounceMs);
        });

        // Listen for quit
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', (key: Buffer | string) => {
            const ch = typeof key === 'string' ? key : key.toString('utf8');
            if (ch === 'q' || ch === '\u0003') {
              // q or Ctrl+C
              console.log(`\n  ${styles.dim}Stopping watch mode...${styles.reset}\n`);
              watcher.close();
              process.exit(ExitCode.SUCCESS);
            }
          });
        } else {
          // Non-TTY: keep alive until SIGINT
          process.on('SIGINT', () => {
            console.log(`\n  ${styles.dim}Stopping watch mode...${styles.reset}\n`);
            watcher.close();
            process.exit(ExitCode.SUCCESS);
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(
          `  ${styles.brightRed}${icons.error}${styles.reset} File watcher unavailable: ${msg}`
        );
        console.log(
          `  ${styles.dim}Install chokidar: npm i -D chokidar${styles.reset}\n`
        );
        process.exit(ExitCode.SYSTEM_ERROR);
      }
    });
}

function isSourceFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|go|rs)$/.test(filePath);
}

async function runScan(
  projectPath: string,
  state: WatchState,
  _showClear: boolean,
  isInitial: boolean,
): Promise<void> {
  const startTime = performance.now();

  try {
    const scanner = new RealitySniffScanner();
    const sniffResult = await scanner.scan(projectPath, {
      exclude: ['node_modules', '.git', 'dist', 'build', '.next'],
      includeTests: false,
    });

    const verifier = new VerificationEngine();
    const verified = await Promise.all(
      sniffResult.findings.map(f =>
        verifier.verify(f, { enableStructural: true, enableRuntime: false })
      )
    );

    const elapsed = Math.round(performance.now() - startTime);

    // Update state
    state.totalFindings = verified.length;
    state.score = sniffResult.summary.totalScore;
    state.lastScanMs = elapsed;
    state.lastScanTime = new Date();
    state.filesScanned = sniffResult.summary.filesScanned ?? 0;

    // Show findings
    if (verified.length > 0) {
      const label = isInitial ? 'Initial scan' : 'Scan';
      console.log(`  ${styles.bold}${label}: ${verified.length} issue${verified.length === 1 ? '' : 's'} found${styles.reset}\n`);

      for (const vf of verified.slice(0, 10)) {
        printFinding(
          vf.finding.file,
          vf.finding.line,
          vf.finding.type,
          vf.finding.severity,
          projectPath,
        );
      }

      if (verified.length > 10) {
        console.log(
          `\n  ${styles.dim}... and ${verified.length - 10} more${styles.reset}`
        );
      }
    } else {
      console.log(
        `  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}All clear${styles.reset} — no issues found`
      );
    }

    printStatusBar(state);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      `  ${styles.brightRed}${icons.error}${styles.reset} Scan error: ${msg}`
    );
  }
}
