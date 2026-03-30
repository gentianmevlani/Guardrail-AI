import Stripe from "stripe";
import { resolveStripeApiVersion } from "./stripe-api-version";

let stripeSingleton: Stripe | null = null;

/**
 * Server-only Stripe client for API routes. Returns null if STRIPE_SECRET_KEY is unset.
 */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      /** Pinned to same default as @guardrail/api `config/stripe.ts` */
      apiVersion: resolveStripeApiVersion() as Stripe.LatestApiVersion,
    });
  }
  return stripeSingleton;
}

export function resetStripeClientForTests(): void {
  stripeSingleton = null;
}
