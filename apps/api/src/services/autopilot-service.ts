/**
 * guardrail Autopilot Service
 *
 * Continuous protection for vibe coders:
 * 1. Watches repos continuously
 * 2. Auto-fixes safe issues
 * 3. Creates PRs for complex issues with AI-generated fixes
 * 4. Blocks deploys that would break production
 * 5. Sends weekly report in plain English
 */

import { pool } from "@guardrail/database";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// App URL from environment (defaults to guardrail.dev)
const APP_BASE_URL = process.env.APP_BASE_URL || "https://app.guardrail.dev";

// Types
interface AutopilotConfig {
  repositoryId: string;
  userId: string;
  enabled: boolean;
  autoFixEnabled: boolean;
  autoPrEnabled: boolean;
  deployBlockingEnabled: boolean;
  weeklyDigestEnabled: boolean;
  slackWebhookUrl?: string;
  notificationEmail?: string;
}

interface ScanResult {
  score: number;
  problems: Problem[];
  warnings: Warning[];
  timestamp: Date;
}

interface Problem {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  plainEnglish: string;
  file: string;
  line?: number;
  autoFixable: boolean;
  fixAction?: string;
}

interface Warning {
  id: string;
  type: string;
  message: string;
  plainEnglish: string;
  file: string;
}

interface AutoFixResult {
  problemId: string;
  success: boolean;
  action: string;
  details?: string;
  prUrl?: string;
}

interface WeeklyDigest {
  repositoryId: string;
  repositoryName: string;
  period: { start: Date; end: Date };
  summary: {
    deploysBlocked: number;
    issuesAutoFixed: number;
    issuesNeedingReview: number;
    healthScore: number;
    healthTrend: "up" | "down" | "stable";
    previousScore: number;
  };
  highlights: string[];
  actionItems: ActionItem[];
}

interface ActionItem {
  priority: "urgent" | "soon" | "review";
  title: string;
  description: string;
  fixUrl?: string;
}

// Database row types for type-safe queries
interface AutopilotConfigRow {
  repository_id: string;
  user_id: string;
  enabled: boolean;
  auto_fix_enabled: boolean;
  auto_pr_enabled: boolean;
  deploy_blocking_enabled: boolean;
  weekly_digest_enabled: boolean;
  slack_webhook_url: string | null;
  notification_email: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AutopilotActivityRow {
  id: string;
  repository_id: string;
  action_type: string;
  details: string;
  created_at: Date;
}

interface RunRow {
  id: string;
  repository_id: string;
  status: string;
  score: number;
  created_at: Date;
}

interface RepositoryRow {
  id: string;
  full_name: string;
  name: string;
  default_branch: string;
}

interface FindingRow {
  id: string;
  repository_id: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  plain_english: string | null;
  fix_url: string | null;
  created_at: Date;
}

interface DigestConfigRow {
  repository_id: string;
  notification_email: string | null;
  slack_webhook_url: string | null;
  full_name: string;
}

// Plain English translations
const PLAIN_ENGLISH_ACTIONS: Record<string, string> = {
  "secret-moved": "Moved exposed secret to environment variables",
  "gitignore-updated": "Added sensitive files to .gitignore",
  "auth-middleware-added": "Added authentication check to protect route",
  "rate-limit-added": "Added rate limiting to prevent abuse",
  "error-handler-added": "Added proper error handling",
  "mock-removed": "Removed fake/mock data from production code",
  "dependency-updated": "Updated vulnerable dependency",
};

/**
 * Autopilot Service Class
 */
export class AutopilotService {
  private scanInterval: NodeJS.Timeout | null = null;
  private digestInterval: NodeJS.Timeout | null = null;

  constructor() {
    logger.info("AutopilotService initialized");
  }

