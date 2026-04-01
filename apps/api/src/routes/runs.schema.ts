/**
 * Zod schemas for runs routes
 */

import { z } from "zod";

export const CreateRunSchema = z.object({
  repo: z.string().min(1).max(500),
  branch: z.string().max(200).optional(),
  commitSha: z.string().max(40).optional(),
  projectPath: z.string().max(1000).optional(),
  runSecurity: z.boolean().optional(),
  runReality: z.boolean().optional(),
  runGuardrails: z.boolean().optional(),
});

export const ListRunsQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(0))
    .optional(),
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  verdict: z.enum(["pass", "fail", "review", "pending"]).optional(),
  repo: z.string().max(500).optional(),
  sortBy: z
    .enum(["created_at", "score", "status", "verdict", "repo"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  search: z.string().max(200).optional(),
});

export const SaveRunBodySchema = z.object({
  repo: z.string().min(1),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
  verdict: z.union([z.string(), z.number()]),
  score: z.union([z.string(), z.number()]),
  securityResult: z.unknown().optional(),
  realityResult: z.unknown().optional(),
  guardrailResult: z.unknown().optional(),
  traceUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  source: z.enum(["cli", "mcp", "vscode", "github", "ci"]).optional(),
  findings: z.array(z.unknown()).optional(),
});

export const ApplyFixesBodySchema = z.object({
  dryRun: z.boolean().optional(),
});
