/**
 * Zod schemas for organization routes
 */

import { z } from "zod";

export const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

export const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export const UpdateMemberSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

export const PurchaseSeatsBodySchema = z.object({
  additionalSeats: z.number().int().positive(),
  billingCycle: z.enum(["monthly", "annual"]),
});

export const ReduceSeatsBodySchema = z.object({
  reduceBy: z.number().int().positive(),
});

export const UpgradeOrgBodySchema = z.object({
  tier: z.string(),
  additionalSeats: z.number().int().nonnegative().optional(),
  billingCycle: z.enum(["monthly", "annual"]),
});