  /**
   * Enable autopilot for a repository
   */
  async enableAutopilot(config: AutopilotConfig): Promise<void> {
    logger.info({ repositoryId: config.repositoryId }, "Enabling autopilot");

    await pool.query(
      `INSERT INTO autopilot_configs 
       (repository_id, user_id, enabled, auto_fix_enabled, auto_pr_enabled, 
        deploy_blocking_enabled, weekly_digest_enabled, slack_webhook_url, notification_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (repository_id) DO UPDATE SET
         enabled = $3,
         auto_fix_enabled = $4,
         auto_pr_enabled = $5,
         deploy_blocking_enabled = $6,
         weekly_digest_enabled = $7,
         slack_webhook_url = $8,
         notification_email = $9,
         updated_at = NOW()`,
      [
        config.repositoryId,
        config.userId,
        config.enabled,
        config.autoFixEnabled,
        config.autoPrEnabled,
        config.deployBlockingEnabled,
        config.weeklyDigestEnabled,
        config.slackWebhookUrl,
        config.notificationEmail,
      ],
    );
  }

  /**
   * Disable autopilot for a repository
   */
  async disableAutopilot(repositoryId: string): Promise<void> {
    logger.info({ repositoryId }, "Disabling autopilot");

    await pool.query(
      `UPDATE autopilot_configs SET enabled = false, updated_at = NOW() WHERE repository_id = $1`,
      [repositoryId],
    );
  }

  /**
   * Get autopilot status for a repository
   */
  async getAutopilotStatus(repositoryId: string): Promise<{
    enabled: boolean;
    config: AutopilotConfig | null;
    lastScan: Date | null;
    lastScore: number | null;
    recentActivity: unknown[];
  }> {
    const configResult = await pool.query<AutopilotConfigRow>(
      `SELECT * FROM autopilot_configs WHERE repository_id = $1`,
      [repositoryId],
    );

    const activityResult = await pool.query<AutopilotActivityRow>(
      `SELECT * FROM autopilot_activity 
       WHERE repository_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [repositoryId],
    );

    const lastScanResult = await pool.query<{
      created_at: Date;
      score: number;
    }>(
      `SELECT created_at, score FROM runs 
       WHERE repository_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [repositoryId],
    );

    const configRow = configResult.rows[0];
    const lastScan = lastScanResult.rows[0];

    // Map database row to application type
    const config: AutopilotConfig | null = configRow
      ? {
          repositoryId: configRow.repository_id,
          userId: configRow.user_id,
          enabled: configRow.enabled,
          autoFixEnabled: configRow.auto_fix_enabled,
          autoPrEnabled: configRow.auto_pr_enabled,
          deployBlockingEnabled: configRow.deploy_blocking_enabled,
          weeklyDigestEnabled: configRow.weekly_digest_enabled,
          slackWebhookUrl: configRow.slack_webhook_url || undefined,
          notificationEmail: configRow.notification_email || undefined,
        }
      : null;

    return {
      enabled: configRow?.enabled || false,
      config,
      lastScan: lastScan?.created_at || null,
      lastScore: lastScan?.score || null,
      recentActivity: activityResult.rows,
    };
  }

  /**
   * Run a scan and process results
   */
  async runScan(repositoryId: string): Promise<ScanResult> {
    logger.info({ repositoryId }, "Running autopilot scan");

    // Get repository info
    const repoResult = await pool.query<RepositoryRow>(
      `SELECT * FROM repositories WHERE id = $1`,
      [repositoryId],
    );
    const repo = repoResult.rows[0];

    if (!repo) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    // In production, this would:
    // 1. Clone/pull the latest code
    // 2. Run guardrail ship
    // 3. Parse the results

    // For now, simulate scan results
    const scanResult: ScanResult = {
      score: 75,
      problems: [],
      warnings: [],
      timestamp: new Date(),
    };

    // Store scan result
    await pool.query(
      `INSERT INTO runs (id, repository_id, status, score, created_at)
       VALUES (gen_random_uuid(), $1, 'completed', $2, NOW())`,
      [repositoryId, scanResult.score],
    );

    // Log activity
    await this.logActivity(repositoryId, "scan_completed", {
      score: scanResult.score,
      problemCount: scanResult.problems.length,
      warningCount: scanResult.warnings.length,
    });

    return scanResult;
  }

