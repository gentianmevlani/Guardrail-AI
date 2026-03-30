/**
 * Verification Layer Types
 * Defines all types for the Prompt Firewall + Output Verification system
 */

import {
  stripeSkLiveRegex24,
  stripeSkTestRegex24,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';

export type VerificationMode = 'build' | 'explore' | 'ship';

export interface StrictAgentOutput {
  format: 'guardrail-v1';
  diff: string;
  commands?: string[];
  tests?: string[];
  notes?: string;
  error?: string;
}

export interface VerificationContext {
  projectRoot: string;
  mode: VerificationMode;
  strict: boolean;
  runTests: boolean;
  allowedPaths?: string[];
  scopeLock?: ScopeLock;
}

export interface ScopeLock {
  allowedPaths: string[];
  allowedCommands: string[];
  maxFiles: number;
  maxLinesChanged: number;
}

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  check: string;
  status: CheckStatus;
  message: string;
  details?: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
  blockers?: string[];
}

export interface VerificationResult {
  success: boolean;
  checks: CheckResult[];
  blockers: string[];
  warnings: string[];
  failureContext?: string;
  parsedOutput?: StrictAgentOutput;
  appliedDiff?: boolean;
}

export interface RepoFingerprint {
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | null;
  framework: string | null;
  monorepoTool: 'turbo' | 'nx' | 'lerna' | 'rush' | null;
  testRunner: 'jest' | 'vitest' | 'mocha' | 'ava' | null;
  linter: 'eslint' | 'biome' | 'tslint' | null;
  typescript: boolean;
  scripts: Record<string, string>;
  hasGit: boolean;
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
}

export interface CommandExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface WorkspaceInfo {
  tempDir: string;
  isWorktree: boolean;
  cleanup: () => Promise<void>;
}

export const FORMAT_RETRY_PROMPT = `Your response was not in the required format. Please respond with ONLY valid JSON in this exact structure:

{
  "format": "guardrail-v1",
  "diff": "<unified diff for ALL file changes>",
  "commands": ["optional array of commands to run"],
  "tests": ["optional array of test commands"],
  "notes": "optional notes"
}

If you cannot provide the requested changes, respond with:
{ "format": "guardrail-v1", "error": "reason why you cannot provide the changes" }

Do NOT include any markdown fencing, explanations, or text outside the JSON object.`;

export const DIFF_FORMAT_RETRY_PROMPT = `Your diff is malformed. The diff field must be a valid unified diff containing:
- File headers starting with "diff --git a/path b/path"
- Old file marker "--- a/path" or "--- /dev/null" for new files
- New file marker "+++ b/path"
- Hunk headers like "@@ -start,count +start,count @@"
- Lines prefixed with " " (context), "+" (addition), or "-" (deletion)

Please regenerate your response with a properly formatted unified diff.`;

export const PROTECTED_PATHS = [
  '.git',
  '.git/',
  'node_modules',
  'node_modules/',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
];

export const DANGEROUS_COMMANDS = [
  'rm -rf',
  'rm -r /',
  'rmdir /s',
  'del /f /s /q',
  'sudo',
  'chmod 777',
  'curl | bash',
  'curl | sh',
  'wget | bash',
  'wget | sh',
  '> /dev/sd',
  'mkfs',
  'dd if=',
  ':(){:|:&};:',
  'format c:',
  'rd /s /q',
];

export const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'critical' | 'high' | 'medium' }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{15,16}/g, severity: 'critical' },
  { name: 'AWS Secret Key', pattern: /["']([A-Za-z0-9/+=]{40})["']/g, severity: 'critical' },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: 'critical' },
  { name: 'GitHub OAuth', pattern: /gho_[A-Za-z0-9_]{36,}/g, severity: 'critical' },
  { name: 'Generic API Key', pattern: /['"][a-zA-Z0-9_-]*(?:api[_-]?key|apikey)['"][\s]*[:=][\s]*['"]([a-zA-Z0-9_-]{16,})['"]/gi, severity: 'high' },
  { name: 'Bearer Token', pattern: /bearer\s+[a-zA-Z0-9_.~+/-]+=*/gi, severity: 'high' },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'critical' },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g, severity: 'critical' },
  { name: 'Stripe Key', pattern: stripeSkLiveRegex24(), severity: 'critical' },
  { name: 'Stripe Test Key', pattern: stripeSkTestRegex24(), severity: 'medium' },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g, severity: 'high' },
  { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, severity: 'high' },
  { name: 'Database URL', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, severity: 'critical' },
  { name: 'Hardcoded Password', pattern: /(?:password|passwd|pwd)[\s]*[:=][\s]*['"]([^'"]{8,})['"]/gi, severity: 'high' },
];

export const STUB_PATTERNS: Array<{ name: string; pattern: RegExp; intentAware: boolean }> = [
  { name: 'TODO comment', pattern: /\/\/\s*TODO[:\s]/gi, intentAware: true },
  { name: 'FIXME comment', pattern: /\/\/\s*FIXME[:\s]/gi, intentAware: true },
  { name: 'Placeholder function', pattern: /throw new Error\(['"]not implemented['"]\)/gi, intentAware: false },
  { name: 'Console placeholder', pattern: /console\.log\(['"]placeholder['"]\)/gi, intentAware: false },
  { name: 'Mock data object', pattern: /(?:const|let|var)\s+\w*[Mm]ock\w*\s*=/g, intentAware: true },
  { name: 'Fake data', pattern: /['"]fake[_-]?[^'"]*['"]/gi, intentAware: false },
  { name: 'Lorem ipsum', pattern: /lorem\s+ipsum/gi, intentAware: false },
  { name: 'Test email', pattern: /test@(?:test|example)\.com/gi, intentAware: true },
  { name: 'Hardcoded localhost', pattern: /['"]http:\/\/localhost:\d+['"]/g, intentAware: true },
  { name: 'Empty implementation', pattern: /{\s*\/\/\s*empty\s*}/gi, intentAware: false },
  { name: 'Pass statement', pattern: /^\s*pass\s*$/gm, intentAware: true },
  { name: 'NotImplementedError', pattern: /raise NotImplementedError/g, intentAware: false },
  { name: 'Unimplemented panic', pattern: /unimplemented!\(\)/g, intentAware: false },
  { name: 'Todo panic', pattern: /todo!\(\)/g, intentAware: false },
];
