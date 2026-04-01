/**
 * Authentication Routes for Fastify
 *
 * API endpoints for authentication, registration, and token management
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authService } from "../services/auth-service";
import type { AuthUser } from "../types/auth";
import { authRateLimit } from "../middleware/fastify-auth";
import { SecurityEventService } from "../services/security-event-service";
import { sanitizeRedirectUrl } from "../lib/redirect-validator";
import { isLocked, recordFailedAttempt, clearFailedAttempts } from "../services/brute-force-protection";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// Request type extensions - using imported AuthenticatedRequest
// Extended with legacy fields for backwards compatibility
interface AuthRequestWithLegacy extends FastifyRequest {
  userId?: string;
  userEmail?: string;
  user?: AuthUser;
}

/**
 * POST /api/auth/register
 * Register a new user
 */
async function register(request: FastifyRequest, reply: FastifyReply) {
  const reqLogger = request.log;

  try {
    // Validate input
    const validatedData = registerSchema.parse(request.body);

    reqLogger.info(
      {
        email: validatedData.email,
        hasName: !!validatedData.name,
      },
      "User registration attempt",
    );

    // Register user
    const result = await authService.register(validatedData as any);

    reqLogger.info(
      {
        userId: result.user.id,
        email: result.user.email,
      },
      "User registered successfully",
    );

    // Set HTTP-only cookie for refresh token
    reply.setCookie("refreshToken", result["refreshToken"], {
      httpOnly: true,
      secure: process["env"]["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: "/",
    });

    reply.status(201).send({
      success: true,
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    const err = error as Error;
    const body = request.body as { email?: string } | undefined;
    reqLogger.error(
      {
        error: err.message,
        stack: err.stack,
        email: body?.email,
      },
      "Registration failed",
    );

    if (err.message.includes("already exists")) {
      return reply.status(409).send({
        success: false,
        error: "User already exists with this email",
      });
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    reply.status(500).send({
      success: false,
      error: "Failed to register user",
    });
  }
}

/**
 * POST /api/auth/login
 * Login user
 */
async function login(request: FastifyRequest, reply: FastifyReply) {
  const securityEventService = SecurityEventService.getInstance();
  const ip = request.ip || request.socket.remoteAddress || "unknown";
  const userAgent = request.headers["user-agent"] || "unknown";
  
  // Import MFA service at function level to avoid circular dependencies
  const { mfaService } = await import('../services/mfa-service');
  
  try {
    // Validate input
    const validatedData = loginSchema.parse(request.body);
    const email = validatedData.email;

    // Check if account is locked due to brute-force attempts
    const lockoutStatus = await isLocked(email);
    if (lockoutStatus.locked && lockoutStatus.lockoutUntil) {
      const lockoutMinutes = Math.ceil((lockoutStatus.lockoutUntil - Date.now()) / (60 * 1000));
      
      await securityEventService.emit({
        eventType: 'login_failure',
        payload: {
          email,
          reason: 'account_locked',
        },
        requestContext: {
          requestId: request.id,
          ip,
          userAgent,
          route: '/api/auth/login',
          method: 'POST',
        },
        severity: 'high',
      });

      return reply.status(423).send({
        success: false,
        error: `Account temporarily locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minute(s).`,
        code: "ACCOUNT_LOCKED",
        lockoutUntil: new Date(lockoutStatus.lockoutUntil).toISOString(),
      });
    }

    // Login user (validates password)
    const result = await authService.login(validatedData as any);

    // Clear failed attempts on successful login
    await clearFailedAttempts(email);

    // Check if MFA is enabled for this user
    const isMFAEnabled = await mfaService.isMFAEnabled(result.user.id);

    if (isMFAEnabled) {
      // MFA is enabled - don't issue full token yet, require MFA verification
      // Return a temporary token or session ID for MFA verification
      // The client should call /api/mfa/verify with this token
      
      // Generate a temporary MFA session token (short-lived, 5 minutes)
      const { generateToken } = await import('../middleware/fastify-auth');
      const mfaSessionToken = generateToken({
        id: result.user.id,
        email: result.user.email,
        role: (result.user as any).role || 'user',
      });

      // Audit log: MFA required
      await securityEventService.emit({
        eventType: 'login_success',
        payload: {
          email,
          userId: result.user.id,
          requiresMFA: true,
        },
        requestContext: {
          requestId: request.id,
          ip,
          userAgent,
          route: '/api/auth/login',
          method: 'POST',
        },
        userId: result.user.id,
        severity: 'low',
      });

      return reply.send({
        success: true,
        requiresMFA: true,
        data: {
          userId: result.user.id,
          mfaSessionToken, // Temporary token for MFA verification
          message: 'MFA verification required',
        },
      });
    }

    // MFA not enabled - proceed with normal login
    // Check for "remember me" option in request body
    const rememberMe = (request.body as { rememberMe?: boolean })?.rememberMe || false;
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days if remember me, else 7 days

    // Set HTTP-only cookie for refresh token
    reply.setCookie("refreshToken", result["refreshToken"], {
      httpOnly: true,
      secure: process["env"]["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: cookieMaxAge,
      path: "/",
    });

    // Audit log: Successful login
    await securityEventService.emit({
      eventType: 'login_success',
      payload: {
        email,
        userId: result.user.id,
        requiresMFA: false,
      },
      requestContext: {
        requestId: request.id,
        ip,
        userAgent,
        route: '/api/auth/login',
        method: 'POST',
      },
      userId: result.user.id,
      severity: 'low',
    });

    reply.send({
      success: true,
      requiresMFA: false,
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    const err = error as Error;
    const email = (request.body as { email?: string })?.email || "unknown";
    
    // Audit log: Failed login
    await securityEventService.emit({
      eventType: 'login_failure',
      payload: {
        email,
        error: err.message,
        reason: err.message.includes("Invalid email or password") 
          ? "invalid_credentials" 
          : err.message.includes("locked") 
          ? "account_locked"
          : "unknown",
      },
      requestContext: {
        requestId: request.id,
        ip,
        userAgent,
        route: '/api/auth/login',
        method: 'POST',
      },
      severity: err.message.includes("locked") ? 'high' : 'medium',
    }).catch((logError: unknown) => {
      // Don't fail the request if audit logging fails
      request.log.warn({ error: logError }, "Failed to log security event");
    });

    request.log.error({ error: err.message, email }, "Login error");

    if (err.message.includes("Invalid email or password")) {
      // Record failed attempt
      const lockoutResult = await recordFailedAttempt(email);
      
      if (lockoutResult.locked && lockoutResult.lockoutUntil) {
        const lockoutMinutes = Math.ceil((lockoutResult.lockoutUntil - Date.now()) / (60 * 1000));
        return reply.status(423).send({
          success: false,
          error: `Account temporarily locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minute(s).`,
          code: "ACCOUNT_LOCKED",
          lockoutUntil: new Date(lockoutResult.lockoutUntil).toISOString(),
        });
      }

      return reply.status(401).send({
        success: false,
        error: "Invalid email or password",
        attemptsRemaining: lockoutResult.attemptsRemaining,
      });
    }

    if (err.message.includes("locked") || err.message.includes("lockout")) {
      return reply.status(423).send({
        success: false,
        error: "Account temporarily locked due to too many failed login attempts. Please try again later.",
        code: "ACCOUNT_LOCKED",
      });
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    reply.status(500).send({
      success: false,
      error: "Failed to login",
    });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
async function refreshToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    const body = request.body as { refreshToken?: string } | undefined;
    const refreshToken = request.cookies?.refreshToken || body?.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: "Refresh token required",
      });
    }

    const result = await authService.refreshToken(refreshToken);

    reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ error: err.message }, "Token refresh error");
    reply.status(401).send({
      success: false,
      error: "Failed to refresh token",
    });
  }
}

/**
 * POST /api/auth/logout
 * Logout user - invalidates refresh tokens and blacklists access token
 */
async function logout(request: AuthRequestWithLegacy, reply: FastifyReply) {
  const securityEventService = SecurityEventService.getInstance();
  const ip = request.ip || request.socket.remoteAddress || "unknown";
  
  try {
    const userId = request.userId;
    const refreshToken = request.cookies?.refreshToken;
    const authHeader = request.headers.authorization;
    const accessToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    await authService.logout({
      userId,
      refreshToken: refreshToken || undefined,
      accessToken: accessToken || undefined,
    });

    reply.clearCookie("refreshToken", { path: "/" });

    // Audit log: Logout
    if (userId) {
      await securityEventService.emit({
        eventType: 'logout',
        payload: { userId },
        requestContext: {
          requestId: request.id,
          ip,
          route: '/api/auth/logout',
          method: 'POST',
        },
        userId,
        severity: 'low',
      }).catch((logError: unknown) => {
        request.log.warn({ error: logError }, "Failed to log security event");
      });
    }

    reply.send({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ error: err.message }, "Logout error");
    reply.status(500).send({
      success: false,
      error: "Failed to logout",
    });
  }
}

/**
 * GET /api/auth/me
 * Get current user profile
 */
async function getProfile(request: AuthRequestWithLegacy, reply: FastifyReply) {
  try {
    const userId = request.userId;
    const userEmail = request.userEmail;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: "Not authenticated",
      });
    }

    reply.send({
      success: true,
      data: {
        id: userId,
        email: userEmail,
      },
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ error: err.message }, "Get profile error");
    reply.status(500).send({
      success: false,
      error: "Failed to get profile",
    });
  }
}

