import { logger } from "@/lib/logger";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/github/callback`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle errors from GitHub
    if (error) {
      logger.error("GitHub OAuth error", { error });
      return NextResponse.redirect(
        `${APP_URL}/dashboard?error=github_auth_denied`,
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard?error=invalid_callback`,
      );
    }

    // Validate state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("github_oauth_state")?.value;

    if (!storedState || storedState !== state) {
      logger.error("Invalid OAuth state");
      return NextResponse.redirect(`${APP_URL}/dashboard?error=invalid_state`);
    }

    // Clear the state cookie
    cookieStore.delete("github_oauth_state");

    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard?error=oauth_not_configured`,
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      },
    );

    if (!tokenResponse.ok) {
      logger.error("Token exchange failed", { statusText: tokenResponse.statusText });
      return NextResponse.redirect(
        `${APP_URL}/dashboard?error=token_exchange_failed`,
      );
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      logger.error("Token error", {
        detail: tokenData.error_description || tokenData.error,
      });
      return NextResponse.redirect(
        `${APP_URL}/dashboard?error=token_exchange_failed`,
      );
    }

    // Store the access token in a secure HTTP-only cookie
    const response = NextResponse.redirect(
      `${APP_URL}/dashboard?github_connected=true`,
    );

    response.cookies.set("github_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Store token type and scope for reference
    if (tokenData.scope) {
      response.cookies.set("github_scope", tokenData.scope, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    logger.logUnknownError("GitHub callback error", error);
    return NextResponse.redirect(`${APP_URL}/dashboard?error=callback_failed`);
  }
}
