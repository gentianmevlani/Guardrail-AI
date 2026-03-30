/**
 * Organization and team billing business logic
 */

import {
  SEAT_PRICING,
  TIER_CONFIG,
  type Tier,
  calculateEffectiveSeats,
  canAddMember,
  formatSeatInfo,
  validateSeatReduction,
} from "@guardrail/core";
import { pool } from "@guardrail/database";
import * as crypto from "crypto";
import type { z } from "zod";
import type {
  CreateOrgSchema,
  InviteMemberSchema,
  PurchaseSeatsBodySchema,
  ReduceSeatsBodySchema,
  UpdateMemberSchema,
  UpdateOrgSchema,
  UpgradeOrgBodySchema,
} from "../routes/organizations.schema";
import { HttpError } from "./http-errors";

type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;
type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;
type PurchaseSeatsInput = z.infer<typeof PurchaseSeatsBodySchema>;
type ReduceSeatsInput = z.infer<typeof ReduceSeatsBodySchema>;
type UpgradeOrgInput = z.infer<typeof UpgradeOrgBodySchema>;

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function checkOrgMembership(
  orgId: string,
  userId: string,
  requiredRole?: string[],
): Promise<{ isMember: boolean; role?: string }> {
  const result = await pool.query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId],
  );

  if (result.rows.length === 0) {
    return { isMember: false };
  }

  const role = result.rows[0].role as string;
  if (requiredRole && !requiredRole.includes(role)) {
    return { isMember: true, role };
  }

  return { isMember: true, role };
}

function requireUserId(userId: string | undefined): string {
  if (!userId) {
    throw new HttpError(401, { error: "Unauthorized" });
  }
  return userId;
}

export async function createOrganization(userId: string | undefined, body: CreateOrgInput) {
  const uid = requireUserId(userId);

  const slugCheck = await pool.query(
    `SELECT id FROM organizations WHERE slug = $1`,
    [body.slug],
  );
  if (slugCheck.rows.length > 0) {
    throw new HttpError(400, { error: "Organization slug already taken" });
  }

  const orgResult = await pool.query(
    `INSERT INTO organizations (name, slug, owner_id, tier, max_seats)
         VALUES ($1, $2, $3, 'free', 1)
         RETURNING id, name, slug, tier, max_seats, created_at`,
    [body.name, body.slug, uid],
  );

  const org = orgResult.rows[0];

  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
         VALUES ($1, $2, 'owner', NOW())`,
    [org.id, uid],
  );

  return { status: 201 as const, organization: org };
}

export async function listOrganizations(userId: string | undefined) {
  const uid = requireUserId(userId);

  const result = await pool.query(
    `SELECT o.*, om.role as user_role,
                (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
         FROM organizations o
         JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = $1
         ORDER BY o.created_at DESC`,
    [uid],
  );

  return { organizations: result.rows };
}

export async function getOrganization(orgId: string, userId: string | undefined) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Not a member of this organization" });
  }

  const result = await pool.query(
    `SELECT o.*,
                (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
                (SELECT json_agg(json_build_object('id', u.id, 'email', u.email, 'name', u.name, 'role', om.role))
                 FROM organization_members om
                 JOIN users u ON om.user_id = u.id
                 WHERE om.organization_id = o.id) as members
         FROM organizations o
         WHERE o.id = $1`,
    [orgId],
  );

  if (result.rows.length === 0) {
    throw new HttpError(404, { error: "Organization not found" });
  }

  return {
    organization: result.rows[0],
    userRole: membership.role,
  };
}

export async function updateOrganization(
  orgId: string,
  userId: string | undefined,
  body: UpdateOrgInput,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner", "admin"]);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Admin access required" });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (body.name) {
    updates.push(`name = $${paramIndex++}`);
    values.push(body.name);
  }
  if (body.settings) {
    updates.push(`settings = $${paramIndex++}`);
    values.push(body.settings);
  }

  if (updates.length === 0) {
    throw new HttpError(400, { error: "No updates provided" });
  }

  updates.push(`updated_at = NOW()`);
  values.push(orgId);

  const result = await pool.query(
    `UPDATE organizations SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );

  return { organization: result.rows[0] };
}

export async function inviteMember(
  orgId: string,
  userId: string | undefined,
  body: InviteMemberInput,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner", "admin"]);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Admin access required" });
  }

  const orgResult = await pool.query(
    `SELECT tier, purchased_extra_seats, 
                  (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1) as current_members
           FROM organizations WHERE id = $1`,
    [orgId],
  );

  const org = orgResult.rows[0];
  const tier = (org.tier || "free") as Tier;
  const purchasedExtraSeats = org.purchased_extra_seats || 0;
  const currentMembers = parseInt(org.current_members, 10) || 0;

  const seatCheck = canAddMember(tier, currentMembers, purchasedExtraSeats);

  if (!seatCheck.allowed) {
    const seatPricing = SEAT_PRICING[tier];
    throw new HttpError(400, {
      error: "Seat limit reached",
      message: seatCheck.reason,
      effectiveSeats: seatCheck.effectiveSeats,
      currentMembers,
      canPurchaseMore: seatPricing.supportsAdditionalSeats,
      seatPrice: seatPricing.monthlyPricePerSeat,
      upgradeUrl: "https://guardrail.dev/pricing",
    });
  }

  const existingCheck = await pool.query(
    `SELECT id FROM organization_invites 
         WHERE organization_id = $1 AND email = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
    [orgId, body.email],
  );
  if (existingCheck.rows.length > 0) {
    throw new HttpError(400, {
      error: "Invitation already pending for this email",
    });
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO organization_invites (organization_id, email, role, token, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
    [orgId, body.email, body.role, token, uid, expiresAt],
  );

  const inviteUrl = `https://guardrail.dev/invite/${token}`;

  return {
    status: 201 as const,
    message: "Invitation sent",
    inviteUrl,
    expiresAt,
  };
}

