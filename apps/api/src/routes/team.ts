/**
 * Team Management Routes
 * 
 * API endpoints for team member management with RBAC enforcement.
 * Handles invitations, role assignments, and member removal.
 */

import { prisma } from "@guardrail/database";
import type { Tier } from "@guardrail/core";
import { randomBytes } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger";

// Types from RBAC (will be available after build)
type Role = 'owner' | 'admin' | 'dev' | 'viewer' | 'compliance-auditor';

function organizationDbTierToCoreTier(dbTier: string): Tier {
  if (dbTier === "enterprise" || dbTier === "unlimited") {
    return "compliance";
  }
  if (
    dbTier === "free" ||
    dbTier === "starter" ||
    dbTier === "pro" ||
    dbTier === "compliance"
  ) {
    return dbTier;
  }
  return "free";
}

interface TeamRequest extends FastifyRequest {
  rbacContext?: {
    userId: string;
    teamId: string;
    role: Role;
    permissions: string[];
    tier?: string;
  };
  organizationId?: string;
}

// =============================================================================
// ROUTE SCHEMAS
// =============================================================================

const getMembersSchema = {
  tags: ["team"],
  summary: "Get team members",
  params: {
    type: "object",
    properties: {
      organizationId: { type: "string" },
    },
    required: ["organizationId"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        members: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              email: { type: "string" },
              name: { type: "string" },
              role: { type: "string" },
              joinedAt: { type: "string" },
              lastActive: { type: "string", nullable: true },
            },
          },
        },
        total: { type: "number" },
        seatInfo: {
          type: "object",
          properties: {
            current: { type: "number" },
            max: { type: "number" },
            tier: { type: "string" },
          },
        },
      },
    },
  },
};

