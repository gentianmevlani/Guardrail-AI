/**
 * Authentication Service
 *
 * Handles user authentication, registration, and JWT token management
 * with proper token invalidation for security
 */

import { pool, prisma } from "@guardrail/database";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { emailService } from "./email-service";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  token: string;
  refreshToken: string;
}

interface JWTPayload {
  userId: string;
  email?: string;
  type: "access" | "refresh" | "reset";
  timestamp?: number;
}

interface LogoutOptions {
  userId?: string;
  refreshToken?: string;
  accessToken?: string;
}

class AuthService {
  private readonly jwtSecret =
    process["env"]["JWT_SECRET"] || "your-secret-key";

  /**
   * Hash a token for secure storage (don't store raw tokens)
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Get token expiration time from JWT
   */
  private getTokenExpiration(token: string): Date | null {
    try {
      const decoded = (jwt as any).decode(token) as { exp?: number } | null;
      if (decoded?.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    const hashedPassword = await (bcrypt as any).hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        emailVerified: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const token = await this.generateToken(user.id, "access");
    const refreshToken = await this.generateToken(user.id, "refresh");

    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Login user
   * Implements session rotation by invalidating old refresh tokens
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
      },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isValid = await (bcrypt as any).compare(credentials.password, user.password!);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    // Session rotation: Invalidate all existing refresh tokens for this user
    // This prevents session fixation attacks
    await pool.query(
      `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
      [user.id],
    );

    const token = await this.generateToken(user.id, "access");
    const refreshToken = await this.generateToken(user.id, "refresh");

    await this.storeRefreshToken(user.id, refreshToken);

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = this.getTokenExpiration(refreshToken);

    if (!expiresAt) {
      throw new Error("Invalid refresh token");
    }

    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at, revoked, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, false, NOW())
       ON CONFLICT (token) DO NOTHING`,
      [userId, tokenHash, expiresAt],
    );
  }

  /**
   * Logout user - invalidates refresh tokens and blacklists access token
   */
  async logout(options: LogoutOptions): Promise<void> {
    const { userId, refreshToken, accessToken } = options;

    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await pool.query(
        `UPDATE refresh_tokens SET revoked = true WHERE token = $1`,
        [tokenHash],
      );
    }

    if (userId) {
      await pool.query(
        `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
        [userId],
      );
    }

    if (accessToken) {
      await this.blacklistAccessToken(accessToken);
    }
  }

  /**
   * Blacklist an access token
   */
  async blacklistAccessToken(accessToken: string): Promise<void> {
    const tokenHash = this.hashToken(accessToken);
    const expiresAt = this.getTokenExpiration(accessToken);

    if (!expiresAt || expiresAt < new Date()) {
      return;
    }

    try {
      await pool.query(
        `INSERT INTO token_blacklist (id, "tokenHash", "expiresAt", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT ("tokenHash") DO NOTHING`,
        [tokenHash, expiresAt],
      );
    } catch (error: unknown) {
      if (!toErrorMessage(error)?.includes("duplicate")) {
        throw error;
      }
    }
  }

  /**
   * Check if access token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM token_blacklist WHERE "tokenHash" = $1`,
      [tokenHash],
    );
    return result.rows.length > 0;
  }

  /**
   * Check if refresh token is revoked
   */
  async isRefreshTokenRevoked(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const result = await pool.query<{ revoked: boolean }>(
      `SELECT revoked FROM refresh_tokens WHERE token = $1`,
      [tokenHash],
    );
    if (result.rows.length === 0) {
      return false;
    }
    return result.rows[0].revoked === true;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const decoded = (jwt as any).verify(refreshToken, this.jwtSecret) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== "refresh") {
        throw new Error("Invalid refresh token");
      }

      const isRevoked = await this.isRefreshTokenRevoked(refreshToken);
      if (isRevoked) {
        throw new Error("Refresh token has been revoked");
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true },
      });

      if (!user) {
        throw new Error("Invalid refresh token");
      }

      const token = await this.generateToken(user.id, "access");

      return { token };
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  /**
   * Verify access token
   */
  async verifyToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error("Token has been revoked");
      }

      const decoded = (jwt as any).verify(token, this.jwtSecret) as {
        userId: string;
        email: string;
        type: string;
      };

      if (decoded.type !== "access") {
        throw new Error("Invalid token type");
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { email: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return {
        userId: decoded.userId,
        email: user.email,
      };
    } catch (error: unknown) {
      if (toErrorMessage(error) === "Token has been revoked") {
        throw error;
      }
      throw new Error("Invalid token");
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<{ userId: string }> {
    try {
      const decoded = (jwt as any).verify(token, this.jwtSecret) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      const isRevoked = await this.isRefreshTokenRevoked(token);
      if (isRevoked) {
        throw new Error("Refresh token has been revoked");
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return {
        userId: decoded.userId,
      };
    } catch (error: unknown) {
      if (toErrorMessage(error) === "Refresh token has been revoked") {
        throw error;
      }
      throw new Error("Invalid refresh token");
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  /**
   * Generate JWT token
   */
  private async generateToken(
    userId: string,
    type: "access" | "refresh",
  ): Promise<string> {
    const payload = {
      userId,
      type,
      timestamp: Date.now(),
    };

    const expiresIn = type === "access" ? "15m" : "7d";

    return (jwt as any).sign(payload, this.jwtSecret, { expiresIn });
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const isValid = await (bcrypt as any).compare(currentPassword, user.password!);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    const hashedPassword = await (bcrypt as any).hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return empty string but don't reveal if user exists
      return "";
    }

    const payload: JWTPayload = {
      userId: user.id,
      email,
      type: "reset" as const,
    };
    const resetToken = (jwt as any).sign(payload, this.jwtSecret, { expiresIn: "1h" });

    // Send password reset email
    await emailService.sendPasswordResetEmail(email, resetToken);

    return resetToken;
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const decoded = (jwt as any).verify(token, this.jwtSecret) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== "reset") {
        throw new Error("Invalid reset token");
      }

      const hashedPassword = await (bcrypt as any).hash(newPassword, 12);

      await prisma.user.update({
        where: { id: decoded.userId },
        data: { password: hashedPassword },
      });
    } catch (error) {
      throw new Error("Invalid or expired reset token");
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  /**
   * Create OAuth user (no password required)
   */
  async createOAuthUser(data: {
    email: string;
    name?: string;
    provider: string;
  }) {
    return await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        emailVerified: new Date(),
        password: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  /**
   * Login OAuth user (no password check)
   */
  async loginOAuth(email: string): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const token = await this.generateToken(user.id, "access");
    const refreshToken = await this.generateToken(user.id, "refresh");

    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Issue a new access + refresh token pair (e.g. after MFA verification).
   */
  async issueAccessAndRefreshTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = await this.generateToken(userId, "access");
    const refreshToken = await this.generateToken(userId, "refresh");
    await this.storeRefreshToken(userId, refreshToken);
    return { accessToken, refreshToken };
  }

  /**
   * Cleanup expired tokens from blacklist and refresh_tokens table
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpiredTokens(): Promise<{
    blacklistDeleted: number;
    refreshDeleted: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const blacklistResult = await pool.query(
      `DELETE FROM token_blacklist WHERE "expiresAt" < $1`,
      [now],
    );

    const refreshResult = await pool.query(
      `DELETE FROM refresh_tokens WHERE expires_at < $1 OR (revoked = true AND created_at < $2)`,
      [now, oneDayAgo],
    );

    return {
      blacklistDeleted: blacklistResult.rowCount || 0,
      refreshDeleted: refreshResult.rowCount || 0,
    };
  }
}

export const authService = new AuthService();
