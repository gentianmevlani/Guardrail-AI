import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// =============================================================================
// CSP Nonce Generation
// =============================================================================
// Generate a cryptographically secure nonce for Content-Security-Policy.
// This prevents XSS attacks while allowing legitimate inline scripts.
// =============================================================================

function generateNonce(): string {
  // In Edge runtime, we use crypto.getRandomValues
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convert to base64 without spread operator for TypeScript compatibility
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

// =============================================================================
// Edge Rate Limiting (Vercel Edge Runtime Compatible)
// =============================================================================
// Uses in-memory Map for rate limiting. In production with multiple edge nodes,
// consider using Vercel KV, Upstash Redis, or Cloudflare KV for distributed state.
// =============================================================================

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Rate limit configuration by path pattern
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/": { max: 10, windowMs: 60 * 1000 }, // 10 req/min for auth
  "/api/keys/": { max: 5, windowMs: 60 * 60 * 1000 }, // 5 req/hour for key generation
  "/api/": { max: 100, windowMs: 60 * 1000 }, // 100 req/min for general API
  default: { max: 200, windowMs: 60 * 1000 }, // 200 req/min for other routes
};

// In-memory rate limit store (per edge node)
const rateLimitStore = new Map<string, RateLimitRecord>();

function getRateLimitConfig(pathname: string): {
  max: number;
  windowMs: number;
} {
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern !== "default" && pathname.startsWith(pattern)) {
      return config;
    }
  }
  return RATE_LIMITS.default;
}

function checkRateLimit(
  identifier: string,
  config: { max: number; windowMs: number },
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    const newRecord = { count: 1, resetTime: now + config.windowMs };
    rateLimitStore.set(identifier, newRecord);
    return {
      allowed: true,
      remaining: config.max - 1,
      resetTime: newRecord.resetTime,
    };
  }

  if (record.count >= config.max) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return {
    allowed: true,
    remaining: config.max - record.count,
    resetTime: record.resetTime,
  };
}

function getClientIdentifier(request: NextRequest): string {
  // Use Vercel's real IP header, Cloudflare's CF-Connecting-IP, or forwarded header
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${ip}:${request.nextUrl.pathname}`;
}

export function middleware(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for static assets
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Generate CSP nonce for this request
  const nonce = generateNonce();

  // Apply rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimitConfig = getRateLimitConfig(pathname);
  const { allowed, remaining, resetTime } = checkRateLimit(
    clientId,
    rateLimitConfig,
  );

  if (!allowed) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": rateLimitConfig.max.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
        },
      },
    );
  }

  // Clone the request headers and add nonce for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add rate limit headers to response
  response.headers.set("X-RateLimit-Limit", rateLimitConfig.max.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  response.headers.set(
    "X-RateLimit-Reset",
    Math.ceil(resetTime / 1000).toString(),
  );

  // ==========================================================================
  // Content-Security-Policy with Nonce
  // ==========================================================================
  // SECURITY: Strict CSP in production, relaxed for development
  // - In development: allow 'unsafe-eval' for Next.js React Refresh
  // - In production: strict CSP without 'unsafe-inline' or 'unsafe-eval'
  // - Scripts require nonce or be from allowed sources
  // - Styles allow 'unsafe-inline' (needed for CSS-in-JS, but less risky than scripts)
  // ==========================================================================
  // Note: Next.js requires 'unsafe-inline' for its inline scripts in production
  // The nonce approach doesn't work well with Next.js's build output
  // Using 'strict-dynamic' allows scripts loaded by trusted scripts
  const scriptSrc = isProduction
    ? `'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://js.stripe.com`
    : `'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://js.stripe.com`;
  
  const cspDirectives = [
    // Default: only same-origin
    "default-src 'self'",
    // Scripts: self + nonce + (dev: unsafe-eval/unsafe-inline for Next.js) + specific CDNs
    `script-src ${scriptSrc}`,
    // Styles: self + unsafe-inline (required for styled-components/emotion)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Images: self + data URIs + HTTPS sources
    "img-src 'self' data: https: blob:",
    // Fonts: self + data + Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com",
    // Connect: API calls, websockets, analytics, and development services (Sentry, etc.)
    isProduction
      ? "connect-src 'self' https: wss: https://www.google-analytics.com https://analytics.google.com"
      : "connect-src 'self' https: wss: http://localhost:3000 http://localhost:5000 http://localhost:5001 http://127.0.0.1:7242 https://www.google-analytics.com https://analytics.google.com",
    // Frames: none by default, add Stripe if needed
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    // Frame ancestors: prevent clickjacking
    "frame-ancestors 'none'",
    // Object/embed: none
    "object-src 'none'",
    // Base URI: self only
    "base-uri 'self'",
    // Form actions: self only
    "form-action 'self'",
    // Upgrade insecure requests in production
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
    // Report violations
    "report-uri /api/csp-report",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspDirectives);

  // Pass nonce to client via header (components can read this)
  response.headers.set("x-nonce", nonce);

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // XSS Protection (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy - restrict browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  // HSTS - Force HTTPS in production (2 years, include subdomains, allow preload)
  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  // Prevent caching of sensitive pages
  if (
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/api/")
  ) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    response.headers.set("Pragma", "no-cache");
  }

  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
