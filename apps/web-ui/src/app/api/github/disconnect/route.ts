import { logger } from "@/lib/logger";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Clear GitHub OAuth cookies
    cookieStore.delete("github_access_token");
    cookieStore.delete("github_scope");
    cookieStore.delete("github_oauth_state");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logUnknownError("GitHub disconnect error", error);
    return NextResponse.json(
      { error: "Failed to disconnect GitHub" },
      { status: 500 },
    );
  }
}
