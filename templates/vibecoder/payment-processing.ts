/**
 * Payment Processing
 * 
 * What AI app builders forget: Webhooks, idempotency, error recovery
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { query, transaction } from '../backend/utils/database.util';
import { logger } from '../backend/utils/logger.util';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * Create payment intent
 */
export async function createPaymentIntent(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;

    // Create idempotency key
    const idempotencyKey = req.headers['idempotency-key'] as string || 
                         `payment-${Date.now()}-${Math.random()}`;

    // Check if already processed
    const existing = await query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        clientSecret: existing.rows[0].client_secret,
        paymentId: existing.rows[0].payment_id,
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          ...metadata,
          idempotencyKey,
        },
      },
      {
        idempotencyKey, // Stripe idempotency
      }
    );

    // Store in database
    await query(
      `INSERT INTO payments (idempotency_key, payment_id, client_secret, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        idempotencyKey,
        paymentIntent.id,
        paymentIntent.client_secret,
        amount,
        currency,
        'pending',
      ]
    );

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
    });
  } catch (error: any) {
    logger.error('Payment intent creation failed', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
    });
  }
}

/**
 * Stripe webhook handler
 * 
 * CRITICAL: AI app builders always forget webhooks!
 */
export async function stripeWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const sig = req.headers['stripe-signature']!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logger.error('Webhook signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle event with transaction for data consistency
  await transaction(async (client) => {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent, client);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, client);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge, client);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
  });

  res.json({ received: true });
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(
  paymentIntent: Stripe.PaymentIntent,
  client: any
): Promise<void> {
  await client.query(
    `UPDATE payments 
     SET status = $1, updated_at = NOW()
     WHERE payment_id = $2`,
    ['succeeded', paymentIntent.id]
  );

  // Update user subscription, grant access, etc.
  // This is what AI app builders forget!
  
  logger.info('Payment succeeded', { paymentId: paymentIntent.id });
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  client: any
): Promise<void> {
  await client.query(
    `UPDATE payments 
     SET status = $1, error_message = $2, updated_at = NOW()
     WHERE payment_id = $3`,
    ['failed', paymentIntent.last_payment_error?.message || 'Unknown error', paymentIntent.id]
  );

  // Notify user, retry logic, etc.
  logger.warn('Payment failed', { paymentId: paymentIntent.id });
}

/**
 * Handle refund
 */
async function handleRefund(
  charge: Stripe.Charge,
  client: any
): Promise<void> {
  await client.query(
    `UPDATE payments 
     SET status = $1, refunded_at = NOW(), updated_at = NOW()
     WHERE payment_id = $2`,
    ['refunded', charge.payment_intent as string]
  );

  // Revoke access, update subscription, etc.
  logger.info('Payment refunded', { chargeId: charge.id });
}

