/**
 * GitHub App Service
 * 
 * Handles GitHub App authentication, installation tokens, and API operations
 * for creating check runs and posting PR comments.
 */

import { Octokit } from "@octokit/rest";
import jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

function httpStatusFromUnknown(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  const s = (error as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET;

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

interface CheckRunAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "notice" | "warning" | "failure";
  message: string;
  title: string;
  raw_details?: string;
}

interface CheckRunOutput {
  title: string;
  summary: string;
  text?: string;
  annotations?: CheckRunAnnotation[];
}

/**
 * Generate a JWT for GitHub App authentication
 */
function generateAppJWT(): string {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time (60 seconds in the past for clock skew)
    exp: now + 60 * 10, // Expires in 10 minutes
    iss: GITHUB_APP_ID, // Issuer (GitHub App ID)
  };

  // Handle base64 encoded private key
  let privateKey = GITHUB_APP_PRIVATE_KEY;
  if (!privateKey.includes("BEGIN")) {
    privateKey = Buffer.from(privateKey, "base64").toString("utf-8");
  }

  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}

/**
 * Get an installation access token for a GitHub App installation
 */
export async function getInstallationToken(
  installationId: number
): Promise<string> {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials not configured");
  }

  const jwt = generateAppJWT();
  const octokit = new Octokit({
    auth: jwt,
  });

  try {
    const { data } = await octokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

    return data.token;
  } catch (error: unknown) {
    throw new Error(
      `Failed to get installation token: ${toErrorMessage(error) || "Unknown error"}`
    );
  }
}

/**
 * Get an authenticated Octokit instance for an installation
 */
export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  const token = await getInstallationToken(installationId);
  return new Octokit({ auth: token });
}

/**
 * Create or update a check run for a commit
 */
export async function createCheckRun(
  installationId: number,
  owner: string,
  repo: string,
  headSha: string,
  name: string,
  status: "queued" | "in_progress" | "completed",
  conclusion?: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required",
  output?: CheckRunOutput,
  externalId?: string
): Promise<{ id: number; checkRunId: number }> {
  const octokit = await getInstallationOctokit(installationId);

  let lastError: unknown = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data } = await octokit.checks.create({
        owner,
        repo,
        name,
        head_sha: headSha,
        status,
        conclusion,
        output,
        external_id: externalId,
      });

      // Log success on retry
      if (attempt > 1) {
        const logger = (await import('../logger')).logger;
        (logger as any).info({
          installationId,
          owner,
          repo,
          attempt,
          checkRunId: data.id,
        }, 'GitHub check run created after retry');
      }

      return {
        id: data.id,
        checkRunId: data.id,
      };
    } catch (error: unknown) {
      lastError = error;

      const status = httpStatusFromUnknown(error);
      // Retry on rate limits (429) or server errors (5xx)
      const shouldRetry =
        attempt < maxAttempts &&
        status !== undefined &&
        (status === 429 || (status >= 500 && status < 600));

      if (shouldRetry) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        const logger = (await import('../logger')).logger;
        (logger as any).warn({
          installationId,
          owner,
          repo,
          attempt,
          error: toErrorMessage(error),
          status,
          retryIn: delay,
        }, 'GitHub check run creation failed, retrying');

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry on client errors (4xx except 429)
      break;
    }
  }

  throw new Error(
    `Failed to create check run after ${maxAttempts} attempts: ${toErrorMessage(lastError)}`
  );
}

/**
 * Update an existing check run with retry logic
 */
export async function updateCheckRun(
  installationId: number,
  owner: string,
  repo: string,
  checkRunId: number,
  status: "queued" | "in_progress" | "completed",
  conclusion?: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required",
  output?: CheckRunOutput
): Promise<void> {
  const octokit = await getInstallationOctokit(installationId);

  let lastError: unknown = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await octokit.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status,
        conclusion,
        output,
      });

      // Log success on retry
      if (attempt > 1) {
        const logger = (await import('../logger')).logger;
        (logger as any).info({
          installationId,
          owner,
          repo,
          checkRunId,
          attempt,
        }, 'GitHub check run updated after retry');
      }

      return;
    } catch (error: unknown) {
      lastError = error;

      const status = httpStatusFromUnknown(error);
      const shouldRetry =
        attempt < maxAttempts &&
        status !== undefined &&
        (status === 429 || (status >= 500 && status < 600));

      if (shouldRetry) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        const logger = (await import('../logger')).logger;
        (logger as any).warn({
          installationId,
          owner,
          repo,
          checkRunId,
          attempt,
          error: toErrorMessage(error),
          status,
          retryIn: delay,
        }, 'GitHub check run update failed, retrying');

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry on client errors (4xx except 429)
      break;
    }
  }

  throw new Error(
    `Failed to update check run after ${maxAttempts} attempts: ${toErrorMessage(lastError)}`
  );
}

/**
 * Create annotations from findings (only critical/high severity)
 */
export function createAnnotationsFromFindings(
  findings: Array<{
    file: string;
    line: number;
    endLine?: number;
    severity: string;
    title: string;
    message: string;
  }>
): CheckRunAnnotation[] {
  return findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .map((finding) => ({
      path: finding.file,
      start_line: finding.line,
      end_line: finding.endLine || finding.line,
      annotation_level:
        finding.severity === "critical" ? "failure" : "warning",
      message: finding.message,
      title: finding.title,
    }));
}

/**
 * Post a comment on a pull request
 */
