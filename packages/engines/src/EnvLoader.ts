/**
 * EnvLoader — Pure Node.js env var loader for CLI / GitHub Action use.
 * Implements IEnvIndex — same interface consumed by EnvVarEngine.
 * No VS Code dependencies; no file watchers.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IEnvIndex } from './core-types';

const PLATFORM_VARS = new Set([
  'NODE_ENV', 'PORT', 'HOST', 'DATABASE_URL', 'REDIS_URL',
  'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'VERCEL',
  'RAILWAY_STATIC_URL', 'HEROKU', 'RENDER', 'FLY_APP_NAME',
]);

/** Example/sample env file names — not real .env files with secrets */
const EXAMPLE_ONLY_FILES = new Set([
  '.env.example', '.env.sample', '.env.template',
  '.env.production.template', '.env.development.template',
]);

export class EnvLoader implements IEnvIndex {
  private _index: Set<string> = new Set([...PLATFORM_VARS]);
  /**
   * True when the only env definition files found are .env.example / .env.sample / .env.template
   * (no actual .env, .env.local, .env.development, etc.). Consumers should use this to
   * demote findings to informational severity.
   */
  exampleOnly = false;
  /**
   * True when NO env files exist at all in the workspace (not even .env.example).
   * Consumers should skip all findings in this mode.
   */
  noEnvFiles = true;

  get index(): Set<string> { return this._index; }
  has(name: string): boolean { return this._index.has(name); }

  /** Load env vars from .env* files in workspaceRoot. Sync. */
  build(workspaceRoot: string, allowlistEnvVars?: string[]): void {
    this._index = new Set([...PLATFORM_VARS]);
    this.exampleOnly = false;
    this.noEnvFiles = true;

    if (Array.isArray(allowlistEnvVars)) {
      for (const v of allowlistEnvVars) {
        if (typeof v === 'string' && /^[A-Z_][A-Z0-9_]*$/.test(v)) this._index.add(v);
      }
    }

    const envFiles = [
      '.env', '.env.local', '.env.development', '.env.production',
      '.env.test', '.env.example', '.env.sample', '.env.template',
    ];

    let hasRealEnvFile = false;
    let hasAnyEnvFile = false;

    for (const f of envFiles) {
      try {
        const content = fs.readFileSync(path.join(workspaceRoot, f), 'utf-8');
        hasAnyEnvFile = true;
        if (!EXAMPLE_ONLY_FILES.has(f)) {
          hasRealEnvFile = true;
        }
        for (const line of content.split('\n')) {
          const m = line.trim().match(/^([A-Z_][A-Z0-9_]*)=/);
          if (m) this._index.add(m[1]!);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'EACCES') {
          process.stderr.write(`[guardrail] Permission denied: ${path.join(workspaceRoot, f)}\n`);
        }
      }
    }

    // Track whether any env files exist at all
    if (hasAnyEnvFile) {
      this.noEnvFiles = false;
    }

    // If we found env files but none of them are "real" .env files, mark as example-only
    if (hasAnyEnvFile && !hasRealEnvFile) {
      this.exampleOnly = true;
    }

    // GitHub Actions workflow env: blocks
    const workflowsDir = path.join(workspaceRoot, '.github', 'workflows');
    if (fs.existsSync(workflowsDir)) {
      for (const f of fs.readdirSync(workflowsDir)) {
        if (!f.endsWith('.yml') && !f.endsWith('.yaml')) continue;
        try {
          const content = fs.readFileSync(path.join(workflowsDir, f), 'utf-8');
          const matches = content.match(/([A-Z_][A-Z0-9_]*):/g) ?? [];
          matches.forEach(v => this._index.add(v.replace(':', '')));
        } catch (err) {
          if ((err as NodeJS.ErrnoException)?.code === 'EACCES') {
            process.stderr.write(`[guardrail] Permission denied: ${path.join(workflowsDir, f)}\n`);
          }
        }
      }
    }
  }
}