const inviteMemberSchema = {
  tags: ["team"],
  summary: "Invite a new team member",
  params: {
    type: "object",
    properties: {
      organizationId: { type: "string" },
    },
    required: ["organizationId"],
  },
  body: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      role: { type: "string", enum: ["admin", "dev", "viewer", "compliance-auditor"] },
    },
    required: ["email", "role"],
  },
  response: {
    201: {
      type: "object",
      properties: {
        invitation: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string" },
            expiresAt: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  },
};

const updateRoleSchema = {
  tags: ["team"],
  summary: "Update member role",
  params: {
    type: "object",
    properties: {
      organizationId: { type: "string" },
      memberId: { type: "string" },
    },
    required: ["organizationId", "memberId"],
  },
  body: {
    type: "object",
    properties: {
      role: { type: "string", enum: ["admin", "dev", "viewer", "compliance-auditor"] },
    },
    required: ["role"],
  },
};

const removeMemberSchema = {
  tags: ["team"],
  summary: "Remove team member",
  params: {
    type: "object",
    properties: {
      organizationId: { type: "string" },
      memberId: { type: "string" },
    },
    required: ["organizationId", "memberId"],
  },
};

const getRBACMatrixSchema = {
  tags: ["team"],
  summary: "Get RBAC permission matrix",
  response: {
    200: {
      type: "object",
      properties: {
        roles: { type: "array", items: { type: "string" } },
        permissions: { type: "array", items: { type: "string" } },
        matrix: { type: "object" },
        roleMetadata: { type: "object" },
      },
    },
  },
};

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function teamRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/team/:organizationId/members
   * Get all team members for an organization
   */
  fastify.get<{
    Params: { organizationId: string };
  }>(
    "/:organizationId/members",
    { schema: getMembersSchema },
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId } = request.params as { organizationId: string };

      try {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        });

        if (!org) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Organization not found",
          });
        }

        const members = org.members.map((m: (typeof org.members)[number]) => ({
          id: m.id,
          userId: m.userId,
          email: m.user.email,
          name: m.user.name,
          role: m.role,
          joinedAt: m.joinedAt?.toISOString() || m.createdAt.toISOString(),
          lastActive: m.user.updatedAt?.toISOString(),
        }));

        // Calculate seat info
        const { getTierConfig, calculateEffectiveSeats } = await import("@guardrail/core");
        const effectiveSeats = calculateEffectiveSeats(
          organizationDbTierToCoreTier(org.tier),
          org.purchasedExtraSeats,
        );

        return reply.send({
          members,
          total: members.length,
          seatInfo: {
            current: members.length,
            max: effectiveSeats,
            tier: org.tier,
          },
        });
      } catch (error) {
        logger.error({ error, organizationId }, "Failed to get team members");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to retrieve team members",
        });
      }
    }
  );

  /**
   * POST /api/team/:organizationId/invite
   * Invite a new member to the team
   */
  fastify.post<{
    Params: { organizationId: string };
    Body: { email: string; role: Role };
  }>(
    "/:organizationId/invite",
    { schema: inviteMemberSchema },
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId } = request.params as { organizationId: string };
      const { email, role } = request.body as { email: string; role: Role };

      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        // Check seat limit
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          include: { members: true },
        });

        if (!org) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Organization not found",
          });
        }

        const { calculateEffectiveSeats } = await import("@guardrail/core");
        const effectiveSeats = calculateEffectiveSeats(
          organizationDbTierToCoreTier(org.tier),
          org.purchasedExtraSeats,
        );

        if (org.members.length >= effectiveSeats) {
          return reply.status(403).send({
            error: "Seat Limit Exceeded",
            message: `Cannot invite more members. Current: ${org.members.length}, Max: ${effectiveSeats}`,
          });
        }

        // Check if user already exists and is a member
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          const existingMember = await prisma.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId,
                userId: existingUser.id,
              },
            },
          });

          if (existingMember) {
            return reply.status(409).send({
              error: "Conflict",
              message: "User is already a member of this organization",
            });
          }
        }

        // Check for existing pending invitation
        const existingInvite = await prisma.teamInvitation.findFirst({
          where: {
            organizationId,
            email,
            status: "pending",
          },
        });

        if (existingInvite) {
          return reply.status(409).send({
            error: "Conflict",
            message: "An invitation is already pending for this email",
          });
        }

        // Create invitation
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const invitation = await prisma.teamInvitation.create({
          data: {
            organizationId,
            email,
            role,
            invitedBy: request.user.id,
            token,
            expiresAt,
            status: "pending",
          },
        });

        // Log the action
        await prisma.rBACActivityLog.create({
          data: {
            organizationId,
            actorUserId: request.user.id,
            action: "member_invited",
            newRole: role,
            metadata: { email },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] as string,
          },
        });

        logger.info({ organizationId, email, role, invitedBy: request.user.id }, "Team invitation created");

        // Send invitation email (async, don't block response)
        try {
          const { emailNotificationService } = await import("../services/email-notification-service");
          const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true },
          });
          const inviter = await prisma.user.findUnique({
            where: { id: request.user.id },
            select: { name: true, email: true },
          });

          const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL || "https://guardrailai.dev";
          const acceptUrl = `${frontendUrl}/team/invite/${token}`;

          await emailNotificationService.sendEmail({
            to: email,
            subject: `You've been invited to join ${org?.name || "a team"} on guardrail`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Team Invitation</h1>
                </div>
                <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    ${inviter?.name || inviter?.email || "Someone"} has invited you to join <strong>${org?.name || "their team"}</strong> on guardrail with the role of <strong>${role}</strong>.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${acceptUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                  </div>
                  <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                    This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                  <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="${acceptUrl}" style="color: #0ea5e9; word-break: break-all;">${acceptUrl}</a>
                  </p>
                </div>
              </body>
              </html>
            `,
            text: `
              Team Invitation

              ${inviter?.name || inviter?.email || "Someone"} has invited you to join ${org?.name || "their team"} on guardrail with the role of ${role}.

              Accept your invitation: ${acceptUrl}

              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            `,
          });
        } catch (emailError) {
          // Log but don't fail the invitation creation
          logger.warn(
            { error: emailError, organizationId, email },
            "Failed to send invitation email, but invitation was created"
          );
        }

        return reply.status(201).send({
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt.toISOString(),
            status: invitation.status,
          },
        });
      } catch (error) {
        logger.error({ error, organizationId, email }, "Failed to create invitation");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to create invitation",
        });
      }
    }
  );

  /**
   * PUT /api/team/:organizationId/members/:memberId/role
   * Update a member's role
   */
  fastify.put<{
    Params: { organizationId: string; memberId: string };
    Body: { role: Role };
  }>(
    "/:organizationId/members/:memberId/role",
    { schema: updateRoleSchema },
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId, memberId } = request.params as { organizationId: string; memberId: string };
      const { role: newRole } = request.body as { role: Role };

      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const member = await prisma.organizationMember.findUnique({
          where: { id: memberId },
          include: { user: true },
        });

        if (!member || member.organizationId !== organizationId) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Member not found in this organization",
          });
        }

        // Cannot change owner's role
        if (member.role === "owner") {
          return reply.status(403).send({
            error: "Forbidden",
            message: "Cannot change the owner's role",
          });
        }

        // Cannot assign owner role
        if (newRole === "owner") {
          return reply.status(403).send({
            error: "Forbidden",
            message: "Cannot assign owner role. Use transfer ownership instead.",
          });
        }

        const previousRole = member.role;

        const updatedMember = await prisma.organizationMember.update({
          where: { id: memberId },
          data: { role: newRole },
        });

        // Log the action
        await prisma.rBACActivityLog.create({
          data: {
            organizationId,
            actorUserId: request.user.id,
            targetUserId: member.userId,
            action: "role_changed",
            previousRole,
            newRole,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] as string,
          },
        });

        logger.info(
          { organizationId, memberId, previousRole, newRole, changedBy: request.user.id },
          "Member role updated"
        );

        return reply.send({
          member: {
            id: updatedMember.id,
            userId: updatedMember.userId,
            role: updatedMember.role,
          },
        });
      } catch (error) {
        logger.error({ error, organizationId, memberId }, "Failed to update member role");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to update member role",
        });
      }
    }
  );

  /**
   * DELETE /api/team/:organizationId/members/:memberId
   * Remove a member from the team
   */
  fastify.delete<{
    Params: { organizationId: string; memberId: string };
  }>(
    "/:organizationId/members/:memberId",
    { schema: removeMemberSchema },
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId, memberId } = request.params as { organizationId: string; memberId: string };

      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const member = await prisma.organizationMember.findUnique({
          where: { id: memberId },
        });

        if (!member || member.organizationId !== organizationId) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Member not found in this organization",
          });
        }

        // Cannot remove owner
        if (member.role === "owner") {
          return reply.status(403).send({
            error: "Forbidden",
            message: "Cannot remove the organization owner",
          });
        }

        await prisma.organizationMember.delete({
          where: { id: memberId },
        });

        // Log the action
        await prisma.rBACActivityLog.create({
          data: {
            organizationId,
            actorUserId: request.user.id,
            targetUserId: member.userId,
            action: "member_removed",
            previousRole: member.role,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] as string,
          },
        });

        logger.info(
          { organizationId, memberId, removedBy: request.user.id },
          "Member removed from team"
        );

        return reply.status(204).send();
      } catch (error) {
        logger.error({ error, organizationId, memberId }, "Failed to remove member");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to remove member",
        });
      }
    }
  );

  /**
   * GET /api/team/rbac-matrix
   * Get the RBAC permission matrix (read-only, for transparency)
   */
  fastify.get(
    "/rbac-matrix",
    { schema: getRBACMatrixSchema },
    async (_request: TeamRequest, reply: FastifyReply) => {
      try {
        const { generatePermissionMatrix, ROLE_METADATA } = await import("@guardrail/core");
        const matrix = generatePermissionMatrix();

        return reply.send({
          roles: matrix.roles,
          permissions: matrix.permissions,
          matrix: matrix.matrix,
          roleMetadata: ROLE_METADATA,
        });
      } catch (error) {
        logger.error({ error }, "Failed to generate RBAC matrix");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to generate RBAC matrix",
        });
      }
    }
  );

  /**
   * POST /api/team/invite/:token/accept
   * Accept a team invitation
   */
  fastify.post<{
    Params: { token: string };
  }>(
    "/invite/:token/accept",
    async (request: TeamRequest, reply: FastifyReply) => {
      const { token } = request.params as { token: string };

      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const invitation = await prisma.teamInvitation.findUnique({
          where: { token },
        });

        if (!invitation) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Invitation not found",
          });
        }

        if (invitation.status !== "pending") {
          return reply.status(400).send({
            error: "Bad Request",
            message: `Invitation is ${invitation.status}`,
          });
        }

        if (invitation.expiresAt < new Date()) {
          await prisma.teamInvitation.update({
            where: { id: invitation.id },
            data: { status: "expired" },
          });
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invitation has expired",
          });
        }

        // Check if invitation email matches user email
        if (invitation.email !== request.user.email) {
          return reply.status(403).send({
            error: "Forbidden",
            message: "This invitation was sent to a different email address",
          });
        }

        // Add user to organization
        await prisma.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: request.user.id,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            invitedAt: invitation.createdAt,
            joinedAt: new Date(),
          },
        });

        // Update invitation status
        await prisma.teamInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        });

        // Log the action
        await prisma.rBACActivityLog.create({
          data: {
            organizationId: invitation.organizationId,
            actorUserId: request.user.id,
            action: "role_assigned",
            newRole: invitation.role,
            metadata: { invitationId: invitation.id },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] as string,
          },
        });

        logger.info(
          { organizationId: invitation.organizationId, userId: request.user.id, role: invitation.role },
          "Invitation accepted"
        );

        // Notify organization admins (async, don't block response)
        try {
          const { emailNotificationService } = await import("../services/email-notification-service");
          const org = await prisma.organization.findUnique({
            where: { id: invitation.organizationId },
            include: {
              members: {
                where: { role: { in: ["owner", "admin"] } },
                include: { user: { select: { email: true, name: true } } },
              },
            },
          });

          if (org) {
            const adminEmails = org.members
              .map((m: (typeof org.members)[number]) => m.user.email)
              .filter((email: string | null): email is string => !!email);

            if (adminEmails.length > 0) {
              await emailNotificationService.sendEmail({
                to: adminEmails,
                subject: `New team member joined ${org.name}`,
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  </head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">New Team Member</h1>
                    </div>
                    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                      <p style="font-size: 16px; margin-bottom: 20px;">
                        <strong>${request.user.name || request.user.email}</strong> has accepted the invitation and joined <strong>${org.name}</strong> as a <strong>${invitation.role}</strong>.
                      </p>
                      <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                        You can manage team members in your organization settings.
                      </p>
                    </div>
                  </body>
                  </html>
                `,
                text: `
                  New Team Member

                  ${request.user.name || request.user.email} has accepted the invitation and joined ${org.name} as a ${invitation.role}.

                  You can manage team members in your organization settings.
                `,
              });
            }
          }
        } catch (emailError) {
          // Log but don't fail the acceptance
          logger.warn(
            { error: emailError, organizationId: invitation.organizationId },
            "Failed to send acceptance notification email"
          );
        }

        return reply.send({
          message: "Invitation accepted successfully",
          organizationId: invitation.organizationId,
          role: invitation.role,
        });
      } catch (error) {
        logger.error({ error, token }, "Failed to accept invitation");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to accept invitation",
        });
      }
    }
  );

  /**
   * GET /api/team/:organizationId/invitations
   * Get pending invitations for an organization
   */
  fastify.get<{
    Params: { organizationId: string };
  }>(
    "/:organizationId/invitations",
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId } = request.params as { organizationId: string };

      try {
        const invitations = await prisma.teamInvitation.findMany({
          where: {
            organizationId,
            status: "pending",
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          invitations: invitations.map((inv: (typeof invitations)[number]) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role,
            expiresAt: inv.expiresAt.toISOString(),
            createdAt: inv.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        logger.error({ error, organizationId }, "Failed to get invitations");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to retrieve invitations",
        });
      }
    }
  );

  /**
   * POST /api/team/:organizationId/invitations/:invitationId/resend
   * Resend a pending invitation email
   */
  fastify.post<{
    Params: { organizationId: string; invitationId: string };
  }>(
    "/:organizationId/invitations/:invitationId/resend",
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId, invitationId } = request.params as {
        organizationId: string;
        invitationId: string;
      };

      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const invitation = await prisma.teamInvitation.findUnique({
          where: { id: invitationId },
        });

        if (!invitation) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Invitation not found",
          });
        }

        // Get organization and inviter details separately
        const org = await prisma.organization.findUnique({
          where: { id: invitation.organizationId },
          select: { name: true },
        });

        const inviter = invitation.invitedBy
          ? await prisma.user.findUnique({
              where: { id: invitation.invitedBy },
              select: { name: true, email: true },
            })
          : null;

        if (!invitation || invitation.organizationId !== organizationId) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Invitation not found",
          });
        }

        if (invitation.status !== "pending") {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Only pending invitations can be resent",
          });
        }

        if (invitation.expiresAt < new Date()) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Invitation has expired",
          });
        }

        // Resend invitation email
        try {
          const { emailNotificationService } = await import("../services/email-notification-service");
          const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_API_URL || "https://guardrailai.dev";
          const acceptUrl = `${frontendUrl}/team/invite/${invitation.token}`;

          await emailNotificationService.sendEmail({
            to: invitation.email,
            subject: `Reminder: You've been invited to join ${invitation.organization?.name || "a team"} on guardrail`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Team Invitation Reminder</h1>
                </div>
                <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    This is a reminder that ${inviter?.name || inviter?.email || "someone"} invited you to join <strong>${org?.name || "their team"}</strong> on guardrail with the role of <strong>${invitation.role}</strong>.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${acceptUrl}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
                  </div>
                  <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                    This invitation expires on ${new Date(invitation.expiresAt).toLocaleDateString()}. If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                  <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">
                    Or copy and paste this link into your browser:<br>
                    <a href="${acceptUrl}" style="color: #0ea5e9; word-break: break-all;">${acceptUrl}</a>
                  </p>
                </div>
              </body>
              </html>
            `,
            text: `
              Team Invitation Reminder

              This is a reminder that ${invitation.invitedByUser?.name || invitation.invitedByUser?.email || "someone"} invited you to join ${invitation.organization?.name || "their team"} on guardrail with the role of ${invitation.role}.

              Accept your invitation: ${acceptUrl}

              This invitation expires on ${new Date(invitation.expiresAt).toLocaleDateString()}. If you didn't expect this invitation, you can safely ignore this email.
            `,
          });

          logger.info(
            { organizationId, invitationId, email: invitation.email, resentBy: request.user.id },
            "Invitation email resent"
          );
        } catch (emailError) {
          logger.error(
            { error: emailError, organizationId, invitationId },
            "Failed to resend invitation email"
          );
          return reply.status(500).send({
            error: "Internal Server Error",
            message: "Failed to resend invitation email",
          });
        }

        return reply.send({
          message: "Invitation email resent successfully",
        });
      } catch (error) {
        logger.error({ error, organizationId, invitationId }, "Failed to resend invitation");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to resend invitation",
        });
      }
    }
  );

  /**
   * DELETE /api/team/:organizationId/invitations/:invitationId
   * Revoke a pending invitation
   */
  fastify.delete<{
    Params: { organizationId: string; invitationId: string };
  }>(
    "/:organizationId/invitations/:invitationId",
    async (request: TeamRequest, reply: FastifyReply) => {
      const { organizationId, invitationId } = request.params as {
        organizationId: string;
        invitationId: string;
      };

      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const invitation = await prisma.teamInvitation.findUnique({
          where: { id: invitationId },
        });

        if (!invitation || invitation.organizationId !== organizationId) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Invitation not found",
          });
        }

        if (invitation.status !== "pending") {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Only pending invitations can be revoked",
          });
        }

        await prisma.teamInvitation.update({
          where: { id: invitationId },
          data: { status: "revoked" },
        });

        logger.info(
          { organizationId, invitationId, revokedBy: request.user.id },
          "Invitation revoked"
        );

        return reply.status(204).send();
      } catch (error) {
        logger.error({ error, organizationId, invitationId }, "Failed to revoke invitation");
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "Failed to revoke invitation",
        });
      }
    }
  );
}

export default teamRoutes;
