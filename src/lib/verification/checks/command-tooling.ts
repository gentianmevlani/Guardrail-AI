/**
 * Command Tooling Check
 * Validates commands match the project's detected tooling
 */

import { CheckResult, RepoFingerprint } from '../types';

interface ToolingValidation {
  valid: boolean;
  issue?: string;
  suggestion?: string;
}

/**
 * Validate package manager command matches project
 */
function validatePackageManager(
  command: string,
  fingerprint: RepoFingerprint
): ToolingValidation {
  const pmCommands: Record<string, string[]> = {
    npm: ['npm install', 'npm run', 'npm test', 'npm ci', 'npx'],
    pnpm: ['pnpm install', 'pnpm run', 'pnpm test', 'pnpm add', 'pnpm exec', 'pnpx'],
    yarn: ['yarn install', 'yarn run', 'yarn test', 'yarn add'],
    bun: ['bun install', 'bun run', 'bun test', 'bun add', 'bunx'],
  };

  if (!fingerprint.packageManager) {
    return { valid: true };
  }

  const commandLower = command.toLowerCase();
  const detectedPm = fingerprint.packageManager;

  // Check if command uses a different package manager
  for (const [pm, pmCmds] of Object.entries(pmCommands)) {
    if (pm === detectedPm) continue;

    for (const pmCmd of pmCmds) {
      if (commandLower.startsWith(pmCmd.toLowerCase())) {
        const correctCmd = pmCmds[pmCommands[detectedPm].indexOf(pmCmd)] || pmCommands[detectedPm][0];
        return {
          valid: false,
          issue: `Command uses ${pm} but project uses ${detectedPm}`,
          suggestion: `Use ${detectedPm} instead: ${command.replace(new RegExp(`^${pm}`, 'i'), detectedPm)}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate test runner command matches project
 */
function validateTestRunner(
  command: string,
  fingerprint: RepoFingerprint
): ToolingValidation {
  const testRunners: Record<string, string[]> = {
    jest: ['jest', 'npx jest', 'pnpm jest', 'yarn jest'],
    vitest: ['vitest', 'npx vitest', 'pnpm vitest'],
    mocha: ['mocha', 'npx mocha'],
    ava: ['ava', 'npx ava'],
  };

  if (!fingerprint.testRunner) {
    return { valid: true };
  }

  const commandLower = command.toLowerCase();
  const detectedRunner = fingerprint.testRunner;

  for (const [runner, runnerCmds] of Object.entries(testRunners)) {
    if (runner === detectedRunner) continue;

    for (const runnerCmd of runnerCmds) {
      if (commandLower.includes(runnerCmd.toLowerCase()) && !commandLower.includes(detectedRunner)) {
        return {
          valid: false,
          issue: `Command uses ${runner} but project uses ${detectedRunner}`,
          suggestion: `Use ${detectedRunner} instead`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate monorepo tool usage
 */
function validateMonorepoTool(
  command: string,
  fingerprint: RepoFingerprint
): ToolingValidation {
  if (!fingerprint.monorepoTool) {
    return { valid: true };
  }

  const commandLower = command.toLowerCase();
  const tool = fingerprint.monorepoTool;

  // If monorepo tool detected but command doesn't use it for multi-package operations
  const multiPackagePatterns = [
    /--filter\s+/,
    /--scope\s+/,
    /-w\s+/,
    /workspace/,
  ];

  const isMultiPackageCmd = multiPackagePatterns.some(p => p.test(commandLower));
  const usesMonorepoTool = commandLower.includes(tool);

  // Warn if running commands across packages without the monorepo tool
  if (
    isMultiPackageCmd &&
    !usesMonorepoTool &&
    (commandLower.includes('npm run') || commandLower.includes('pnpm run') || commandLower.includes('yarn'))
  ) {
    return {
      valid: true,
      issue: `Consider using ${tool} for multi-package commands`,
      suggestion: `Use "${tool} run" for better caching and parallelization`,
    };
  }

  return { valid: true };
}

/**
 * Validate command against package.json scripts
 */
function validateAgainstScripts(
  command: string,
  fingerprint: RepoFingerprint
): ToolingValidation {
  if (!fingerprint.scripts || Object.keys(fingerprint.scripts).length === 0) {
    return { valid: true };
  }

  const commandLower = command.toLowerCase();
  const pm = fingerprint.packageManager || 'npm';

  // Extract script name if it's a run command
  const runMatch = commandLower.match(new RegExp(`(?:${pm}|npx|pnpm|yarn|bun)\\s+(?:run\\s+)?(\\w+)`));
  if (!runMatch) {
    return { valid: true };
  }

  const scriptName = runMatch[1];
  const knownScripts = Object.keys(fingerprint.scripts).map(s => s.toLowerCase());

  // Check if it's a known npm lifecycle script
  const lifecycleScripts = ['test', 'build', 'start', 'dev', 'lint', 'format', 'prepare', 'prepublish'];
  if (lifecycleScripts.includes(scriptName) && !knownScripts.includes(scriptName)) {
    return {
      valid: true,
      issue: `Script "${scriptName}" not found in package.json`,
      suggestion: `Available scripts: ${Object.keys(fingerprint.scripts).join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate a command against project tooling
 */
export function validateCommandTooling(
  command: string,
  fingerprint: RepoFingerprint
): CheckResult {
  if (!command || typeof command !== 'string') {
    return {
      check: 'command-tooling',
      status: 'pass',
      message: 'No command to validate',
    };
  }

  const validations = [
    validatePackageManager(command, fingerprint),
    validateTestRunner(command, fingerprint),
    validateMonorepoTool(command, fingerprint),
    validateAgainstScripts(command, fingerprint),
  ];

  const failures = validations.filter(v => !v.valid);
  const warnings = validations.filter(v => v.valid && v.issue);

  if (failures.length > 0) {
    const failure = failures[0];
    return {
      check: 'command-tooling',
      status: 'fail',
      message: failure.issue || 'Command does not match project tooling',
      suggestedFix: failure.suggestion,
      details: `Command: ${command}\nProject uses: ${fingerprint.packageManager || 'unknown'} (package manager), ${fingerprint.testRunner || 'unknown'} (test runner)`,
    };
  }

  if (warnings.length > 0) {
    return {
      check: 'command-tooling',
      status: 'warn',
      message: warnings.map(w => w.issue).join('; '),
      suggestedFix: warnings.map(w => w.suggestion).filter(Boolean).join('; '),
    };
  }

  return {
    check: 'command-tooling',
    status: 'pass',
    message: 'Command matches project tooling',
  };
}

/**
 * Validate all commands against project tooling
 */
export function validateCommandsTooling(
  commands: string[],
  fingerprint: RepoFingerprint
): CheckResult {
  if (!commands || commands.length === 0) {
    return {
      check: 'command-tooling',
      status: 'pass',
      message: 'No commands to validate',
    };
  }

  const results = commands.map(cmd => validateCommandTooling(cmd, fingerprint));
  const failures = results.filter(r => r.status === 'fail');
  const warnings = results.filter(r => r.status === 'warn');

  if (failures.length > 0) {
    return {
      check: 'command-tooling',
      status: 'fail',
      message: `${failures.length} command(s) do not match project tooling`,
      details: failures.map(f => f.message).join('\n'),
      blockers: failures.map(f => f.message),
      suggestedFix: failures.map(f => f.suggestedFix).filter(Boolean).join('\n'),
    };
  }

  if (warnings.length > 0) {
    return {
      check: 'command-tooling',
      status: 'warn',
      message: `${warnings.length} command suggestion(s)`,
      details: warnings.map(w => w.message).join('\n'),
    };
  }

  return {
    check: 'command-tooling',
    status: 'pass',
    message: `All ${commands.length} command(s) match project tooling`,
  };
}
