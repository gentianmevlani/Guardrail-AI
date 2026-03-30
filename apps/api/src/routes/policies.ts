import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware, standardRateLimit } from "../middleware/fastify-auth";
import { pool } from "@guardrail/database";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  gates: {
    mockproof: { enabled: boolean; failOn: "off" | "warn" | "error" };
    reality: { enabled: boolean; failOn: "off" | "warn" | "error" };
    airlock: { enabled: boolean; failOn: "off" | "warn" | "error" };
  };
}

interface PolicyRule {
  id: string;
  name: string;
  category: string;
  severity: "off" | "warn" | "error";
  description: string;
}

interface PolicyAllowlistEntry {
  type: "domain" | "endpoint" | "package";
  value: string;
  reason?: string;
  addedBy: string;
  addedAt: string;
}

interface PoliciesData {
  profiles: PolicyProfile[];
  rules: PolicyRule[];
  allowlist: PolicyAllowlistEntry[];
  ignoreGlobs: string[];
}

const defaultPoliciesData: PoliciesData = {
  profiles: [
    {
      id: "standard",
      name: "Standard",
      description: "Balanced security and productivity",
      isDefault: true,
      gates: {
        mockproof: { enabled: true, failOn: "error" },
        reality: { enabled: true, failOn: "warn" },
        airlock: { enabled: true, failOn: "warn" },
      },
    },
    {
      id: "strict",
      name: "Strict",
      description: "Maximum security for production",
      isDefault: false,
      gates: {
        mockproof: { enabled: true, failOn: "error" },
        reality: { enabled: true, failOn: "error" },
        airlock: { enabled: true, failOn: "error" },
      },
    },
    {
      id: "relaxed",
      name: "Relaxed",
      description: "For development and testing",
      isDefault: false,
      gates: {
        mockproof: { enabled: true, failOn: "warn" },
        reality: { enabled: false, failOn: "off" },
        airlock: { enabled: false, failOn: "off" },
      },
    },
  ],
  rules: [
    {
      id: "no-mock-data",
      name: "no-mock-data",
      category: "mockproof",
      severity: "error",
      description: "Detect mock/placeholder data in production code",
    },
    {
      id: "no-hardcoded-secrets",
      name: "no-hardcoded-secrets",
      category: "security",
      severity: "error",
      description: "Prevent hardcoded API keys and passwords",
    },
    {
      id: "no-unsafe-eval",
      name: "no-unsafe-eval",
      category: "security",
      severity: "error",
      description: "Prevent use of eval() and similar functions",
    },
    {
      id: "no-console-log",
      name: "no-console-log",
      category: "reality",
      severity: "warn",
      description: "Remove console.log statements in production",
    },
    {
      id: "no-todo-comments",
      name: "no-todo-comments",
      category: "reality",
      severity: "warn",
      description: "Resolve TODO/FIXME comments before shipping",
    },
    {
      id: "require-tests",
      name: "require-tests",
      category: "airlock",
      severity: "warn",
      description: "Ensure test coverage for new code",
    },
  ],
  allowlist: [],
  ignoreGlobs: [],
};

async function ensurePoliciesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_policies (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        profiles JSONB DEFAULT '[]'::jsonb,
        rules JSONB DEFAULT '[]'::jsonb,
        allowlist JSONB DEFAULT '[]'::jsonb,
        ignore_globs JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    logger.error({ error }, "Error ensuring policies table");
  }
}

