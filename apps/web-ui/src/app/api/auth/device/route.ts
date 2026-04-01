/**
 * POST /api/auth/device
 *
 * Initiates a device code flow. Called by CLI or VS Code extension.
 * Returns a device_code (for polling) and user_code (for the user to enter on web).
 */

import { NextResponse } from "next/server";
import { createDeviceCode } from "@/lib/device-code-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientType = body.client_type === "vscode" ? "vscode" as const
      : body.client_type === "cli" ? "cli" as const
      : "unknown" as const;

    const result = createDeviceCode(clientType);

    // Build the verification URL
    const host = request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const verificationUrl = `${proto}://${host}/link-device?code=${result.userCode}`;

    return NextResponse.json({
      device_code: result.deviceCode,
      user_code: result.userCode,
      verification_url: verificationUrl,
      expires_in: result.expiresIn,
      interval: result.interval,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create device code" },
      { status: 500 },
    );
  }
}
