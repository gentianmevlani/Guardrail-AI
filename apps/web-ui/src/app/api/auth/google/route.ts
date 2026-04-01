import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Google OAuth Login - Initiates the OAuth flow
 * Redirects user to Google for authorization
 */
export async function GET() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001";
  const redirectUri =
    process.env.GOOGLE_CALLBACK_URL ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${appBase}/api/auth/google/callback`;

  if (process.env.NODE_ENV === "development") {
    logger.debug("[Google OAuth] init", {
      clientIdExists: !!clientId,
      redirectUri,
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
  }

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Google OAuth not configured",
        message: "Please set GOOGLE_CLIENT_ID in environment variables",
      },
      { status: 500 },
    );
  }

  // Google OAuth scopes
  const scopes = ["openid", "email", "profile"].join(" ");

  // Generate state for CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7),
    }),
  ).toString("base64");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  // Set state in cookie for verification on callback
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}

export async function POST() {
  // Also support POST for flexibility
  return GET();
}
