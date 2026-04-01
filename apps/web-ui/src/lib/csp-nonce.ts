/**
 * CSP Nonce Utilities
 *
 * Provides access to the CSP nonce for components that need inline scripts.
 * The nonce is generated in middleware.ts and passed via headers.
 */

import { headers } from "next/headers";

/**
 * Get the CSP nonce from request headers (Server Components only).
 * Returns undefined if not available.
 */
export async function getNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get("x-nonce") ?? undefined;
  } catch {
    // headers() throws in client components
    return undefined;
  }
}

/**
 * Synchronous version for use in generateMetadata or other sync contexts.
 * Note: This may not work in all contexts.
 */
export function getNonceSync(): string | undefined {
  if (typeof window !== "undefined") {
    // Client-side: nonce should be in a meta tag if needed
    const metaNonce = document.querySelector('meta[name="csp-nonce"]');
    return metaNonce?.getAttribute("content") ?? undefined;
  }
  return undefined;
}