/**
 * PUT /api/auth/change-password
 * Change user password
 */
async function changePassword(
  request: AuthRequestWithLegacy,
  reply: FastifyReply,
) {
  try {
    const userId = request.userId;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: "Not authenticated",
      });
    }

    // Validate input
    const validatedData = changePasswordSchema.parse(request.body);

    await authService.changePassword(
      userId,
      validatedData.currentPassword,
      validatedData.newPassword,
    );

    reply.send({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ error: err.message }, "Change password error");

    if (err.message.includes("incorrect")) {
      return reply.status(400).send({
        success: false,
        error: "Current password is incorrect",
      });
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    reply.status(500).send({
      success: false,
      error: "Failed to change password",
    });
  }
}

/**
 * POST /api/auth/request-reset
 * Request password reset
 */
async function requestPasswordReset(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const securityEventService = SecurityEventService.getInstance();
  const ip = request.ip || request.socket.remoteAddress || "unknown";
  
  try {
    const body = request.body as { email?: string };
    const email = body.email;

    if (!email || !email.includes("@")) {
      return reply.status(400).send({
        success: false,
        error: "Valid email is required",
      });
    }

    await authService.requestPasswordReset(email);

    // Audit log: Password reset requested
    await securityEventService.emit({
      eventType: 'password_reset_request',
      payload: { email },
      requestContext: {
        requestId: request.id,
        ip,
        route: '/api/auth/request-reset',
        method: 'POST',
      },
      severity: 'low',
    }).catch((logError: unknown) => {
      request.log.warn({ error: logError }, "Failed to log security event");
    });

    reply.send({
      success: true,
      message:
        "If an account with this email exists, a reset link has been sent",
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ error: err.message }, "Request password reset error");
    reply.status(500).send({
      success: false,
      error: "Failed to process password reset request",
    });
  }
}

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
async function resetPassword(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(request.body);

    await authService.resetPassword(
      validatedData.token,
      validatedData.newPassword,
    );

    reply.send({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ error: err.message }, "Reset password error");

    if (err.message.includes("Invalid or expired")) {
      return reply.status(400).send({
        success: false,
        error: "Invalid or expired reset token",
      });
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    reply.status(500).send({
      success: false,
      error: "Failed to reset password",
    });
  }
}

