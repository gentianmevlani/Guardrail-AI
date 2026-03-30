/**
 * Exec Utils
 * Safe command execution with timeouts and output capture
 */

import { spawn, SpawnOptions } from 'child_process';
import { CommandExecResult } from './types';

interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Execute a command with timeout and output capture
 */
export function execCommandWithTimeout(
  command: string,
  options: ExecOptions = {}
): Promise<CommandExecResult> {
  const { cwd, timeoutMs = 30000, env } = options;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let resolved = false;

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const spawnOptions: SpawnOptions = {
      cwd,
      env: env || process.env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    const proc = spawn(shell, shellArgs, spawnOptions);

    const timeoutHandle = setTimeout(() => {
      if (!resolved) {
        timedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!resolved) {
            proc.kill('SIGKILL');
          }
        }, 1000);
      }
    }, timeoutMs);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
      // Limit output size to prevent memory issues
      if (stdout.length > 1024 * 1024) {
        stdout = stdout.substring(stdout.length - 512 * 1024);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      if (stderr.length > 1024 * 1024) {
        stderr = stderr.substring(stderr.length - 512 * 1024);
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);
        resolve({
          exitCode: code ?? (timedOut ? 124 : 1),
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timedOut,
        });
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutHandle);
        resolve({
          exitCode: 1,
          stdout: '',
          stderr: err.message,
          timedOut: false,
        });
      }
    });
  });
}

/**
 * Execute a command (convenience wrapper)
 */
export async function execCommand(
  command: string,
  cwd?: string
): Promise<CommandExecResult> {
  return execCommandWithTimeout(command, { cwd });
}

/**
 * Check if a command exists
 */
export async function commandExists(command: string): Promise<boolean> {
  const isWindows = process.platform === 'win32';
  const checkCmd = isWindows ? `where ${command}` : `which ${command}`;

  const result = await execCommandWithTimeout(checkCmd, { timeoutMs: 5000 });
  return result.exitCode === 0;
}

/**
 * Get git version
 */
export async function getGitVersion(): Promise<string | null> {
  const result = await execCommandWithTimeout('git --version', { timeoutMs: 5000 });
  if (result.exitCode === 0) {
    const match = result.stdout.match(/git version (\d+\.\d+\.\d+)/);
    return match ? match[1] : result.stdout;
  }
  return null;
}

/**
 * Check if we're in a git repository
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execCommandWithTimeout('git rev-parse --git-dir', {
    cwd,
    timeoutMs: 5000,
  });
  return result.exitCode === 0;
}
