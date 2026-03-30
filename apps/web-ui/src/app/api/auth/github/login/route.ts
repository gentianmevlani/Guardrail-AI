import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GitHub OAuth Login - Initiates the OAuth flow
 * Redirects user to GitHub for authorization
 */
export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri =
    process.env.GITHUB_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "GitHub OAuth not configured",
        message: "Please set GITHUB_CLIENT_ID in environment variables",
      },
      { status: 500 },
    );
  }

  // GitHub OAuth scopes for login + repo access
  const scopes = ["user:email", "read:user", "repo"].join(" ");

  // Generate state for CSRF protection
  const state = Buffer.from(
    JSON.stringify({
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7),
    }),
  ).toString("base64");

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  // Set state in cookie for verification on callback
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("github_oauth_state", state, {
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
