import * as nodemailer from "nodemailer";

export interface EmailConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service for guardrail notifications
 * 
 * Supports SMTP-based email delivery via nodemailer.
 * Configure via environment variables:
 *   - EMAIL_FROM: sender email address
 *   - SMTP_HOST: SMTP server hostname
 *   - SMTP_PORT: SMTP server port (default: 587)
 *   - SMTP_USER: SMTP authentication username
 *   - SMTP_PASS: SMTP authentication password
 *   - SMTP_SECURE: Use TLS (default: false for port 587, true for port 465)
 */
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initializeFromEnv();
  }

  /**
   * Initialize email configuration from environment variables
   */
  private initializeFromEnv(): void {
    const host = process.env["SMTP_HOST"];
    const port = parseInt(process.env["SMTP_PORT"] || "587", 10);
    const user = process.env["SMTP_USER"];
    const pass = process.env["SMTP_PASS"];
    const from = process.env["EMAIL_FROM"];

    if (host && user && pass && from) {
      this.config = {
        host,
        port,
        secure: process.env["SMTP_SECURE"] === "true" || port === 465,
        auth: { user, pass },
        from,
      };
      this.createTransporter();
    }
  }

  /**
   * Create nodemailer transporter with current config
   */
  private createTransporter(): void {
    if (!this.config) return;

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
    });
  }

  /**
   * Check if email service is configured and available
   */
  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("Email service verification failed:", error);
      return false;
    }
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: "Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM environment variables.",
      };
    }

    try {
      const recipients = Array.isArray(message.to)
        ? message.to.join(", ")
        : message.to;

      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: recipients,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to send email:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send compliance check notification email
   */
  async sendComplianceNotification(
    recipients: string[],
    projectId: string,
    frameworkId: string,
    result: {
      status: "completed" | "failed";
      score?: number;
      summary?: string;
      reportUrl?: string;
    }
  ): Promise<EmailResult> {
    const statusEmoji = result.status === "completed" ? "✅" : "❌";
    const statusText = result.status === "completed" ? "Completed" : "Failed";
    const scoreText = result.score !== undefined ? `${result.score}%` : "N/A";

    const subject = `[guardrail] Compliance Check ${statusText}: ${frameworkId}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .status { font-size: 24px; margin-bottom: 10px; }
    .metric { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #e5e7eb; }
    .metric-label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .metric-value { font-size: 20px; font-weight: 600; color: #111827; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status">${statusEmoji} Compliance Check ${statusText}</div>
      <div>Project: ${projectId}</div>
    </div>
    <div class="content">
      <div class="metric">
        <div class="metric-label">Framework</div>
        <div class="metric-value">${frameworkId}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Compliance Score</div>
        <div class="metric-value">${scoreText}</div>
      </div>
      ${result.summary ? `<p>${result.summary}</p>` : ""}
      ${result.reportUrl ? `<a href="${result.reportUrl}" class="button">View Full Report</a>` : ""}
    </div>
    <div class="footer">
      <p>Sent by guardrail Compliance Automation</p>
      <p>Context Enhanced by guardrail AI</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Compliance Check ${statusText}

Project: ${projectId}
Framework: ${frameworkId}
Score: ${scoreText}
${result.summary ? `\nSummary: ${result.summary}` : ""}
${result.reportUrl ? `\nView Report: ${result.reportUrl}` : ""}

--
Sent by guardrail Compliance Automation
    `.trim();

    return this.send({
      to: recipients,
      subject,
      text,
      html,
    });
  }
}

// Singleton instance
export const emailService = new EmailService();
