import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.guardrailai.dev";

export async function POST(request: Request) {
  try {
    // Get authorization header if present
    const authHeader = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");

    // Build headers for backend request
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    if (cookie) {
      headers["Cookie"] = cookie;
    }

    // Proxy request to backend
    const response = await fetch(`${API_URL}/api/auth/github/connect`, {
      method: "POST",
      headers,
      credentials: "include",
    });

    const data = await response.json();

    // Forward response with same status
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Set-Cookie": response.headers.get("set-cookie") || "",
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("GitHub connect error:", error);
    return NextResponse.json(
      { error: "Failed to connect to GitHub", message: error.message },
      { status: 500 },
    );
  }
}
