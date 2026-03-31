/**
 * Device code login — same flow as the VS Code extension (browser + poll).
 * Uses GUARDRAIL_API_BASE_URL or https://api.guardrailai.dev
 */

import { spawn } from 'child_process';
import { saveAuthState, type AuthState } from '../runtime/creds';
import { validateApiKey, getCacheExpiry } from '../runtime/client';
import { getConfigPath } from '../runtime/creds';
import { icons, styles } from '../ui/cli-styles';
import { frameLines } from '../ui/cli-frame-inline';
import { printLogo, c } from '../ui/cli-terminal';
import { maskApiKey } from '../runtime/auth-utils';
import { ExitCode, exitWith } from '../runtime/exit-codes';

const DEFAULT_API_BASE =
  process.env.GUARDRAIL_API_BASE_URL || 'https://api.guardrailai.dev';

function apiBase(): string {
  return DEFAULT_API_BASE.replace(/\/$/, '');
}

function unwrapBody<T extends Record<string, unknown>>(
  res: unknown,
): T | undefined {
  if (!res || typeof res !== 'object') return undefined;
  const o = res as Record<string, unknown>;
  if (o.data && typeof o.data === 'object') {
    return o.data as T;
  }
  const { success: _s, error: _e, message: _m, data: _d, ...rest } = o;
  if (Object.keys(rest).length > 0) {
    return rest as unknown as T;
  }
  return undefined;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'guardrail-cli-tool/device-login',
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON (${r.status}): ${text.slice(0, 200)}`);
  }
  if (!r.ok) {
    const err =
      (parsed as { error?: string }).error ||
      (parsed as { message?: string }).message ||
      r.statusText;
    throw new Error(err);
  }
  return parsed;
}

function openBrowser(url: string): void {
  const child =
    process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', url], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
          detached: true,
          stdio: 'ignore',
        });
  child.unref();
}

export async function runDeviceLoginFlow(): Promise<void> {
  const base = apiBase();
  console.log('');
  console.log(
    `  ${c.dim('API:')}${styles.reset} ${styles.cyan}${base}${styles.reset}`,
  );

  const codeRes = await postJson(`${base}/api/auth/device`, {
    client_type: 'cli',
  });
  const payload = unwrapBody<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }>(codeRes);

  if (!payload?.device_code) {
    console.log('');
    console.log(
      frameLines(
        [
          `${styles.brightRed}${styles.bold}${icons.error} DEVICE CODE FAILED${styles.reset}`,
          '',
          `${styles.dim}Could not start browser login. Check GUARDRAIL_API_BASE_URL.${styles.reset}`,
        ],
        { padding: 2 },
      ).join('\n'),
    );
    console.log('');
    exitWith(ExitCode.AUTH_FAILURE);
    return;
  }

  const { device_code, user_code, verification_url, expires_in, interval } =
    payload;
  const pollMs = Math.max(2000, (interval || 5) * 1000);
  const deadline = Date.now() + (expires_in || 600) * 1000;

  console.log('');
  console.log(
    frameLines(
      [
        `${styles.brightCyan}${styles.bold}${icons.auth} BROWSER LOGIN${styles.reset}`,
        '',
        `${styles.dim}Your code:${styles.reset}  ${styles.bold}${user_code}${styles.reset}`,
        `${styles.dim}Open:${styles.reset}     ${styles.brightBlue}${verification_url}${styles.reset}`,
        '',
        `${styles.dim}Press Enter after you approve in the browser, or wait — we poll automatically.${styles.reset}`,
      ],
      { padding: 2 },
    ).join('\n'),
  );
  console.log('');

  openBrowser(verification_url);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));

    const pollRes = await postJson(`${base}/api/auth/device/poll`, {
      device_code,
    });
    const poll = pollRes as {
      status?: string;
      access_token?: string;
      user?: { id: string; email: string; name: string };
      plan?: string;
    };

    if (poll.status === 'authorized' && poll.access_token) {
      const token = poll.access_token;
      const v = await validateApiKey({ apiKey: token, baseUrl: base });
      if (!v.ok) {
        console.log('');
        console.log(
          frameLines(
            [
              `${styles.brightRed}${styles.bold}${icons.error} VALIDATION FAILED${styles.reset}`,
              '',
              `${styles.dim}${v.error || 'Unknown error'}${styles.reset}`,
            ],
            { padding: 2 },
          ).join('\n'),
        );
        console.log('');
        exitWith(ExitCode.AUTH_FAILURE);
        return;
      }

      const newState: AuthState = {
        apiKey: token,
        tier: v.tier,
        email: v.email,
        entitlements: v.entitlements,
        expiresAt: v.expiresAt,
        issuedAt: v.issuedAt,
        authenticatedAt: new Date().toISOString(),
        cacheUntil: getCacheExpiry(15),
      };
      await saveAuthState(newState);

      const configPath = getConfigPath();
      console.log('');
      console.log(
        frameLines(
          [
            `${styles.brightGreen}${styles.bold}${icons.success} LOGGED IN${styles.reset}`,
            '',
            `${styles.dim}API key:${styles.reset}  ${styles.cyan}${maskApiKey(token)}${styles.reset}`,
            `${styles.dim}Email:${styles.reset}    ${poll.user?.email || v.email || 'N/A'}`,
            `${styles.dim}Saved:${styles.reset}    ${styles.dim}${configPath}${styles.reset}`,
            '',
            `${styles.dim}Matches VS Code “Login & Link Device” — same credential store format.${styles.reset}`,
          ],
          { padding: 2 },
        ).join('\n'),
      );
      console.log('');
      return;
    }

    if (poll.status === 'expired') {
      console.log('');
      console.log(
        `${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Code expired — run again.${styles.reset}\n`,
      );
      exitWith(ExitCode.AUTH_FAILURE);
      return;
    }
  }

  console.log('');
  console.log(
    `${styles.brightYellow}${icons.warning}${styles.reset} ${styles.bold}Timed out waiting for authorization.${styles.reset}\n`,
  );
  exitWith(ExitCode.AUTH_FAILURE);
}