export async function postPRComment(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<number> {
  const octokit = await getInstallationOctokit(installationId);

  try {
    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    return data.id;
  } catch (error: unknown) {
    throw new Error(
      `Failed to post PR comment: ${toErrorMessage(error) || "Unknown error"}`
    );
  }
}

/**
 * Find existing comment on PR by bot (to avoid duplicates)
 */
export async function findExistingComment(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  commentMarker: string
): Promise<number | null> {
  const octokit = await getInstallationOctokit(installationId);

  try {
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    // Find comment that contains our marker
    const existing = comments.find((comment) =>
      comment.body?.includes(commentMarker)
    );

    return existing ? existing.id : null;
  } catch (error: unknown) {
    // If we can't find comments, return null (will create new one)
    return null;
  }
}

/**
 * Update an existing PR comment
 */
export async function updatePRComment(
  installationId: number,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<void> {
  const octokit = await getInstallationOctokit(installationId);

  try {
    await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body,
    });
  } catch (error: unknown) {
    throw new Error(
      `Failed to update PR comment: ${toErrorMessage(error) || "Unknown error"}`
    );
  }
}

/**
 * Generate a summary table for PR comment
 */
export function generatePRCommentSummary(
  findings: Array<{
    severity: string;
    category: string;
    title: string;
    file: string;
    line: number;
  }>,
  runId: string,
  runUrl: string,
  trustScore?: {
    score: number;
    verdict: string;
    grade: string;
    delta?: number;
    previousScore?: number;
    dimensions?: Record<string, { score: number; label: string; findingCount: number }>;
  }
): string {
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  findings.forEach((f) => {
    const severity = f.severity.toLowerCase() as keyof typeof severityCounts;
    if (severityCounts[severity] !== undefined) {
      severityCounts[severity]++;
    }
  });

  const total = findings.length;
  const criticalHigh = severityCounts.critical + severityCounts.high;

  // Decision icons
  const verdictIcon = trustScore?.verdict === 'SHIP' ? '🟢' :
    trustScore?.verdict === 'REVIEW' ? '🟡' : '🔴';
  const statusEmoji = criticalHigh > 0 ? "🔴" : total > 0 ? "🟡" : "🟢";
  const statusText =
    criticalHigh > 0
      ? "NO SHIP"
      : total > 0
      ? "REVIEW"
      : "SHIP";

  const lines: string[] = [];

  // Header with trust score
  if (trustScore) {
    const deltaStr = trustScore.delta !== undefined && trustScore.previousScore !== undefined
      ? ` (${trustScore.delta >= 0 ? '+' : ''}${trustScore.delta} from \`main\`)`
      : '';

    lines.push(`## ${verdictIcon} Guardrail: ${trustScore.score}/100 — ${trustScore.verdict} ${trustScore.verdict === 'SHIP' ? '✅' : trustScore.verdict === 'REVIEW' ? '⚠️' : '⛔'}`)
    lines.push('');
    lines.push(`**Grade:** ${trustScore.grade} | **Score:** ${trustScore.score}/100${deltaStr} | **Findings:** ${total}`);
  } else {
    lines.push(`## ${statusEmoji} Guardrail Scan — ${statusText}`);
    lines.push('');
    lines.push(`**Findings:** ${total} total`);
  }
  lines.push('');

  // Severity breakdown
  lines.push('<details>');
  lines.push(`<summary>Severity Breakdown (${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low)</summary>`);
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  lines.push(`| 🔴 Critical | ${severityCounts.critical} |`);
  lines.push(`| 🟠 High | ${severityCounts.high} |`);
  lines.push(`| 🟡 Medium | ${severityCounts.medium} |`);
  lines.push(`| 🔵 Low | ${severityCounts.low} |`);
  lines.push(`| **Total** | **${total}** |`);
  lines.push('</details>');
  lines.push('');

  // Dimension scores (if available)
  if (trustScore?.dimensions && Object.keys(trustScore.dimensions).length > 0) {
    lines.push('<details>');
    lines.push('<summary>Trust Score Dimensions</summary>');
    lines.push('');
    lines.push('| Dimension | Score | Findings |');
    lines.push('|-----------|-------|----------|');
    for (const [, dim] of Object.entries(trustScore.dimensions)) {
      const bar = dim.score >= 85 ? '🟢' : dim.score >= 70 ? '🟡' : '🔴';
      lines.push(`| ${dim.label} | ${bar} ${dim.score}/100 | ${dim.findingCount} |`);
    }
    lines.push('</details>');
    lines.push('');
  }

  // Top findings preview (up to 5 critical/high)
  const topFindings = findings
    .filter(f => ['critical', 'high'].includes(f.severity.toLowerCase()))
    .slice(0, 5);

  if (topFindings.length > 0) {
    lines.push('<details open>');
    lines.push('<summary>Top Findings</summary>');
    lines.push('');
    for (const f of topFindings) {
      const icon = f.severity.toLowerCase() === 'critical' ? '🔴' : '🟠';
      const location = f.line > 0 ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      lines.push(`- ${icon} **${f.title}** — ${location}`);
    }
    if (findings.filter(f => ['critical', 'high'].includes(f.severity.toLowerCase())).length > 5) {
      lines.push(`- ... and ${findings.filter(f => ['critical', 'high'].includes(f.severity.toLowerCase())).length - 5} more`);
    }
    lines.push('</details>');
    lines.push('');
  }

  // Footer
  lines.push(`[View Full Report](${runUrl}) | Run \`${runId.slice(0, 8)}\``);
  lines.push('');
  lines.push('---');
  lines.push('*Powered by [Guardrail](https://guardrailai.dev) — Ship Real Code. Prove It.*');

  return lines.join('\n');
}
