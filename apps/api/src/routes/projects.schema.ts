/**
 * Zod schemas for project routes (colocated with projects.ts)
 */

import { z } from "zod";
import {
  CreateProjectRequestSchema,
  PaginationQuerySchema,
  UpdateProjectRequestSchema,
} from "../schemas/common";

export const QueryProjectsSchema = PaginationQuerySchema.extend({
  includeStats: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

export const ProjectIdParamsSchema = z.object({ id: z.string() });

export const ProjectScanBodySchema = z.object({
  path: z.string().optional(),
});

export const ProjectStatsQuerySchema = z.object({
  days: z.string().default("30"),
});

export {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
};
