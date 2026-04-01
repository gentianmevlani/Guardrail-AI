import type { AuthUser } from "./auth";
import "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    /** When true, preserves raw body on the request for signature verification (e.g. Stripe). */
    rawBody?: boolean;
  }

  interface FastifyRequest {
    /** Set by auth middleware after JWT / session validation */
    user?: AuthUser;
  }
}