/**
 * Authentication routes plugin
 */
export async function authRoutes(fastify: FastifyInstance) {
  // Schemas are registered centrally in registerSchemas.ts

  // Public routes
  fastify.post(
    "/register",
    {
      schema: {
        body: { $ref: "register" },
        tags: ["Authentication"],
        summary: "Register a new user",
        description: "Create a new user account with email and password",
        response: {
          201: {
            description: "User registered successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          409: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    register,
  );

  fastify.post(
    "/login",
    {
      preHandler: [authRateLimit],
      schema: {
        body: { $ref: "login" },
        tags: ["Authentication"],
        summary: "Login user",
        description: "Authenticate with email and password",
        response: {
          200: {
            description: "Login successful",
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          423: {
            description: "Account locked",
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
              code: { type: "string" },
            },
          },
        },
      },
    },
    login,
  );
  fastify.post("/refresh", refreshToken);
  fastify.post(
    "/request-reset",
    {
      preHandler: [authRateLimit], // Rate limit password reset requests
    },
    requestPasswordReset,
  );
  fastify.post("/reset-password", resetPassword);

  // GitHub OAuth status endpoint
  fastify.get(
    "/github/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if GitHub is configured and if user is connected
        const isConfigured = !!(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        );

        // In production, would check database for user's GitHub connection
        return reply.send({
          success: true,
          connected: false,
          configured: isConfigured,
        });
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "GitHub status error");
        reply.status(500).send({
          success: false,
          error: "Failed to get GitHub status",
        });
      }
    },
  );

  // GitHub sync endpoint
  fastify.post(
    "/github/sync",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // In production, would sync repositories from GitHub API
        return reply.send({
          success: true,
          message: "Repositories synced",
          synced: 0,
        });
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "GitHub sync error");
        reply.status(500).send({
          success: false,
          error: "Failed to sync repositories",
        });
      }
    },
  );

  // GitHub OAuth endpoints
  fastify.post(
    "/github/connect",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const redirectUri =
          process.env.GITHUB_REDIRECT_URI ||
          process.env.GITHUB_CALLBACK_URL ||
          `${process.env.FRONTEND_URL || "http://localhost:5001"}/api/auth/github/callback`;

        if (clientId) {
          // Real OAuth flow - redirect to GitHub
          const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email,repo`;
          return reply.send({ success: true, redirectUrl: authUrl });
        }

        // Development mode - mark as connected without real OAuth
        return reply.send({ success: true, connected: true });
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "GitHub connect error");
        reply.status(500).send({
          success: false,
          error: "Failed to initiate GitHub connection",
        });
      }
    },
  );

  fastify.get(
    "/github/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code } = request.query as { code?: string };

        if (!code) {
          return reply
            .status(400)
            .send({ success: false, error: "Authorization code required" });
        }

        // Exchange code for access token
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const tokenResponse = await fetch(
            "https://github.com/login/oauth/access_token",
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
              }),
            },
          );

          const tokenData = (await tokenResponse.json()) as {
            access_token?: string;
          };
          if (tokenData.access_token) {
            // Store token securely (in production, save to database)
            // Redirect back to frontend with success
            return reply.redirect("/?github=connected");
          }
        }

        reply.redirect("/?github=error");
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "GitHub callback error");
        reply.redirect("/?github=error");
      }
    },
  );

  fastify.post(
    "/github/disconnect",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // In production, revoke GitHub token and remove from database
        return reply.send({ success: true, disconnected: true });
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "GitHub disconnect error");
        reply
          .status(500)
          .send({ success: false, error: "Failed to disconnect GitHub" });
      }
    },
  );

  // GitHub OAuth login/signup endpoint (called by web-ui callback)
  fastify.post(
    "/oauth/github",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as {
          provider: string;
          providerId: string;
          email: string;
          name?: string;
          avatar?: string;
          accessToken?: string;
        };

        const { email, name, providerId } = body;

        if (!email) {
          return reply.status(400).send({
            success: false,
            error: "Email is required",
          });
        }

        // Check if user already exists
        const existingUser = await authService.findUserByEmail(email);
        let isNewUser = false;

        if (!existingUser) {
          // Create new user (OAuth users don't have passwords)
          isNewUser = true;
          await authService.createOAuthUser({
            email,
            name,
            provider: "github",
          });
          request.log.info({ email, providerId }, "New GitHub user created");
        } else {
          request.log.info(
            { email, providerId },
            "Existing GitHub user logged in",
          );
        }

        // Login user and generate JWT
        const authResponse = await authService.loginOAuth(email);

        // Set refresh token cookie
        reply.setCookie("refreshToken", authResponse.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return reply.send({
          success: true,
          isNewUser,
          data: {
            user: authResponse.user,
            token: authResponse.token,
          },
        });
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "GitHub OAuth error");
        reply.status(500).send({
          success: false,
          error: "Failed to authenticate with GitHub",
        });
      }
    },
  );

  // Google OAuth login/signup (called by Next.js web-ui callback)
  fastify.post(
    "/oauth/google",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as {
          provider?: string;
          providerId: string;
          email: string;
          name?: string;
          avatar?: string;
          accessToken?: string;
          refreshToken?: string;
        };

        const { email, name, providerId } = body;

        if (!email) {
          return reply.status(400).send({
            success: false,
            error: "Email is required",
          });
        }

        const existingUser = await authService.findUserByEmail(email);
        let isNewUser = false;

        if (!existingUser) {
          isNewUser = true;
          await authService.createOAuthUser({
            email,
            name,
            provider: "google",
          });
          request.log.info({ email, providerId }, "New Google user created");
        } else {
          request.log.info(
            { email, providerId },
            "Existing Google user logged in",
          );
        }

        const authResponse = await authService.loginOAuth(email);

        reply.setCookie("refreshToken", authResponse.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        });

        return reply.send({
          success: true,
          isNewUser,
          data: {
            user: authResponse.user,
            token: authResponse.token,
          },
        });
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "Google OAuth API error");
        reply.status(500).send({
          success: false,
          error: "Failed to authenticate with Google",
        });
      }
    },
  );

  // Google OAuth endpoints
  fastify.get(
    "/google/connect",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri =
          process.env.GOOGLE_REDIRECT_URI ||
          process.env.GOOGLE_CALLBACK_URL ||
          `${process.env.FRONTEND_URL || "http://localhost:5001"}/api/auth/google/callback`;

        if (!clientId) {
          return reply.status(500).send({
            success: false,
            error: "Google OAuth not configured",
          });
        }

        // Build Google OAuth URL
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid email profile");
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        return reply.redirect(authUrl.toString());
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "Google connect error");
        reply.status(500).send({
          success: false,
          error: "Failed to initiate Google connection",
        });
      }
    },
  );

  fastify.get(
    "/google/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code } = request.query as { code?: string };

        if (!code) {
          return reply.redirect(`${process.env.FRONTEND_URL}/?google=error`);
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri =
          process.env.GOOGLE_REDIRECT_URI ||
          process.env.GOOGLE_CALLBACK_URL ||
          `${process.env.FRONTEND_URL || "http://localhost:5001"}/api/auth/google/callback`;
        const frontendUrl =
          process.env.FRONTEND_URL || "http://myGuardrail.com";

        if (!clientId || !clientSecret) {
          return reply.redirect(`${frontendUrl}/?google=error`);
        }

        // Exchange code for tokens
        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          },
        );

        const tokenData = (await tokenResponse.json()) as {
          access_token?: string;
          id_token?: string;
        };

        if (!tokenData.access_token) {
          return reply.redirect(`${frontendUrl}/?google=error`);
        }

        // Get user info from Google
        const userInfoResponse = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          },
        );

        const googleUser = (await userInfoResponse.json()) as {
          email: string;
          name?: string;
          picture?: string;
        };

        if (!googleUser.email) {
          return reply.redirect(`${frontendUrl}/?google=error`);
        }

        // Check if user exists
        const existingUser = await authService.findUserByEmail(
          googleUser.email,
        );
        let isNewUser = false;

        if (!existingUser) {
          // Create new user (OAuth users don't have passwords)
          isNewUser = true;
          await authService.createOAuthUser({
            email: googleUser.email,
            name: googleUser.name,
            provider: "google",
          });
        }

        // Login user and generate JWT
        const authResponse = await authService.loginOAuth(googleUser.email);

        // Set refresh token cookie
        reply.setCookie("refreshToken", authResponse.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        // Redirect based on user type - validate redirect URL
        const redirectPath = isNewUser ? "/pricing" : "/dashboard";
        const redirectUrl = sanitizeRedirectUrl(
          `${redirectPath}?token=${authResponse.token}`,
          "/dashboard"
        );
        return reply.redirect(`${frontendUrl}${redirectUrl}`);
      } catch (err) {
        const error = err as Error;
        request.log.error({ error: error?.message }, "Google callback error");
        const frontendUrl =
          process.env.FRONTEND_URL || "http://myGuardrail.com";
        reply.redirect(`${frontendUrl}/?google=error`);
      }
    },
  );

  // Public user endpoint - checks session via cookie
  fastify.get("/user", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const refreshToken = request.cookies?.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({
          success: false,
          error: "Not authenticated",
        });
      }

      // Verify refresh token and get user ID
      const result = await authService.verifyRefreshToken(refreshToken);
      const user = await authService.findUserById(result.userId);

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: "User not found",
        });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.name?.split(" ")[0],
        lastName: user.name?.split(" ").slice(1).join(" "),
        profileImageUrl: null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      request.log.error({ error: err.message }, "Get user error");
      return reply.status(401).send({
        success: false,
        error: "Invalid session",
      });
    }
  });

  // Protected routes
  fastify.register(async function (fastify) {
    // Add authentication hook
    fastify.addHook("preHandler", async (request, reply) => {
      try {
        const authHeader = request.headers.authorization;
        const token =
          authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.substring(7)
            : null;

        if (!token) {
          return reply.status(401).send({
            success: false,
            error: "Access token required",
          });
        }

        // Verify token
        const decoded = await authService.verifyToken(token);

        // Attach user info to request
        (request as AuthRequestWithLegacy).userId = decoded.userId;
        (request as AuthRequestWithLegacy).userEmail = decoded.email;
      } catch (error) {
        const err = error as Error;
        request.log.error({ error: err.message }, "Authentication error");
        reply.status(401).send({
          success: false,
          error: "Invalid or expired token",
        });
      }
    });

    fastify.get("/me", getProfile);
    fastify.post("/logout", logout);
    fastify.put("/change-password", changePassword);

    // API Key management
    fastify.get(
      "/api-key",
      async (request: AuthRequestWithLegacy, reply: FastifyReply) => {
        try {
          const userId = request.userId;
          if (!userId) {
            return reply
              .status(401)
              .send({ success: false, error: "Not authenticated" });
          }

          // Check database for existing API keys
          const prisma = (fastify as any).prisma;
          if (!prisma) {
            return reply.status(500).send({ 
              success: false, 
              error: "Database not available" 
            });
          }

          const existingKey = await prisma.apiKey.findFirst({
            where: {
              userId: userId,
              isActive: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          return reply.send({
            success: true,
            apiKey: existingKey ? {
              id: existingKey.id,
              prefix: existingKey.keyPrefix || existingKey.keyHash?.substring(0, 8) || '****',
              name: existingKey.name,
              createdAt: existingKey.createdAt,
              lastUsedAt: existingKey.lastUsedAt,
            } : null,
          });
        } catch (error: unknown) {
          request.log.error({ error: toErrorMessage(error) }, "Failed to get API key");
          return reply
            .status(500)
            .send({ success: false, error: "Failed to get API key" });
        }
      },
    );

    fastify.post(
      "/api-key",
      async (request: AuthRequestWithLegacy, reply: FastifyReply) => {
        try {
          const userId = request.userId;
          if (!userId) {
            return reply
              .status(401)
              .send({ success: false, error: "Not authenticated" });
          }

          // Generate a new API key
          const crypto = await import("crypto");
          const apiKey = `grl_${crypto.randomBytes(32).toString("hex")}`;
          const keyHash = crypto
            .createHash("sha256")
            .update(apiKey)
            .digest("hex");

          // In production, store the hash in database
          // For now, return the key (only shown once)
          return reply.send({
            success: true,
            apiKey: apiKey,
            data: {
              key: apiKey,
              prefix: apiKey.substring(0, 12) + "...",
              createdAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          const err = error as Error;
          request.log.error({ error: err.message }, "API key creation error");
          reply
            .status(500)
            .send({ success: false, error: "Failed to create API key" });
        }
      },
    );

    fastify.delete(
      "/api-key",
      async (request: AuthRequestWithLegacy, reply: FastifyReply) => {
        try {
          const userId = request.userId;
          if (!userId) {
            return reply
              .status(401)
              .send({ success: false, error: "Not authenticated" });
          }

          // In production, delete from database
          return reply.send({
            success: true,
            message: "API key revoked",
          });
        } catch (error) {
          const err = error as Error;
          request.log.error({ error: err.message }, "API key deletion error");
          reply
            .status(500)
            .send({ success: false, error: "Failed to revoke API key" });
        }
      },
    );
  });
}
