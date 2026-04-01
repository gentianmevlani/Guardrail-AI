import { z } from "./z.js";

export const TruthPackSchema = z.object({
  version: z.literal("1"),
  generatedAt: z.string(),
  repoRoot: z.string(),
  stack: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    pkgManager: z.enum(["pnpm", "npm", "yarn", "bun"]).optional(),
  }),
  files: z.object({
    total: z.number(),
  }),
});

export type TruthPack = z.infer<typeof TruthPackSchema>;

export const SymbolRecordSchema = z.object({
  name: z.string(),
  kind: z.enum(["export", "function", "class", "type", "interface", "const", "component", "hook"]),
  file: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  isExported: z.boolean(),
});

export type SymbolRecord = z.infer<typeof SymbolRecordSchema>;

export const DepsTruthSchema = z.object({
  packageJson: z.object({
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    peerDependencies: z.record(z.string()).optional(),
  }).optional(),
  lockfile: z.object({
    type: z.enum(["pnpm", "npm", "yarn", "bun", "unknown"]),
    path: z.string().optional(),
  }),
});

export type DepsTruth = z.infer<typeof DepsTruthSchema>;

export const GraphSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
  })),
});

export type Graph = z.infer<typeof GraphSchema>;

export const RiskTagSchema = z.enum(["auth", "payments", "db", "infra", "security", "core"]);
export type RiskTag = z.infer<typeof RiskTagSchema>;

export const RiskMapSchema = z.record(z.object({
  tags: z.array(RiskTagSchema),
  score: z.number(),
}));

export type RiskMap = z.infer<typeof RiskMapSchema>;

export const ImportanceSchema = z.record(z.number());
export type Importance = z.infer<typeof ImportanceSchema>;

export const VerifyResultSchema = z.object({
  ok: z.boolean(),
  gates: z.array(z.object({
    name: z.string(),
    ok: z.boolean(),
    details: z.string().optional(),
  })),
});

export type VerifyResult = z.infer<typeof VerifyResultSchema>;

export const ScopeContractSchema = z.object({
  allowedGlobs: z.array(z.string()),
  forbiddenGlobs: z.array(z.string()).optional(),
  requiredTests: z.array(z.string()).optional(),
});

export type ScopeContract = z.infer<typeof ScopeContractSchema>;
