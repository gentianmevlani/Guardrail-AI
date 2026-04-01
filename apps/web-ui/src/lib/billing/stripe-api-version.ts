/**
 * Pin Stripe API version across Checkout and any future Stripe calls.
 * Must match @guardrail/api billing routes (see apps/api/src/config/stripe.ts).
 *
 * Override with STRIPE_API_VERSION only if you know your Stripe account supports it.
 */
export const DEFAULT_STRIPE_API_VERSION = "2023-10-16" as const;

export function resolveStripeApiVersion(): string {
  const v = process.env.STRIPE_API_VERSION?.trim();
  return v || DEFAULT_STRIPE_API_VERSION;
}
