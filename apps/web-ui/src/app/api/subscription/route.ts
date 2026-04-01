import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Subscription API Routes
 * 
 * Proxies subscription requests to the API server which handles
 * authentication and database operations.
 */

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

async function proxyToApi(request: NextRequest, method: string, body?: string) {
  const cookies = request.headers.get('cookie') || '';
  const authorization = request.headers.get('authorization') || '';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (cookies) headers['cookie'] = cookies;
  if (authorization) headers['authorization'] = authorization;
  
  const response = await fetch(`${API_URL}/api/billing/subscription`, {
    method,
    headers,
    body: body || undefined,
  });
  
  const contentType = response.headers.get('content-type') || '';
  
  if (response.status === 204 || !contentType.includes('application/json')) {
    return new NextResponse(null, { status: response.status });
  }
  
  const text = await response.text();
  if (!text || text.trim() === '') {
    return NextResponse.json({ success: true }, { status: response.status });
  }
  
  try {
    const result = JSON.parse(text);
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Invalid response' }, { status: 500 });
  }
}

/**
 * GET /api/subscription
 * Get current user's subscription status.
 */
export async function GET(request: NextRequest) {
  try {
    return await proxyToApi(request, 'GET');
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Subscription fetch error:', error);
    return NextResponse.json({
      tier: 'free',
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * DELETE /api/subscription
 * Cancel current subscription at period end.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.text();
    return await proxyToApi(request, 'DELETE', body);
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Subscription cancel error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to cancel subscription',
    }, { status: 500 });
  }
}

/**
 * PUT /api/subscription
 * Update subscription (change tier).
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.text();
    return await proxyToApi(request, 'PUT', body);
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Subscription update error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to update subscription',
    }, { status: 500 });
  }
}
