import { logger } from "@/lib/logger";
import { Octokit } from "@octokit/rest";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Prevent static generation - this route requires runtime environment variables
export const dynamic = "force-dynamic";

async function getGitHubToken(): Promise<string | null> {
  // First check OAuth token from cookie (user-authorized)
  const cookieStore = cookies();
  const oauthToken = cookieStore.get("github_access_token")?.value;
  if (oauthToken) {
    return oauthToken;
  }

  // Fallback to environment variable (server-level PAT)
  const envToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
  return envToken || null;
}

export async function GET() {
  try {
    const token = await getGitHubToken();

    if (!token) {
      return NextResponse.json({
        connected: false,
        configured: !!(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ),
      });
    }

    const client = new Octokit({ auth: token });
    const [{ data: user }, { data: repos }] = await Promise.all([
      client.users.getAuthenticated(),
      client.repos.listForAuthenticatedUser({ per_page: 100, sort: "updated" }),
    ]);

    interface GitHubRepo {
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      html_url: string;
      language: string | null;
      default_branch?: string;
    }
    const repositories = repos.map((repo: GitHubRepo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      language: repo.language,
      lastScan: null,
    }));

    return NextResponse.json({
      connected: true,
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      },
      repositories,
    });
  } catch (err: unknown) {
    logger.error("GitHub status error:", err);
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
