import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001";

/**
 * Logout - Clear all auth sessions
 */
export async function POST(request: NextRequest) {
  // Get access token from request for proper logout
  const cookie = request.headers.get("cookie");
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");

  // Try to logout from backend (invalidates all sessions)
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
    });
  } catch {
    // Backend might not be available, continue with local logout
  }

  // Clear all OAuth session cookies
  const response = NextResponse.json({ success: true });

  // Clear all auth-related cookies
  const cookieNames = [
    "guardrail_session",
    "refreshToken",
    "auth_token",
    "github_user",
    "github_access_token",
    "github_oauth_state",
    "google_user",
    "google_access_token",
    "google_oauth_state",
  ];

  cookieNames.forEach(name => {
    response.cookies.delete(name);
    response.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
    });
  });

  // Clear localStorage items (client-side)
  // Note: This requires client-side cleanup

  return response;
}

export async function GET() {
  // Also support GET for redirect-based logout
  const response = NextResponse.redirect(`${APP_URL}/`);

  // Clear email session cookie
  response.cookies.delete("guardrail_session");

  // Clear all OAuth session cookies
  response.cookies.delete("github_user");
  response.cookies.delete("github_access_token");
  response.cookies.delete("github_oauth_state");
  response.cookies.delete("google_user");
  response.cookies.delete("google_access_token");
  response.cookies.delete("google_oauth_state");

  return response;
}
