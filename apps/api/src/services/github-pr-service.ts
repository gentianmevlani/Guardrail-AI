/**
 * GitHub PR Integration Service
 *
 * Handles:
 * - Posting commit status checks
 * - Creating PR comments with scan results
 * - Managing GitHub Check Runs
 */

import { Octokit } from "@octokit/rest";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Types
interface ScanResult {
  verdict: "SHIP" | "NO_SHIP" | "REVIEW";
  score: number;
  findings: Array<{
    severity: "critical" | "warning" | "info";
    file: string;
    line: number;
    title: string;
    message: string;
  }>;
  metrics: {
    filesScanned: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
  };
  duration: number;
}

interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
  sha: string;
  branch: string;
}

interface CheckRunOptions {
  owner: string;
  repo: string;
  sha: string;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required";
  title?: string;
  summary?: string;
  text?: string;
  annotations?: Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: "notice" | "warning" | "failure";
    message: string;
    title?: string;
  }>;
}

/**
 * GitHub PR Service for posting scan results
 */
export class GitHubPRService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  /**
   * Create a commit status check
   */
  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    state: "pending" | "success" | "failure" | "error",
    context: string = "guardrail/ship-check",
    description?: string,
    targetUrl?: string
  ): Promise<void> {
    try {
      await this.octokit.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        context,
        description: description?.substring(0, 140), // GitHub limit
        target_url: targetUrl,
      });

      logger.info({ owner, repo, sha, state, context }, "Created commit status");
    } catch (error: unknown) {
      logger.error(
        { error: toErrorMessage(error), owner, repo, sha },
        "Failed to create commit status"
      );
      throw error;
    }
  }

  /**
   * Create or update a Check Run (GitHub Checks API)
   */
  async createCheckRun(options: CheckRunOptions): Promise<number> {
    try {
      const response = await this.octokit.checks.create({
        owner: options.owner,
        repo: options.repo,
        head_sha: options.sha,
        name: options.name,
        status: options.status,
        conclusion: options.conclusion,
        output: {
          title: options.title || "guardrail Check",
          summary: options.summary || "",
          text: options.text,
          annotations: options.annotations?.slice(0, 50), // GitHub limit
        },
      });

      logger.info(
        { checkRunId: response.data.id, owner: options.owner, repo: options.repo },
        "Created check run"
      );

      return response.data.id;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Failed to create check run");
      throw error;
    }
  }

  /**
   * Update an existing Check Run
   */
  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    options: Partial<CheckRunOptions>
  ): Promise<void> {
    try {
      await this.octokit.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: options.status,
        conclusion: options.conclusion,
        output: options.title
          ? {
              title: options.title,
              summary: options.summary || "",
              text: options.text,
              annotations: options.annotations?.slice(0, 50),
            }
          : undefined,
      });

      logger.info({ checkRunId, owner, repo }, "Updated check run");
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), checkRunId }, "Failed to update check run");
      throw error;
    }
  }

  /**
   * Post a PR comment with scan results
   */
  async postPRComment(context: PRContext, scanResult: ScanResult): Promise<void> {
    const comment = this.formatScanComment(scanResult, context);

    try {
      // First, try to find and update existing guardrail comment
      const existingComment = await this.findExistingComment(context);

      if (existingComment) {
        await this.octokit.issues.updateComment({
          owner: context.owner,
          repo: context.repo,
          comment_id: existingComment.id,
          body: comment,
        });
        logger.info({ commentId: existingComment.id }, "Updated existing PR comment");
      } else {
        await this.octokit.issues.createComment({
          owner: context.owner,
          repo: context.repo,
          issue_number: context.pullNumber,
          body: comment,
        });
        logger.info({ pr: context.pullNumber }, "Created new PR comment");
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Failed to post PR comment");
      throw error;
    }
  }

  /**
   * Post inline review comments on specific files/lines
   */
  async postInlineComments(
    context: PRContext,
    findings: ScanResult["findings"]
  ): Promise<void> {
    // Group findings by severity for batch processing
    const criticalFindings = findings.filter((f) => f.severity === "critical");

    // Only post inline comments for critical findings to avoid spam
    const commentsToPost = criticalFindings.slice(0, 10).map((finding) => ({
      path: finding.file,
      line: finding.line,
      body: this.formatInlineComment(finding),
    }));

    if (commentsToPost.length === 0) return;

    try {
      // Create a review with comments
      await this.octokit.pulls.createReview({
        owner: context.owner,
        repo: context.repo,
        pull_number: context.pullNumber,
        commit_id: context.sha,
        event: "COMMENT",
        comments: commentsToPost,
      });

      logger.info(
        { count: commentsToPost.length, pr: context.pullNumber },
        "Posted inline review comments"
      );
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Failed to post inline comments");
      // Don't throw - inline comments are not critical
    }
  }

  /**
   * Report scan results with full Check Run + PR comment
   */
  async reportScanResults(
    context: PRContext,
    scanResult: ScanResult,
    dashboardUrl?: string
  ): Promise<void> {
    const { owner, repo, sha, pullNumber } = context;

    // 1. Create commit status
    await this.createCommitStatus(
      owner,
      repo,
      sha,
      scanResult.verdict === "SHIP" ? "success" : "failure",
      "guardrail/ship-check",
      this.getStatusDescription(scanResult),
      dashboardUrl
    );

    // 2. Create detailed check run
    const checkRunId = await this.createCheckRun({
      owner,
      repo,
      sha,
      name: "guardrail Ship Check",
      status: "completed",
      conclusion: this.getCheckConclusion(scanResult),
      title: this.getCheckTitle(scanResult),
      summary: this.getCheckSummary(scanResult),
      text: this.getCheckDetails(scanResult),
      annotations: this.getAnnotations(scanResult.findings),
    });

    // 3. Post PR comment
    await this.postPRComment(context, scanResult);

    // 4. Post inline comments for critical issues
    if (scanResult.findings.some((f) => f.severity === "critical")) {
      await this.postInlineComments(context, scanResult.findings);
    }

    logger.info(
      {
        owner,
        repo,
        pullNumber,
        verdict: scanResult.verdict,
        checkRunId,
      },
      "Reported scan results to GitHub"
    );
  }

  /**
   * Start a pending check (call before scan starts)
   */
  async startPendingCheck(
    owner: string,
    repo: string,
    sha: string
  ): Promise<number> {
    // Create pending commit status
    await this.createCommitStatus(
      owner,
      repo,
      sha,
      "pending",
      "guardrail/ship-check",
      "Running ship check..."
    );

    // Create in-progress check run
    return this.createCheckRun({
      owner,
      repo,
      sha,
      name: "guardrail Ship Check",
      status: "in_progress",
      title: "Running guardrail Analysis",
      summary: "Scanning for mock data, dead routes, and security issues...",
    });
  }

  // Helper methods

  private async findExistingComment(context: PRContext): Promise<{ id: number } | null> {
    try {
      const { data: comments } = await this.octokit.issues.listComments({
        owner: context.owner,
        repo: context.repo,
        issue_number: context.pullNumber,
        per_page: 100,
      });

      const guardrailComment = comments.find(
        (c) =>
          c.body?.includes("<!-- guardrail-report -->") ||
          c.body?.includes("## guardrail Scan Results")
      );

      return guardrailComment ? { id: guardrailComment.id } : null;
    } catch {
      return null;
    }
  }

  private formatScanComment(result: ScanResult, context: PRContext): string {
    const emoji =
      result.verdict === "SHIP"
        ? "🚀"
        : result.verdict === "NO_SHIP"
          ? "🚫"
          : "⚠️";
    const statusBadge =
      result.verdict === "SHIP"
        ? "![SHIP](https://img.shields.io/badge/status-SHIP-success)"
        : result.verdict === "NO_SHIP"
          ? "![NO_SHIP](https://img.shields.io/badge/status-NO_SHIP-critical)"
          : "![REVIEW](https://img.shields.io/badge/status-REVIEW-yellow)";

    let comment = `<!-- guardrail-report -->
## ${emoji} guardrail Scan Results

${statusBadge}

| Metric | Value |
|--------|-------|
| **Score** | ${result.score}/100 |
| **Files Scanned** | ${result.metrics.filesScanned} |
| **Issues Found** | ${result.metrics.issuesFound} |
| **Critical** | ${result.metrics.criticalCount} |
| **Warnings** | ${result.metrics.warningCount} |
| **Duration** | ${result.duration}s |

`;

    if (result.findings.length > 0) {
      comment += `### Findings\n\n`;

      // Group by severity
      const critical = result.findings.filter((f) => f.severity === "critical");
      const warnings = result.findings.filter((f) => f.severity === "warning");

      if (critical.length > 0) {
        comment += `<details>\n<summary><b>🔴 Critical (${critical.length})</b></summary>\n\n`;
        critical.slice(0, 5).forEach((f) => {
          comment += `- **${f.title}** - \`${f.file}:${f.line}\`\n  ${f.message}\n`;
        });
        if (critical.length > 5) {
          comment += `\n... and ${critical.length - 5} more\n`;
        }
        comment += `\n</details>\n\n`;
      }

      if (warnings.length > 0) {
        comment += `<details>\n<summary><b>🟡 Warnings (${warnings.length})</b></summary>\n\n`;
        warnings.slice(0, 5).forEach((f) => {
          comment += `- **${f.title}** - \`${f.file}:${f.line}\`\n  ${f.message}\n`;
        });
        if (warnings.length > 5) {
          comment += `\n... and ${warnings.length - 5} more\n`;
        }
        comment += `\n</details>\n\n`;
      }
    }

    comment += `---\n`;
    comment += `*Commit: ${context.sha.substring(0, 7)} | Branch: ${context.branch}*\n`;
    comment += `*Powered by [guardrail](https://guardrailai.dev) - CI Truth for AI-Generated Code*`;

    return comment;
  }

  private formatInlineComment(finding: ScanResult["findings"][0]): string {
    const emoji =
      finding.severity === "critical"
        ? "🔴"
        : finding.severity === "warning"
          ? "🟡"
          : "ℹ️";

    return `${emoji} **guardrail: ${finding.title}**

${finding.message}

---
*This issue was detected by [guardrail](https://guardrailai.dev)*`;
  }

  private getStatusDescription(result: ScanResult): string {
    if (result.verdict === "SHIP") {
      return `Ready to ship! Score: ${result.score}/100`;
    } else if (result.verdict === "NO_SHIP") {
      return `${result.metrics.criticalCount} critical issues found`;
    }
    return `Review needed: ${result.metrics.issuesFound} issues`;
  }

  private getCheckConclusion(
    result: ScanResult
  ): "success" | "failure" | "neutral" {
    if (result.verdict === "SHIP") return "success";
    if (result.verdict === "NO_SHIP") return "failure";
    return "neutral";
  }

  private getCheckTitle(result: ScanResult): string {
    if (result.verdict === "SHIP") {
      return `Ship Ready - Score: ${result.score}/100`;
    } else if (result.verdict === "NO_SHIP") {
      return `Not Ship Ready - ${result.metrics.criticalCount} Critical Issues`;
    }
    return `Review Needed - ${result.metrics.issuesFound} Issues`;
  }

  private getCheckSummary(result: ScanResult): string {
    return `## Scan Summary

- **Verdict**: ${result.verdict}
- **Score**: ${result.score}/100
- **Files Scanned**: ${result.metrics.filesScanned}
- **Issues Found**: ${result.metrics.issuesFound}
  - Critical: ${result.metrics.criticalCount}
  - Warnings: ${result.metrics.warningCount}
- **Duration**: ${result.duration}s`;
  }

  private getCheckDetails(result: ScanResult): string {
    if (result.findings.length === 0) {
      return "No issues detected. Your code looks production-ready!";
    }

    let details = "## Detailed Findings\n\n";

    result.findings.slice(0, 20).forEach((f, i) => {
      details += `### ${i + 1}. ${f.title}\n`;
      details += `- **File**: \`${f.file}:${f.line}\`\n`;
      details += `- **Severity**: ${f.severity}\n`;
      details += `- **Description**: ${f.message}\n\n`;
    });

    if (result.findings.length > 20) {
      details += `\n... and ${result.findings.length - 20} more findings.\n`;
    }

    return details;
  }

  private getAnnotations(
    findings: ScanResult["findings"]
  ): CheckRunOptions["annotations"] {
    return findings.slice(0, 50).map((f) => ({
      path: f.file,
      start_line: f.line,
      end_line: f.line,
      annotation_level:
        f.severity === "critical"
          ? "failure"
          : f.severity === "warning"
            ? "warning"
            : "notice",
      message: f.message,
      title: f.title,
    }));
  }
}

/**
 * Factory function to create GitHubPRService with user's access token
 */
export async function createGitHubPRService(
  userId: string,
  prisma: any
): Promise<GitHubPRService | null> {
  try {
    const githubAccount = await prisma.githubAccount.findUnique({
      where: { userId },
    });

    if (!githubAccount?.accessToken) {
      logger.warn({ userId }, "No GitHub access token found for user");
      return null;
    }

    return new GitHubPRService(githubAccount.accessToken);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), userId }, "Failed to create GitHub PR service");
    return null;
  }
}

export default GitHubPRService;
