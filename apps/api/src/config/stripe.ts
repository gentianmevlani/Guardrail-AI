/**
 * Stripe API version — keep in sync with @guardrail/web-ui billing/stripe-api-version.ts
 */
export const DEFAULT_STRIPE_API_VERSION = "2025-02-24.acacia" as const;

export function resolveStripeApiVersion(): string {
  const v = process.env.STRIPE_API_VERSION?.trim();
  return v || DEFAULT_STRIPE_API_VERSION;
}
