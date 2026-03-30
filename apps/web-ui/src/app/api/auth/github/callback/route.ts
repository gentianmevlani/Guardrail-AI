import { logger } from "@/lib/logger";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * GitHub OAuth Callback - Handles the OAuth redirect from GitHub
 * Exchanges code for token and creates/logs in user
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    const errorDescription =
      searchParams.get("error_description") || "Authorization failed";
    return NextResponse.redirect(
      `${APP_URL}/?auth_error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${APP_URL}/?auth_error=No authorization code received`,
    );
  }

  // Verify state to prevent CSRF
  const cookieStore = cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${APP_URL}/?auth_error=Invalid state parameter`,
    );
  }

  try {
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
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri:
            process.env.GITHUB_CALLBACK_URL ||
            `${APP_URL}/api/auth/github/callback`,
        }),
      },
    );

    const tokenData: GitHubTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        `${APP_URL}/?auth_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        `${APP_URL}/?auth_error=Failed to fetch GitHub user info`,
      );
    }

    const githubUser: GitHubUser = await userResponse.json();

    // Fetch user emails (in case primary email is private)
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (emailsResponse.ok) {
        const emails: GitHubEmail[] = await emailsResponse.json();
        const primaryEmail = emails.find((e) => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email || null;
      }
    }

    if (!email) {
      return NextResponse.redirect(
        `${APP_URL}/?auth_error=No email associated with GitHub account`,
      );
    }

    // Send user data to backend API to create/login user
    const authResponse = await fetch(`${API_URL}/api/auth/oauth/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "github",
        providerId: String(githubUser.id),
        email,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url,
        accessToken,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      logger.error("Backend OAuth error", { body: errorText });
      return NextResponse.redirect(
        `${APP_URL}/?auth_error=${encodeURIComponent("Failed to authenticate with backend")}`,
      );
    }

    const authData = await authResponse.json();

    // Determine redirect based on whether user is new or existing
    const isNewUser = authData.isNewUser;
    const redirectPath = isNewUser ? "/pricing" : "/dashboard";
    const response = NextResponse.redirect(`${APP_URL}${redirectPath}`);

    // Set the auth token as a cookie for the frontend
    if (authData.data?.token) {
      response.cookies.set("auth_token", authData.data.token, {
        httpOnly: false, // Accessible by JS for API calls
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 1 day (access token)
        path: "/",
      });
    }

    // Forward any cookies from the backend (refresh token)
    const setCookie = authResponse.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("Set-Cookie", setCookie);
    }

    // Clear OAuth state cookie
    response.cookies.delete("github_oauth_state");

    return response;
  } catch (err) {
    logger.logUnknownError("GitHub OAuth callback error", err);
    return NextResponse.redirect(
      `${APP_URL}/?auth_error=Authentication failed`,
    );
  }
}
