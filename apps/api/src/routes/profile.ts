/**
 * Profile API Routes
 *
 * Handles profile management, avatar upload, and notification integrations
 * All routes require authentication
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Simple auth middleware for profile routes
async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply
      .status(401)
      .send({ success: false, error: "Authentication required" });
  }
  // In production, verify JWT token here
}

// ============ Schemas ============

const TestEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const TestSlackSchema = z.object({
  webhookUrl: z
    .string()
    .url("Invalid webhook URL")
    .startsWith("https://hooks.slack.com/", "Must be a Slack webhook URL"),
});

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  avatar: z.string().optional(),
  preferences: z
    .object({
      emailNotifications: z.boolean().optional(),
      slackNotifications: z.boolean().optional(),
      slackWebhook: z.string().optional(),
      theme: z.enum(["light", "dark", "system"]).optional(),
    })
    .optional(),
});

// ============ In-Memory Storage ============

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "member";
  emailVerified: boolean;
  createdAt: Date;
  preferences: {
    emailNotifications: boolean;
    slackNotifications: boolean;
    slackWebhook?: string;
    theme: "light" | "dark" | "system";
  };
}

// Default user profile
let userProfile: UserProfile = {
  id: "user_default",
  name: "guardrail User",
  email: "user@guardrail.dev",
  role: "admin",
  emailVerified: true,
  createdAt: new Date("2024-01-01"),
  preferences: {
    emailNotifications: true,
    slackNotifications: false,
    theme: "dark",
  },
};

// ============ Routes ============

export async function profileRoutes(fastify: FastifyInstance) {
  // Add auth middleware to all profile routes
  fastify.addHook("preHandler", requireAuth);

  // Get user profile
  fastify.get("/", async (request: FastifyRequest) => {
    return {
      success: true,
      data: userProfile,
    };
  });

  // Update user profile
  fastify.put("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = UpdateProfileSchema.parse(request.body);

      userProfile = {
        ...userProfile,
        name: body.name ?? userProfile.name,
        avatar: body.avatar ?? userProfile.avatar,
        preferences: {
          ...userProfile.preferences,
          ...body.preferences,
        },
      };

      return {
        success: true,
        data: userProfile,
      };
    } catch (error: unknown) {
      reply.status(400).send({ success: false, error: toErrorMessage(error) });
    }
  });

  // Upload avatar
  fastify.post(
    "/avatar",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // In production, this would handle multipart form data and upload to S3/CDN
        // For now, generate a placeholder avatar URL based on user initials
        const initials = userProfile.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        // Generate a deterministic color based on the user ID
        const colors = ["3B82F6", "10B981", "8B5CF6", "F59E0B", "EF4444"];
        const colorIndex =
          userProfile.id.charCodeAt(userProfile.id.length - 1) % colors.length;
        const bgColor = colors[colorIndex];

        // Use UI Avatars service for placeholder
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=${bgColor}&color=fff&size=128&bold=true`;

        userProfile.avatar = avatarUrl;

        return {
          success: true,
          data: {
            avatarUrl,
            message:
              "Avatar updated successfully. For custom uploads, please use a third-party image hosting service.",
          },
        };
      } catch (error: unknown) {
        reply
          .status(500)
          .send({ success: false, error: "Failed to upload avatar" });
      }
    },
  );

  // Test email notification
  fastify.post(
    "/test-email",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email } = TestEmailSchema.parse(request.body);

        // In production, this would use a real email service (SendGrid, SES, etc.)
        // For now, we'll simulate sending an email

        logger.info({ email }, "Sending test email");

        // Simulate email sending delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // In production, integrate with email service:
        // await sendEmail({
        //   to: email,
        //   subject: 'guardrail Test Notification',
        //   html: '<h1>Test Email</h1><p>Your email notifications are working!</p>',
        // });

        return {
          success: true,
          data: {
            message: `Test email sent to ${email}`,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error: unknown) {
        reply.status(400).send({ success: false, error: toErrorMessage(error) });
      }
    },
  );

  // Test Slack webhook
  fastify.post(
    "/test-slack",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { webhookUrl } = TestSlackSchema.parse(request.body);

        logger.info(
          { webhookUrlPrefix: webhookUrl.substring(0, 50) },
          "Testing Slack webhook",
        );

        // Send a test message to Slack
        const slackMessage = {
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🛡️ guardrail Connected!",
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Your Slack integration is now active!*\n\nYou will receive security alerts and validation results in this channel.",
              },
            },
            {
              type: "divider",
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Connected at ${new Date().toLocaleString()} | <https://guardrail.dev|guardrail Dashboard>`,
                },
              ],
            },
          ],
        };

        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackMessage),
        });

        if (!response.ok) {
          throw new Error("Slack webhook returned an error");
        }

        // Save webhook URL to profile
        userProfile.preferences.slackWebhook = webhookUrl;
        userProfile.preferences.slackNotifications = true;

        return {
          success: true,
          data: {
            message: "Slack connected successfully",
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error: unknown) {
        logger.error({ error }, "Slack webhook test failed");
        reply.status(400).send({
          success: false,
          error: "Failed to connect to Slack. Please check your webhook URL.",
        });
      }
    },
  );

  // Send notification (internal use)
  fastify.post(
    "/notify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { type, title, message } = request.body as {
          type: string;
          title: string;
          message: string;
        };

        const notifications: Promise<unknown>[] = [];

        // Send email notification
        if (userProfile.preferences.emailNotifications) {
          notifications.push(
            Promise.resolve().then(() => {
              logger.info({ title, message }, "Email notification sent");
            }),
          );
        }

        // Send Slack notification
        if (
          userProfile.preferences.slackNotifications &&
          userProfile.preferences.slackWebhook
        ) {
          const slackPayload = {
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${title}*\n${message}`,
                },
              },
            ],
          };

          notifications.push(
            fetch(userProfile.preferences.slackWebhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(slackPayload),
            }),
          );
        }

        await Promise.all(notifications);

        return {
          success: true,
          data: { sent: notifications.length },
        };
      } catch (error: unknown) {
        reply.status(500).send({ success: false, error: toErrorMessage(error) });
      }
    },
  );
}
