import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.guardrail.dev";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 },
      );
    }

    // Proxy request to backend
    const response = await fetch(`${API_URL}/api/auth/request-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: body.email }),
    });

    const data = await response.json();

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message:
        "If an account with this email exists, a reset link has been sent",
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("Forgot password error:", error);
    return NextResponse.json(
      {
        success: true,
        message:
          "If an account with this email exists, a reset link has been sent",
      },
      { status: 200 },
    );
  }
}
