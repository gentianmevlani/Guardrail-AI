// =============================================================================
// API URL Configuration
// =============================================================================
// In production, API calls go directly to the Railway API via Netlify redirects.
// In development, Next.js rewrites proxy to local servers.
// =============================================================================

import createMDX from "@next/mdx";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeHighlight, rehypeSlug],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify OpenNext adapter + App Router — standalone output ensures proper SSR.
  // Pages that fail static generation are served dynamically via Netlify Functions.
  output: "standalone",

  // Enable strict mode for proper hydration debugging
  reactStrictMode: true,

  // ESLint configuration for builds
  // NOTE: ESLint disabled during builds due to missing @typescript-eslint plugin config
  // TODO: Fix eslintrc to properly configure @typescript-eslint rules, then enable
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ["src"],
  },

  // TypeScript configuration for builds
  // NOTE: TypeScript currently passes with 0 errors!
  // ignoreBuildErrors is kept temporarily as a safety net while we enforce via CI.
  // The CI workflow will fail on any TypeScript errors.
  typescript: {
    // SAFE TO REMOVE: TypeScript passes with 0 errors as of 2026-01-06
    // Keeping temporarily while CI enforcement is validated
    ignoreBuildErrors: true, // TODO: Set to false after 1 week of clean CI runs
  },

  // Treat warnings as errors - disable this for now
  distDir: ".next",

  // MDX configuration
  pageExtensions: ["js", "jsx", "mdx", "ts", "tsx"],
  experimental: {
    mdxRs: true,
  },

  async rewrites() {
    return [
      // Auth routes are handled by Next.js API routes in app/api/auth/
      // Do NOT proxy them - they need access to Netlify env vars

      // API routes - proxy to API server
      {
        source: "/api/projects/:path*",
        destination: `${API_URL}/api/projects/:path*`,
      },
      {
        source: "/api/advanced/:path*",
        destination: `${API_URL}/api/advanced/:path*`,
      },
      {
        source: "/api/compliance/:path*",
        destination: `${API_URL}/api/compliance/:path*`,
      },
      {
        source: "/api/audit/:path*",
        destination: `${API_URL}/api/audit/:path*`,
      },
      {
        source: "/api/security/:path*",
        destination: `${API_URL}/api/security/:path*`,
      },
      {
        source: "/api/guardrails/:path*",
        destination: `${API_URL}/api/guardrails/:path*`,
      },
      {
        source: "/api/profile/:path*",
        destination: `${API_URL}/api/profile/:path*`,
      },
      {
        source: "/api/billing/:path*",
        destination: `${API_URL}/api/billing/:path*`,
      },
      {
        source: "/api/tenants/:path*",
        destination: `${API_URL}/api/tenants/:path*`,
      },
      {
        source: "/api/notifications/:path*",
        destination: `${API_URL}/api/notifications/:path*`,
      },
      {
        source: "/health",
        destination: `${API_URL}/health`,
      },
      // Ship Check routes
      {
        source: "/api/ship/:path*",
        destination: `${API_URL}/api/ship/:path*`,
      },
      // MCP wrapper routes
      {
        source: "/api/mcp/:path*",
        destination: `${API_URL}/api/mcp/:path*`,
      },
      // Reports routes
      {
        source: "/api/reports/:path*",
        destination: `${API_URL}/api/reports/:path*`,
      },
      // Collaboration routes
      {
        source: "/api/collaboration/:path*",
        destination: `${API_URL}/api/collaboration/:path*`,
      },
      // Webhook routes
      {
        source: "/api/webhooks/:path*",
        destination: `${API_URL}/api/webhooks/:path*`,
      },
      // Findings routes
      {
        source: "/api/findings/:path*",
        destination: `${API_URL}/api/findings/:path*`,
      },
      // Dashboard routes
      {
        source: "/api/dashboard/:path*",
        destination: `${API_URL}/api/dashboard/:path*`,
      },
      // Runs routes (critical for run detail pages)
      {
        source: "/api/runs/:path*",
        destination: `${API_URL}/api/runs/:path*`,
      },
      // API v1 routes (fixes, etc.)
      {
        source: "/api/v1/:path*",
        destination: `${API_URL}/api/v1/:path*`,
      },
      // Intelligence routes
      {
        source: "/api/intelligence/:path*",
        destination: `${API_URL}/api/intelligence/:path*`,
      },
      // Autopilot routes
      {
        source: "/api/autopilot/:path*",
        destination: `${API_URL}/api/autopilot/:path*`,
      },
      // Settings routes
      {
        source: "/api/settings/:path*",
        destination: `${API_URL}/api/settings/:path*`,
      },
      // MFA routes
      {
        source: "/api/mfa/:path*",
        destination: `${API_URL}/api/mfa/:path*`,
      },
      // Onboarding routes
      {
        source: "/api/onboarding/:path*",
        destination: `${API_URL}/api/onboarding/:path*`,
      },
      // Scans routes
      {
        source: "/api/scans/:path*",
        destination: `${API_URL}/api/scans/:path*`,
      },
      // Scheduled scans routes
      {
        source: "/api/scheduled-scans/:path*",
        destination: `${API_URL}/api/scheduled-scans/:path*`,
      },
      // Policies routes
      {
        source: "/api/policies/:path*",
        destination: `${API_URL}/api/policies/:path*`,
      },
      // Organizations/Team routes
      {
        source: "/api/organizations/:path*",
        destination: `${API_URL}/api/organizations/:path*`,
      },
      // Team routes (legacy - maps to team.ts routes)
      {
        source: "/api/team/:path*",
        destination: `${API_URL}/api/team/:path*`,
      },
      // GitHub routes (v1)
      {
        source: "/api/v1/github/:path*",
        destination: `${API_URL}/api/v1/github/:path*`,
      },
      // Health check with /api prefix
      {
        source: "/api/health/:path*",
        destination: `${API_URL}/health/:path*`,
      },
      // Health check live endpoint
      {
        source: "/health/live",
        destination: `${API_URL}/health/live`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "guardrailai.dev" },
      { protocol: "https", hostname: "www.guardrailai.dev" },
      { protocol: "https", hostname: "api.guardrailai.dev" },
    ],
  },
  async headers() {
    return [
      // Static assets - long caching
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Images - long caching
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // API responses - short caching with stale-while-revalidate
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      // Default headers
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.ALLOWED_ORIGIN || "https://guardrailai.dev",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // CSP is now set in middleware.ts with nonce-based script-src
          // This provides stronger XSS protection without 'unsafe-inline' or 'unsafe-eval'
          {
            key: "Report-To",
            value:
              '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}',
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-RateLimit-Limit",
            value: "100",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
