import { NextRequest, NextResponse } from 'next/server';
import {
  checkoutBodySchema,
  getTrustedCheckoutSiteOrigin,
  isStripeCheckoutSessionId,
} from '@/lib/billing/checkout';
import { getStripeClient } from '@/lib/billing/stripe-client';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';

/**
 * POST /api/checkout
 *
 * Creates a Stripe checkout session for subscription purchase.
 * Body: { tierId: 'starter' | 'pro' | 'compliance', email?: string, userId?: string }
 *
 * Paid tiers must not be set via tenant PUT — use checkout + webhooks.
 */

const MAX_BODY_BYTES = 16_384;

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_ID_STARTER || '',
  pro: process.env.STRIPE_PRICE_ID_PRO || '',
  compliance:
    process.env.STRIPE_PRICE_ID_COMPLIANCE ||
    process.env.STRIPE_PRICE_ID_ENTERPRISE ||
    '',
};

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: 'Stripe is not configured',
        message: 'Billing is in preview mode. Set STRIPE_SECRET_KEY to enable.',
        preview: true,
      },
      { status: 503 },
    );
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = checkoutBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { tierId, email, userId } = parsed.data;

  if (!PRICE_IDS[tierId]) {
    return NextResponse.json(
      { error: 'Invalid tier', validTiers: Object.keys(PRICE_IDS) },
      { status: 400 },
    );
  }

  const priceId = PRICE_IDS[tierId];
  if (!priceId) {
    return NextResponse.json(
      {
        error: 'Price not configured',
        message: `STRIPE_PRICE_ID_${tierId.toUpperCase()} is not set`,
        preview: true,
      },
      { status: 503 },
    );
  }

  const siteOrigin = getTrustedCheckoutSiteOrigin(request);
  if (!siteOrigin) {
    logger.error('Checkout: missing FRONTEND_URL / NEXT_PUBLIC_APP_URL in production');
    return NextResponse.json(
      {
        error: 'Server misconfiguration',
        message: 'Set FRONTEND_URL or NEXT_PUBLIC_APP_URL for checkout redirects.',
      },
      { status: 503 },
    );
  }

  try {
    const stripe = getStripeClient()!;
    const successUrl = `${siteOrigin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteOrigin}/pricing?checkout=canceled`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(email ? { customer_email: email } : {}),
        metadata: {
          tierId,
          userId: userId ?? '',
          source: 'guardrail-web',
        },
        subscription_data: {
          metadata: {
            tierId,
            userId: userId ?? '',
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      },
      {
        idempotencyKey: request.headers.get('stripe-idempotency-key') ?? undefined,
      },
    );

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('Checkout error:', error);

    const stripeError = error as { message?: string; code?: string };
    if (stripeError.message) {
      return NextResponse.json(
        {
          error: stripeError.message,
          code: stripeError.code,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/checkout?session_id=xxx
 *
 * Retrieves checkout session details (for success page)
 */
export async function GET(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: 'Stripe is not configured',
        preview: true,
      },
      { status: 503 },
    );
  }

  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId || !isStripeCheckoutSessionId(sessionId)) {
    return NextResponse.json(
      {
        error: 'session_id is required and must be a valid Stripe session id',
      },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripeClient()!;
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    return NextResponse.json({
      status: session.status,
      customerEmail: session.customer_email,
      subscription: session.subscription
        ? {
            id: (session.subscription as Stripe.Subscription).id,
            status: (session.subscription as Stripe.Subscription).status,
            currentPeriodEnd: (session.subscription as Stripe.Subscription)
              .current_period_end,
          }
        : null,
      tier: session.metadata?.tierId,
    });
  } catch (error) {
    logger.error('Session retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve session',
      },
      { status: 500 },
    );
  }
}
