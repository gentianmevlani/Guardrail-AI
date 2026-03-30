/**
 * Schema Registration Utility
 *
 * Converts Zod schemas to JSON Schema format and registers them with Fastify
 */

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "./toErrorMessage";

/**
 * Convert Zod schema to JSON Schema format for Fastify
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);

      // Check if field is required (not optional)
      if (
        !(value instanceof z.ZodOptional) &&
        !(value instanceof z.ZodDefault)
      ) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  if (schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: "string" };

    // Check for email format
    for (const check of def.checks || []) {
      if (check.kind === "email") {
        result.format = "email";
      } else if (check.kind === "uuid") {
        result.format = "uuid";
      } else if (check.kind === "url") {
        result.format = "uri";
      } else if (check.kind === "min") {
        result.minLength = check.value;
      } else if (check.kind === "max") {
        result.maxLength = check.value;
      } else if (check.kind === "datetime") {
        result.format = "date-time";
      }
    }

    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: Record<string, unknown> = { type: "number" };

    for (const check of def.checks || []) {
      if (check.kind === "int") {
        result.type = "integer";
      } else if (check.kind === "min") {
        result.minimum = check.value;
      } else if (check.kind === "max") {
        result.maximum = check.value;
      }
    }

    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(def.type),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: def.values,
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(def.innerType);
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(def.innerType);
    inner.default = def.defaultValue();
    return inner;
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: "object",
      additionalProperties: zodToJsonSchema(def.valueType),
    };
  }

  if (schema instanceof z.ZodAny) {
    return {};
  }

  // Fallback for transform and other complex types
  if (def.innerType) {
    return zodToJsonSchema(def.innerType);
  }

  return { type: "string" };
}

/**
 * Additional route-specific schemas (moved from individual route files)
 */
const routeSchemas: Record<string, Record<string, unknown>> = {
  createTenant: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      domain: { type: "string", minLength: 1, maxLength: 255 },
      plan: {
        type: "string",
        enum: ["free", "starter", "pro", "compliance"],
      },
    },
    required: ["name", "domain", "plan"],
  },
  updateTenant: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      domain: { type: "string", minLength: 1, maxLength: 255 },
      status: { type: "string", enum: ["active", "inactive", "suspended"] },
      plan: {
        type: "string",
        enum: ["free", "starter", "pro", "compliance"],
      },
      settings: { type: "object" },
    },
  },
  reportRequest: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      config: { type: "object" },
    },
    required: ["projectId", "config"],
  },
  codeContext: {
    type: "object",
    properties: {
      language: { type: "string" },
      framework: { type: "string" },
      filePath: { type: "string" },
      content: { type: "string" },
      cursor: { type: "object" },
      imports: { type: "array", items: { type: "string" } },
      functions: { type: "array", items: { type: "string" } },
      variables: { type: "array", items: { type: "string" } },
    },
    required: ["language", "filePath", "content"],
  },
  suggestionRequest: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: [
          "completion",
          "refactor",
          "security",
          "optimization",
          "documentation",
        ],
      },
      context: { type: "object" },
      prompt: { type: "string" },
      maxSuggestions: { type: "number", minimum: 1, maximum: 20 },
    },
    required: ["type", "context"],
  },
  createProject: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      description: { type: "string" },
      path: { type: "string" },
      repositoryUrl: { type: "string", format: "uri" },
    },
    required: ["name"],
  },
  createRoom: {
    type: "object",
    properties: {
      roomId: { type: "string" },
      name: { type: "string" },
      projectId: { type: "string" },
      settings: { type: "object" },
    },
    required: ["roomId", "name"],
  },
  joinRoom: {
    type: "object",
    properties: {
      roomId: { type: "string" },
      userName: { type: "string" },
      avatar: { type: "string" },
      permissions: { type: "array", items: { type: "string" } },
    },
    required: ["roomId", "userName"],
  },
  sendNotification: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["info", "warning", "error", "success"] },
      title: { type: "string" },
      message: { type: "string" },
      userId: { type: "string" },
      roomId: { type: "string" },
    },
    required: ["type", "title", "message"],
  },
};

/**
 * Register all common schemas with Fastify
 */
export function registerSchemas(fastify: FastifyInstance): void {
  // Import commonSchemas
  const { commonSchemas } = require("../middleware/validation");

  // Register each Zod schema with Fastify (skip if already exists)
  for (const [name, schema] of Object.entries(commonSchemas)) {
    try {
      const existing = fastify.getSchema(name);
      if (!existing && schema instanceof z.ZodType) {
        const jsonSchema = zodToJsonSchema(schema as z.ZodTypeAny);
        fastify.addSchema({
          $id: name,
          ...jsonSchema,
        });
      }
    } catch (error: unknown) {
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";
      if (!code.includes("ALREADY_PRESENT")) {
        logger.warn({ error: toErrorMessage(error), stack: getErrorStack(error), schemaName: name, component: 'schema-registration' }, `Failed to register schema "${name}"`);
      }
    }
  }

  // Register route-specific schemas (skip if already exists)
  for (const [name, schema] of Object.entries(routeSchemas)) {
    try {
      // Check if schema already exists
      const existing = fastify.getSchema(name);
      if (!existing) {
        fastify.addSchema({
          $id: name,
          ...schema,
        });
      }
    } catch (error: unknown) {
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";
      if (!code.includes("ALREADY_PRESENT")) {
        logger.warn({ error: toErrorMessage(error), stack: getErrorStack(error), schemaName: name, component: 'schema-registration' }, `Failed to register route schema "${name}"`);
      }
    }
  }

  // Register additional JSON schemas from schemas.ts (skip if already exists)
  const { schemas } = require("../schemas");

  for (const [name, schema] of Object.entries(schemas)) {
    try {
      // Check if schema already exists
      const existing = fastify.getSchema(name);
      if (!existing) {
        fastify.addSchema({
          $id: name,
          ...(schema as Record<string, unknown>),
        });
      }
    } catch (error: unknown) {
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";
      if (!code.includes("ALREADY_PRESENT")) {
        logger.warn({ error: toErrorMessage(error), stack: getErrorStack(error), schemaName: name, component: 'schema-registration' }, `Failed to register schema "${name}"`);
      }
    }
  }
}
