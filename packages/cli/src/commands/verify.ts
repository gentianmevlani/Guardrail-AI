/**
 * guardrail verify
 *
 * Post-deploy runtime verification.
 * Hits your live URL and checks that routes respond, auth is enforced,
 * no debug endpoints are exposed, and health checks pass.
 * Use in CI after deploy or manually after shipping.
 *
 * Usage:
 *   guardrail verify --url https://myapp.com
 *   guardrail verify --url https://staging.myapp.com --checks health,auth,routes
 */

import { Command } from 'commander';
import { styles, icons } from '../ui';
import { createSteps } from '../ui/progress';
import { printScanSummary, type ScanSummaryData } from '../ui/summary';
import { printLogo } from '../ui';
import { ExitCode } from '../runtime/exit-codes';
import { validateUrl, withErrorHandler } from './shared';

interface VerifyCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

async function httpGet(url: string, options?: { timeout?: number; headers?: Record<string, string> }): Promise<{
  status: number;
  body: string;
  headers: Record<string, string>;
  elapsed: number;
}> {
  const start = performance.now();
  const timeoutMs = options?.timeout ?? 10_000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: options?.headers,
      redirect: 'follow',
    });

    clearTimeout(timer);

    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });

    return {
      status: res.status,
      body,
      headers,
      elapsed: Math.round(performance.now() - start),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return {
      status: 0,
      body: msg,
      headers: {},
      elapsed: Math.round(performance.now() - start),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKS
// ─────────────────────────────────────────────────────────────────────────────

async function checkHealth(baseUrl: string): Promise<VerifyCheck> {
  const healthPaths = ['/health', '/healthz', '/api/health', '/_health', '/ping'];

  for (const path of healthPaths) {
    const res = await httpGet(`${baseUrl}${path}`, { timeout: 5000 });
    if (res.status >= 200 && res.status < 400) {
      return {
        name: 'Health endpoint',
        status: 'pass',
        detail: `${path} → ${res.status} (${res.elapsed}ms)`,
        severity: 'high',
      };
    }
  }

  return {
    name: 'Health endpoint',
    status: 'warn',
    detail: `No health endpoint found (tried: ${healthPaths.join(', ')})`,
    severity: 'medium',
  };
}

async function checkHomepage(baseUrl: string): Promise<VerifyCheck> {
  const res = await httpGet(baseUrl);

  if (res.status === 0) {
    return {
      name: 'Homepage reachable',
      status: 'fail',
      detail: `Cannot reach ${baseUrl}: ${res.body}`,
      severity: 'critical',
    };
  }

  if (res.status >= 500) {
    return {
      name: 'Homepage reachable',
      status: 'fail',
      detail: `${baseUrl} → ${res.status} server error (${res.elapsed}ms)`,
      severity: 'critical',
    };
  }

  if (res.status >= 400) {
    return {
      name: 'Homepage reachable',
      status: 'warn',
      detail: `${baseUrl} → ${res.status} (${res.elapsed}ms)`,
      severity: 'high',
    };
  }

  return {
    name: 'Homepage reachable',
    status: 'pass',
    detail: `${baseUrl} → ${res.status} (${res.elapsed}ms)`,
    severity: 'low',
  };
}

async function checkAuthEnforced(baseUrl: string): Promise<VerifyCheck> {
  // Try to access common protected routes without auth
  const protectedPaths = ['/api/admin', '/api/users', '/admin', '/dashboard', '/api/v1/me'];
  const failures: string[] = [];

  for (const path of protectedPaths) {
    const res = await httpGet(`${baseUrl}${path}`, { timeout: 5000 });
    // 200 on a protected route with no auth = bad
    if (res.status === 200) {
      // Check if it's actually returning data (not a login page redirect)
      const isLoginRedirect = res.body.includes('login') || res.body.includes('sign in') || res.body.includes('Sign In');
      if (!isLoginRedirect) {
        failures.push(`${path} → ${res.status} (accessible without auth)`);
      }
    }
  }

  if (failures.length > 0) {
    return {
      name: 'Auth enforcement',
      status: 'fail',
      detail: failures.join('; '),
      severity: 'critical',
    };
  }

  return {
    name: 'Auth enforcement',
    status: 'pass',
    detail: 'Protected routes return 401/403 or redirect to login',
    severity: 'low',
  };
}

async function checkSecurityHeaders(baseUrl: string): Promise<VerifyCheck> {
  const res = await httpGet(baseUrl);
  const missing: string[] = [];

  const expectedHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'strict-transport-security',
  ];

  for (const header of expectedHeaders) {
    if (!res.headers[header]) {
      missing.push(header);
    }
  }

  if (missing.length === expectedHeaders.length) {
    return {
      name: 'Security headers',
      status: 'fail',
      detail: `Missing all security headers: ${missing.join(', ')}`,
      severity: 'high',
    };
  }

  if (missing.length > 0) {
    return {
      name: 'Security headers',
      status: 'warn',
      detail: `Missing: ${missing.join(', ')}`,
      severity: 'medium',
    };
  }

  return {
    name: 'Security headers',
    status: 'pass',
    detail: 'All security headers present',
    severity: 'low',
  };
}

async function checkDebugEndpoints(baseUrl: string): Promise<VerifyCheck> {
  const debugPaths = [
    '/debug', '/_debug', '/api/debug',
    '/graphql', // Should require auth
    '/.env', '/env.json',
    '/phpinfo.php', '/server-info',
    '/api/test', '/_test',
  ];
  const exposed: string[] = [];

  for (const path of debugPaths) {
    const res = await httpGet(`${baseUrl}${path}`, { timeout: 3000 });
    if (res.status === 200 && res.body.length > 50) {
      exposed.push(`${path} → ${res.status}`);
    }
  }

  if (exposed.length > 0) {
    return {
      name: 'Debug endpoints',
      status: 'fail',
      detail: `Exposed: ${exposed.join('; ')}`,
      severity: 'critical',
    };
  }

  return {
    name: 'Debug endpoints',
    status: 'pass',
    detail: 'No debug endpoints accessible',
    severity: 'low',
  };
}

async function checkResponseTime(baseUrl: string): Promise<VerifyCheck> {
  const res = await httpGet(baseUrl);

  if (res.elapsed > 5000) {
    return {
      name: 'Response time',
      status: 'fail',
      detail: `Homepage took ${res.elapsed}ms (>5s)`,
      severity: 'high',
    };
  }

  if (res.elapsed > 2000) {
    return {
      name: 'Response time',
      status: 'warn',
      detail: `Homepage took ${res.elapsed}ms (>2s)`,
      severity: 'medium',
    };
  }

  return {
    name: 'Response time',
    status: 'pass',
    detail: `Homepage: ${res.elapsed}ms`,
    severity: 'low',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CHECKS = ['homepage', 'health', 'auth', 'headers', 'debug', 'response-time'] as const;

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Post-deploy verification — smoke test a live URL')
    .requiredOption('--url <url>', 'Base URL to verify (e.g. https://myapp.com)')
    .option('--checks <checks>', `Checks to run (comma-separated: ${ALL_CHECKS.join(',')})`, ALL_CHECKS.join(','))
    .option('--json', 'JSON output')
    .option('--timeout <ms>', 'Per-check timeout in ms', '10000')
    .action(async (options) => {
      const silent = Boolean(options.json);

      await withErrorHandler('verify', async () => {
      const startTime = performance.now();

      // Validate URL
      const baseUrl = validateUrl(options.url);

      if (!silent) {
        printLogo();
        console.log(`\n${styles.brightCyan}${styles.bold}  🌐 POST-DEPLOY VERIFICATION${styles.reset}`);
        console.log(`  ${styles.dim}${baseUrl}${styles.reset}\n`);
      }

      // Validate --checks input
      const requestedChecks = options.checks.split(',').map((c: string) => c.trim()).filter(Boolean);
      const validChecks = new Set(ALL_CHECKS as readonly string[]);
      const invalid = requestedChecks.filter((c: string) => !validChecks.has(c));
      if (invalid.length > 0 && !silent) {
        console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} Unknown checks ignored: ${invalid.join(', ')}\n`);
      }
      const selectedChecks = new Set(requestedChecks.filter((c: string) => validChecks.has(c)));
      const steps = createSteps(selectedChecks.size);
      const results: VerifyCheck[] = [];

      const checkMap: Record<string, () => Promise<VerifyCheck>> = {
        homepage: () => checkHomepage(baseUrl),
        health: () => checkHealth(baseUrl),
        auth: () => checkAuthEnforced(baseUrl),
        headers: () => checkSecurityHeaders(baseUrl),
        debug: () => checkDebugEndpoints(baseUrl),
        'response-time': () => checkResponseTime(baseUrl),
      };

      for (const checkName of ALL_CHECKS) {
        if (!selectedChecks.has(checkName)) continue;

        if (!silent) steps.start(checkName);
<<<<<<< HEAD
        const runner = checkMap[checkName];
        if (!runner) continue;
        const result = await runner();
=======
        const result = await checkMap[checkName]();
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
        results.push(result);

        if (!silent) {
          if (result.status === 'pass') steps.complete(`${result.name}: ${result.detail}`);
          else if (result.status === 'warn') steps.complete(`${result.name}: ${styles.brightYellow}${result.detail}${styles.reset}`);
          else if (result.status === 'fail') steps.fail(`${result.name}: ${result.detail}`);
          else steps.skip(result.name);
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      const critical = results.filter(r => r.status === 'fail' && r.severity === 'critical').length;
      const high = results.filter(r => r.status === 'fail' && r.severity === 'high').length;
      const medium = results.filter(r => r.status === 'warn').length;
      const passed = results.filter(r => r.status === 'pass').length;
      const total = results.length;

      const verdict = critical > 0 ? 'FAIL' : high > 0 ? 'WARN' : 'PASS';

      if (options.json) {
        console.log(JSON.stringify({
          url: baseUrl,
          verdict,
          checks: results,
          summary: { total, passed, critical, high, medium },
          elapsed,
        }, null, 2));
      } else {
        const summaryData: ScanSummaryData = {
          verdict: verdict as ScanSummaryData['verdict'],
          score: Math.round((passed / total) * 100),
          findings: { total: total - passed, critical, high, medium, low: 0 },
          elapsedMs: elapsed,
          nextActions: verdict === 'FAIL'
            ? ['Fix critical issues and re-deploy', `Re-run: guardrail verify --url ${baseUrl}`]
            : verdict === 'WARN'
              ? ['Review warnings before promoting to production', `guardrail verify --url ${baseUrl} --checks ${ALL_CHECKS.join(',')}`]
              : ['Deploy is healthy — ship it!'],
        };
        printScanSummary(summaryData);
      }

      // Exit code
      process.exit(
        (critical > 0 || high > 0) ? ExitCode.POLICY_FAIL : ExitCode.SUCCESS,
      );
      }, { silent })();
    });
}
