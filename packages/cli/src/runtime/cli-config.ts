import { join } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';

export interface CliConfig {
  apiKey?: string;
  tier?: 'free' | 'starter' | 'pro' | 'enterprise';
  email?: string;
  authenticatedAt?: string;
  lastProjectPath?: string;
  lastScanType?: 'all' | 'secrets' | 'vulnerabilities' | 'compliance';
  lastFormat?: 'table' | 'json' | 'sarif' | 'markdown';
  lastFramework?: 'soc2' | 'gdpr' | 'hipaa' | 'pci' | 'iso27001' | 'nist';
  lastUrl?: string;
  lastFlow?: 'auth' | 'checkout' | 'dashboard';
  lastProfile?: 'quick' | 'full' | 'ship' | 'ci';
}

const CONFIG_DIR = join(process.env.HOME || process.env.USERPROFILE || '.', '.guardrail');
export const CONFIG_FILE = join(CONFIG_DIR, 'credentials.json');

export function loadConfig(): CliConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as CliConfig;
    }
  } catch {
    // Config file doesn't exist or is invalid
  }
  return {};
}

export function saveConfig(config: CliConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function isInteractiveAllowed(argv: string[]): boolean {
  if (process.env.GUARDRAIL_NO_INTERACTIVE === '1') return false;
  if (argv.includes('--no-interactive')) return false;
  if (process.env.CI) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function defaultReportPath(projectPath: string, kind: string, ext: string): string {
  const dir = join(projectPath, '.guardrail', 'reports');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${kind}-${nowStamp()}.${ext}`);
}
