import { NextResponse } from 'next/server';

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://guardrail-production.up.railway.app';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HealthResponse {
  ok: boolean;
  frontend: 'ok' | 'error';
  api: 'ok' | 'error' | 'unreachable';
  db?: 'ok' | 'error' | 'unreachable';
  ms: number;
  ts: string;
  version: string;
  errors?: string[];
}

export async function GET() {
  const started = Date.now();
  const errors: string[] = [];

  // Check Railway API health
  let apiStatus: 'ok' | 'error' | 'unreachable' = 'unreachable';
  let dbStatus: 'ok' | 'error' | 'unreachable' | undefined;

  try {
    const apiResponse = await fetch(`${RAILWAY_API_URL}/health`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (apiResponse.ok) {
      const apiHealth = await apiResponse.json();
      apiStatus = 'ok';
      dbStatus = apiHealth.db === 'ok' ? 'ok' : 'error';
    } else {
      apiStatus = 'error';
      errors.push(`API returned ${apiResponse.status}`);
    }
  } catch (err) {
    apiStatus = 'unreachable';
    errors.push(`API unreachable: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  const ms = Date.now() - started;
  const allOk = apiStatus === 'ok' && (!dbStatus || dbStatus === 'ok');

  const response: HealthResponse = {
    ok: allOk,
    frontend: 'ok',
    api: apiStatus,
    ...(dbStatus && { db: dbStatus }),
    ms,
    ts: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    ...(errors.length > 0 && { errors }),
  };

  return NextResponse.json(response, {
    status: allOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
