import { FastifyPluginAsync, FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";

type SessionData = { sessionId: string; userId?: string };

const sessionStoreKey = "_guardrailSession" as const;

const sessionPlugin: FastifyPluginAsync = async (fastify) => {
  // Register cookie plugin with security settings
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || "your-super-secret-cookie-key",
    parseOptions: {
      // Security settings
      secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
      httpOnly: true, // Prevent XSS attacks
      sameSite: "strict", // CSRF protection
      path: "/",
      // Additional security
      maxAge: 60 * 60 * 24 * 7, // 7 days
      domain: process.env.COOKIE_DOMAIN, // Set for cross-domain if needed
    },
  });

  // Add session decorator (Fastify 5 requires getter/setter, not null)
  fastify.decorateRequest("session", {
    getter(this: FastifyRequest): SessionData | undefined {
      return (this as FastifyRequest & { [sessionStoreKey]?: SessionData })[
        sessionStoreKey
      ];
    },
    setter(this: FastifyRequest, value: SessionData | undefined): void {
      (this as FastifyRequest & { [sessionStoreKey]?: SessionData })[
        sessionStoreKey
      ] = value;
    },
  });

  // Add hook to parse session from cookies
  fastify.addHook("preHandler", async (request, reply) => {
    const sessionId = request.cookies.sessionId;

    if (sessionId) {
      try {
        // In production, validate session ID against database or Redis
        // For now, basic validation
        if (sessionId.length > 10) {
          request.session = {
            sessionId,
            userId: request.cookies.userId,
          };
        }
      } catch (error) {
        fastify.log.warn("Invalid session detected");
        // Clear invalid cookies
        reply.clearCookie("sessionId");
        reply.clearCookie("userId");
      }
    }
  });

  // Helper to set secure session cookies
  fastify.decorate(
    "setSessionCookie",
    async (reply: any, sessionId: string, userId: string) => {
      reply
        .setCookie("sessionId", sessionId, {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
          domain: process.env.COOKIE_DOMAIN,
        })
        .setCookie("userId", userId, {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
          domain: process.env.COOKIE_DOMAIN,
        });
    },
  );

  // Helper to clear session cookies
  fastify.decorate("clearSessionCookie", async (reply: any) => {
    reply
      .clearCookie("sessionId", {
        path: "/",
        domain: process.env.COOKIE_DOMAIN,
      })
      .clearCookie("userId", { path: "/", domain: process.env.COOKIE_DOMAIN });
  });
};

export default sessionPlugin;
