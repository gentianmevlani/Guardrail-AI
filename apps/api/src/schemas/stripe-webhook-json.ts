import type { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Recursive JSON value compatible with Prisma InputJsonValue.
 * Used to validate Stripe webhook object snapshots before persisting.
 */
/** Stripe snapshots may include `null`; Prisma InputJsonValue excludes null at the type level but accepts it at runtime. */
export const prismaInputJsonValueSchema = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(prismaInputJsonValueSchema),
    z.record(z.string(), prismaInputJsonValueSchema),
  ]),
) as z.ZodType<Prisma.InputJsonValue>;

export type StripeWebhookMetadataJson = z.infer<typeof prismaInputJsonValueSchema>;

/**
 * Serialize a Stripe API object (or any structured payload) into Prisma-safe JSON.
 */
export function stripeObjectToPrismaJson(
  object: unknown,
): Prisma.InputJsonValue {
  const plain = JSON.parse(JSON.stringify(object)) as unknown;
  return prismaInputJsonValueSchema.parse(plain);
}
