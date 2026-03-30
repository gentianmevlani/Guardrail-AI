# Stripe setup for Guardrail

This project uses **Stripe Checkout** (hosted payment page) for subscriptions and a **webhook** pipeline to sync tiers in `@guardrail/api`.

## Quick checklist

1. **Stripe Dashboard → Products / Prices**  
   Create **Starter**, **Pro**, and **Compliance** recurring prices ($9.99 / $29.99 / $59.99 monthly or your amounts). Copy each **`price_...`** into:
   - `apps/web-ui/.env.local` → `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_COMPLIANCE`
   - `apps/api/.env` → the same three variables (webhooks map tiers using these IDs)

2. **Stripe → Developers → API keys**  
   Set **`STRIPE_SECRET_KEY`** to the same **`sk_test_...`** or **`sk_live_...`** on **both** web-ui and API.

3. **Production webhooks**  
   Endpoint URL: **`https://<your-domain>/api/webhooks/stripe`** (Next.js forwards to the API).  
   Copy the endpoint **Signing secret** (`whsec_...`) into **`STRIPE_WEBHOOK_SECRET` on the API only** — signature verification runs in `@guardrail/api`, not in Next.js.

4. **Local webhooks**  
   From `apps/web-ui`: `pnpm stripe:listen` (forwards to `localhost:5001/api/webhooks/stripe`).  
   Paste the CLI **`whsec_...`** into **`STRIPE_WEBHOOK_SECRET`** in **`apps/api/.env`**.

5. **Ports & URLs**  
   Run API on **4000** and web-ui on **5000** (defaults), or change **`NEXT_PUBLIC_API_URL`** / **`API_URL`** on web-ui so the webhook proxy reaches your API.

---

## Architecture

| Layer | Role |
|--------|------|
| **Web UI** (`apps/web-ui`) | `POST /api/checkout` creates Checkout Sessions with `STRIPE_SECRET_KEY` and price IDs. |
| **Web UI** | `POST /api/webhooks/stripe` forwards raw body + `stripe-signature` to the API. |
| **API** (`apps/api`) | `POST /api/billing/webhook` verifies the signature with `STRIPE_WEBHOOK_SECRET` and updates subscriptions. |

Use the **same** Stripe secret key on web-ui and API when both create sessions or when the API reads Stripe objects. The **webhook secret** must be configured on the **API** (where verification runs).

## 1. Stripe Dashboard

1. [Dashboard](https://dashboard.stripe.com) → **Developers** → **API keys** → copy **Publishable** and **Secret** test keys.
2. **Product catalog** → **Add product** (or three products):
   - **Starter** — recurring, monthly **$9.99** (add a yearly price if you use annual checkout later).
   - **Pro** — **$29.99**/mo.
   - **Compliance** — **$59.99**/mo.
3. Open each **Price** and copy the **Price ID** (`price_...`).

## 2. Environment variables

### Web UI (`apps/web-ui/.env.local`)

- `STRIPE_SECRET_KEY` — `sk_test_...` or `sk_live_...`
- `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_COMPLIANCE` — the `price_...` IDs used in Checkout
- `FRONTEND_URL` / `NEXT_PUBLIC_APP_URL` — public site URL (e.g. `http://localhost:5001` in dev; `https://app.yourdomain.com` in prod)

See `apps/web-ui/.env.example` for the full list.

### API (`apps/api/.env`)

- `STRIPE_SECRET_KEY` — same secret if the API touches Stripe
- `STRIPE_WEBHOOK_SECRET` — from the webhook endpoint (below)
- `STRIPE_PRICE_ID_*` — same price IDs as web-ui so webhooks map tiers correctly

Optional: `STRIPE_PRICE_ID_*_MONTHLY` / `_ANNUAL` for explicit tier mapping (see `billing-webhooks.ts`).

## 3. Webhook URL

### Production

1. Stripe → **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL**: `https://<your-web-ui-domain>/api/webhooks/stripe`
3. Select events your API handles (at minimum: `checkout.session.completed`, `customer.subscription.*`, `invoice.*` as implemented in `apps/api/src/routes/billing-webhooks.ts`).
4. Copy the **Signing secret** (`whsec_...`) into **`STRIPE_WEBHOOK_SECRET`** on the API.

Set **`NEXT_PUBLIC_API_URL`** on the web-ui deployment to your API’s public origin so the proxy can reach `POST /api/billing/webhook`.

### Local development

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Run web-ui on port **5000** (default in `package.json`).
3. Forward events:

```bash
stripe listen --forward-to localhost:5001/api/webhooks/stripe
```

4. Paste the CLI **webhook signing secret** (`whsec_...`) into **`STRIPE_WEBHOOK_SECRET`** for the **API** process (or a shared `.env` used by API).

## 4. Customer portal

The billing UI calls **`/api/billing/portal`** on the API (`createCustomerPortalSession`). Ensure the API implements **Stripe Customer Portal** with your **return URL** and that **Customer Portal** is enabled in Stripe Dashboard → **Settings** → **Billing** → **Customer portal**.

## 5. Verify

1. Start API and web-ui with env vars set.
2. Sign in → **Billing** → choose **Starter** / **Pro** / **Compliance** → you should redirect to Stripe Checkout.
3. Complete a test payment; confirm webhook logs in API and tier updates in the app.

## API version

Default Stripe API version is **`2023-10-16`** (see `apps/web-ui/src/lib/billing/stripe-api-version.ts` and `apps/api/src/config/stripe.ts`). Override with **`STRIPE_API_VERSION`** only if required by your Stripe account.
