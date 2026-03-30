/**
 * Checkout & subscription tier helpers (web-ui).
 * Keep in sync with @/lib/tier-gates and apps/api billing routes.
 */

import { z } from "zod";

export const PAID_TIER_IDS = ["starter", "pro", "compliance"] as const;
export type PaidTierId = (typeof PAID_TIER_IDS)[number];

export const checkoutBodySchema = z
  .object({
    tierId: z.enum(PAID_TIER_IDS),
    email: z.string().email().max(254).optional(),
    userId: z.string().min(1).max(128).optional(),
  })
  .strict();

export type CheckoutBody = z.infer<typeof checkoutBodySchema>;

/** Stripe Checkout Session id (cs_live_*, cs_test_*, or legacy cs_*). */
export function isStripeCheckoutSessionId(id: string): boolean {
  if (!id || id.length > 128) return false;
  return /^cs_(?:live_|test_)?[A-Za-z0-9]+$/.test(id);
}

/**
 * Base URL for Stripe success/cancel redirects. In production, requires
 * FRONTEND_URL or NEXT_PUBLIC_APP_URL so redirects are not driven by Origin alone.
 */
export function getTrustedCheckoutSiteOrigin(request: {
  headers: Headers;
}): string | null {
  const envRaw =
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_HOME;
  if (envRaw) {
    try {
      const u = new URL(envRaw);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const u = new URL(origin);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      /* fall through */
    }
  }
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) {
    return `${proto}://${host.split(",")[0].trim()}`;
  }
  return "http://localhost:5000";
}