  /**
   * Auto-fix safe issues
   */
  async autoFix(
    repositoryId: string,
    problems: Problem[],
  ): Promise<AutoFixResult[]> {
    logger.info(
      { repositoryId, problemCount: problems.length },
      "Running auto-fix",
    );

    const results: AutoFixResult[] = [];
    const fixableProblems = problems.filter((p) => p.autoFixable);

    for (const problem of fixableProblems) {
      try {
        const result = await this.applyFix(repositoryId, problem);
        results.push(result);

        if (result.success) {
          await this.logActivity(repositoryId, "auto_fix_applied", {
            problemId: problem.id,
            action: result.action,
            plainEnglish: PLAIN_ENGLISH_ACTIONS[result.action] || result.action,
          });
        }
      } catch (error: unknown) {
        logger.error(
          { repositoryId, problemId: problem.id, error: toErrorMessage(error) },
          "Auto-fix failed",
        );
        results.push({
          problemId: problem.id,
          success: false,
          action: problem.fixAction || "unknown",
          details: toErrorMessage(error),
        });
      }
    }

    return results;
  }

  /**
   * Apply a specific fix
   */
  private async applyFix(
    repositoryId: string,
    problem: Problem,
  ): Promise<AutoFixResult> {
    const action = problem.fixAction || "unknown";

    // In production, this would actually modify the code
    // For now, we'll simulate the fix actions
    switch (action) {
      case "move-to-env":
        return {
          problemId: problem.id,
          success: true,
          action: "secret-moved",
          details: `Moved secret from ${problem.file} to .env`,
        };

      case "add-gitignore":
        return {
          problemId: problem.id,
          success: true,
          action: "gitignore-updated",
          details: `Added ${problem.file} to .gitignore`,
        };

      case "add-auth-middleware":
        // This requires a PR, not direct fix
        return {
          problemId: problem.id,
          success: false,
          action: "auth-middleware-needed",
          details: "Requires PR review - creating PR",
        };

      default:
        return {
          problemId: problem.id,
          success: false,
          action,
          details: "Fix action not implemented",
        };
    }
  }

  /**
   * Create a PR with AI-generated fixes
   */
  async createFixPR(
    repositoryId: string,
    problems: Problem[],
    githubToken: string,
  ): Promise<{ prUrl: string; problemsAddressed: string[] }> {
    logger.info(
      { repositoryId, problemCount: problems.length },
      "Creating fix PR",
    );

    // Get repository info
    const repoResult = await pool.query<{
      full_name: string;
      default_branch: string;
    }>(`SELECT full_name, default_branch FROM repositories WHERE id = $1`, [
      repositoryId,
    ]);
    const repo = repoResult.rows[0];

    if (!repo) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }

    // In production, this would:
    // 1. Create a new branch
    // 2. Apply fixes using AI-generated code
    // 3. Commit changes
    // 4. Create PR with description

    const branchName = `guardrail/auto-fix-${Date.now()}`;
    const prTitle = `🛡️ guardrail: Fix ${problems.length} issue${problems.length > 1 ? "s" : ""}`;

    // Generate PR description
    const prBody = this.generatePRDescription(problems);

    // Simulate PR creation (in production, use GitHub API)
    const prUrl = `https://github.com/${repo.full_name}/pull/new/${branchName}`;

    await this.logActivity(repositoryId, "pr_created", {
      prUrl,
      problemCount: problems.length,
      branch: branchName,
    });

    return {
      prUrl,
      problemsAddressed: problems.map((p) => p.id),
    };
  }

  /**
   * Generate PR description in plain English
   */
  private generatePRDescription(problems: Problem[]): string {
    let description = `## 🛡️ guardrail Auto-Fix\n\n`;
    description += `This PR was automatically generated by guardrail to fix ${problems.length} issue${problems.length > 1 ? "s" : ""}.\n\n`;

    description += `### Problems Fixed\n\n`;
    for (const problem of problems) {
      description += `- **${problem.plainEnglish}**\n`;
      description += `  - File: \`${problem.file}\`\n`;
      if (problem.line) {
        description += `  - Line: ${problem.line}\n`;
      }
      description += `\n`;
    }

    description += `### How to Review\n\n`;
    description += `1. Check each changed file to ensure the fix is correct\n`;
    description += `2. Run your tests to verify nothing is broken\n`;
    description += `3. Merge when ready!\n\n`;

    description += `---\n`;
    description += `*Generated by [guardrail](https://guardrail.dev) - Ship with confidence*`;

    return description;
  }

