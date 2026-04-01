import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Get current authenticated user
 * Checks OAuth session cookies and backend session
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies();

  // Check for email/password session (guardrail_session cookie)
  const sessionCookie = cookieStore.get("guardrail_session");
  if (sessionCookie) {
    try {
      const session = JSON.parse(
        Buffer.from(sessionCookie.value, "base64").toString("utf-8"),
      );
      // Check if session is expired
      if (session.exp && session.exp > Date.now()) {
        return NextResponse.json({
          id: session.id,
          email: session.email,
          name: session.name,
          firstName: session.name?.split(" ")[0],
          lastName: session.name?.split(" ").slice(1).join(" "),
          profileImageUrl: null,
          provider: "email",
          subscription: {
            plan: session.tier || "free",
            status: "active",
          },
          createdAt: session.createdAt || new Date().toISOString(),
        });
      }
    } catch {
      // Invalid cookie, continue to check other sources
    }
  }

  // Check for GitHub OAuth session
  const githubUserCookie = cookieStore.get("github_user");
  if (githubUserCookie) {
    try {
      const user = JSON.parse(githubUserCookie.value);
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.name?.split(" ")[0],
        lastName: user.name?.split(" ").slice(1).join(" "),
        profileImageUrl: user.avatar,
        provider: "github",
        subscription: {
          plan: "free",
          status: "active",
        },
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Invalid cookie, continue to check other sources
    }
  }

  // Check for Google OAuth session
  const googleUserCookie = cookieStore.get("google_user");
  if (googleUserCookie) {
    try {
      const user = JSON.parse(googleUserCookie.value);
      return NextResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.name?.split(" ")[0],
        lastName: user.name?.split(" ").slice(1).join(" "),
        profileImageUrl: user.avatar,
        provider: "google",
        subscription: {
          plan: "free",
          status: "active",
        },
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Invalid cookie, continue to check other sources
    }
  }

  // Try to get user from backend API
  try {
    const authHeader = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");

    const headers: HeadersInit = {};
    if (authHeader) headers["Authorization"] = authHeader;
    if (cookie) headers["Cookie"] = cookie;

    const response = await fetch(`${API_URL}/api/auth/user`, {
      headers,
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch {
    // Backend not available
  }

  // No authenticated user found
  return NextResponse.json(null, { status: 401 });
}
