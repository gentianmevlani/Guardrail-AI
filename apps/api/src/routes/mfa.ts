/**
 * Multi-Factor Authentication (MFA) Routes
 * 
 * Endpoints for MFA setup, verification, and management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../middleware/fastify-auth';
import { mfaService } from '../services/mfa-service';
import { logger } from '../logger';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@guardrail/database';
import { authService } from '../services/auth-service';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Request schemas
const setupMFASchema = z.object({
  // No body required - uses authenticated user
});

const verifyMFASetupSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/),
});

const verifyMFATokenSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/),
  backupCode: z.string().optional(),
});

const disableMFASchema = z.object({
  password: z.string().min(1),
});

/**
 * MFA Routes
 */
export async function mfaRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/mfa/status
   * Get MFA status for current user
   */
  fastify.get(
    '/status',
    { preHandler: [authMiddleware] },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const isEnabled = await mfaService.isMFAEnabled(user.id);
        const remainingBackupCodes = await mfaService.getRemainingBackupCodes(user.id);

        return reply.send({
          success: true,
          data: {
            enabled: isEnabled,
            remainingBackupCodes,
          },
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Failed to get MFA status');
        return reply.status(500).send({
          success: false,
          error: 'Failed to get MFA status',
        });
      }
    }
  );

  /**
   * POST /api/mfa/setup
   * Generate MFA secret and QR code for setup
   */
  fastify.post(
    '/setup',
    { preHandler: [authMiddleware] },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        // Check if MFA is already enabled
        const isEnabled = await mfaService.isMFAEnabled(user.id);
        if (isEnabled) {
          return reply.status(400).send({
            success: false,
            error: 'MFA is already enabled',
          });
        }

        // Generate secret and QR code
        const result = await mfaService.generateMFASecret(
          user.id,
          user.email ?? '',
        );

        return reply.send({
          success: true,
          data: {
            secret: result.secret,
            qrCodeUrl: result.qrCodeUrl,
            backupCodes: result.backupCodes,
            message: 'Save these backup codes in a safe place. You will need them if you lose access to your authenticator app.',
          },
        });
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Failed to setup MFA');
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || 'Failed to setup MFA',
        });
      }
    }
  );

  /**
   * POST /api/mfa/verify-setup
   * Verify MFA setup with a TOTP code
   */
  fastify.post(
    '/verify-setup',
    { preHandler: [authMiddleware] },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const body = verifyMFASetupSchema.parse(request.body);
        const isValid = await mfaService.verifyMFASetup(user.id, body.token);

        if (!isValid) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid verification code',
          });
        }

        return reply.send({
          success: true,
          message: 'MFA enabled successfully',
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request',
            details: error.errors,
          });
        }

        logger.error({ error: toErrorMessage(error) }, 'Failed to verify MFA setup');
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || 'Failed to verify MFA setup',
        });
      }
    }
  );

  /**
   * POST /api/mfa/verify
   * Verify MFA token during authentication
   * This endpoint is used after initial login when MFA is enabled
   * Accepts mfaSessionToken from login response or Bearer token
   */
  fastify.post(
    '/verify',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = verifyMFATokenSchema.parse(request.body);
        
        // Get userId from mfaSessionToken or Bearer token
        let userId: string | undefined;
        
        // Check for mfaSessionToken in body (from login response)
        if ((request.body as any).mfaSessionToken) {
          const { verifyToken } = await import('../middleware/fastify-auth');
          try {
            const decoded = verifyToken((request.body as any).mfaSessionToken);
            userId = decoded.id;
          } catch {
            return reply.status(401).send({
              success: false,
              error: 'Invalid MFA session token',
            });
          }
        } else {
          // Try Bearer token
          const authHeader = request.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            const { verifyToken } = await import('../middleware/fastify-auth');
            try {
              const decoded = verifyToken(authHeader.substring(7));
              userId = decoded.id;
            } catch {
              return reply.status(401).send({
                success: false,
                error: 'Invalid token',
              });
            }
          }
        }

        if (!userId) {
          return reply.status(401).send({
            success: false,
            error: 'User ID required. Provide mfaSessionToken or Bearer token.',
          });
        }

        // Try TOTP token first
        if (body.token) {
          const isValid = await mfaService.verifyMFAToken(userId, body.token);
          if (isValid) {
            // MFA verified - now issue full access token
            const { authService } = await import('../services/auth-service');
            
            // Get user details
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, email: true, name: true, role: true },
            });

            if (!user) {
              return reply.status(404).send({
                success: false,
                error: 'User not found',
              });
            }

            const { accessToken, refreshToken } =
              await authService.issueAccessAndRefreshTokens(user.id);

            // Set refresh token cookie
            reply.setCookie("refreshToken", refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 7 * 24 * 60 * 60, // 7 days
              path: "/",
            });

            return reply.send({
              success: true,
              message: 'MFA verified',
              data: {
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role,
                },
                token: accessToken,
              },
            });
          }
        }

        // Try backup code if provided
        if (body.backupCode) {
          const isValid = await mfaService.verifyBackupCode(userId, body.backupCode);
          if (isValid) {
            // Same as above - issue full tokens
            const { authService } = await import('../services/auth-service');
            
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, email: true, name: true, role: true },
            });

            if (!user) {
              return reply.status(404).send({
                success: false,
                error: 'User not found',
              });
            }

            const { accessToken, refreshToken } =
              await authService.issueAccessAndRefreshTokens(user.id);

            reply.setCookie("refreshToken", refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 7 * 24 * 60 * 60,
              path: "/",
            });

            return reply.send({
              success: true,
              message: 'MFA verified with backup code',
              data: {
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role,
                },
                token: accessToken,
              },
            });
          }
        }

        return reply.status(400).send({
          success: false,
          error: 'Invalid verification code or backup code',
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request',
            details: error.errors,
          });
        }

        logger.error({ error: toErrorMessage(error) }, 'Failed to verify MFA');
        return reply.status(500).send({
          success: false,
          error: 'Failed to verify MFA',
        });
      }
    }
  );

  /**
   * POST /api/mfa/disable
   * Disable MFA (requires password verification)
   */
  fastify.post(
    '/disable',
    { preHandler: [authMiddleware] },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user) {
          return reply.status(401).send({
            success: false,
            error: 'Authentication required',
          });
        }

        const body = disableMFASchema.parse(request.body);

        // Verify password
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { password: true },
        });

        if (!dbUser || !dbUser.password) {
          return reply.status(400).send({
            success: false,
            error: 'Password not set for this account',
          });
        }

        const isValidPassword = await bcrypt.compare(body.password, dbUser.password);
        if (!isValidPassword) {
          return reply.status(401).send({
            success: false,
            error: 'Invalid password',
          });
        }

        // Disable MFA
        await mfaService.disableMFA(user.id);

        return reply.send({
          success: true,
          message: 'MFA disabled successfully',
        });
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid request',
            details: error.errors,
          });
        }

        logger.error({ error: toErrorMessage(error) }, 'Failed to disable MFA');
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || 'Failed to disable MFA',
        });
      }
    }
  );
}
