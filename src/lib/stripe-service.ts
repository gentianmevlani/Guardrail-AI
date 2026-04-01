/**
 * Stripe Service
 * 
 * Handles subscription management, payments, and webhooks
 */

import Stripe from 'stripe';

export interface SubscriptionTier {
  id: string;
  name: string;
  priceId: string;
  price: number; // in cents
  interval: 'month' | 'year';
  limits: {
    files: number;
    lines: number;
    sizeMB: number;
    projects: number;
    teamMembers: number;
    validations: number;
    apiEndpoints: number;
  };
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  subscriptionId?: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise' | 'unlimited';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd?: Date;
}

class StripeService {
  private stripe: Stripe;
  private tiers: Map<string, SubscriptionTier> = new Map();

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20.acacia',
    });

    this.initializeTiers();
  }

  /**
   * Initialize subscription tiers
   */
  private initializeTiers(): void {
    // These should match your Stripe Price IDs
    this.tiers.set('starter', {
      id: 'starter',
      name: 'Starter',
      priceId: process.env.STRIPE_PRICE_ID_STARTER || '',
      price: 1900, // $19.00
      interval: 'month',
      limits: {
        files: 2000,
        lines: 50000,
        sizeMB: 25,
        projects: 3,
        teamMembers: 3,
        validations: 1000,
        apiEndpoints: 50,
      },
    });

    this.tiers.set('pro', {
      id: 'pro',
      name: 'Pro',
      priceId: process.env.STRIPE_PRICE_ID_PRO || '',
      price: 4900, // $49.00
      interval: 'month',
      limits: {
        files: 10000,
        lines: 250000,
        sizeMB: 100,
        projects: 10,
        teamMembers: 10,
        validations: 10000,
        apiEndpoints: 200,
      },
    });

    this.tiers.set('enterprise', {
      id: 'enterprise',
      name: 'Enterprise',
      priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
      price: 19900, // $199.00
      interval: 'month',
      limits: {
        files: 50000,
        lines: 1000000,
        sizeMB: 500,
        projects: 50,
        teamMembers: 50,
        validations: 100000,
        apiEndpoints: -1, // unlimited
      },
    });
  }

  /**
   * Create checkout session
   */
  async createCheckoutSession(
    customerEmail: string,
    tierId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    const tier = this.tiers.get(tierId);
    if (!tier) {
      throw new Error(`Invalid tier: ${tierId}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer_email: customerEmail,
      payment_method_types: ['card'],
      line_items: [
        {
          price: tier.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tier: tierId,
      },
    });

    return session.url || '';
  }

  /**
   * Create customer
   */
  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email,
      name,
    });
  }

  /**
   * Get customer subscription
   */
  async getCustomerSubscription(customerId: string): Promise<Customer | null> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return null;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id || '';
    
    // Find tier by price ID
    let tier: 'free' | 'starter' | 'pro' | 'enterprise' | 'unlimited' = 'free';
    for (const [tierId, tierData] of this.tiers.entries()) {
      if (tierData.priceId === priceId) {
        tier = tierId as any;
        break;
      }
    }

    return {
      id: customerId,
      email: subscription.customer as string,
      subscriptionId: subscription.id,
      tier,
      status: subscription.status as any,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    newTierId: string
  ): Promise<void> {
    const newTier = this.tiers.get(newTierId);
    if (!newTier) {
      throw new Error(`Invalid tier: ${newTierId}`);
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    
    await this.stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newTier.priceId,
        },
      ],
      proration_behavior: 'always_invoice',
    });
  }

  /**
   * Handle webhook
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  }

  /**
   * Get tier by ID
   */
  getTier(tierId: string): SubscriptionTier | undefined {
    return this.tiers.get(tierId);
  }

  /**
   * Get all tiers
   */
  getAllTiers(): SubscriptionTier[] {
    return Array.from(this.tiers.values());
  }
}

export const stripeService = new StripeService();

