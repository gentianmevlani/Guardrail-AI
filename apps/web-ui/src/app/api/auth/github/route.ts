import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const appBase =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001";

/**
 * GitHub OAuth — start login (same behavior as /api/auth/github/login).
 * Registered callback must match GITHUB_CALLBACK_URL / GITHUB_REDIRECT_URI
 * or default {NEXT_PUBLIC_APP_URL}/api/auth/github/callback.
 */
export async function GET() {
  const clientId =
    process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

  const redirectUri =
    process.env.GITHUB_CALLBACK_URL ||
    process.env.GITHUB_REDIRECT_URI ||
    `${appBase}/api/auth/github/callback`;

  if (process.env.NODE_ENV === "development") {
    logger.debug("[GitHub OAuth] init", {
      clientIdExists: !!clientId,
      redirectUri,
    });
  }

  if (!clientId) {
    return NextResponse.json(
      {
        error: "GitHub OAuth not configured",
        message:
          "Set GITHUB_CLIENT_ID (or NEXT_PUBLIC_GITHUB_CLIENT_ID) and GITHUB_CLIENT_SECRET",
      },
      { status: 500 },
    );
  }

  const scopes = ["user:email", "read:user", "repo"].join(" ");

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

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}

export async function POST() {
  return GET();
}