export async function acceptInvite(token: string, userId: string | undefined) {
  const uid = requireUserId(userId);

  const inviteResult = await pool.query(
    `SELECT * FROM organization_invites 
         WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [token],
  );

  if (inviteResult.rows.length === 0) {
    throw new HttpError(404, { error: "Invalid or expired invitation" });
  }

  const invite = inviteResult.rows[0];

  const memberCheck = await pool.query(
    `SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [invite.organization_id, uid],
  );
  if (memberCheck.rows.length > 0) {
    throw new HttpError(400, { error: "Already a member of this organization" });
  }

  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role, invited_by, invited_at, joined_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      invite.organization_id,
      uid,
      invite.role,
      invite.invited_by,
      invite.created_at,
    ],
  );

  await pool.query(
    `UPDATE organization_invites SET accepted_at = NOW() WHERE id = $1`,
    [invite.id],
  );

  const orgResult = await pool.query(
    `SELECT name, slug FROM organizations WHERE id = $1`,
    [invite.organization_id],
  );

  return {
    message: `Joined ${orgResult.rows[0].name}`,
    organization: orgResult.rows[0],
  };
}

export async function removeMember(
  orgId: string,
  memberId: string,
  userId: string | undefined,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner", "admin"]);
  if (!membership.isMember && memberId !== uid) {
    throw new HttpError(403, { error: "Admin access required" });
  }

  const memberResult = await pool.query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, memberId],
  );
  if (memberResult.rows[0]?.role === "owner") {
    throw new HttpError(400, { error: "Cannot remove organization owner" });
  }

  await pool.query(
    `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, memberId],
  );

  return { message: "Member removed" };
}

export async function updateMemberRole(
  orgId: string,
  memberId: string,
  userId: string | undefined,
  body: UpdateMemberInput,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner", "admin"]);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Admin access required" });
  }

  const memberResult = await pool.query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
    [orgId, memberId],
  );
  if (memberResult.rows[0]?.role === "owner") {
    throw new HttpError(400, { error: "Cannot change owner role" });
  }

  await pool.query(
    `UPDATE organization_members SET role = $1, updated_at = NOW() 
         WHERE organization_id = $2 AND user_id = $3`,
    [body.role, orgId, memberId],
  );

  return { message: "Member role updated" };
}

export async function getSeatInfo(orgId: string, userId: string | undefined) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Not a member of this organization" });
  }

  const orgResult = await pool.query(
    `SELECT tier, purchased_extra_seats,
                  (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1) as current_members
           FROM organizations WHERE id = $1`,
    [orgId],
  );

  if (orgResult.rows.length === 0) {
    throw new HttpError(404, { error: "Organization not found" });
  }

  const org = orgResult.rows[0];
  const tier = (org.tier || "free") as Tier;
  const purchasedExtraSeats = org.purchased_extra_seats || 0;
  const currentMembers = parseInt(org.current_members, 10) || 0;
  const effectiveSeats = calculateEffectiveSeats(tier, purchasedExtraSeats);
  const seatPricing = SEAT_PRICING[tier];

  return {
    seats: {
      tier,
      baseSeats: (() => {
        const t = tier as string;
        if (SEAT_PRICING[tier].maxAdditionalSeats === 0) return 1;
        if (t === "pro") return 5;
        if (t === "compliance") return 10;
        if (t === "enterprise") return 50;
        return 1;
      })(),
      purchasedExtraSeats,
      effectiveSeats: effectiveSeats === Infinity ? -1 : effectiveSeats,
      currentMembers,
      availableSeats:
        effectiveSeats === Infinity ? -1 : effectiveSeats - currentMembers,
    },
    pricing: {
      supportsAdditionalSeats: seatPricing.supportsAdditionalSeats,
      monthlyPricePerSeat: seatPricing.monthlyPricePerSeat,
      annualPricePerSeat: seatPricing.annualPricePerSeat,
      maxAdditionalSeats: seatPricing.maxAdditionalSeats,
    },
    displayText: formatSeatInfo(tier),
  };
}

export async function purchaseSeats(
  orgId: string,
  userId: string | undefined,
  body: PurchaseSeatsInput,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner", "admin"]);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Admin access required" });
  }

  const orgResult = await pool.query(
    `SELECT tier, purchased_extra_seats FROM organizations WHERE id = $1`,
    [orgId],
  );

  if (orgResult.rows.length === 0) {
    throw new HttpError(404, { error: "Organization not found" });
  }

  const org = orgResult.rows[0];
  const tier = (org.tier || "free") as Tier;
  const currentPurchased = org.purchased_extra_seats || 0;
  const seatPricing = SEAT_PRICING[tier];

  if (!seatPricing.supportsAdditionalSeats) {
    throw new HttpError(400, {
      error: "Tier does not support additional seats",
      message: "Upgrade to Pro or higher to add team members.",
    });
  }

  const newTotal = currentPurchased + body.additionalSeats;
  if (
    seatPricing.maxAdditionalSeats !== -1 &&
    newTotal > seatPricing.maxAdditionalSeats
  ) {
    throw new HttpError(400, {
      error: "Exceeds maximum seats",
      message: `Maximum additional seats for ${tier} tier is ${seatPricing.maxAdditionalSeats}. You have ${currentPurchased} purchased.`,
      maxAllowed: seatPricing.maxAdditionalSeats - currentPurchased,
    });
  }

  const pricePerSeat =
    body.billingCycle === "annual"
      ? seatPricing.annualPricePerSeat
      : seatPricing.monthlyPricePerSeat;
  const totalPrice = pricePerSeat * body.additionalSeats;

  const checkoutUrl = `https://guardrail.dev/checkout/seats?org=${orgId}&seats=${body.additionalSeats}&billing=${body.billingCycle}`;

  return {
    purchase: {
      additionalSeats: body.additionalSeats,
      pricePerSeat,
      totalPrice,
      billingCycle: body.billingCycle,
      newTotalPurchased: newTotal,
    },
    checkoutUrl,
  };
}