  /**
   * Generate weekly digest
   */
  async generateWeeklyDigest(repositoryId: string): Promise<WeeklyDigest> {
    logger.info({ repositoryId }, "Generating weekly digest");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get repository info
    const repoResult = await pool.query<RepositoryRow>(
      `SELECT id, full_name, name FROM repositories WHERE id = $1`,
      [repositoryId],
    );
    const repo = repoResult.rows[0];

    // Get activity stats
    const activityResult = await pool.query<{
      action_type: string;
      count: string;
    }>(
      `SELECT action_type, COUNT(*) as count 
       FROM autopilot_activity 
       WHERE repository_id = $1 AND created_at >= $2
       GROUP BY action_type`,
      [repositoryId, weekAgo],
    );

    const activityStats: Record<string, number> = {};
    for (const row of activityResult.rows) {
      activityStats[row.action_type] = parseInt(row.count);
    }

    // Get current and previous scores
    const scoresResult = await pool.query<{ score: number; created_at: Date }>(
      `SELECT score, created_at FROM runs 
       WHERE repository_id = $1 
       ORDER BY created_at DESC 
       LIMIT 2`,
      [repositoryId],
    );

    const currentScore = scoresResult.rows[0]?.score || 0;
    const previousScore = scoresResult.rows[1]?.score || currentScore;

    let healthTrend: "up" | "down" | "stable" = "stable";
    if (currentScore > previousScore + 5) healthTrend = "up";
    if (currentScore < previousScore - 5) healthTrend = "down";

    // Get pending issues
    const issuesResult = await pool.query(
      `SELECT * FROM findings 
       WHERE repository_id = $1 AND status = 'open' AND severity IN ('critical', 'high')
       ORDER BY severity, created_at
       LIMIT 5`,
      [repositoryId],
    );

    const actionItems: ActionItem[] = issuesResult.rows.map((issue: any) => ({
      priority: issue.severity === "critical" ? "urgent" : "soon",
      title: issue.title || issue.message,
      description: issue.plain_english || issue.message,
      fixUrl: issue.fix_url,
    }));

    // Generate highlights
    const highlights: string[] = [];

    if (activityStats["deploy_blocked"]) {
      highlights.push(
        `Blocked ${activityStats["deploy_blocked"]} deploy${activityStats["deploy_blocked"] > 1 ? "s" : ""} that would have broken production`,
      );
    }

    if (activityStats["auto_fix_applied"]) {
      highlights.push(
        `Auto-fixed ${activityStats["auto_fix_applied"]} security issue${activityStats["auto_fix_applied"] > 1 ? "s" : ""}`,
      );
    }

    if (healthTrend === "up") {
      highlights.push(
        `Health score improved from ${previousScore} to ${currentScore}! 🎉`,
      );
    }

    if (highlights.length === 0) {
      highlights.push("No major incidents this week");
    }

    const digest: WeeklyDigest = {
      repositoryId,
      repositoryName: repo?.full_name || "Unknown",
      period: { start: weekAgo, end: now },
      summary: {
        deploysBlocked: activityStats["deploy_blocked"] || 0,
        issuesAutoFixed: activityStats["auto_fix_applied"] || 0,
        issuesNeedingReview: activityStats["pr_created"] || 0,
        healthScore: currentScore,
        healthTrend,
        previousScore,
      },
      highlights,
      actionItems,
    };

    // Store digest
    await pool.query(
      `INSERT INTO weekly_digests (repository_id, digest_data, period_start, period_end, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [repositoryId, JSON.stringify(digest), weekAgo, now],
    );

    return digest;
  }

  /**
   * Format digest as plain English email
   */
  formatDigestEmail(digest: WeeklyDigest): {
    subject: string;
    html: string;
    text: string;
  } {
    const { summary, highlights, actionItems, repositoryName } = digest;

    const healthEmoji =
      summary.healthScore >= 80
        ? "🟢"
        : summary.healthScore >= 50
          ? "🟡"
          : "🔴";
    const trendEmoji =
      summary.healthTrend === "up"
        ? "📈"
        : summary.healthTrend === "down"
          ? "📉"
          : "➡️";

    const subject = `${healthEmoji} Weekly guardrail Report for ${repositoryName} - ${summary.healthScore}/100`;

    // Plain text version
    let text = `📬 Weekly guardrail Report for ${repositoryName}\n\n`;
    text += `This week:\n`;
    for (const highlight of highlights) {
      text += `• ${highlight}\n`;
    }
    text += `\n`;
    text += `Your app health: ${healthEmoji} ${summary.healthScore}/100 ${trendEmoji}\n`;

    if (actionItems.length > 0) {
      text += `\nAction needed:\n`;
      for (let i = 0; i < actionItems.length; i++) {
        const item = actionItems[i];
        text += `${i + 1}. ${item.title}\n`;
        text += `   ${item.description}\n`;
      }
    }

    text += `\nView full dashboard: ${APP_BASE_URL}/dashboard/${digest.repositoryId}`;

    // HTML version
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .score { font-size: 48px; font-weight: bold; }
    .highlight { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 8px 0; border-radius: 0 8px 8px 0; }
    .action-item { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 8px 0; border-radius: 0 8px 8px 0; }
    .action-item.urgent { background: #fee2e2; border-color: #ef4444; }
    .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📬 Weekly guardrail Report</h1>
    <p>${repositoryName}</p>
    <div class="score">${healthEmoji} ${summary.healthScore}/100 ${trendEmoji}</div>
    <p>${summary.healthTrend === "up" ? `Up from ${summary.previousScore} last week!` : summary.healthTrend === "down" ? `Down from ${summary.previousScore}` : "Stable"}</p>
  </div>

  <h2>This week:</h2>
  ${highlights.map((h) => `<div class="highlight">• ${h}</div>`).join("")}

  <h2>Stats:</h2>
  <ul>
    <li>🚫 Blocked ${summary.deploysBlocked} risky deploy${summary.deploysBlocked !== 1 ? "s" : ""}</li>
    <li>🔧 Auto-fixed ${summary.issuesAutoFixed} issue${summary.issuesAutoFixed !== 1 ? "s" : ""}</li>
    <li>📝 ${summary.issuesNeedingReview} issue${summary.issuesNeedingReview !== 1 ? "s" : ""} need${summary.issuesNeedingReview === 1 ? "s" : ""} your review</li>
  </ul>

  ${
    actionItems.length > 0
      ? `
  <h2>Action needed:</h2>
  ${actionItems
    .map(
      (item, i) => `
    <div class="action-item ${item.priority === "urgent" ? "urgent" : ""}">
      <strong>${i + 1}. ${item.title}</strong><br>
      ${item.description}
      ${item.fixUrl ? `<br><a href="${item.fixUrl}">Review Fix →</a>` : ""}
    </div>
  `,
    )
    .join("")}
  `
      : ""
  }

  <a href="${APP_BASE_URL}/dashboard/${digest.repositoryId}" class="btn">View Full Dashboard</a>

  <div class="footer">
    <p>You're receiving this because you enabled guardrail Autopilot for ${repositoryName}.</p>
    <p><a href="${APP_BASE_URL}/settings/notifications">Manage notification preferences</a></p>
  </div>
</body>
</html>`;

    return { subject, html, text };
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(
    webhookUrl: string,
    message: {
      type: "deploy_blocked" | "issues_fixed" | "pr_created" | "weekly_digest";
      repositoryName: string;
      details: any;
    },
  ): Promise<void> {
    const blocks = this.formatSlackMessage(message);

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
    } catch (error: unknown) {
      logger.error(
        { webhookUrl, error: toErrorMessage(error) },
        "Failed to send Slack notification",
      );
    }
  }

  /**
   * Format Slack message blocks
   */
  private formatSlackMessage(message: any): unknown[] {
    const { type, repositoryName, details } = message;

    switch (type) {
      case "deploy_blocked":
        return [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚫 Deploy Blocked by guardrail",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Repository:* ${repositoryName}\n\n*Problems found:*\n${details.problems?.map((p: string) => `• ${p}`).join("\n") || "No details"}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View Report", emoji: true },
                url: details.reportUrl,
                style: "primary",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Fix with AI", emoji: true },
                url: details.fixUrl,
              },
            ],
          },
        ];

      case "issues_fixed":
        return [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "✅ Issues Auto-Fixed by guardrail",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Repository:* ${repositoryName}\n\n*Fixed:*\n${details.fixes?.map((f: string) => `• ${f}`).join("\n") || "No details"}`,
            },
          },
        ];

      case "weekly_digest":
        const { summary } = details;
        const emoji =
          summary.healthScore >= 80
            ? "🟢"
            : summary.healthScore >= 50
              ? "🟡"
              : "🔴";
        return [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `📬 Weekly guardrail Report`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${repositoryName}*\n\nHealth Score: ${emoji} *${summary.healthScore}/100*\n\nThis week:\n• Blocked ${summary.deploysBlocked} risky deploys\n• Auto-fixed ${summary.issuesAutoFixed} issues\n• ${summary.issuesNeedingReview} issues need review`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View Dashboard",
                  emoji: true,
                },
                url: details.dashboardUrl,
                style: "primary",
              },
            ],
          },
        ];

      default:
        return [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `guardrail notification for ${repositoryName}`,
            },
          },
        ];
    }
  }

  /**
   * Log autopilot activity
   */
  private async logActivity(
    repositoryId: string,
    actionType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await pool.query(
      `INSERT INTO autopilot_activity (id, repository_id, action_type, details, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [repositoryId, actionType, JSON.stringify(details)],
    );
  }

  /**
   * Start autopilot scheduler (for background processing)
   */
  startScheduler(): void {
    // Run scans every hour for enabled repos
    this.scanInterval = setInterval(
      async () => {
        await this.runScheduledScans();
      },
      60 * 60 * 1000,
    );

    // Check for weekly digests daily
    this.digestInterval = setInterval(
      async () => {
        await this.sendScheduledDigests();
      },
      24 * 60 * 60 * 1000,
    );

    logger.info("Autopilot scheduler started");
  }

  /**
   * Stop scheduler
   */
  stopScheduler(): void {
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.digestInterval) clearInterval(this.digestInterval);
    logger.info("Autopilot scheduler stopped");
  }

  /**
   * Run scheduled scans for all enabled repos
   */
  private async runScheduledScans(): Promise<void> {
    const result = await pool.query<{ repository_id: string }>(
      `SELECT repository_id FROM autopilot_configs WHERE enabled = true`,
    );

    for (const row of result.rows) {
      try {
        await this.runScan(row.repository_id);
      } catch (error: unknown) {
        logger.error(
          { repositoryId: row.repository_id, error: toErrorMessage(error) },
          "Scheduled scan failed",
        );
      }
    }
  }

  /**
   * Send weekly digests (runs daily, sends on Mondays)
   */
  private async sendScheduledDigests(): Promise<void> {
    const today = new Date();
    if (today.getDay() !== 1) return; // Only on Mondays

    const result = await pool.query<DigestConfigRow>(
      `SELECT ac.repository_id, ac.notification_email, ac.slack_webhook_url, r.full_name
       FROM autopilot_configs ac
       JOIN repositories r ON r.id = ac.repository_id
       WHERE ac.enabled = true AND ac.weekly_digest_enabled = true`,
    );

    for (const row of result.rows) {
      try {
        const digest = await this.generateWeeklyDigest(row.repository_id);

        // Send email if configured
        if (row.notification_email) {
          const email = this.formatDigestEmail(digest);
          // In production, send via email service
          logger.info(
            { email: row.notification_email, subject: email.subject },
            "Would send digest email",
          );
        }

        // Send Slack if configured
        if (row.slack_webhook_url) {
          await this.sendSlackNotification(row.slack_webhook_url, {
            type: "weekly_digest",
            repositoryName: row.full_name,
            details: {
              summary: digest.summary,
              dashboardUrl: `${APP_BASE_URL}/dashboard/${row.repository_id}`,
            },
          });
        }
      } catch (error: unknown) {
        logger.error(
          { repositoryId: row.repository_id, error: toErrorMessage(error) },
          "Failed to send digest",
        );
      }
    }
  }
}

// Export singleton instance
export const autopilotService = new AutopilotService();
