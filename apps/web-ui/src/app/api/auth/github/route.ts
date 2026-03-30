import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Check if GitHub token is configured
  const token = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;

  if (token) {
    // Token is configured, redirect to dashboard
    return NextResponse.redirect(
      new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  // No token configured - return instructions
  return NextResponse.json(
    {
      error: "GitHub not configured",
      message:
        "GitHub integration requires a Personal Access Token. Set GITHUB_ACCESS_TOKEN in your environment variables.",
      instructions: [
        "1. Go to GitHub Settings > Developer Settings > Personal Access Tokens",
        '2. Generate a new token with "repo" scope',
        "3. Set GITHUB_ACCESS_TOKEN environment variable in Netlify",
        "4. Redeploy the application",
      ],
    },
    { status: 400 },
  );
}
