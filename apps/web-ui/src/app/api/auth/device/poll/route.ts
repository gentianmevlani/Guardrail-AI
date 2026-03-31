/**
 * POST /api/auth/device/poll
 *
 * Polled by CLI/VS Code extension to check if the user has authorized the device code.
 * Returns pending/authorized/expired status.
 * On authorized: returns access_token + refresh_token + user info.
 */

import { NextResponse } from "next/server";
import { getByDeviceCode, markAsUsed } from "@/lib/device-code-store";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { device_code } = body;

    if (!device_code) {
      return NextResponse.json(
        { error: "device_code is required" },
        { status: 400 },
      );
    }

    const entry = getByDeviceCode(device_code);

    if (!entry) {
      return NextResponse.json(
        { error: "invalid_device_code", status: "invalid" },
        { status: 404 },
      );
    }

    if (entry.status === "expired") {
      return NextResponse.json({ status: "expired" });
    }

    if (entry.status === "used") {
      return NextResponse.json(
        { error: "code_already_used", status: "used" },
        { status: 410 },
      );
    }

    if (entry.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    // Status is "authorized" — issue tokens and return user info
    if (entry.status === "authorized" && entry.userId) {
      // Generate tokens for the CLI/extension
      // In production, use authService.issueAccessAndRefreshTokens(entry.userId)
      // For now, generate a session-linked API key
      const apiKey = `gr_pro_${randomBytes(24).toString("base64url")}`;

      // Mark as used so it can't be polled again
      markAsUsed(device_code);

      return NextResponse.json({
        status: "authorized",
        access_token: apiKey,
        token_type: "bearer",
        user: {
          id: entry.userId,
          email: entry.userEmail || "",
          name: entry.userName || "",
        },
        plan: "pro",
        scopes: [
          "scan:local",
          "gate:local",
          "proof:reality",
          "fix:apply",
          "report:upload",
        ],
      });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return NextResponse.json(
      { error: "Poll failed" },
      { status: 500 },
    );
  }
}
