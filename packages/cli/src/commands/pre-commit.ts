/**
 * guardrail pre-commit
 *
 * Ultra-fast staged-files-only scanner for git pre-commit hooks.
 * Only scans files in `git diff --cached`, not the entire project.
 * Designed to complete in <2 seconds for instant commit feedback.
 */

import { Command } from 'commander';
import { resolve, extname } from 'path';
import { execSync } from 'child_process';
import { styles, icons } from '../ui';
import { ExitCode } from '../runtime/exit-codes';
import { isGitRepo, withErrorHandler } from './shared';

/** Max staged file size to scan (skip large/binary files) */
const MAX_FILE_SIZE = 512 * 1024; // 512 KB

/** File extensions we should scan */
const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb',
  '.env', '.yml', '.yaml', '.json', '.toml',
]);

interface StagedFinding {
  file: string;
  line: number;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

/**
 * Get list of staged files from git.
 */
function getStagedFiles(projectPath: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return output
      .trim()
      .split('\n')
      .filter(f => f.length > 0)
      .filter(f => SCANNABLE_EXTENSIONS.has(extname(f).toLowerCase()));
  } catch {
    return [];
  }
}

/**
 * Get the staged content of a file (what will actually be committed).
 * Returns null if file is binary, too large, or unreadable.
 */
function getStagedContent(projectPath: string, filePath: string): string | null {
  try {
    const content = execSync(`git show ":${filePath}"`, {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
      maxBuffer: MAX_FILE_SIZE,
    });

    // Skip binary content (contains null bytes)
    if (content.includes('\0')) return null;

    return content;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FAST INLINE SCANNERS (no AST, pure regex for speed)
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_PATTERNS: Array<{ pattern: RegExp; type: string; severity: StagedFinding['severity'] }> = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`]([A-Za-z0-9_\-]{20,})['"`]/gi, type: 'API key', severity: 'critical' },
  { pattern: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"`]([^\s'"`]{8,})['"`]/gi, type: 'Hardcoded secret', severity: 'critical' },
  { pattern: /(?:sk|pk)[-_](?:live|test|prod)[_-][A-Za-z0-9]{20,}/g, type: 'Stripe key', severity: 'critical' },
  { pattern: /ghp_[A-Za-z0-9]{36,}/g, type: 'GitHub token', severity: 'critical' },
  { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, type: 'AWS key', severity: 'critical' },
  { pattern: /xox[bpas]-[A-Za-z0-9-]{10,}/g, type: 'Slack token', severity: 'critical' },
];

