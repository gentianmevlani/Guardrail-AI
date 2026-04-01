import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Google OAuth Callback - Handles the OAuth redirect from Google
 * Exchanges code for token and creates/logs in user
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get("error_description") || "Authorization failed";
    return NextResponse.redirect(
      `${APP_URL}/?auth_error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/?auth_error=No authorization code received`);
  }

  // Verify state to prevent CSRF
  const cookieStore = cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;
  
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${APP_URL}/?auth_error=Invalid state parameter`);
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_CALLBACK_URL ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${APP_URL}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${APP_URL}/?auth_error=Google OAuth not configured`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        `${APP_URL}/?auth_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch user info from Google
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${APP_URL}/?auth_error=Failed to fetch Google user info`);
    }

    const googleUser: GoogleUserInfo = await userResponse.json();

    if (!googleUser.email) {
      return NextResponse.redirect(`${APP_URL}/?auth_error=No email associated with Google account`);
    }

    // Send user data to backend API to create/login user
    const authResponse = await fetch(`${API_URL}/api/auth/oauth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "google",
        providerId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        accessToken,
        refreshToken: tokenData.refresh_token,
      }),
    });

    if (!authResponse.ok) {
      const errBody = await authResponse.text();
      logger.error("Google OAuth backend error", { body: errBody });
      return NextResponse.redirect(
        `${APP_URL}/?auth_error=${encodeURIComponent("Failed to authenticate with server")}`,
      );
    }

    const authData = (await authResponse.json()) as {
      isNewUser?: boolean;
      data?: { token?: string };
    };

    const isNewUser = authData.isNewUser === true;
    const redirectPath = isNewUser ? "/pricing" : "/dashboard";
    const response = NextResponse.redirect(`${APP_URL}${redirectPath}`);

    if (authData.data?.token) {
      response.cookies.set("auth_token", authData.data.token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
    }

    const setCookie = authResponse.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("Set-Cookie", setCookie);
    }

    response.cookies.delete("google_oauth_state");

    return response;
  } catch (err) {
    logger.logUnknownError("Google OAuth callback error", err);
    return NextResponse.redirect(`${APP_URL}/?auth_error=Authentication failed`);
  }
}
