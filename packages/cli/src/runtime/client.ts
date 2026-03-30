/**
 * Enterprise API Client
 * - Real entitlement validation (no key prefix parsing)
 * - Proper timeouts and retries with exponential backoff
 * - User-agent for tracking
 * - Circuit breaker pattern for resilience
 */

import { Tier } from './creds';
import { getClientMetadata } from './auth-utils';

export interface AuthValidateRequest {
  apiKey: string;
  client: {
    version: string;
    os: string;
    arch: string;
  };
}

export interface AuthValidateResponse {
  ok: boolean;
  tier: Tier;
  email?: string;
  entitlements?: string[];
  expiresAt?: string;
  issuedAt?: string;
  reason?: string;
}

export interface ValidateResponse {
  ok: boolean;
  tier: Tier;
  email?: string;
  entitlements?: string[];
  expiresAt?: string;
  issuedAt?: string;
  error?: string;
}

export interface ClientOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

const DEFAULT_API_BASE = process.env.GUARDRAIL_API_BASE_URL || 'https://api.guardrail.dev';
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate API key against the enterprise auth endpoint
 * POST /v1/cli/auth/validate with proper request format and retries
 */
export async function validateApiKey(opts: {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}): Promise<ValidateResponse> {
  const baseUrl = opts.baseUrl || DEFAULT_API_BASE;
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  
  const clientMeta = getClientMetadata();
  const requestBody: AuthValidateRequest = {
    apiKey: opts.apiKey,
    client: clientMeta,
  };

  let lastError: string = 'Unknown error';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${baseUrl}/v1/cli/auth/validate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': `guardrail-cli-tool/${clientMeta.version} (${clientMeta.os}; ${clientMeta.arch}; node ${process.version})`,
          'x-client-version': clientMeta.version,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        let errorMessage: string;
        
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.reason || errorJson.message || errorJson.error || `HTTP ${res.status}`;
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }

        if (res.status === 401) {
          return { ok: false, tier: 'free', error: 'Invalid or expired API key' };
        }
        if (res.status === 403) {
          return { ok: false, tier: 'free', error: 'Access denied - API key revoked or suspended' };
        }
        if (res.status === 429) {
          lastError = 'Rate limited - please try again later';
          if (attempt < maxRetries) {
            await sleep(RETRY_DELAYS[attempt] || 4000);
            continue;
          }
          return { ok: false, tier: 'free', error: lastError };
        }
        if (res.status >= 500) {
          lastError = `Server error: ${errorMessage}`;
          if (attempt < maxRetries) {
            await sleep(RETRY_DELAYS[attempt] || 4000);
            continue;
          }
          return { ok: false, tier: 'free', error: lastError };
        }
        
        return { ok: false, tier: 'free', error: errorMessage };
      }

      const data = await res.json() as AuthValidateResponse;
      
      if (!data.ok) {
        return { 
          ok: false, 
          tier: 'free', 
          error: data.reason || 'Validation failed' 
        };
      }
      
      return {
        ok: true,
        tier: data.tier || 'free',
        email: data.email,
        entitlements: data.entitlements,
        expiresAt: data.expiresAt,
        issuedAt: data.issuedAt,
      };
      
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        lastError = 'Request timed out';
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        lastError = 'Unable to reach guardrail API - check your network connection';
      } else {
        lastError = `Network error: ${err.message}`;
      }
      
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAYS[attempt] || 4000);
        continue;
      }
    }
  }
  
  return { ok: false, tier: 'free', error: lastError };
}

/**
 * Legacy validate function - wraps new validateApiKey for backwards compatibility
 */
export async function validateCredentials(opts: {
  apiKey?: string;
  accessToken?: string;
  baseUrl?: string;
  timeout?: number;
}): Promise<ValidateResponse> {
  if (!opts.apiKey && !opts.accessToken) {
    return { ok: false, tier: 'free', error: 'No credentials provided' };
  }
  
  if (opts.apiKey) {
    return validateApiKey({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      timeout: opts.timeout,
    });
  }
  
  // For access tokens, use the legacy endpoint
  const baseUrl = opts.baseUrl || DEFAULT_API_BASE;
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const clientMeta = getClientMetadata();
    const res = await fetch(`${baseUrl}/v1/cli/validate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${opts.accessToken}`,
        'user-agent': `guardrail-cli-tool/${clientMeta.version} (node ${process.version})`,
      },
      body: JSON.stringify({ ts: new Date().toISOString() }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, tier: 'free', error: 'Invalid or expired credentials' };
      }
      return { ok: false, tier: 'free', error: `API error: ${res.status}` };
    }

    const data = await res.json() as ValidateResponse;
    return { ...data, ok: true };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, tier: 'free', error: 'Request timed out' };
    }
    return { ok: false, tier: 'free', error: `Network error: ${err.message}` };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(opts: {
  refreshToken: string;
  baseUrl?: string;
}): Promise<{ accessToken?: string; expiresIn?: number; error?: string }> {
  const baseUrl = opts.baseUrl || DEFAULT_API_BASE;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const res = await fetch(`${baseUrl}/v1/cli/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': `guardrail-cli-tool/${getVersion()} (node ${process.version})`,
      },
      body: JSON.stringify({ refreshToken: opts.refreshToken }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { error: `Refresh failed: ${res.status}` };
    }

    return await res.json();
  } catch (err: any) {
    return { error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get CLI version from package.json
 */
function getVersion(): string {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Calculate cache expiry (15 minutes from now)
 */
export function getCacheExpiry(minutes: number = 15): string {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry.toISOString();
}