export async function reduceSeats(
  orgId: string,
  userId: string | undefined,
  body: ReduceSeatsInput,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner"]);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Owner access required" });
  }

  const orgResult = await pool.query(
    `SELECT tier, purchased_extra_seats,
                  (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1) as current_members
           FROM organizations WHERE id = $1`,
    [orgId],
  );

  if (orgResult.rows.length === 0) {
    throw new HttpError(404, { error: "Organization not found" });
  }

  const org = orgResult.rows[0];
  const tier = (org.tier || "free") as Tier;
  const currentPurchased = org.purchased_extra_seats || 0;
  const currentMembers = parseInt(org.current_members, 10) || 0;

  if (body.reduceBy > currentPurchased) {
    throw new HttpError(400, {
      error: "Cannot reduce more than purchased",
      currentPurchased,
      requestedReduction: body.reduceBy,
    });
  }

  const newPurchased = currentPurchased - body.reduceBy;

  const validation = validateSeatReduction(
    currentMembers,
    calculateEffectiveSeats(tier, currentPurchased),
    calculateEffectiveSeats(tier, newPurchased),
  );

  if (!validation.safe) {
    throw new HttpError(400, {
      error: "Seat reduction blocked",
      message: validation.message,
      requiresAction: validation.requiresAction,
      excessMembers: validation.excessMembers,
      suggestion: `Remove ${validation.excessMembers} member(s) before reducing seats.`,
    });
  }

  await pool.query(
    `UPDATE organizations SET purchased_extra_seats = $1, updated_at = NOW() WHERE id = $2`,
    [newPurchased, orgId],
  );

  return {
    message: `Reduced ${body.reduceBy} seat(s)`,
    seats: {
      previousPurchased: currentPurchased,
      newPurchased,
      effectiveSeats: calculateEffectiveSeats(tier, newPurchased),
    },
  };
}

