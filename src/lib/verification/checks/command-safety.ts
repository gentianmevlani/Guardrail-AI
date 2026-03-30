/**
 * Command Safety Check
 * Validates commands for dangerous operations
 */

import { CheckResult, DANGEROUS_COMMANDS } from '../types';

/**
 * Check if a command contains dangerous patterns
 */
function isDangerousCommand(command: string): { dangerous: boolean; pattern?: string } {
  const normalized = command.toLowerCase().trim();

  for (const dangerous of DANGEROUS_COMMANDS) {
    const dangerousLower = dangerous.toLowerCase();
    if (normalized.includes(dangerousLower)) {
      return { dangerous: true, pattern: dangerous };
    }
  }

  // Additional pattern checks
  const dangerousPatterns: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /rm\s+(-[rf]+\s+)*[\/~]/, description: 'rm with root/home path' },
    { pattern: />\s*\/dev\/sd[a-z]/, description: 'write to disk device' },
    { pattern: /chmod\s+[0-7]*7[0-7]*/, description: 'chmod with world-writable' },
    { pattern: /curl\s+.*\|\s*(ba)?sh/, description: 'curl pipe to shell' },
    { pattern: /wget\s+.*\|\s*(ba)?sh/, description: 'wget pipe to shell' },
    { pattern: /eval\s*\(.*\$/, description: 'eval with variable expansion' },
    { pattern: /\$\(.*rm\s/, description: 'command substitution with rm' },
    { pattern: /`.*rm\s/, description: 'backtick substitution with rm' },
    { pattern: /powershell.*-enc/, description: 'encoded PowerShell command' },
    { pattern: /iex\s*\(/, description: 'PowerShell Invoke-Expression' },
  ];

  for (const { pattern, description } of dangerousPatterns) {
    if (pattern.test(normalized)) {
      return { dangerous: true, pattern: description };
    }
  }

  return { dangerous: false };
}

/**
 * Check if command modifies system state in potentially harmful ways
 */
function isSystemModifyingCommand(command: string): boolean {
  const systemCommands = [
    'apt-get',
    'apt',
    'yum',
    'dnf',
    'brew',
    'choco',
    'winget',
    'npm install -g',
    'pnpm add -g',
    'yarn global',
    'pip install',
    'gem install',
    'cargo install',
    'go install',
    'systemctl',
    'service',
    'launchctl',
    'reboot',
    'shutdown',
    'init',
    'kill -9',
    'pkill',
    'killall',
  ];

  const normalized = command.toLowerCase();
  return systemCommands.some(cmd => normalized.includes(cmd));
}

/**
 * Validate a single command
 */
export function validateCommand(command: string): CheckResult {
  if (typeof command !== 'string') {
    return {
      check: 'command-safety',
      status: 'fail',
      message: 'Invalid command: not a string',
      suggestedFix: 'Provide valid commands as strings',
    };
  }

  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return {
      check: 'command-safety',
      status: 'pass',
      message: 'Empty command (skipped)',
    };
  }

  // Check for dangerous patterns
  const dangerCheck = isDangerousCommand(trimmed);
  if (dangerCheck.dangerous) {
    return {
      check: 'command-safety',
      status: 'fail',
      message: `Dangerous command detected: "${trimmed}"`,
      details: `Matched dangerous pattern: ${dangerCheck.pattern}`,
      suggestedFix: 'Remove or replace the dangerous command with a safe alternative',
    };
  }

  // Warn about system-modifying commands
  if (isSystemModifyingCommand(trimmed)) {
    return {
      check: 'command-safety',
      status: 'warn',
      message: `System-modifying command detected: "${trimmed}"`,
      details: 'This command may modify system state outside the project',
      suggestedFix: 'Consider if this command is necessary and safe for the current context',
    };
  }

  return {
    check: 'command-safety',
    status: 'pass',
    message: `Command is safe: ${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}`,
  };
}

/**
 * Validate multiple commands
 */
export function validateCommands(commands: string[]): CheckResult {
  if (!commands || !Array.isArray(commands)) {
    return {
      check: 'command-safety',
      status: 'pass',
      message: 'No commands to validate',
    };
  }

  if (commands.length === 0) {
    return {
      check: 'command-safety',
      status: 'pass',
      message: 'No commands to validate',
    };
  }

  const failures: CheckResult[] = [];
  const warnings: CheckResult[] = [];

  for (const cmd of commands) {
    const result = validateCommand(cmd);
    if (result.status === 'fail') {
      failures.push(result);
    } else if (result.status === 'warn') {
      warnings.push(result);
    }
  }

  if (failures.length > 0) {
    return {
      check: 'command-safety',
      status: 'fail',
      message: `${failures.length} dangerous command(s) detected`,
      details: failures.map(f => f.message).join('\n'),
      blockers: failures.map(f => f.message),
      suggestedFix: 'Remove or replace all dangerous commands',
    };
  }

  if (warnings.length > 0) {
    return {
      check: 'command-safety',
      status: 'warn',
      message: `${warnings.length} system-modifying command(s) detected`,
      details: warnings.map(w => w.message).join('\n'),
    };
  }

  return {
    check: 'command-safety',
    status: 'pass',
    message: `All ${commands.length} command(s) validated`,
  };
}

/**
 * Get safe command alternatives
 */
export function getSafeAlternative(dangerousCommand: string): string | null {
  const alternatives: Record<string, string> = {
    'rm -rf /': 'Do not delete root directory',
    'rm -rf ~': 'Do not delete home directory',
    'sudo': 'Run without sudo or use project-local tools',
    'chmod 777': 'Use chmod 755 or more restrictive permissions',
    'curl | bash': 'Download file first, inspect, then run',
  };

  const normalized = dangerousCommand.toLowerCase();
  for (const [pattern, alternative] of Object.entries(alternatives)) {
    if (normalized.includes(pattern.toLowerCase())) {
      return alternative;
    }
  }

  return null;
}
