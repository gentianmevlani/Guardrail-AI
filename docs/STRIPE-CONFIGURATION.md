# Stripe Configuration Guide

This document outlines the Stripe products, prices, and webhook configuration for guardrail billing.

## Pricing Tiers

| Tier           | Monthly | Annual | Description                                             |
| -------------- | ------- | ------ | ------------------------------------------------------- |
| **Free**       | $0      | $0     | 3 scans/month, 1 repo, basic analysis                   |
| **Pro**        | $19     | $190   | Unlimited scans, 10 repos, LLM analysis, priority queue |
| **Team**       | $49     | $490   | 5 seats, shared dashboard, webhook integrations         |
| **Enterprise** | Custom  | Custom | SSO, audit logs, SLA, dedicated support                 |

---

## Stripe Dashboard Setup

### 1. Create Products

Navigate to **Stripe Dashboard → Products → Add Product**

#### Product: guardrail Pro

```json
{
  "name": "guardrail Pro",
  "description": "Unlimited scans, 10 repos, LLM analysis, priority queue",
  "metadata": {
    "tier": "pro",
    "features": "unlimited_scans,llm_analysis,priority_queue",
    "max_repos": "10"
  }
}
```

**Prices for Pro:**

- Monthly: $19/month (recurring)
- Annual: $190/year (recurring, ~17% discount)

#### Product: guardrail Team

```json
{
  "name": "guardrail Team",
  "description": "5 seats, shared dashboard, webhook integrations",
  "metadata": {
    "tier": "team",
    "features": "team_dashboard,webhooks,shared_projects",
    "default_seats": "5"
  }
}
```

**Prices for Team:**

- Monthly: $49/month (recurring, per team)
- Annual: $490/year (recurring, per team)
- Additional seats: $10/month per seat (metered)

#### Product: guardrail Enterprise

```json
{
  "name": "guardrail Enterprise",
  "description": "SSO, audit logs, SLA, dedicated support",
  "metadata": {
    "tier": "enterprise",
    "features": "sso,audit_logs,sla,dedicated_support",
    "custom_pricing": "true"
  }
}
```

**Prices for Enterprise:**

- Contact sales (custom quote)

---

### 2. Environment Variables

Add these to your `.env` file after creating products in Stripe:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Product IDs (from Stripe Dashboard)
STRIPE_PRODUCT_PRO=prod_xxx
STRIPE_PRODUCT_TEAM=prod_xxx
STRIPE_PRODUCT_ENTERPRISE=prod_xxx

# Price IDs (from Stripe Dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_ANNUAL=price_xxx
STRIPE_PRICE_TEAM_MONTHLY=price_xxx
STRIPE_PRICE_TEAM_ANNUAL=price_xxx
STRIPE_PRICE_TEAM_SEAT=price_xxx  # Metered, per seat

# Customer Portal
STRIPE_CUSTOMER_PORTAL_CONFIG=bpc_xxx
```

---

### 3. Webhook Configuration

Navigate to **Stripe Dashboard → Developers → Webhooks → Add Endpoint**

**Endpoint URL:** `https://api.guardrailai.dev/api/billing/webhook`

**Events to subscribe:**

```
checkout.session.completed
checkout.session.expired
customer.created
customer.updated
customer.deleted
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
customer.subscription.trial_will_end
invoice.created
invoice.finalized
invoice.paid
invoice.payment_failed
invoice.payment_action_required
invoice.upcoming
invoice.updated
payment_intent.succeeded
payment_intent.payment_failed
payment_method.attached
payment_method.detached
charge.refunded
charge.dispute.created
```

---

### 4. Customer Portal Configuration

Navigate to **Stripe Dashboard → Settings → Billing → Customer Portal**

Enable:

- ✅ Update payment methods
- ✅ View invoice history
- ✅ Update billing information
- ✅ Cancel subscriptions (at period end)
- ✅ Switch plans (with proration)

Cancellation:

- Require cancellation reason
- Allow immediate cancellation: No
- Cancel at period end: Yes

Plan switching:

- Allow upgrades: Yes (prorate immediately)
- Allow downgrades: Yes (prorate at period end)

---

## API Integration

### Create Checkout Session

```typescript
// POST /api/billing/checkout
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: customerId, // or customer_email for new customers
  line_items: [
    {
      price: priceId,
      quantity: 1,
    },
  ],
  success_url: `${frontendUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${frontendUrl}/pricing?checkout=canceled`,
  subscription_data: {
    metadata: {
      userId: user.id,
      tier: "pro",
    },
    trial_period_days: 14, // Optional: 14-day trial
  },
  allow_promotion_codes: true,
  billing_address_collection: "auto",
  tax_id_collection: { enabled: true },
});
```

### Create Customer Portal Session

```typescript
// POST /api/billing/portal
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${frontendUrl}/settings/billing`,
});
```

### Handle Proration

```typescript
// Upgrade: Immediate proration
await stripe.subscriptions.update(subscriptionId, {
  items: [
    {
      id: subscriptionItemId,
      price: newPriceId,
    },
  ],
  proration_behavior: "create_prorations",
});

// Downgrade: Proration at period end
await stripe.subscriptions.update(subscriptionId, {
  items: [
    {
      id: subscriptionItemId,
      price: newPriceId,
    },
  ],
  proration_behavior: "none",
  billing_cycle_anchor: "unchanged",
});
```

---

## Webhook Security

All webhooks must verify the Stripe signature:

```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET,
);
```

---

## Testing

### Test Cards

| Card Number      | Scenario           |
| ---------------- | ------------------ |
| 4242424242424242 | Success            |
| 4000000000000341 | Attaching fails    |
| 4000000000009995 | Insufficient funds |
| 4000000000000002 | Declined           |
| 4000002500003155 | 3D Secure required |

### Test Webhooks

Use Stripe CLI for local testing:

```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

### Test Clock (Subscription Lifecycle)

Create test clocks in Stripe Dashboard to simulate:

- Trial expiration
- Billing cycle renewal
- Payment failures
- Subscription cancellation

---

## Metered Billing (Usage-Based)

For overage billing on the Pro plan:

```typescript
// Report usage at end of billing period
await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
  quantity: overageScans,
  timestamp: Math.floor(Date.now() / 1000),
  action: "set", // or 'increment'
});
```

---

## Refunds

```typescript
// Full refund
await stripe.refunds.create({
  payment_intent: paymentIntentId,
});

// Partial refund
await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: 1000, // $10.00 in cents
});
```

---

## Compliance

- PCI DSS: Stripe handles all card data (PCI Level 1)
- SCA: 3D Secure automatically handled by Stripe Checkout
- GDPR: Customer data can be deleted via API
- Tax: Use Stripe Tax for automatic calculation