const MOCK_PATTERNS: Array<{ pattern: RegExp; type: string; severity: StagedFinding['severity'] }> = [
  { pattern: /['"`](?:test|example|fake|dummy|placeholder)@(?:example\.com|test\.com|fake\.com)['"`]/gi, type: 'Mock email', severity: 'medium' },
  { pattern: /['"`](?:https?:\/\/)?(?:example\.com|localhost:\d{4}|127\.0\.0\.1)['"`]/gi, type: 'Mock URL', severity: 'medium' },
  { pattern: /(?:TODO|FIXME|HACK|XXX|PLACEHOLDER)[\s:]/gi, type: 'TODO/FIXME marker', severity: 'low' },
];

const AUTH_PATTERNS: Array<{ pattern: RegExp; type: string; severity: StagedFinding['severity'] }> = [
  { pattern: /(?:auth|authentication|authorization)\s*[:=]\s*(?:false|null|undefined|'none'|"none")/gi, type: 'Auth disabled', severity: 'high' },
  { pattern: /\.use\(\s*cors\(\s*\)\s*\)/g, type: 'Open CORS (no origin restriction)', severity: 'high' },
];

function scanContent(content: string, filePath: string): StagedFinding[] {
  const findings: StagedFinding[] = [];
  const lines = content.split('\n');

  // Skip test files
  if (/\.(test|spec|mock|fixture)\./i.test(filePath)) return findings;
  if (/\/__tests__\/|\/test\/|\/fixtures?\//i.test(filePath)) return findings;

  const patternGroups = [SECRET_PATTERNS, MOCK_PATTERNS, AUTH_PATTERNS];

  for (const patterns of patternGroups) {
    for (const { pattern, type, severity } of patterns) {
      // Clone regex to reset state for each file
      const re = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = re.exec(content)) !== null) {
        // Guard against catastrophic backtracking
        if (findings.length > 100) break;

        const beforeMatch = content.substring(0, match.index);
        const lineNum = beforeMatch.split('\n').length;

        // Skip if in comment
        const line = lines[lineNum - 1] || '';
        const trimmedLine = line.trimStart();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) continue;

        // Skip guardrail-ignore
        if (lineNum > 1) {
          const prevLine = (lines[lineNum - 2] || '').trim();
          if (prevLine.includes('guardrail-ignore')) continue;
        }

        findings.push({
          file: filePath,
          line: lineNum,
          type,
          severity,
          message: `${type} found in staged file`,
        });
      }
    }
  }

  // Check .env files specifically
  if (/\.env($|\.)/.test(filePath) && !filePath.includes('.example') && !filePath.includes('.sample') && !filePath.includes('.template')) {
    findings.push({
      file: filePath,
      line: 1,
      type: 'Environment file staged',
      severity: 'critical',
      message: '.env file should not be committed — add to .gitignore',
    });
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────────────────────────────────────

export function registerPreCommitCommand(program: Command): void {
  program
    .command('pre-commit')
    .description('Fast staged-files-only scan for git hooks (<2s)')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--json', 'JSON output')
    .option('--strict', 'Fail on any finding (not just critical/high)')
    .action(async (options) => {
      const silent = Boolean(options.json);

      await withErrorHandler('pre-commit', async () => {
        const projectPath = resolve(options.path);
        const startTime = performance.now();

        // Must be in a git repo
        if (!isGitRepo(projectPath)) {
          if (!silent) {
            console.log(`  ${styles.dim}Not a git repository — skipping pre-commit scan${styles.reset}\n`);
          }
          process.exit(ExitCode.SUCCESS);
        }

        // Get staged files
        const stagedFiles = getStagedFiles(projectPath);

        if (stagedFiles.length === 0) {
          if (!silent) {
            console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} No staged files to scan\n`);
          }
          process.exit(ExitCode.SUCCESS);
        }

        if (!silent) {
          console.log(
            `\n  ${styles.brightCyan}${styles.bold}${icons.scan} PRE-COMMIT SCAN${styles.reset} ${styles.dim}(${stagedFiles.length} staged file${stagedFiles.length === 1 ? '' : 's'})${styles.reset}\n`,
          );
        }

        // Scan each staged file
        const allFindings: StagedFinding[] = [];

        for (const file of stagedFiles) {
          const content = getStagedContent(projectPath, file);
          if (!content) continue;
          const findings = scanContent(content, file);
          allFindings.push(...findings);
        }

        const elapsed = Math.round(performance.now() - startTime);

        // Output
        if (silent) {
          console.log(JSON.stringify({
            files: stagedFiles.length,
            findings: allFindings,
            elapsed,
            verdict: allFindings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'FAIL' : 'PASS',
          }, null, 2));
        } else if (allFindings.length === 0) {
          console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}All clear${styles.reset} — ${stagedFiles.length} files scanned ${styles.dim}(${elapsed}ms)${styles.reset}\n`);
        } else {
          const critical = allFindings.filter(f => f.severity === 'critical').length;
          const high = allFindings.filter(f => f.severity === 'high').length;

          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${allFindings.length} issue${allFindings.length === 1 ? '' : 's'} in staged files${styles.reset} ${styles.dim}(${elapsed}ms)${styles.reset}\n`);

          for (const finding of allFindings.slice(0, 15)) {
            const sev = finding.severity === 'critical' ? `${styles.brightRed}CRIT${styles.reset}` :
                        finding.severity === 'high' ? `${styles.brightMagenta}HIGH${styles.reset}` :
                        finding.severity === 'medium' ? `${styles.brightYellow}MED ${styles.reset}` :
                        `${styles.dim}LOW ${styles.reset}`;
            console.log(`  ${sev}  ${styles.dim}${finding.file}:${finding.line}${styles.reset}  ${finding.type}`);
          }

          if (allFindings.length > 15) {
            console.log(`\n  ${styles.dim}... and ${allFindings.length - 15} more${styles.reset}`);
          }

          console.log('');

          if (critical > 0 || high > 0) {
            console.log(`  ${styles.brightRed}${styles.bold}Commit blocked${styles.reset}: ${critical} critical, ${high} high severity findings`);
            console.log(`  ${styles.dim}Fix issues or use ${styles.bold}git commit --no-verify${styles.reset}${styles.dim} to skip (not recommended)${styles.reset}\n`);
          }
        }

        // Exit code
        const hasBlockers = allFindings.some(f => f.severity === 'critical' || f.severity === 'high');
        const hasAny = allFindings.length > 0;

        process.exit(
          (hasBlockers || (options.strict && hasAny))
            ? ExitCode.POLICY_FAIL
            : ExitCode.SUCCESS,
        );
      }, { silent })();
    });
}
