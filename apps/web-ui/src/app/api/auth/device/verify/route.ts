/**
 * POST /api/auth/device/verify
 *
 * Called by the web UI when a logged-in user enters/confirms a device code.
 * Links the device code to the user's account.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeDeviceCode } from "@/lib/device-code-store";

export async function POST(request: Request) {
  try {
    // Verify the user is logged in via session cookie
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get("session")?.value ||
      cookieStore.get("token")?.value ||
      cookieStore.get("next-auth.session-token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "You must be logged in to authorize a device" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { user_code } = body;

    if (!user_code || typeof user_code !== "string") {
      return NextResponse.json(
        { error: "user_code is required" },
        { status: 400 },
      );
    }

    // In production, decode the session token to get the real user.
    // For now, extract user info from the /api/auth/user endpoint pattern.
    let userId = "usr_web";
    let userEmail = "";
    let userName = "Web User";

    try {
      // Try to get real user from session
      const host = request.headers.get("host") || "localhost:3000";
      const proto = request.headers.get("x-forwarded-proto") || "http";
      const userRes = await fetch(`${proto}://${host}/api/auth/user`, {
        headers: {
          cookie: cookieStore
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData?.id) {
          userId = userData.id;
          userEmail = userData.email || "";
          userName =
            userData.name ||
            (userData.firstName && userData.lastName
              ? `${userData.firstName} ${userData.lastName}`
              : userData.email || "User");
        }
      }
    } catch {
      // Use defaults if user fetch fails
    }

    const result = authorizeDeviceCode(user_code, userId, userEmail, userName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Device authorized successfully",
      client_type: result.clientType,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 },
    );
  }
}