export async function upgradeOrganization(
  orgId: string,
  userId: string | undefined,
  body: UpgradeOrgInput,
) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid, ["owner"]);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Owner access required" });
  }

  if (!SEAT_PRICING[body.tier as Tier]) {
    throw new HttpError(400, { error: "Invalid tier" });
  }

  const tierKey = body.tier as Tier;
  const seatPricing = SEAT_PRICING[tierKey];
  const additionalSeats = body.additionalSeats ?? 0;

  if (additionalSeats > 0 && !seatPricing.supportsAdditionalSeats) {
    throw new HttpError(400, {
      error: "Tier does not support additional seats",
    });
  }

  if (
    seatPricing.maxAdditionalSeats !== -1 &&
    additionalSeats > seatPricing.maxAdditionalSeats
  ) {
    throw new HttpError(400, {
      error: "Exceeds maximum additional seats",
      maxAllowed: seatPricing.maxAdditionalSeats,
    });
  }

  const baseTierConfig = TIER_CONFIG[tierKey];
  const baseTierPrice =
    body.billingCycle === "annual"
      ? baseTierConfig.annualPrice
      : baseTierConfig.price;

  const seatPrice =
    body.billingCycle === "annual"
      ? seatPricing.annualPricePerSeat
      : seatPricing.monthlyPricePerSeat;
  const seatsTotal = seatPrice * additionalSeats;
  const totalPrice = baseTierPrice + seatsTotal;

  const checkoutUrl = `https://guardrail.dev/checkout?org=${orgId}&tier=${body.tier}&seats=${additionalSeats}&billing=${body.billingCycle}`;

  return {
    pricing: {
      tier: body.tier,
      baseTierPrice,
      additionalSeats,
      pricePerSeat: seatPrice,
      seatsTotal,
      totalPrice,
      billingCycle: body.billingCycle,
    },
    checkoutUrl,
  };
}

export async function getOrganizationUsage(orgId: string, userId: string | undefined) {
  const uid = requireUserId(userId);

  const membership = await checkOrgMembership(orgId, uid);
  if (!membership.isMember) {
    throw new HttpError(403, { error: "Not a member of this organization" });
  }

  const membersResult = await pool.query(
    `SELECT user_id FROM organization_members WHERE organization_id = $1`,
    [orgId],
  );
  const memberIds = membersResult.rows.map((r: { user_id: string }) => r.user_id);

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const usageResult = await pool.query(
    `SELECT type, SUM(count) as total_count
         FROM usage_records
         WHERE user_id = ANY($1) AND period_start = $2
         GROUP BY type`,
    [memberIds, periodStart],
  );

  const orgResult = await pool.query(
    `SELECT tier, max_seats FROM organizations WHERE id = $1`,
    [orgId],
  );
  const orgTier = orgResult.rows[0]?.tier || "free";

  const usage: Record<string, number> = {};
  for (const row of usageResult.rows) {
    usage[row.type] = parseInt(row.total_count, 10);
  }

  return {
    organization: {
      tier: orgTier,
      memberCount: memberIds.length,
      maxSeats: orgResult.rows[0]?.max_seats || 1,
    },
    usage,
    period: {
      start: periodStart.toISOString(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
    },
  };
}
