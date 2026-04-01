/**
 * Organizations Data Access Layer
 * 
 * Typed database operations for organizations, teams, and members
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './index';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateOrganizationData {
  name: string;
  slug: string;
  tier?: string;
  maxSeats?: number;
  purchasedExtraSeats?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface UpdateOrganizationData {
  name?: string;
  slug?: string;
  tier?: string;
  maxSeats?: number;
  purchasedExtraSeats?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface CreateOrganizationMemberData {
  organizationId: string;
  userId: string;
  role?: string;
  invitedBy?: string;
}

export interface UpdateOrganizationMemberData {
  role?: string;
  invitedAt?: Date;
  joinedAt?: Date;
}

export interface CreateTeamSeatData {
  userId?: string;
  organizationId?: string;
  subscriptionId?: string;
  tier: string;
  seatType?: string;
  isActive?: boolean;
  assignedAt?: Date;
  expiresAt?: Date;
}

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export async function createOrganization(data: CreateOrganizationData) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organization.create({
    data,
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      teamSeats: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  });
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      teamSeats: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  });
}

export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      teamSeats: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  });
}

export async function updateOrganization(id: string, data: UpdateOrganizationData) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organization.update({
    where: { id },
    data,
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      teamSeats: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  });
}

export async function deleteOrganization(id: string) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organization.delete({
    where: { id },
  });
}

export async function getOrganizationsByUserId(userId: string) {
  return prisma.organization.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        where: { userId },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      _count: {
        select: {
          members: true,
          teamSeats: true,
        },
      },
    },
  });
}

// ============================================================================
// ORGANIZATION MEMBERS
// ============================================================================

export async function addOrganizationMember(data: CreateOrganizationMemberData) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organizationMember.create({
    data,
    include: {
      organization: true,
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function getOrganizationMember(organizationId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      organization: true,
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function updateOrganizationMember(
  organizationId: string,
  userId: string,
  data: UpdateOrganizationMemberData
) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    data,
    include: {
      organization: true,
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });
}

export async function removeOrganizationMember(organizationId: string, userId: string) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organizationMember.delete({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });
}

export async function getOrganizationMembers(organizationId: string) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

// ============================================================================
// TEAM SEATS
// ============================================================================

export async function createTeamSeat(data: CreateTeamSeatData) {
  return prisma.teamSeat.create({
    data: data as any,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      organization: true,
      subscription: true,
    },
  });
}

export async function getTeamSeatById(id: string) {
  return prisma.teamSeat.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      organization: true,
      subscription: true,
    },
  });
}

export async function updateTeamSeat(id: string, data: Partial<CreateTeamSeatData>) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.teamSeat.update({
    where: { id },
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      organization: true,
      subscription: true,
    },
  });
}

export async function deactivateTeamSeat(id: string) {
  // @ts-ignore - Prisma client types need regeneration
  return prisma.teamSeat.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getTeamSeatsByOrganization(organizationId: string) {
  return prisma.teamSeat.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
}

export async function getTeamSeatsBySubscription(subscriptionId: string) {
  return prisma.teamSeat.findMany({
    where: { subscriptionId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
}

export async function getTeamSeatsByUserId(userId: string) {
  return prisma.teamSeat.findMany({
    where: { userId },
    include: {
      organization: true,
      subscription: true,
    },
    orderBy: { assignedAt: 'desc' },
  });
}

// ============================================================================
// USAGE TRACKING FOR ORGANIZATIONS
// ============================================================================

export async function getOrganizationUsage(organizationId: string, periodStart: Date, periodEnd: Date) {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    select: { userId: true },
  });

  const userIds = members.map((m: { userId: string }) => m.userId);

  return prisma.usageLog.findMany({
    where: {
      userId: { in: userIds },
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { periodStart: 'desc' },
  });
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function createOrganizationWithOwner(
  data: CreateOrganizationData,
  ownerUserId: string,
  ownerRole: string = 'owner'
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create organization
    const organization = await tx.organization.create({
      data,
    });

    // Add owner as member
    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: ownerUserId,
        role: ownerRole,
        joinedAt: new Date(),
      },
    });

    // Create team seat for owner
    await tx.teamSeat.create({
      data: {
        userId: ownerUserId,
        organizationId: organization.id,
        tier: data.tier || 'free',
        seatType: 'base',
        isActive: true,
        assignedAt: new Date(),
      },
    });

    return organization;
  });
}

export async function addMemberWithSeat(
  organizationId: string,
  userId: string,
  role: string = 'member',
  tier: string = 'free'
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Add as organization member
    const member = await tx.organizationMember.create({
      data: {
        organizationId,
        userId,
        role,
        joinedAt: new Date(),
      },
      include: {
        organization: true,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Create team seat
    await tx.teamSeat.create({
      data: {
        userId,
        organizationId,
        tier,
        seatType: 'additional',
        isActive: true,
        assignedAt: new Date(),
      },
    });

    return member;
  });
}

export async function removeMemberAndSeat(organizationId: string, userId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Remove organization membership
    await tx.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    // Deactivate team seat
    await tx.teamSeat.updateMany({
      where: {
        organizationId,
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  });
}

export async function updateOrganizationTier(
  organizationId: string,
  newTier: string,
  maxSeats: number
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update organization
    const organization = await tx.organization.update({
      where: { id: organizationId },
      data: { tier: newTier, maxSeats },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
        teamSeats: true,
      },
    });

    // Count current active seats
    const activeSeatsCount = await tx.teamSeat.count({
      where: {
        organizationId,
        isActive: true,
      },
    });

    // If we have more active seats than allowed, deactivate excess seats
    if (activeSeatsCount > maxSeats) {
      const seatsToDeactivate = activeSeatsCount - maxSeats;
      
      await tx.teamSeat.updateMany({
        where: {
          organizationId,
          isActive: true,
          seatType: 'additional', // Only deactivate additional seats, not base seats
        },
        data: {
          isActive: false,
        },
      });
    }

    return organization;
  });
}
