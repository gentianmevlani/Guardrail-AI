import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/webhooks/stripe
 * 
 * Proxies Stripe webhook events to the API server for processing.
 * The API server handles all database operations for subscriptions.
 * 
 * Required env vars:
 * - STRIPE_SECRET_KEY (on API server)
 * - STRIPE_WEBHOOK_SECRET (on API server)
 */

/** Backend @guardrail/api origin (must match apps/api dev port, usually 4000). */
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      logger.error('[Stripe Webhook Proxy] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const response = await fetch(`${API_URL}/api/billing/webhook`, {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'content-type': request.headers.get('content-type') || 'application/json',
      },
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      return new NextResponse(await response.text(), { status: response.status });
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return NextResponse.json({ received: true }, { status: response.status });
    }

    try {
      const result = JSON.parse(text);
      return NextResponse.json(result, { status: response.status });
    } catch {
      return NextResponse.json({ received: true }, { status: response.status });
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('[Stripe Webhook Proxy] Error forwarding webhook:', error);
    return NextResponse.json(
      { error: 'Webhook proxy failed', message: error.message },
      { status: 500 }
    );
  }
}