export async function policiesRoutes(fastify: FastifyInstance) {
  await ensurePoliciesTable();

  fastify.addHook("preHandler", authMiddleware);

  fastify.get(
    "/",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const result = await pool.query(
          `SELECT profiles, rules, allowlist, ignore_globs FROM user_policies WHERE user_id = $1`,
          [user.id],
        );

        if (result.rows.length === 0) {
          await pool.query(
            `INSERT INTO user_policies (user_id, profiles, rules, allowlist, ignore_globs)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user.id,
              JSON.stringify(defaultPoliciesData.profiles),
              JSON.stringify(defaultPoliciesData.rules),
              JSON.stringify(defaultPoliciesData.allowlist),
              JSON.stringify(defaultPoliciesData.ignoreGlobs),
            ],
          );

          return reply.send({
            success: true,
            data: defaultPoliciesData,
          });
        }

        const row = result.rows[0];
        const policies: PoliciesData = {
          profiles: row.profiles || defaultPoliciesData.profiles,
          rules: row.rules || defaultPoliciesData.rules,
          allowlist: row.allowlist || [],
          ignoreGlobs: row.ignore_globs || [],
        };

        return reply.send({
          success: true,
          data: policies,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error fetching policies");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error),
        });
      }
    },
  );

  // PUT /api/policies - Bulk update all policies
  fastify.put(
    "/",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const body = request.body as Partial<PoliciesData>;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const existingResult = await pool.query(
          `SELECT id FROM user_policies WHERE user_id = $1`,
          [user.id],
        );

        const profiles = body.profiles || defaultPoliciesData.profiles;
        const rules = body.rules || defaultPoliciesData.rules;
        const allowlist = (body.allowlist || []).map((entry) => ({
          ...entry,
          addedBy:
            entry.addedBy === "Unknown"
              ? user.name || user.email || "User"
              : entry.addedBy,
          addedAt:
            entry.addedAt === "Unknown"
              ? new Date().toISOString()
              : entry.addedAt,
        }));
        const ignoreGlobs = body.ignoreGlobs || [];

        if (existingResult.rows.length === 0) {
          await pool.query(
            `INSERT INTO user_policies (user_id, profiles, rules, allowlist, ignore_globs)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user.id,
              JSON.stringify(profiles),
              JSON.stringify(rules),
              JSON.stringify(allowlist),
              JSON.stringify(ignoreGlobs),
            ],
          );
        } else {
          await pool.query(
            `UPDATE user_policies 
             SET profiles = $1, rules = $2, allowlist = $3, ignore_globs = $4, updated_at = NOW()
             WHERE user_id = $5`,
            [
              JSON.stringify(profiles),
              JSON.stringify(rules),
              JSON.stringify(allowlist),
              JSON.stringify(ignoreGlobs),
              user.id,
            ],
          );
        }

        const updatedPolicies: PoliciesData = {
          profiles,
          rules,
          allowlist,
          ignoreGlobs,
        };

        return reply.send({
          success: true,
          data: updatedPolicies,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error updating policies");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error),
        });
      }
    },
  );

  fastify.put(
    "/:id",
    { preHandler: [standardRateLimit] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const body = request.body as Partial<PoliciesData>;

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Unauthorized",
          });
        }

        const existingResult = await pool.query(
          `SELECT id FROM user_policies WHERE user_id = $1`,
          [user.id],
        );

        const profiles = body.profiles || defaultPoliciesData.profiles;
        const rules = body.rules || defaultPoliciesData.rules;
        const allowlist = (body.allowlist || []).map((entry) => ({
          ...entry,
          addedBy:
            entry.addedBy === "Unknown"
              ? user.name || user.email || "User"
              : entry.addedBy,
          addedAt:
            entry.addedAt === "Unknown"
              ? new Date().toISOString()
              : entry.addedAt,
        }));
        const ignoreGlobs = body.ignoreGlobs || [];

        if (existingResult.rows.length === 0) {
          await pool.query(
            `INSERT INTO user_policies (user_id, profiles, rules, allowlist, ignore_globs)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user.id,
              JSON.stringify(profiles),
              JSON.stringify(rules),
              JSON.stringify(allowlist),
              JSON.stringify(ignoreGlobs),
            ],
          );
        } else {
          await pool.query(
            `UPDATE user_policies 
             SET profiles = $1, rules = $2, allowlist = $3, ignore_globs = $4, updated_at = NOW()
             WHERE user_id = $5`,
            [
              JSON.stringify(profiles),
              JSON.stringify(rules),
              JSON.stringify(allowlist),
              JSON.stringify(ignoreGlobs),
              user.id,
            ],
          );
        }

        const updatedPolicies: PoliciesData = {
          profiles,
          rules,
          allowlist,
          ignoreGlobs,
        };

        return reply.send({
          success: true,
          data: updatedPolicies,
        });
      } catch (error: unknown) {
        logger.error({ error }, "Error updating policies");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error),
        });
      }
    },
  );
}
