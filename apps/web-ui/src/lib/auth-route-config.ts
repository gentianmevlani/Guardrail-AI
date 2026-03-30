/**
 * Resolves how email/password auth routes should behave.
 *
 * - Prefer proxying to NEXT_PUBLIC_API_URL when set.
 * - Mock auth is opt-in: development only, ALLOW_MOCK_AUTH=true, and MOCK_AUTH_EMAIL + MOCK_AUTH_PASSWORD.
 * Never treat a missing API URL as "dev mode" by itself (staging/prod misconfig safety).
 */

import { NextResponse } from "next/server";

export type AuthBackend =
  | { mode: "proxy"; apiUrl: string }
  | { mode: "mock"; mockEmail: string; mockPassword: string }
  | { mode: "unconfigured"; devMessage: string };

function trimApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "").trim();
}

export function isMockAuthExplicitlyEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_MOCK_AUTH === "true"
  );
}

/**
 * When API URL is unset: mock only if dev + ALLOW_MOCK_AUTH + both mock creds set.
 */
export function resolveEmailPasswordAuthBackend(): AuthBackend {
  const apiUrl = trimApiUrl();
  if (apiUrl.length > 0) {
    return { mode: "proxy", apiUrl };
  }

  if (!isMockAuthExplicitlyEnabled()) {
    const isDev = process.env.NODE_ENV === "development";
    return {
      mode: "unconfigured",
      devMessage: isDev
        ? "Set NEXT_PUBLIC_API_URL, or for local-only mock auth set ALLOW_MOCK_AUTH=true with MOCK_AUTH_EMAIL and MOCK_AUTH_PASSWORD."
        : "Authentication is not configured.",
    };
  }

  const mockEmail = process.env.MOCK_AUTH_EMAIL?.trim() ?? "";
  const mockPassword = process.env.MOCK_AUTH_PASSWORD ?? "";
  if (!mockEmail || !mockPassword) {
    return {
      mode: "unconfigured",
      devMessage:
        "Mock auth is enabled (ALLOW_MOCK_AUTH=true) but MOCK_AUTH_EMAIL and MOCK_AUTH_PASSWORD must both be set.",
    };
  }

  return { mode: "mock", mockEmail, mockPassword };
}

export function json503AuthUnconfigured(devMessage: string): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  return NextResponse.json(
    {
      success: false,
      error: isDev
        ? devMessage
        : "Authentication service is unavailable. Please try again later.",
    },
    { status: 503 },
  );
}
