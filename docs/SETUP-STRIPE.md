# 💳 Stripe Setup Guide

## Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Sign up for an account
3. Complete business verification

## Step 2: Get API Keys

1. Go to **Developers** → **API keys**
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

## Step 3: Create Products & Prices

### Create Starter Tier

1. Go to **Products** → **Add product**
2. Name: "Starter Tier"
3. Description: "2,000 files, 50K lines, 3 projects"
4. Pricing: $19/month (recurring)
5. Copy the **Price ID** (starts with `price_`)
6. Add to `.env`:
   ```env
   STRIPE_PRICE_ID_STARTER=price_...
   ```

### Create Pro Tier

1. Add product: "Pro Tier"
2. Description: "10,000 files, 250K lines, 10 projects"
3. Pricing: $49/month (recurring)
4. Copy Price ID
5. Add to `.env`:
   ```env
   STRIPE_PRICE_ID_PRO=price_...
   ```

### Create Enterprise Tier

1. Add product: "Enterprise Tier"
2. Description: "50,000 files, 1M lines, 50 projects"
3. Pricing: $199/month (recurring)
4. Copy Price ID
5. Add to `.env`:
   ```env
   STRIPE_PRICE_ID_ENTERPRISE=price_...
   ```

## Step 4: Set Up Webhooks

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://your-api.com/api/webhooks/stripe`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy **Signing secret** (starts with `whsec_`)
6. Add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## Step 5: Test in Development

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

## Step 6: Go Live

1. Complete business verification
2. Switch to **Live mode**
3. Update API keys in production `.env`
4. Update webhook URL to production

---

**Next:** Set up database schema with `npx prisma migrate dev`

